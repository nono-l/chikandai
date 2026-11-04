import assert from "node:assert/strict"
import test from "node:test"
import { newShareId, parseShareBody, parseShareId } from "./share-body.ts"

test("share body keeps only rule fields and a short name", () => {
  const parsed = parseShareBody({
    name: "  日付  ",
    rules: [{ pattern: "a", replacement: "b", flags: "gix!", literal: true, enabled: false, label: "一" }],
  })
  assert.ok(!("error" in parsed))
  if ("error" in parsed) return
  assert.equal(parsed.name, "日付")
  assert.deepEqual(parsed.rules[0], {
    label: "一",
    enabled: false,
    pattern: "a",
    flags: "gi",
    replacement: "b",
    literal: true,
    dictionary: "",
  })
})

test("share id is a short token and rejects anything else", () => {
  const id = newShareId()
  assert.match(id, /^[A-Za-z0-9_-]{8,32}$/)
  assert.equal(parseShareId({ id }), id)
  assert.equal(parseShareId({ id: "../rules" }), null)
  assert.equal(parseShareId({ id: "" }), null)
})

test("empty share is refused", () => {
  const parsed = parseShareBody({ rules: [] })
  assert.equal("error" in parsed && parsed.error, "規則がありません")
})
