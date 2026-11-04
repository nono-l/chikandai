const MAX_ENTRIES = 400

export type DictionaryRow = { key: string; value: string }

export function parseDictionary(source: string): { map: Map<string, string> } | { error: string } {
  const map = new Map<string, string>()
  const lines = source.split("\n")
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/\r$/, "")
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue
    const split = splitEntry(line)
    if (!split) return { error: `辞書の${index + 1}行目は キー=値 にしてください` }
    const key = split[0].trim()
    const value = split[1].trim()
    if (key === "") continue
    if (map.size >= MAX_ENTRIES && !map.has(key)) return { error: `辞書は${MAX_ENTRIES}語までです` }
    map.set(key, value)
  }
  return { map }
}

function splitEntry(line: string): [string, string] | null {
  const tab = line.indexOf("\t")
  if (tab >= 0) return [line.slice(0, tab), line.slice(tab + 1)]
  const arrow = line.indexOf("→")
  if (arrow >= 0) return [line.slice(0, arrow), line.slice(arrow + 1)]
  const asciiArrow = line.indexOf("->")
  if (asciiArrow >= 0) return [line.slice(0, asciiArrow), line.slice(asciiArrow + 2)]
  const wide = line.indexOf("＝")
  if (wide >= 0) return [line.slice(0, wide), line.slice(wide + 1)]
  const equal = line.indexOf("=")
  if (equal >= 0) return [line.slice(0, equal), line.slice(equal + 1)]
  return null
}

export function patternFromDictionary(
  source: string,
  group?: string,
): { pattern: string; replacement: string } | { error: string } {
  const parsed = parseDictionary(source)
  if ("error" in parsed) return parsed
  if (parsed.map.size === 0) return { error: "辞書が空です" }
  const name = group?.trim() ?? ""
  if (name && !/^[\p{L}_][\p{L}\p{N}_]*$/u.test(name)) return { error: "グループ名に使えない文字があります" }
  const keys = [...parsed.map.keys()].sort((a, b) => b.length - a.length || (a < b ? -1 : 1))
  const body = keys.map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
  const pattern = name ? `^(?<${name}>${body})$` : `^(?:${body})$`
  if (pattern.length > 20_000) return { error: "辞書が長すぎてパターンにできません" }
  return { pattern, replacement: name ? `\${辞書($<${name}>)}` : "${辞書($&)}" }
}

export function dictionaryRows(source: string): DictionaryRow[] {
  if (source.trim() === "") return []
  return source.split("\n").flatMap((line) => {
    const cleaned = line.replace(/\r$/, "")
    if (cleaned.trim() === "" || cleaned.trimStart().startsWith("#")) return []
    const split = splitEntry(cleaned)
    if (!split) return [{ key: cleaned.trim(), value: "" }]
    return [{ key: split[0].trim(), value: split[1].trim() }]
  })
}

export function serializeDictionary(rows: DictionaryRow[]): string {
  return rows
    .filter((row) => row.key !== "" || row.value !== "")
    .map((row) => `${row.key}\t${row.value}`)
    .join("\n")
}
