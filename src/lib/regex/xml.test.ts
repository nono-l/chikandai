import assert from "node:assert/strict"
import test from "node:test"
import type { Rule } from "./types"
import { rulesFromXml, rulesToXml } from "./xml.ts"

function rule(patch: Partial<Rule> = {}): Rule {
  return {
    id: "rule-1",
    label: "括る",
    enabled: true,
    pattern: "あ-ん+",
    flags: "gu",
    replacement: "「$&」",
    literal: false,
    dictionary: "",
    ...patch,
  }
}

test("xml round-trips rules, including markup and newlines", () => {
  const xml = rulesToXml([
    rule({
      enabled: false,
      literal: true,
      pattern: "a < b & c",
      replacement: "次\n行",
      flags: "gi",
      label: '名"前',
    }),
  ])
  const parsed = rulesFromXml(xml)
  assert.ok(!("error" in parsed))
  if ("error" in parsed) return
  assert.equal(parsed.rules.length, 1)
  assert.deepEqual(parsed.rules[0], {
    label: '名"前',
    enabled: false,
    pattern: "a < b & c",
    flags: "gi",
    replacement: "次\n行",
    literal: true,
    dictionary: "",
  })
})

test("xml accepts attributes, cdata, and numeric entities", () => {
  const parsed = rulesFromXml(`<?xml version="1.0"?>
    <rules>
      <rule pattern="a" replacement="b" enabled="false"/>
      <rule>
        <pattern><![CDATA[a<b&c]]></pattern>
        <replacement>&#x2605;</replacement>
      </rule>
    </rules>`)
  assert.ok(!("error" in parsed))
  if ("error" in parsed) return
  assert.equal(parsed.rules[0].pattern, "a")
  assert.equal(parsed.rules[0].replacement, "b")
  assert.equal(parsed.rules[0].enabled, false)
  assert.equal(parsed.rules[0].flags, "gu")
  assert.equal(parsed.rules[1].pattern, "a<b&c")
  assert.equal(parsed.rules[1].replacement, "★")
})

test("xml rejects a document that is not a rule list", () => {
  const pack = rulesFromXml("<pack/>")
  const empty = rulesFromXml("<rules></rules>")
  const missing = rulesFromXml("<rules><rule><replacement>x</replacement></rule></rules>")
  const doctype = rulesFromXml("<!DOCTYPE rules [<!ENTITY x 'y'>]><rules/>")
  assert.equal("error" in pack && pack.error, "ルートは rules にしてください")
  assert.equal("error" in empty && empty.error, "規則がありません")
  assert.equal("error" in missing && missing.error, "1件目の規則にパターンがありません")
  assert.match("error" in doctype ? doctype.error : "", /DOCTYPE/)
})
