import { z } from "zod"
import { sanitizeFlags } from "./engine.ts"
import type { RuleDraft } from "./xml"

export const SHARE_DAYS = 7
const MAX_RULES = 40
const MAX_TEXT = 8_000
const MAX_DICTIONARY = 20_000

const ruleSchema = z.object({
  label: z.string().optional(),
  enabled: z.boolean().optional(),
  pattern: z.string(),
  flags: z.string().optional(),
  replacement: z.string(),
  literal: z.boolean().optional(),
  dictionary: z.string().optional(),
})

const bodySchema = z.object({
  name: z.string().optional(),
  rules: z.array(ruleSchema),
})

export function parseShareBody(input: unknown): { name: string; rules: RuleDraft[] } | { error: string } {
  const parsed = bodySchema.safeParse(input)
  if (!parsed.success) return { error: "共有の形式が違います" }
  if (parsed.data.rules.length === 0) return { error: "規則がありません" }
  if (parsed.data.rules.length > MAX_RULES) return { error: `規則は${MAX_RULES}件まで共有できます` }
  const rules: RuleDraft[] = []
  for (const [index, rule] of parsed.data.rules.entries()) {
    if (rule.pattern.length === 0) return { error: `${index + 1}件目のパターンが空です` }
    if (rule.pattern.length > MAX_TEXT || rule.replacement.length > MAX_TEXT) {
      return { error: `${index + 1}件目が長すぎます` }
    }
    if ((rule.dictionary ?? "").length > MAX_DICTIONARY) return { error: `${index + 1}件目の辞書が長すぎます` }
    rules.push({
      label: (rule.label ?? "").slice(0, 80),
      enabled: rule.enabled !== false,
      pattern: rule.pattern,
      flags: sanitizeFlags(rule.flags ?? "gu") || "gu",
      replacement: rule.replacement,
      literal: rule.literal === true,
      dictionary: rule.dictionary ?? "",
    })
  }
  const name = (parsed.data.name ?? "").trim().slice(0, 80) || "共有された規則"
  return { name, rules }
}

export function parseShareId(input: unknown): string | null {
  if (!input || typeof input !== "object") return null
  const id = (input as { id?: unknown }).id
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{8,32}$/.test(id)) return null
  return id
}

export function newShareId(): string {
  const bytes = new Uint8Array(9)
  crypto.getRandomValues(bytes)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}
