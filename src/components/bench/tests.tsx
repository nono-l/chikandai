import { Plus, Trash2 } from "lucide-react"
import clsx from "clsx"
import type { TestCase, TestInfo } from "@/lib/regex/types"
import { Button, IconButton } from "./ui"

type Props = {
  className?: string
  open: boolean
  tests: TestCase[]
  results: TestInfo[]
  onToggle: () => void
  onAdd: (fromSource: boolean) => void
  onUpdate: (id: string, patch: Partial<TestCase>) => void
  onRemove: (id: string) => void
  onLock: (id: string, output: string) => void
}

export function scoreTests(tests: TestCase[], results: TestInfo[]) {
  let pass = 0
  let total = 0
  for (const test of tests) {
    if (test.expected.length === 0) continue
    total += 1
    const info = results.find((item) => item.id === test.id)
    if (info?.pass) pass += 1
  }
  return { pass, total }
}

export function TestBench({
  className,
  open,
  tests,
  results,
  onToggle,
  onAdd,
  onUpdate,
  onRemove,
  onLock,
}: Props) {
  const score = scoreTests(tests, results)

  return (
    <section className={clsx("min-h-0 flex-col border-t border-line bg-bg", className)}>
      <button
        type="button"
        className="flex h-12 w-full shrink-0 items-center gap-3 px-3 text-start"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="text-sm font-medium">試験</span>
        <span className={clsx("text-xs tabular-nums", score.total > 0 && score.pass < score.total ? "text-accent" : "text-muted")}>
          {score.total === 0 ? "期待を書くと合否が出ます" : `${score.pass} / ${score.total} 合格`}
        </span>
        <span className="ms-auto text-xs text-muted">{open ? "閉じる" : "開く"}</span>
      </button>
      {open ? (
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-3 pb-3">
          <p className="mb-3 text-sm text-pretty text-muted">
            帳ごとの試しです。期待を空にすると、結果を見るだけになります。完全一致で合格です。
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button tone="primary" onClick={() => onAdd(false)}>
              <Plus className="size-4" />
              試験を足す
            </Button>
            <Button onClick={() => onAdd(true)}>原文を試験にする</Button>
          </div>
          {tests.length === 0 ? (
            <p className="card px-3 py-6 text-center text-sm text-muted">まだ試験がありません。</p>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {tests.map((test, index) => {
                const info = results.find((item) => item.id === test.id)
                return (
                  <li key={test.id} className="card p-3">
                    <div className="flex items-center gap-2">
                      <input
                        className="field font-sans"
                        value={test.name}
                        placeholder={`試験 ${index + 1}`}
                        aria-label={`試験 ${index + 1} の名前`}
                        autoComplete="off"
                        onChange={(event) => onUpdate(test.id, { name: event.target.value })}
                      />
                      <Status info={info} expected={test.expected} />
                      <IconButton label="この試験を削除" onClick={() => onRemove(test.id)}>
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                    <label className="mt-2 block text-xs text-muted" htmlFor={`in-${test.id}`}>
                      入力
                    </label>
                    <textarea
                      id={`in-${test.id}`}
                      className="field field-paper mt-1"
                      rows={3}
                      spellCheck={false}
                      value={test.input}
                      onChange={(event) => onUpdate(test.id, { input: event.target.value })}
                    />
                    <label className="mt-2 block text-xs text-muted" htmlFor={`ex-${test.id}`}>
                      期待する結果
                    </label>
                    <textarea
                      id={`ex-${test.id}`}
                      className="field field-paper mt-1"
                      rows={3}
                      spellCheck={false}
                      placeholder="空なら、結果を見るだけ"
                      value={test.expected}
                      onChange={(event) => onUpdate(test.id, { expected: event.target.value })}
                    />
                    {info?.error ? <p className="mt-2 text-sm text-accent">{info.error}</p> : null}
                    {info && info.pass === false ? (
                      <div className="mt-2">
                        <p className="text-xs text-accent">
                          一致しません。結果 {info.output.length.toLocaleString("ja-JP")}文字 / 期待{" "}
                          {test.expected.length.toLocaleString("ja-JP")}文字
                        </p>
                        <pre className="mt-1 max-h-36 overflow-auto rounded-md bg-paper p-2 font-mono text-sm leading-relaxed break-all whitespace-pre-wrap text-ink">
                          {info.output || " "}
                        </pre>
                      </div>
                    ) : null}
                    {info && info.pass === null && !info.error && (test.input.length > 0 || test.expected.length > 0) ? (
                      <pre className="mt-2 max-h-36 overflow-auto rounded-md bg-paper p-2 font-mono text-sm leading-relaxed break-all whitespace-pre-wrap text-ink">
                        {info.output || " "}
                      </pre>
                    ) : null}
                    {info && !info.error ? (
                      <Button tone="quiet" className="mt-2 px-2" onClick={() => onLock(test.id, info.output)}>
                        この結果を期待にする
                      </Button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  )
}

function Status({ info, expected }: { info: TestInfo | undefined; expected: string }) {
  if (!info || (info.pass === null && !info.error)) {
    return <span className="shrink-0 text-xs text-muted">{expected.length === 0 ? "見るだけ" : "…"}</span>
  }
  if (info.error || info.pass === false) {
    return <span className="shrink-0 text-xs font-medium text-accent">不合格</span>
  }
  return <span className="shrink-0 text-xs font-medium text-fg">合格</span>
}
