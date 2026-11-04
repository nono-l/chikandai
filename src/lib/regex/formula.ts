export type MatchContext = {
  full: string
  numbered: string[]
  named: Record<string, string>
  index: number
  input: string
  nth: number
}

type Val = { kind: "n"; n: number } | { kind: "s"; s: string }

const ASCII_BUILTIN: { token: string; key: string }[] = [
  ["datetime", "日時"],
  ["weekday", "曜日"],
  ["minute", "分"],
  ["second", "秒"],
  ["month", "月"],
  ["epoch", "unix"],
  ["year", "年"],
  ["date", "日付"],
  ["time", "時刻"],
  ["hour", "時"],
  ["unix", "unix"],
  ["now", "日時"],
  ["day", "日"],
].map(([token, key]) => ({ token, key }))

const JA_BUILTIN = ["日時", "日付", "時刻", "曜日", "年", "月", "日", "時", "分", "秒"]

export function contextFromReplace(full: string, rest: unknown[], nth: number): MatchContext {
  const args = rest.slice()
  let named: Record<string, string> = {}
  const last = args[args.length - 1]
  if (last && typeof last === "object") {
    named = Object.fromEntries(
      Object.entries(last as Record<string, string | undefined>).map(([key, value]) => [key, value ?? ""]),
    )
    args.pop()
  }
  const input = String(args.pop() ?? "")
  const index = Number(args.pop() ?? 0)
  const numbered = args.map((value) => (value == null ? "" : String(value)))
  return { full, numbered, named, index, input, nth }
}

export function renderReplacement(
  template: string,
  ctx: MatchContext,
  now = new Date(),
  dictionary: ReadonlyMap<string, string> = new Map(),
): string {
  const clock = makeClock(now)
  let out = ""
  let i = 0
  while (i < template.length) {
    if (template[i] !== "$") {
      out += template[i]
      i += 1
      continue
    }
    if (template[i + 1] === "$") {
      out += "$"
      i += 2
      continue
    }
    if (template[i + 1] === "{") {
      const close = findClose(template, i + 2)
      if (close < 0) throw new Error("数式が閉じていません")
      out += evalFormula(template.slice(i + 2, close), ctx, clock, dictionary)
      i = close + 1
      continue
    }
    const ref = readRef(template, i, ctx, clock, false)
    if (!ref) {
      out += "$"
      i += 1
      continue
    }
    out += ref.text
    i = ref.next
  }
  return out
}

function makeClock(now: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(now)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "0"
  const bare = (value: string) => String(Number(value))
  const year = pick("year")
  const month = bare(pick("month"))
  const day = bare(pick("day"))
  const hour = bare(pick("hour"))
  const minute = bare(pick("minute"))
  const second = bare(pick("second"))
  const weekday = pick("weekday")
  const date = `${year}-${padRaw(month, 2)}-${padRaw(day, 2)}`
  const time = `${padRaw(hour, 2)}:${padRaw(minute, 2)}:${padRaw(second, 2)}`
  return {
    年: year,
    月: month,
    日: day,
    時: hour,
    分: minute,
    秒: second,
    曜日: weekday,
    日付: date,
    時刻: time,
    日時: `${date} ${time}`,
    unix: String(Math.floor(now.getTime() / 1000)),
  }
}

function findClose(template: string, start: number): number {
  let depth = 1
  for (let i = start; i < template.length; i += 1) {
    const char = template[i]
    if (char === '"') {
      i += 1
      while (i < template.length && template[i] !== '"') {
        if (template[i] === "\\") i += 1
        i += 1
      }
      continue
    }
    if (char === "{") depth += 1
    if (char === "}") {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

type Ref = { text: string; next: number; raw: string; missing: boolean }

function readRef(template: string, start: number, ctx: MatchContext, clock: Record<string, string>, inFormula: boolean): Ref | null {
  if (template[start] !== "$") return null
  const mark = start + 1
  if (template[mark] === "<") {
    const end = template.indexOf(">", mark + 1)
    if (end < 0) return null
    let name = template.slice(mark + 1, end)
    let innerWidth = 0
    const colon = name.lastIndexOf(":")
    if (colon > 0 && /^\d+$/.test(name.slice(colon + 1))) {
      innerWidth = Math.min(Number(name.slice(colon + 1)), 32)
      name = name.slice(0, colon)
    }
    if (!name) return null
    const known = Object.prototype.hasOwnProperty.call(ctx.named, name)
    const raw = known ? ctx.named[name] : ""
    const outer = takePad(template, end + 1)
    const width = outer || innerWidth
    if (!known && !inFormula) return null
    const span = outer ? padSpan(template, end + 1) : 0
    return {
      raw,
      text: width ? padRaw(raw, width) : raw,
      next: end + 1 + span,
      missing: !known,
    }
  }
  if (template[mark] === "&") {
    const padded = takePad(template, mark + 1)
    return {
      raw: ctx.full,
      text: padded ? padRaw(ctx.full, padded) : ctx.full,
      next: padded ? mark + 1 + padSpan(template, mark + 1) : mark + 1,
      missing: false,
    }
  }
  if (template[mark] === "`") return { raw: ctx.input.slice(0, ctx.index), text: ctx.input.slice(0, ctx.index), next: mark + 1, missing: false }
  if (template[mark] === "'") return { raw: ctx.input.slice(ctx.index + ctx.full.length), text: ctx.input.slice(ctx.index + ctx.full.length), next: mark + 1, missing: false }
  if (template[mark] >= "0" && template[mark] <= "9") {
    const second = template[mark + 1]
    const two = second >= "0" && second <= "9" ? Number(template.slice(mark, mark + 2)) : 0
    const one = Number(template[mark])
    let used = 0
    let raw = ""
    let missing = false
    if (two >= 1 && two <= ctx.numbered.length) {
      used = 2
      raw = ctx.numbered[two - 1]
    } else if (one >= 1 && one <= ctx.numbered.length) {
      used = 1
      raw = ctx.numbered[one - 1]
    } else if (inFormula) {
      used = two ? 2 : 1
      missing = true
    } else {
      return null
    }
    const at = mark + used
    const padded = takePad(template, at)
    return { raw, text: padded ? padRaw(raw, padded) : raw, next: padded ? at + padSpan(template, at) : at, missing }
  }
  if (template.startsWith("回", mark)) {
    const raw = String(ctx.nth)
    return { raw, text: raw, next: mark + 1, missing: false }
  }
  for (const name of JA_BUILTIN) {
    if (!template.startsWith(name, mark)) continue
    const raw = clock[name] ?? ""
    return { raw, text: raw, next: mark + name.length, missing: false }
  }
  for (const item of ASCII_BUILTIN) {
    if (!template.startsWith(item.token, mark)) continue
    const next = template[mark + item.token.length] ?? ""
    if (/[A-Za-z0-9_]/.test(next)) continue
    const raw = clock[item.key] ?? ""
    return { raw, text: raw, next: mark + item.token.length, missing: false }
  }
  return null
}

function takePad(template: string, index: number): number {
  if (template[index] !== ":") return 0
  const digits = /^\d+/.exec(template.slice(index + 1))
  if (!digits) return 0
  const width = Number(digits[0])
  if (!Number.isInteger(width) || width <= 0) return 0
  return Math.min(width, 32)
}

function padSpan(template: string, index: number): number {
  const digits = /^\d+/.exec(template.slice(index + 1))
  return 1 + (digits?.[0].length ?? 0)
}

function padRaw(value: string, width: number, fill = "0"): string {
  const negative = value.startsWith("-")
  const body = negative ? value.slice(1) : value
  const padded = body.padStart(width, fill)
  return negative ? `-${padded}` : padded
}

function evalFormula(
  source: string,
  ctx: MatchContext,
  clock: Record<string, string>,
  dictionary: ReadonlyMap<string, string>,
): string {
  const substituted = substitute(source, ctx, clock)
  if (substituted.trim() === "") throw new Error("数式が空です")
  const parser = new Parser(substituted, dictionary)
  const value = parser.parseAdd()
  parser.skip()
  if (!parser.done()) throw new Error("数式を読み切れません")
  return value.kind === "n" ? formatNum(value.n) : value.s
}

function substitute(source: string, ctx: MatchContext, clock: Record<string, string>): string {
  let out = ""
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === '"') {
      const start = i
      i += 1
      while (i < source.length && source[i] !== '"') {
        if (source[i] === "\\") i += 1
        i += 1
      }
      out += source.slice(start, Math.min(source.length, i + 1))
      continue
    }
    if (source[i] === "$" && source[i + 1] === "$") {
      out += '"$"'
      i += 1
      continue
    }
    if (source[i] === "$") {
      const ref = readRef(source, i, ctx, clock, true)
      if (ref) {
        out += formulaLiteral(ref.missing ? "" : ref.raw)
        i = ref.next - 1
        continue
      }
    }
    out += source[i]
  }
  return out
}

function formulaLiteral(value: string): string {
  const normalized = value
    .trim()
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replaceAll("－", "-")
  if (normalized === "") return "0"
  return JSON.stringify(value)
}

function formatNum(value: number): string {
  if (!Number.isFinite(value)) throw new Error("計算が発散しました")
  if (Object.is(value, -0)) return "0"
  if (Number.isInteger(value) && Math.abs(value) < 1e15) return String(value)
  return String(Math.round(value * 1e10) / 1e10)
}

class Parser {
  private index = 0
  private source: string
  private dictionary: ReadonlyMap<string, string>

  constructor(source: string, dictionary: ReadonlyMap<string, string>) {
    this.source = source
    this.dictionary = dictionary
  }

  done(): boolean {
    return this.index >= this.source.length
  }

  skip() {
    while (/\s/.test(this.source[this.index] ?? "")) this.index += 1
  }

  peek(): string {
    this.skip()
    return this.source[this.index] ?? ""
  }

  eat(token: string): boolean {
    this.skip()
    if (!this.source.startsWith(token, this.index)) return false
    this.index += token.length
    return true
  }

  parseAdd(): Val {
    let left = this.parseMul()
    for (;;) {
      if (this.eat("+")) left = add(left, this.parseMul())
      else if (this.eat("-")) left = sub(left, this.parseMul())
      else return left
    }
  }

  parseMul(): Val {
    let left = this.parsePow()
    for (;;) {
      if (this.eat("*")) left = mul(left, this.parsePow())
      else if (this.eat("/")) left = div(left, this.parsePow())
      else if (this.eat("%")) left = mod(left, this.parsePow())
      else return left
    }
  }

  parsePow(): Val {
    const left = this.parseUnary()
    if (this.eat("**")) return pow(left, this.parsePow())
    return left
  }

  parseUnary(): Val {
    if (this.eat("-")) {
      const value = this.parseUnary()
      return { kind: "n", n: -num(value) }
    }
    if (this.eat("+")) return { kind: "n", n: num(this.parseUnary()) }
    return this.parsePrimary()
  }

  parsePrimary(): Val {
    const char = this.peek()
    if (char === "(") {
      this.eat("(")
      const value = this.parseAdd()
      if (!this.eat(")")) throw new Error("括弧が閉じていません")
      return value
    }
    if (char === '"') return { kind: "s", s: this.readString() }
    if (char >= "0" && char <= "9") return { kind: "n", n: this.readNumber() }
    if (/[\p{L}_]/u.test(char)) return this.readCall()
    throw new Error("数式を読み切れません")
  }

  readNumber(): number {
    this.skip()
    const match = /^\d+(?:\.\d+)?/.exec(this.source.slice(this.index))
    if (!match) throw new Error("数式を読み切れません")
    this.index += match[0].length
    return Number(match[0])
  }

  readString(): string {
    this.skip()
    this.index += 1
    let out = ""
    while (this.index < this.source.length) {
      const char = this.source[this.index]
      if (char === '"') {
        this.index += 1
        return out
      }
      if (char === "\\") {
        out += this.source[this.index + 1] ?? ""
        this.index += 2
        continue
      }
      out += char
      this.index += 1
    }
    throw new Error("文字列が閉じていません")
  }

  readCall(): Val {
    this.skip()
    const name = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(this.source.slice(this.index))
    if (!name) throw new Error("数式を読み切れません")
    this.index += name[0].length
    if (!this.eat("(")) throw new Error(`「${name[0]}」は使えません`)
    const args: Val[] = []
    if (this.peek() !== ")") {
      args.push(this.parseAdd())
      while (this.eat(",")) args.push(this.parseAdd())
    }
    if (!this.eat(")")) throw new Error("括弧が閉じていません")
    return call(name[0], args, this.dictionary)
  }
}

function num(value: Val): number {
  if (value.kind === "n") return value.n
  const normalized = value.s
    .trim()
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replaceAll("－", "-")
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized)) throw new Error(`「${value.s}」は数ではありません`)
  return Number(normalized)
}

function textOf(value: Val): string {
  return value.kind === "n" ? formatNum(value.n) : value.s
}

function add(left: Val, right: Val): Val {
  if (isNumericVal(left) && isNumericVal(right)) return { kind: "n", n: num(left) + num(right) }
  return { kind: "s", s: textOf(left) + textOf(right) }
}

function isNumericVal(value: Val): boolean {
  if (value.kind === "n") return true
  const normalized = value.s
    .trim()
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replaceAll("－", "-")
  return /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized)
}

function sub(left: Val, right: Val): Val {
  return { kind: "n", n: num(left) - num(right) }
}

function mul(left: Val, right: Val): Val {
  return { kind: "n", n: num(left) * num(right) }
}

function div(left: Val, right: Val): Val {
  const denominator = num(right)
  if (denominator === 0) throw new Error("0で割れません")
  return { kind: "n", n: num(left) / denominator }
}

function mod(left: Val, right: Val): Val {
  const denominator = num(right)
  if (denominator === 0) throw new Error("0で割れません")
  return { kind: "n", n: num(left) % denominator }
}

function pow(left: Val, right: Val): Val {
  return { kind: "n", n: num(left) ** num(right) }
}

function call(name: string, args: Val[], dictionary: ReadonlyMap<string, string>): Val {
  if (name === "辞書" || name === "dict") {
    const key = textOf(args[0] ?? { kind: "s", s: "" })
    if (dictionary.has(key)) return { kind: "s", s: dictionary.get(key) ?? "" }
    if (args[1]) return { kind: "s", s: textOf(args[1]) }
    return { kind: "s", s: key }
  }
  if (name === "桁" || name === "pad") {
    const width = Math.min(32, Math.max(0, Math.trunc(num(args[1] ?? { kind: "n", n: 0 }))))
    const fill = args[2] ? [...textOf(args[2])][0] || "0" : "0"
    return { kind: "s", s: padRaw(textOf(args[0] ?? { kind: "s", s: "" }), width, fill) }
  }
  if (name === "int" || name === "整数") return { kind: "n", n: Math.trunc(num(args[0] ?? { kind: "n", n: 0 })) }
  if (name === "round" || name === "四捨五入") {
    const digits = args[1] ? Math.min(10, Math.max(0, Math.trunc(num(args[1])))) : 0
    const factor = 10 ** digits
    return { kind: "n", n: Math.round(num(args[0] ?? { kind: "n", n: 0 }) * factor) / factor }
  }
  if (name === "abs" || name === "絶対値") return { kind: "n", n: Math.abs(num(args[0] ?? { kind: "n", n: 0 })) }
  throw new Error(`「${name}」は使えません`)
}
