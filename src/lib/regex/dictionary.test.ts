import assert from "node:assert/strict"
import test from "node:test"
import { patternFromDictionary } from "./dictionary.ts"
import { applyRule } from "./engine.ts"
import type { Rule } from "./types.ts"

function rule(partial: Partial<Rule> & Pick<Rule, "pattern" | "replacement" | "dictionary">): Rule {
  return { id: "r", label: "", enabled: true, flags: "gu", literal: false, ...partial }
}

test("named group values are replaced from the rule dictionary", () => {
  const step = applyRule(
    "東京と大阪府",
    rule({
      pattern: "(?<語>東京都|東京|大阪)",
      replacement: "${辞書($<語>)}",
      dictionary: "東京=Tokyo\n大阪=Osaka\n東京都=Capital",
    }),
  )
  assert.equal(step.text, "TokyoとOsaka府")
  assert.equal(step.sample?.rendered, "Tokyo")
})

test("dictionary keys stay literal, including leading zeros", () => {
  const step = applyRule(
    "番号001です",
    rule({
      pattern: "(?<code>\\d+)",
      replacement: "${辞書($<code>)}",
      dictionary: "001=りんご\n1=みかん",
    }),
  )
  assert.equal(step.text, "番号りんごです")
})

test("a missing dictionary entry keeps the captured text unless a fallback is given", () => {
  const kept = applyRule("b", rule({ pattern: "(?<語>b)", replacement: "${辞書($<語>)}", dictionary: "a=A" }))
  assert.equal(kept.text, "b")
  const fallback = applyRule("b", rule({
    pattern: "(?<語>b)",
    replacement: '${辞書($<語>, "無")}',
    dictionary: "a=A",
  }))
  assert.equal(fallback.text, "無")
})

test("exact line match uses the dictionary and leaves partial lines", () => {
  const built = patternFromDictionary("東京=A\n東京都=B\na.b=c")
  assert.ok(!("error" in built))
  if ("error" in built) return
  assert.match(built.pattern, /^\^\(\?:/)
  assert.match(built.pattern, /東京都\|東京|東京\|東京都/)
  assert.match(built.pattern, /a\\\.b/)
  assert.equal(built.replacement, "${辞書($&)}")
  const step = applyRule(
    "東京都\n東京\n東京です",
    rule({
      pattern: built.pattern,
      flags: "gmu",
      replacement: built.replacement,
      dictionary: "東京=A\n東京都=B",
    }),
  )
  assert.equal(step.text, "B\nA\n東京です")
})

test("a broken dictionary line stops the rule", () => {
  const step = applyRule("a", rule({ pattern: "a", replacement: "b", dictionary: "キーだけ" }))
  assert.match(step.error ?? "", /1行目/)
  assert.equal(step.text, "a")
})
