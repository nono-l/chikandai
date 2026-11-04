import type { ButtonHTMLAttributes, ReactNode } from "react"
import clsx from "clsx"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "ghost" | "quiet"
  children: ReactNode
}

export function Stamp() {
  return (
    <svg viewBox="0 0 32 32" className="size-10 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--color-bg)" />
      <rect x="3.5" y="3.5" width="25" height="25" rx="4" fill="var(--color-accent)" />
      <path
        d="M9 13h9.5M15.5 9.5 19 13l-3.5 3.5"
        fill="none"
        stroke="var(--color-fg)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M23 19H13.5M16.5 15.5 13 19l3.5 3.5"
        fill="none"
        stroke="var(--color-fg)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Button({ tone = "ghost", className, type = "button", children, ...props }: ButtonProps) {
  return (
    <button type={type} className={clsx("btn", `btn-${tone}`, className)} {...props}>
      {children}
    </button>
  )
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" className={clsx("icon-btn", className)} aria-label={label} title={label} {...props}>
      {children}
    </button>
  )
}

export function clip(value: string, max = 72): string {
  const flat = value.replaceAll("\n", "↵")
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

export function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function safeName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, "").trim()
  return cleaned || "chikandai"
}

export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? "").replaceAll("\r\n", "\n").replaceAll("\r", "\n"))
    reader.onerror = () => reject(reader.error ?? new Error("読めません"))
    reader.readAsText(file)
  })
}

const TOKENS: { token: string; help: string }[] = [
  { token: "$1", help: "1番目のグループ" },
  { token: "$2", help: "2番目。続く番号も同じ" },
  { token: "$<name>", help: "名前付きグループ" },
  { token: "$&", help: "一致した全体" },
  { token: "$`", help: "一致の直前" },
  { token: "$'", help: "一致の直後" },
  { token: "$$", help: "ドル記号そのもの" },
]

const FORMULAS: { token: string; help: string }[] = [
  { token: "$1:3", help: "3を003に。$<m>:2 も同じ" },
  { token: "${桁($1, 3)}", help: "桁を指定。pad($1, 3) も同じ" },
  { token: "${$<m> + 1}", help: "グループを数として計算" },
  { token: "${辞書($&)}", help: "一致した全体がキーと完全に同じとき、辞書の値にする" },
  { token: "キー と 値", help: "規則の置換辞書。行全体がキーのときだけ置き換わります" },
  { token: "$年 $月 $日", help: "今日。$時 $分 $秒 はいま" },
  { token: "$日付 $時刻", help: "2026-11-04 と 09:16:05" },
  { token: "$日時", help: "日付と時刻。$曜日 は水" },
  { token: "$回", help: "この規則で何件目か" },
]

export function CheatSheet() {
  return (
    <div className="grid gap-3">
      <details className="card px-3 py-2">
        <summary className="text-sm font-medium">グループの書き方</summary>
        <ul className="mt-3 grid gap-2">
          {TOKENS.map((item) => (
            <li key={item.token} className="flex items-baseline gap-3 text-sm">
              <code className="w-16 shrink-0 font-mono text-fg">{item.token}</code>
              <span className="text-muted">{item.help}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">
          例 <code className="font-mono text-fg">{`(?<y>\\d{4})`}</code> を{" "}
          <code className="font-mono text-fg">{"$<y>年"}</code> へ。フラグ g で全部、外すと最初の1件だけです。
        </p>
      </details>
      <details className="card px-3 py-2">
        <summary className="text-sm font-medium">数式と日時</summary>
        <ul className="mt-3 grid gap-2">
          {FORMULAS.map((item) => (
            <li key={item.token} className="flex items-baseline gap-3 text-sm">
              <code className="shrink-0 font-mono text-fg">{item.token}</code>
              <span className="text-muted">{item.help}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">
          日時は日本時間です。同じ置換のあいだは同じ時刻で、$秒は次にかけたときに変わります。
        </p>
      </details>
      <details className="card px-3 py-2">
        <summary className="text-sm font-medium">日本語と絵文字</summary>
        <ul className="mt-3 grid gap-2">
          {KANA.map((item) => (
            <li key={item.token} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              <code className="font-mono text-fg">{item.token}</code>
              <span className="text-muted">{item.help}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">
          括弧の外に書いても範囲になります。つなぎは <code className="font-mono text-fg">-</code> のほか{" "}
          <code className="font-mono text-fg">－</code> <code className="font-mono text-fg">〜</code> も使えます。
          文字としての「あ-ん」は <code className="font-mono text-fg">あ[-]ん</code> または{" "}
          <code className="font-mono text-fg">あ\-ん</code> と書きます。絵文字はそのまま、または{" "}
          <code className="font-mono text-fg">{"\\p{絵文字}"}</code> で、肌の色や家族の絵文字もまとめて1つです。
        </p>
      </details>
    </div>
  )
}

const KANA: { token: string; help: string }[] = [
  { token: "あ-ん", help: "ひらがな。小さいぁゃっ、ゔ、ゝも含む" },
  { token: "ア-ン", help: "全角カタカナ。ー、ヴ、ヵヶも含む。半角は含まない" },
  { token: "ｱ-ﾝ", help: "半角カナ。濁点も" },
  { token: "Ａ-Ｚ", help: "全角の英大文字。ａ-ｚ と ０-９ も同じ" },
  { token: "一-龠", help: "漢字。々 と 〆 も含む" },
  { token: "\\p{絵文字}", help: "絵文字ひとつ。\\p{ひらがな} \\p{カタカナ} \\p{漢字} も" },
]
