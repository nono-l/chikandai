import { useMemo, useRef, useState } from "react"
import clsx from "clsx"
import { Download, Eraser, FileUp, Text } from "lucide-react"
import { diffLines } from "@/lib/regex/diff"
import type { Rule, StepInfo } from "@/lib/regex/types"
import { Button, clip, downloadText, readFile, safeName } from "./ui"

type SourceProps = {
  className?: string
  source: string
  onChange: (value: string) => void
  onLoadSample: () => void
}

export function SourcePane({ className, source, onChange, onLoadSample }: SourceProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [armed, setArmed] = useState(false)
  const [note, setNote] = useState("")

  return (
    <section className={clsx("h-full min-h-0 min-w-0 flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">原文</h2>
        <span className="text-xs text-muted tabular-nums">{source.length.toLocaleString("ja-JP")}文字</span>
        <div className="ms-auto flex items-center">
          <Button
            tone="quiet"
            className="px-2"
            onClick={() => {
              onLoadSample()
              setNote("")
            }}
          >
            例
          </Button>
          <Button tone="quiet" className="px-2" onClick={() => inputRef.current?.click()}>
            <FileUp className="size-4" />
            開く
          </Button>
          <Button
            tone="quiet"
            className="px-2"
            onClick={() => {
              if (source.length > 80 && !armed) {
                setArmed(true)
                return
              }
              onChange("")
              setArmed(false)
            }}
          >
            <Eraser className="size-4" />
            {armed ? "消してよい" : "消す"}
          </Button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.md,.csv,.log,.html,.json,.xml,text/plain"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (!file) return
          void readFile(file)
            .then((text) => {
              onChange(text)
              setNote(`${file.name} を開きました`)
              setArmed(false)
            })
            .catch(() => setNote("ファイルを読めませんでした"))
        }}
      />
      <textarea
        className="manuscript"
        value={source}
        spellCheck={false}
        aria-label="原文"
        placeholder="ここに原文を貼るか、ファイルを開きます"
        onChange={(event) => {
          onChange(event.target.value)
          setArmed(false)
        }}
      />
      {note ? <p className="text-xs text-muted">{note}</p> : null}
    </section>
  )
}

function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => false,
    )
  }
  return Promise.resolve(false)
}

type ResultProps = {
  className?: string
  source: string
  output: string
  rules: Rule[]
  steps: StepInfo[]
  hung: boolean
  fatal?: string
  packName: string
  onUseAsSource: () => void
}

export function ResultPane({
  className,
  source,
  output,
  rules,
  steps,
  hung,
  fatal,
  packName,
  onUseAsSource,
}: ResultProps) {
  const [mode, setMode] = useState<"text" | "diff">("text")
  const [copied, setCopied] = useState("")
  const diff = useMemo(() => diffLines(source, output), [source, output])
  const replaced = steps.reduce((sum, step) => sum + (step.error || step.skipped ? 0 : step.count), 0)
  const shown = output.length > 120_000 ? output.slice(0, 120_000) : output

  return (
    <section className={clsx("h-full min-h-0 min-w-0 flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium">結果</h2>
        <span className="text-xs text-muted tabular-nums">
          {replaced.toLocaleString("ja-JP")}件 · {output.length.toLocaleString("ja-JP")}文字
        </span>
        <div className="ms-auto flex items-center">
          <Button tone={mode === "text" ? "ghost" : "quiet"} className="px-2" onClick={() => setMode("text")}>
            <Text className="size-4" />
            全文
          </Button>
          <Button tone={mode === "diff" ? "ghost" : "quiet"} className="px-2" onClick={() => setMode("diff")}>
            差分
          </Button>
        </div>
      </div>
      {hung ? (
        <p className="text-sm text-accent" role="alert">
          規則が時間内に終わりませんでした。繰り返しが重すぎる可能性があります。表示は直前の結果です。
        </p>
      ) : null}
      {fatal ? (
        <p className="text-sm text-accent" role="alert">
          {fatal}
        </p>
      ) : null}
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {rules.map((rule, index) => {
          const step = steps.find((item) => item.id === rule.id)
          const label = rule.label.trim() || `規則 ${index + 1}`
          const state = !step ? "…" : step.error ? "不可" : step.skipped ? "オフ" : `${step.count}件`
          return (
            <li
              key={rule.id}
              className={clsx(
                "shrink-0 rounded-md bg-surface px-2 py-1 text-xs",
                step?.error && "text-accent",
              )}
            >
              <span className="font-mono tabular-nums">{String(index + 1).padStart(2, "0")}</span> {label} · {state}
            </li>
          )
        })}
      </ul>
      {mode === "text" ? (
        <div className="manuscript">
          <pre className="p-3 font-mono text-base leading-relaxed break-all whitespace-pre-wrap md:text-sm">
            {shown.length > 0 ? shown : " "}
          </pre>
        </div>
      ) : (
        <div className="manuscript" aria-label="差分">
          {!diff.changed ? (
            <p className="p-3 text-sm text-ink-soft">原文と同じです。</p>
          ) : (
            <div className="py-2">
              {diff.truncated ? (
                <p className="px-3 pb-2 text-xs text-ink-soft">長いので、変わった行を先頭から拾っています。</p>
              ) : null}
              {diff.rows.map((row, index) =>
                row.fold ? (
                  <p key={`fold-${index}`} className="px-3 py-1 text-xs text-ink-soft">
                    … {row.fold}行は同じ …
                  </p>
                ) : (
                  <div
                    key={`${row.kind}-${index}`}
                    className={clsx(
                      "border-l-2 px-3 py-0.5 font-mono text-sm leading-relaxed break-all whitespace-pre-wrap",
                      row.kind === "del" && "border-accent text-accent line-through",
                      row.kind === "add" && "border-ink text-ink",
                      row.kind === "same" && "border-transparent text-ink-soft",
                    )}
                  >
                    {row.text.length > 0 ? row.text : " "}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      )}
      {output.length > shown.length ? (
        <p className="text-xs text-muted">画面は先頭だけです。書き出しとコピーは全文です。</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          tone="primary"
          onClick={() => {
            void copyText(output).then((ok) => {
              setCopied(ok ? "コピーしました" : "コピーできませんでした")
              window.setTimeout(() => setCopied(""), 1400)
            })
          }}
        >
          {copied || "結果をコピー"}
        </Button>
        <Button
          onClick={() => downloadText(`${safeName(packName)}.txt`, output, "text/plain")}
        >
          <Download className="size-4" />
          書き出す
        </Button>
        <Button tone="quiet" onClick={onUseAsSource}>
          結果を原文にする
        </Button>
      </div>
      <p className="sr-only">{clip(output, 20)}</p>
    </section>
  )
}
