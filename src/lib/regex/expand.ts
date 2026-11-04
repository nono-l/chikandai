/** A practical Japanese range. `inner` is spliced into an existing character class. */
type Expansion = {
  inner: string
  outer: string
  neg?: string
}

const HIRAGANA: Expansion = {
  inner: "\\p{Script=Hiragana}",
  outer: "\\p{Script=Hiragana}",
  neg: "Script=Hiragana",
}

const KATAKANA: Expansion = {
  inner: "ァ-ヺーヽヾ",
  outer: "[ァ-ヺーヽヾ]",
  neg: "Script=Katakana",
}

const HALF_KANA: Expansion = {
  inner: "ｦ-ﾟ",
  outer: "[ｦ-ﾟ]",
}

const KANJI: Expansion = {
  inner: "\\p{Script=Han}〆",
  outer: "(?:\\p{Script=Han}|〆)",
  neg: "Script=Han",
}

const FULL_UPPER: Expansion = { inner: "Ａ-Ｚ", outer: "[Ａ-Ｚ]" }
const FULL_LOWER: Expansion = { inner: "ａ-ｚ", outer: "[ａ-ｚ]" }
const FULL_DIGIT: Expansion = { inner: "０-９", outer: "[０-９]" }

/** One emoji grapheme: ZWJ sequences, skin tones, variation selectors, flags, keycaps. */
const EMOJI =
  "(?:\\p{Extended_Pictographic}\\p{Emoji_Modifier}?(?:\\uFE0F|\\uFE0E)?(?:\\u200D\\p{Extended_Pictographic}\\p{Emoji_Modifier}?(?:\\uFE0F|\\uFE0E)?)*|\\p{Regional_Indicator}{2}|[0-9#*]\\uFE0F?\\u20E3)"

const EMOJI_EXP: Expansion = {
  inner: "\\p{Extended_Pictographic}",
  outer: EMOJI,
  neg: "Extended_Pictographic",
}

const PAIRS = new Map<string, Expansion>([
  ["あん", HIRAGANA],
  ["ぁん", HIRAGANA],
  ["アン", KATAKANA],
  ["ァン", KATAKANA],
  ["ｱﾝ", HALF_KANA],
  ["ＡＺ", FULL_UPPER],
  ["ａｚ", FULL_LOWER],
  ["０９", FULL_DIGIT],
  ["一龠", KANJI],
])

const ALIASES: Record<string, Expansion> = {
  ひらがな: HIRAGANA,
  カタカナ: KATAKANA,
  半角カナ: HALF_KANA,
  漢字: KANJI,
  絵文字: EMOJI_EXP,
}

const DASHES = new Set(["-", "－", "〜", "～"])

export type ExpandedPattern = {
  pattern: string
  changed: boolean
}

function at(input: string, index: number): { char: string; next: number } | null {
  if (index >= input.length) return null
  const code = input.codePointAt(index)
  if (code === undefined) return null
  const char = String.fromCodePoint(code)
  return { char, next: index + char.length }
}

function readEscape(
  input: string,
  index: number,
  inClass: boolean,
): { text: string; next: number; changed: boolean } {
  const mark = index + 1
  if (mark >= input.length) return { text: "\\", next: input.length, changed: false }
  const id = input[mark]
  if ((id === "p" || id === "P") && input[mark + 1] === "{") {
    const close = input.indexOf("}", mark + 2)
    if (close !== -1) {
      const name = input.slice(mark + 2, close)
      const alias = ALIASES[name]
      if (alias && id === "p") {
        return { text: inClass ? alias.inner : alias.outer, next: close + 1, changed: true }
      }
      if (alias?.neg && id === "P") {
        return { text: `\\P{${alias.neg}}`, next: close + 1, changed: true }
      }
      return { text: input.slice(index, close + 1), next: close + 1, changed: false }
    }
  }
  if (id === "u" && input[mark + 1] === "{") {
    const close = input.indexOf("}", mark + 2)
    if (close !== -1) return { text: input.slice(index, close + 1), next: close + 1, changed: false }
  }
  if (id === "u" && /^[0-9a-fA-F]{4}/.test(input.slice(mark + 1, mark + 5))) {
    return { text: input.slice(index, mark + 5), next: mark + 5, changed: false }
  }
  if (id === "x" && /^[0-9a-fA-F]{2}/.test(input.slice(mark + 1, mark + 3))) {
    return { text: input.slice(index, mark + 3), next: mark + 3, changed: false }
  }
  const escaped = at(input, mark)
  if (!escaped) return { text: "\\", next: input.length, changed: false }
  if (!inClass && escaped.char === "-") return { text: "-", next: escaped.next, changed: true }
  return { text: `\\${escaped.char}`, next: escaped.next, changed: false }
}

export function expandPattern(input: string): ExpandedPattern {
  let index = 0
  let out = ""
  let changed = false
  let inClass = false
  let atClassStart = false

  while (index < input.length) {
    if (input[index] === "\\") {
      const escaped = readEscape(input, index, inClass)
      out += escaped.text
      index = escaped.next
      changed = changed || escaped.changed
      atClassStart = false
      continue
    }

    const current = at(input, index)
    if (!current) break

    if (!inClass && current.char === "[") {
      inClass = true
      atClassStart = true
      out += current.char
      index = current.next
      continue
    }

    if (inClass && current.char === "]" && !atClassStart) {
      inClass = false
      out += current.char
      index = current.next
      continue
    }

    if (inClass && atClassStart && current.char === "^") {
      out += current.char
      index = current.next
      continue
    }

    const dash = at(input, current.next)
    const end = dash ? at(input, dash.next) : null
    if (dash && end && DASHES.has(dash.char)) {
      const spec = PAIRS.get(current.char + end.char)
      if (spec) {
        out += inClass ? spec.inner : spec.outer
        index = end.next
        changed = true
        atClassStart = false
        continue
      }
    }

    out += current.char
    index = current.next
    atClassStart = false
  }

  return { pattern: out, changed }
}

export function withUnicodeFlag(source: string, flags: string): { flags: string; added: boolean } {
  if (flags.includes("u") || flags.includes("v")) return { flags, added: false }
  let nonBmp = false
  for (const char of source) {
    if ((char.codePointAt(0) ?? 0) > 0xffff) {
      nonBmp = true
      break
    }
  }
  if (nonBmp || /\\[pP]\{/.test(source)) return { flags: `${flags}u`, added: true }
  return { flags, added: false }
}
