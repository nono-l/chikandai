import { z } from "zod"
import { uid } from "../workspace-store"
import type { Pack, Rule, TestCase } from "./types"

const ruleSchema = z.object({
  label: z.string().optional(),
  enabled: z.boolean().optional(),
  pattern: z.string(),
  flags: z.string().optional(),
  replacement: z.string(),
  literal: z.boolean().optional(),
  dictionary: z.string().optional(),
})

const testSchema = z.object({
  name: z.string().optional(),
  input: z.string(),
  expected: z.string().optional(),
})

const packSchema = z.object({
  name: z.string().optional(),
  rules: z.array(ruleSchema),
  tests: z.array(testSchema).optional(),
})

const bundleSchema = z.object({
  kind: z.literal("chikandai-bundle").optional(),
  packs: z.array(packSchema),
})

function toRule(value: z.infer<typeof ruleSchema>): Rule {
  return {
    id: uid("rule"),
    label: value.label ?? "",
    enabled: value.enabled !== false,
    pattern: value.pattern,
    flags: value.flags ?? "gu",
    replacement: value.replacement,
    literal: value.literal === true,
    dictionary: value.dictionary ?? "",
  }
}

function toTest(value: z.infer<typeof testSchema>): TestCase {
  return {
    id: uid("test"),
    name: value.name ?? "",
    input: value.input,
    expected: value.expected ?? "",
  }
}

function toPack(value: z.infer<typeof packSchema>, fallbackName: string): Pack {
  return {
    id: uid("pack"),
    name: value.name?.trim() || fallbackName,
    rules: value.rules.map(toRule),
    tests: (value.tests ?? []).map(toTest),
    updatedAt: Date.now(),
  }
}

function packBody(pack: Pack) {
  return {
    name: pack.name,
    rules: pack.rules.map(({ label, enabled, pattern, flags, replacement, literal, dictionary }) => ({
      label,
      enabled,
      pattern,
      flags,
      replacement,
      literal,
      dictionary,
    })),
    tests: pack.tests.map(({ name, input, expected }) => ({ name, input, expected })),
  }
}

export function serializePack(pack: Pack): string {
  return JSON.stringify({ kind: "chikandai-pack", version: 1, ...packBody(pack) }, null, 2)
}

export function serializeBundle(packs: Pack[]): string {
  return JSON.stringify(
    { kind: "chikandai-bundle", version: 1, packs: packs.map(packBody) },
    null,
    2,
  )
}

export function parseTransfer(raw: string): { packs: Pack[] } | { error: string } {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { error: "JSONとして読めません" }
  }
  const bundle = bundleSchema.safeParse(data)
  if (bundle.success && bundle.data.packs.length > 0 && Array.isArray((data as { packs?: unknown }).packs)) {
    return {
      packs: bundle.data.packs.map((pack, index) => toPack(pack, `読み込んだ帳 ${index + 1}`)),
    }
  }
  const single = packSchema.safeParse(data)
  if (single.success && Array.isArray((data as { rules?: unknown }).rules)) {
    return { packs: [toPack(single.data, "読み込んだ帳")] }
  }
  return { error: "帳の形式ではありません" }
}
