import type { Rule } from "./types"

export type RuleDraft = Omit<Rule, "id">

type El = {
  name: string
  attrs: Record<string, string>
  text: string
  children: El[]
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "\u0026amp;")
    .replaceAll("<", "\u0026lt;")
    .replaceAll(">", "\u0026gt;")
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[A-Za-z]+);/g, (all, body: string) => {
    if (body[0] !== "#") {
      if (body === "amp") return "&"
      if (body === "lt") return "<"
      if (body === "gt") return ">"
      if (body === "quot") return '"'
      if (body === "apos") return "'"
      return all
    }
    const code = body[1] === "x" || body[1] === "X" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10)
    if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return all
    return String.fromCodePoint(code)
  })
}

export function rulesToXml(rules: Rule[]): string {
  const lines = rules.map((rule) => {
    const enabled = rule.enabled ? "true" : "false"
    const literal = rule.literal ? "true" : "false"
    return [
      `  <rule enabled="${enabled}" literal="${literal}">`,
      `    <label>${escapeXml(rule.label)}</label>`,
      `    <pattern>${escapeXml(rule.pattern)}</pattern>`,
      `    <flags>${escapeXml(rule.flags)}</flags>`,
      `    <replacement>${escapeXml(rule.replacement)}</replacement>`,
      rule.dictionary ? `    <dictionary>${escapeXml(rule.dictionary)}</dictionary>` : "",
      "  </rule>",
    ].filter((line) => line !== "").join("\n")
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rules>\n${lines.join("\n")}\n</rules>\n`
}

class Reader {
  index = 0
  source: string

  constructor(source: string) {
    this.source = source
  }

  get rest(): string {
    return this.source.slice(this.index)
  }

  done(): boolean {
    return this.index >= this.source.length
  }

  starts(token: string): boolean {
    return this.source.startsWith(token, this.index)
  }

  peek(): string {
    return this.source[this.index] ?? ""
  }
}

function skipSpace(reader: Reader) {
  while (reader.peek() && /\s/.test(reader.peek())) reader.index += 1
}

function parseName(reader: Reader): string | null {
  const match = /^[A-Za-z_:][\w:.-]*/.exec(reader.rest)
  if (!match) return null
  reader.index += match[0].length
  return match[0]
}

function parseAttrs(reader: Reader): Record<string, string> | string {
  const attrs: Record<string, string> = {}
  for (;;) {
    skipSpace(reader)
    if (reader.peek() === "/" || reader.peek() === ">" || reader.peek() === "") break
    const name = parseName(reader)
    if (!name) return "属性の名前が読めません"
    skipSpace(reader)
    if (reader.peek() !== "=") return "属性は引用符で書いてください"
    reader.index += 1
    skipSpace(reader)
    const quote = reader.peek()
    if (quote !== '"' && quote !== "'") return "属性は引用符で書いてください"
    reader.index += 1
    const start = reader.index
    const end = reader.source.indexOf(quote, start)
    if (end < 0) return "属性の引用符が閉じていません"
    attrs[name] = decodeEntities(reader.source.slice(start, end))
    reader.index = end + 1
  }
  return attrs
}

function parseElement(reader: Reader): El | string {
  if (!reader.starts("<")) return "タグがありません"
  reader.index += 1
  const name = parseName(reader)
  if (!name) return "タグの名前が読めません"
  const attrs = parseAttrs(reader)
  if (typeof attrs === "string") return attrs
  const element: El = { name, attrs, text: "", children: [] }
  if (reader.starts("/>")) {
    reader.index += 2
    return element
  }
  if (reader.peek() !== ">") return "タグが閉じていません"
  reader.index += 1
  const closed = readChildren(reader, element)
  if (typeof closed === "string") return closed
  return element
}

function readChildren(reader: Reader, parent: El): true | string {
  while (!reader.done()) {
    if (reader.starts(`</`)) {
      reader.index += 2
      const name = parseName(reader)
      skipSpace(reader)
      if (reader.peek() !== ">") return "閉じタグが壊れてます"
      reader.index += 1
      if (name !== parent.name) return `<${parent.name}> の閉じタグが合いません`
      return true
    }
    if (reader.starts("<![CDATA[")) {
      const start = reader.index + 9
      const end = reader.source.indexOf("]]>", start)
      if (end < 0) return "CDATA が閉じていません"
      parent.text += reader.source.slice(start, end)
      reader.index = end + 3
      continue
    }
    if (reader.starts("<!--")) {
      const end = reader.source.indexOf("-->", reader.index + 4)
      if (end < 0) return "コメントが閉じていません"
      reader.index = end + 3
      continue
    }
    if (reader.starts("<?")) {
      const end = reader.source.indexOf("?>", reader.index + 2)
      if (end < 0) return "XML宣言が閉じていません"
      reader.index = end + 2
      continue
    }
    if (reader.starts("<!")) return "DOCTYPE は使えません"
    if (reader.starts("<")) {
      const child = parseElement(reader)
      if (typeof child === "string") return child
      parent.children.push(child)
      continue
    }
    const next = reader.source.indexOf("<", reader.index)
    const end = next < 0 ? reader.source.length : next
    parent.text += decodeEntities(reader.source.slice(reader.index, end))
    reader.index = end
    if (next < 0) return `<${parent.name}> が閉じていません`
  }
  return `<${parent.name}> が閉じていません`
}

function parseRoot(source: string): El | string {
  const reader = new Reader(source.replace(/^\uFEFF/, ""))
  let root: El | null = null
  while (!reader.done()) {
    skipSpace(reader)
    if (reader.done()) break
    if (reader.starts("<?")) {
      const end = reader.source.indexOf("?>", reader.index + 2)
      if (end < 0) return "XML宣言が閉じていません"
      reader.index = end + 2
      continue
    }
    if (reader.starts("<!--")) {
      const end = reader.source.indexOf("-->", reader.index + 4)
      if (end < 0) return "コメントが閉じていません"
      reader.index = end + 3
      continue
    }
    if (reader.starts("<!")) return "DOCTYPE は使えません"
    if (!reader.starts("<")) return "XMLとして読めません"
    if (root) return "ルート要素は一つにしてください"
    const element = parseElement(reader)
    if (typeof element === "string") return element
    root = element
  }
  if (!root) return "XMLとして読めません"
  return root
}

function innerText(element: El): string {
  let text = element.text
  for (const child of element.children) text += innerText(child)
  return text
}

function child(element: El, name: string): El | undefined {
  return element.children.find((item) => item.name === name)
}

function truthy(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  const token = value.trim().toLowerCase()
  if (token === "true" || token === "1" || token === "yes") return true
  if (token === "false" || token === "0" || token === "no") return false
  return fallback
}

function field(element: El, name: string, fallback?: string): string | undefined {
  const node = child(element, name)
  if (node) return innerText(node)
  if (name in element.attrs) return element.attrs[name]
  return fallback
}

function toDraft(element: El, index: number): RuleDraft | string {
  const pattern = field(element, "pattern")
  if (pattern === undefined) return `${index + 1}件目の規則にパターンがありません`
  const enabled = truthy(field(element, "enabled", element.attrs.enabled), true)
  const literal = truthy(field(element, "literal", element.attrs.literal), false)
  return {
    label: field(element, "label", "") ?? "",
    enabled,
    pattern,
    flags: field(element, "flags", "gu") ?? "gu",
    replacement: field(element, "replacement", "") ?? "",
    literal,
    dictionary: field(element, "dictionary", "") ?? "",
  }
}

export function rulesFromXml(source: string): { rules: RuleDraft[] } | { error: string } {
  const root = parseRoot(source.trim())
  if (typeof root === "string") return { error: root }
  if (root.name !== "rules") return { error: "ルートは rules にしてください" }
  const nodes = root.children.filter((item) => item.name === "rule")
  if (nodes.length === 0) return { error: "規則がありません" }
  const rules: RuleDraft[] = []
  for (let index = 0; index < nodes.length; index += 1) {
    const draft = toDraft(nodes[index], index)
    if (typeof draft === "string") return { error: draft }
    rules.push(draft)
  }
  return { rules }
}
