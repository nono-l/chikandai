import { expandPattern, withUnicodeFlag } from "./expand.ts"
import { parseDictionary } from "./dictionary.ts"
import { contextFromReplace, renderReplacement } from "./formula.ts"
import type {
  GroupChip,
  JobRequest,
  JobResponse,
  MatchSample,
  Rule,
  StepInfo,
  TestCase,
  TestInfo,
} from "./types"

const MAX_MATCHES = 100_000
const MAX_TEXT = 1_000_000

const FLAG_CHARS = "gimsuy"

export function sanitizeFlags(flags: string): string {
  let out = ""
  for (const c of flags) {
    if (FLAG_CHARS.includes(c) && !out.includes(c)) out += c
  }
  return out
}

export function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function literalReplacement(replacement: string): string {
  return replacement.replace(/\$/g, "$$$$")
}

function patternOf(rule: Rule): { source: string; changed: boolean } {
  if (rule.literal) return { source: escapeRegExp(rule.pattern), changed: false }
  const expanded = expandPattern(rule.pattern)
  return { source: expanded.pattern, changed: expanded.changed }
}

function replacementOf(rule: Rule): string {
  return rule.literal ? literalReplacement(rule.replacement) : rule.replacement
}

function tryCompile(source: string, flags: string): RegExp | string {
  try {
    return new RegExp(source, flags)
  } catch (error) {
    return error instanceof Error ? error.message : "不正なパターン"
  }
}

function compile(source: string, flags: string): { re: RegExp; flags: string; unicodeAdded: boolean } | string {
  const hinted = withUnicodeFlag(source, flags)
  const first = tryCompile(source, hinted.flags)
  if (first instanceof RegExp) return { re: first, flags: hinted.flags, unicodeAdded: hinted.added }
  if (!hinted.flags.includes("u") && !hinted.flags.includes("v")) {
    const second = tryCompile(source, `${hinted.flags}u`)
    if (second instanceof RegExp) return { re: second, flags: `${hinted.flags}u`, unicodeAdded: true }
  }
  return first
}

function firstSample(text: string, source: string, flags: string): MatchSample | undefined {
  const probeFlags = flags.replaceAll("g", "").replaceAll("y", "")
  const re = compile(source, probeFlags)
  if (typeof re === "string") return
  const match = re.re.exec(text)
  if (!match) return
  const groups: GroupChip[] = []
  for (let i = 1; i < match.length; i++) {
    groups.push({ key: `$${i}`, value: match[i] ?? "" })
  }
  if (match.groups) {
    for (const [name, value] of Object.entries(match.groups)) {
      groups.push({ key: `$<${name}>`, value: value ?? "" })
    }
  }
  return { full: match[0], index: match.index, groups }
}

function countMatches(text: string, source: string, flags: string): number | string {
  const globalFlags = flags.includes("g") ? flags : `${flags}g`
  const re = compile(source, globalFlags)
  if (typeof re === "string") return re
  let count = 0
  for (const _match of text.matchAll(re.re)) {
    count += 1
    if (count > MAX_MATCHES) return "一致が10万件を超えたため止めました"
  }
  return flags.includes("g") ? count : Math.min(count, 1)
}

export function applyRule(
  text: string,
  rule: Rule,
): {
  text: string
  count: number
  skipped: boolean
  error?: string
  sample?: MatchSample
  expanded?: string
  unicodeAdded?: boolean
} {
  if (!rule.enabled) return { text, count: 0, skipped: true }
  if (rule.pattern.length === 0) {
    return { text, count: 0, skipped: false, error: "パターンが空です" }
  }
  const dictionary = parseDictionary(rule.dictionary ?? "")
  if ("error" in dictionary) {
    return { text, count: 0, skipped: false, error: dictionary.error }
  }
  const prepared = patternOf(rule)
  const flags = sanitizeFlags(rule.flags)
  const compiled = compile(prepared.source, flags)
  const expanded = prepared.changed ? prepared.source : undefined
  if (typeof compiled === "string") {
    return { text, count: 0, skipped: false, error: `パターンを解釈できません。${compiled}`, expanded }
  }
  const sample = firstSample(text, prepared.source, compiled.flags)
  const counted = countMatches(text, prepared.source, compiled.flags)
  if (typeof counted === "string") {
    return { text, count: 0, skipped: false, error: counted, sample, expanded, unicodeAdded: compiled.unicodeAdded }
  }
  try {
    const now = new Date()
    let nth = 0
    let rendered: string | undefined
    const next = rule.literal
      ? text.replace(compiled.re, replacementOf(rule))
      : text.replace(compiled.re, (full: string, ...rest: unknown[]) => {
          nth += 1
          const piece = renderReplacement(
            rule.replacement,
            contextFromReplace(full, rest, nth),
            now,
            dictionary.map,
          )
          rendered ??= piece
          return piece
        })
    if (sample && rendered !== undefined) sample.rendered = rendered
    return {
      text: next,
      count: counted,
      skipped: false,
      sample,
      expanded,
      unicodeAdded: compiled.unicodeAdded || undefined,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "置換に失敗しました"
    return { text, count: 0, skipped: false, error: message, sample, expanded, unicodeAdded: compiled.unicodeAdded }
  }
}

function applyAll(text: string, rules: Rule[]): { text: string; steps: StepInfo[]; error?: string } {
  let current = text
  const steps: StepInfo[] = []
  let error: string | undefined
  for (const rule of rules) {
    const step = applyRule(current, rule)
    if (step.error && !error) error = step.error
    steps.push({
      id: rule.id,
      skipped: step.skipped,
      error: step.error,
      count: step.count,
      sample: step.sample,
      expanded: step.expanded,
      unicodeAdded: step.unicodeAdded,
    })
    if (!step.error) current = step.text
  }
  return { text: current, steps, error }
}

function runTest(test: TestCase, rules: Rule[]): TestInfo {
  if (test.input.length === 0 && test.expected.length === 0) {
    return { id: test.id, output: "", pass: null }
  }
  if (test.input.length > MAX_TEXT) {
    return { id: test.id, output: "", error: "試験の原文が長すぎます", pass: false }
  }
  const applied = applyAll(test.input, rules)
  if (applied.error) {
    return { id: test.id, output: applied.text, error: applied.error, pass: false }
  }
  if (test.expected.length === 0) {
    return { id: test.id, output: applied.text, pass: null }
  }
  return { id: test.id, output: applied.text, pass: applied.text === test.expected }
}

export function runJob(job: JobRequest): JobResponse {
  if (job.source.length > MAX_TEXT) {
    return {
      requestId: job.requestId,
      output: job.source,
      steps: [],
      tests: [],
      fatal: "原文は100万文字までです",
    }
  }
  const applied = applyAll(job.source, job.rules)
  return {
    requestId: job.requestId,
    output: applied.text,
    steps: applied.steps,
    tests: job.tests.map((test) => runTest(test, job.rules)),
  }
}

export function totalReplacements(steps: StepInfo[]): number {
  return steps.reduce((sum, step) => sum + (step.error || step.skipped ? 0 : step.count), 0)
}
