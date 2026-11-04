import assert from "node:assert/strict"
import test from "node:test"
import { applyRule, runJob } from "./engine.ts"
import { SAMPLE_SOURCE, seedPacks } from "./presets.ts"
import type { Rule } from "./types.ts"

function rule(partial: Partial<Rule> & Pick<Rule, "pattern" | "replacement">): Rule {
  return {
    id: "r",
    label: "",
    enabled: true,
    flags: "gu",
    literal: false,
    dictionary: "",
    ...partial,
  }
}

test("named groups and numbered groups", () => {
  const named = applyRule(
    "納期は2026-11-03です",
    rule({
      pattern: String.raw`(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})`,
      replacement: "$<y>年$<m>月$<d>日",
    }),
  )
  assert.equal(named.text, "納期は2026年11月03日です")
  assert.equal(named.count, 1)
  assert.equal(named.sample?.groups.find((group) => group.key === "$<y>")?.value, "2026")

  const numbered = applyRule(
    "2025/7/1",
    rule({
      pattern: String.raw`(\d{4})/(\d{1,2})/(\d{1,2})`,
      replacement: "$1年$2月$3日",
    }),
  )
  assert.equal(numbered.text, "2025年7月1日")
})

test("pipeline skips disabled and bad rules without eating the text", () => {
  const job = runJob({
    requestId: 1,
    source: "a.b",
    rules: [
      rule({ id: "off", pattern: "a", replacement: "Z", enabled: false }),
      rule({ id: "bad", pattern: "(", replacement: "x" }),
      rule({ id: "dot", pattern: String.raw`\.`, replacement: "-" }),
    ],
    tests: [{ id: "t", name: "", input: "a.b", expected: "a-b" }],
  })
  assert.equal(job.output, "a-b")
  assert.equal(job.steps[0]?.skipped, true)
  assert.match(job.steps[1]?.error ?? "", /.+/)
  assert.equal(job.steps[2]?.count, 1)
  assert.equal(job.tests[0]?.output, "a-b")
  assert.equal(job.tests[0]?.pass, false)
})

test("literal mode does not treat the pattern as a regex", () => {
  const step = applyRule("a.b aab", rule({ pattern: "a.b", replacement: "Z", literal: true }))
  assert.equal(step.text, "Z aab")
  assert.equal(step.count, 1)
})

test("without g, only the first match changes", () => {
  const step = applyRule("aa", rule({ pattern: "a", replacement: "b", flags: "u" }))
  assert.equal(step.text, "ba")
  assert.equal(step.count, 1)
})

test("empty pattern is refused", () => {
  const step = applyRule("abc", rule({ pattern: "", replacement: "x" }))
  assert.equal(step.text, "abc")
  assert.equal(step.error, "パターンが空です")
})

test("japanese ranges and emoji shorthands", () => {
  const hira = applyRule("ぁっ漢字アァヴーｱﾝ", rule({ pattern: "あ-ん+", replacement: "[$&]" }))
  assert.equal(hira.text, "[ぁっ]漢字アァヴーｱﾝ")
  assert.match(hira.expanded ?? "", /Script=Hiragana/)

  const kata = applyRule("ァヴー漢字あｱ", rule({ pattern: "ア-ン+", replacement: "[$&]" }))
  assert.equal(kata.text, "[ァヴー]漢字あｱ")

  const half = applyRule("ｱﾝﾞ漢字ア", rule({ pattern: "ｱ-ﾝ+", replacement: "[$&]" }))
  assert.equal(half.text, "[ｱﾝﾞ]漢字ア")

  const wide = applyRule("１２３abcＡＢ", rule({ pattern: "０-９+", replacement: "N" }))
  assert.equal(wide.text, "NabcＡＢ")

  const kanji = applyRule("日本語々〆です", rule({ pattern: "一-龠+", replacement: "漢" }))
  assert.equal(kanji.text, "漢です")

  const group = applyRule("あい", rule({ pattern: "(あ〜ん+)", replacement: "<$1>" }))
  assert.equal(group.text, "<あい>")

  const literal = applyRule("あいう", rule({ pattern: "あ-ん", replacement: "X", literal: true }))
  assert.equal(literal.text, "あいう")
  assert.equal(literal.count, 0)

  const escaped = applyRule("あ-ん", rule({ pattern: String.raw`あ\-ん`, replacement: "Y" }))
  assert.equal(escaped.text, "Y")

  const ascii = applyRule("a-z", rule({ pattern: "a-z", replacement: "Q" }))
  assert.equal(ascii.text, "Q")
  const letters = applyRule("b", rule({ pattern: "[a-z]", replacement: "Q" }))
  assert.equal(letters.text, "Q")

  const emoji = applyRule("x👨‍👩‍👧‍👦y👍🏻z❤️w1️⃣", rule({
    pattern: String.raw`\p{絵文字}`,
    replacement: "E",
    flags: "g",
  }))
  assert.equal(emoji.text, "xEyEzEwE")
  assert.equal(emoji.unicodeAdded, true)

  const pictograph = applyRule("a😀b", rule({ pattern: "[😀]", replacement: "★", flags: "g" }))
  assert.equal(pictograph.text, "a★b")
})

test("seed packs match their trials and the sample manuscript", () => {
  const packs = seedPacks()
  for (const pack of packs) {
    const job = runJob({
      requestId: 1,
      source: "",
      rules: pack.rules,
      tests: pack.tests,
    })
    for (const result of job.tests) {
      assert.equal(result.pass, true, `${pack.name} ${result.id} → ${result.output}`)
    }
  }
  const sample = runJob({ requestId: 2, source: SAMPLE_SOURCE, rules: packs[0].rules, tests: [] })
  assert.match(sample.output, /2026年11月03日/)
  assert.match(sample.output, /2025年12月24日/)
  assert.match(sample.output, /2024年1月5日/)
  assert.equal(sample.steps[0]?.count, 3)
})
