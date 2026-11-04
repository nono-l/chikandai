import assert from "node:assert/strict"
import test from "node:test"
import { applyRule } from "./engine.ts"
import { renderReplacement, type MatchContext } from "./formula.ts"
import type { Rule } from "./types.ts"

const when = new Date(Date.UTC(2026, 10, 3, 15, 4, 5))

function ctx(patch: Partial<MatchContext> = {}): MatchContext {
  return {
    full: "3",
    numbered: ["3"],
    named: { m: "3", h: "9" },
    index: 0,
    input: "3",
    nth: 1,
    ...patch,
  }
}

function rule(partial: Partial<Rule> & Pick<Rule, "pattern" | "replacement">): Rule {
  return { id: "r", label: "", enabled: true, flags: "gu", literal: false, dictionary: "", ...partial }
}

test("pads a group and evaluates arithmetic on named groups", () => {
  assert.equal(renderReplacement("$1:3", ctx(), when), "003")
  assert.equal(renderReplacement("$<m:3>", ctx(), when), "003")
  assert.equal(renderReplacement("${桁($<m>, 3)}", ctx(), when), "003")
  assert.equal(renderReplacement("${$<h> * 60 + $<m>}", ctx(), when), "543")
  assert.equal(renderReplacement("${$<m> + 1}時", ctx(), when), "4時")
  const applied = applyRule("値3です", rule({ pattern: String.raw`(?<n>\d+)`, replacement: "${桁($<n>, 3)}" }))
  assert.equal(applied.text, "値003です")
  assert.equal(applied.sample?.rendered, "003")
})

test("numbers each match and keeps ordinary replacements", () => {
  const numbered = applyRule("a a", rule({ pattern: "a", replacement: "$回", flags: "g" }))
  assert.equal(numbered.text, "1 2")
  const plain = applyRule("2026-11-03", rule({
    pattern: String.raw`(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})`,
    replacement: "$<y>年$<m>月$<d>日",
  }))
  assert.equal(plain.text, "2026年11月03日")
  const literal = applyRule("x", rule({ pattern: "x", replacement: "$年", literal: true }))
  assert.equal(literal.text, "$年")
})

test("built-in clock is Japan time for one frozen instant", () => {
  const text = renderReplacement("$年-$月-$日 $時:$分:$秒 $曜日 $日付 $時刻", ctx(), when)
  assert.equal(text, "2026-11-4 0:4:5 水 2026-11-04 00:04:05")
  assert.equal(renderReplacement("$datetime", ctx(), when), "2026-11-04 00:04:05")
  assert.equal(renderReplacement("${$月 + 1}", ctx(), when), "12")
})

test("a broken formula stops that rule", () => {
  const step = applyRule("3", rule({ pattern: "3", replacement: "${$1 / 0}" }))
  assert.match(step.error ?? "", /0で割れません/)
  assert.equal(step.text, "3")
})
