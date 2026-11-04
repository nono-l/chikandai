import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react"
import { Fragment, useRef, useState } from "react"
import clsx from "clsx"
import type { Rule, StepInfo } from "@/lib/regex/types"
import { dictionaryRows, patternFromDictionary, serializeDictionary, type DictionaryRow } from "@/lib/regex/dictionary"
import { Button, CheatSheet, IconButton, clip } from "./ui"
import { XmlDialog } from "./xml-dialog"

const FLAGS: { flag: string; label: string }[] = [
  { flag: "g", label: "すべて" },
  { flag: "i", label: "大小" },
  { flag: "m", label: "行" },
  { flag: "s", label: "改行" },
  { flag: "u", label: "文字" },
]

const INSERTS: { label: string; token: string; select?: [number, number] }[] = [
  { label: "$1", token: "$1" },
  { label: "$2", token: "$2" },
  { label: "$&", token: "$&" },
  { label: "名前", token: "$<name>", select: [2, 6] },
]

const FORMULA_INSERTS: { label: string; token: string; select?: [number, number] }[] = [
  { label: "桁", token: "${桁($1, 3)}", select: [4, 6] },
  { label: "式", token: "${}", select: [2, 2] },
  { label: "$日付", token: "$日付" },
  { label: "$日時", token: "$日時" },
  { label: "$時", token: "$時" },
  { label: "$分", token: "$分" },
  { label: "$秒", token: "$秒" },
  { label: "辞書", token: "${辞書($<語>)}", select: [5, 9] },
]

type Props = {
  className?: string
  packName: string
  rules: Rule[]
  steps: StepInfo[]
  onRename: (name: string) => void
  onUpdate: (id: string, patch: Partial<Rule>) => void
  onAdd: () => string
  onRemove: (id: string) => void
  onMove: (id: string, direction: -1 | 1) => void
  onDuplicate: (id: string) => void
  onReplace: (rules: Rule[]) => void
}

function toggleFlag(flags: string, flag: string): string {
  return flags.includes(flag) ? flags.replace(flag, "") : `${flags}${flag}`
}

function writeToken(
  field: HTMLTextAreaElement | null,
  current: string,
  token: string,
  select?: [number, number],
): string {
  if (!field) return `${current}${token}`
  const start = field.selectionStart ?? current.length
  const end = field.selectionEnd ?? start
  const next = current.slice(0, start) + token + current.slice(end)
  const from = start + (select?.[0] ?? token.length)
  const to = start + (select?.[1] ?? token.length)
  requestAnimationFrame(() => {
    field.focus()
    field.setSelectionRange(from, to)
  })
  return next
}

export function RuleColumn({
  className,
  packName,
  rules,
  steps,
  onRename,
  onUpdate,
  onAdd,
  onRemove,
  onMove,
  onDuplicate,
  onReplace,
}: Props) {
  const replacementRefs = useRef(new Map<string, HTMLTextAreaElement>())
  const [xmlOpen, setXmlOpen] = useState(false)
  const [dictError, setDictError] = useState<Record<string, string>>({})

  return (
    <section className={clsx("h-full min-h-0 min-w-0 flex-col gap-3", className)}>
      <div>
        <label className="mb-1 block text-xs text-muted" htmlFor="pack-name">
          帳の名前
        </label>
        <input
          id="pack-name"
          className="field font-sans"
          value={packName}
          onChange={(event) => onRename(event.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-pretty text-muted">上の規則から順に原文へかけます。無効にしたものは飛ばします。</p>
        <Button className="shrink-0" aria-label="規則をXMLで読み書き" onClick={() => setXmlOpen(true)}>
          XML
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto overscroll-contain pe-0.5">
        <CheatSheet />
        {rules.length === 0 ? (
          <p className="card px-3 py-6 text-center text-sm text-muted">規則がありません。足すと、ここからかけます。</p>
        ) : null}
        {rules.map((rule, index) => {
          const step = steps.find((item) => item.id === rule.id)
          return (
            <article key={rule.id} id={`rule-${rule.id}`} className={clsx("card min-w-0 p-3", !rule.enabled && "opacity-60")}>
              <div className="flex items-center gap-1">
                <span className="w-8 shrink-0 font-mono text-sm text-muted tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <input
                  className="field font-sans"
                  value={rule.label}
                  placeholder={`規則 ${index + 1}`}
                  aria-label={`規則 ${index + 1} の名前`}
                  autoComplete="off"
                  onChange={(event) => onUpdate(rule.id, { label: event.target.value })}
                />
                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.enabled}
                  aria-label={rule.enabled ? "この規則を無効にする" : "この規則を有効にする"}
                  className={clsx(
                    "btn shrink-0 px-3",
                    rule.enabled ? "btn-primary" : "btn-ghost",
                  )}
                  onClick={() => onUpdate(rule.id, { enabled: !rule.enabled })}
                >
                  {rule.enabled ? "有効" : "無効"}
                </button>
              </div>
              <div className="mt-2 flex justify-end">
                <IconButton label="上へ" disabled={index === 0} onClick={() => onMove(rule.id, -1)}>
                  <ChevronUp className="size-4" />
                </IconButton>
                <IconButton label="下へ" disabled={index === rules.length - 1} onClick={() => onMove(rule.id, 1)}>
                  <ChevronDown className="size-4" />
                </IconButton>
                <IconButton label="複製" onClick={() => onDuplicate(rule.id)}>
                  <Copy className="size-4" />
                </IconButton>
                <IconButton label="削除" onClick={() => onRemove(rule.id)}>
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
              <label className="mt-1 block text-xs text-muted" htmlFor={`pat-${rule.id}`}>
                パターン
              </label>
              <textarea
                id={`pat-${rule.id}`}
                className="field mt-1"
                rows={2}
                spellCheck={false}
                wrap="off"
                value={rule.pattern}
                placeholder={"あ-ん+ や (?<name>\\d+)"}
                onChange={(event) => onUpdate(rule.id, { pattern: event.target.value })}
              />
              {step?.expanded ? (
                <p className="mt-1 text-xs break-all text-muted">
                  展開 <code className="font-mono text-fg">{step.expanded}</code>
                </p>
              ) : null}
              {step?.unicodeAdded ? (
                <p className="mt-1 text-xs text-muted">絵文字などのため、フラグ u を補いました。</p>
              ) : null}
              {step?.error ? (
                <p className="mt-1 text-sm text-accent" role="alert">
                  {step.error}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1">
                {FLAGS.map((item) => (
                  <button
                    key={item.flag}
                    type="button"
                    className="flag"
                    aria-pressed={rule.flags.includes(item.flag)}
                    onClick={() => onUpdate(rule.id, { flags: toggleFlag(rule.flags, item.flag) })}
                  >
                    {item.flag}
                    <small>{item.label}</small>
                  </button>
                ))}
                <button
                  type="button"
                  className="flag"
                  aria-pressed={rule.literal}
                  onClick={() => onUpdate(rule.id, { literal: !rule.literal })}
                >
                  文
                  <small>そのまま</small>
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">
                {rule.literal
                  ? "書いた文字をそのまま探します。正規表現もグループも使いません。"
                  : "g すべて · i 大小を無視 · m 行頭と行末 · s ドットが改行 · u 文字単位"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1">
                <span className="me-1 text-xs text-muted">置換</span>
                {INSERTS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="btn btn-quiet min-h-11 px-2 font-mono"
                    onClick={() =>
                      onUpdate(rule.id, {
                        replacement: writeToken(
                          replacementRefs.current.get(rule.id) ?? null,
                          rule.replacement,
                          item.token,
                          item.select,
                        ),
                      })
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="me-1 text-xs text-muted">式</span>
                {FORMULA_INSERTS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="btn btn-quiet min-h-11 px-2 font-mono"
                    onClick={() =>
                      onUpdate(rule.id, {
                        replacement: writeToken(
                          replacementRefs.current.get(rule.id) ?? null,
                          rule.replacement,
                          item.token,
                          item.select,
                        ),
                      })
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <textarea
                className="field mt-1"
                rows={2}
                spellCheck={false}
                wrap="off"
                aria-label={`規則 ${index + 1} の置換`}
                placeholder="空なら削除"
                value={rule.replacement}
                ref={(node) => {
                  if (node) replacementRefs.current.set(rule.id, node)
                  else replacementRefs.current.delete(rule.id)
                }}
                onChange={(event) => onUpdate(rule.id, { replacement: event.target.value })}
              />
              <DictionaryEditor
                rule={rule}
                error={dictError[rule.id] ?? ""}
                onError={(message) => setDictError((current) => ({ ...current, [rule.id]: message }))}
                onUpdate={(patch) => {
                  if (patch.dictionary !== undefined) {
                    setDictError((current) => ({ ...current, [rule.id]: "" }))
                  }
                  onUpdate(rule.id, patch)
                }}
              />
              <MatchNote step={step} />
            </article>
          )
        })}
        <Button
          tone="primary"
          className="sticky bottom-0"
          onClick={() => {
            const id = onAdd()
            requestAnimationFrame(() => {
              document.getElementById(`rule-${id}`)?.scrollIntoView({ block: "nearest" })
            })
          }}
        >
          <Plus className="size-4" />
          規則を足す
        </Button>
      </div>
      <XmlDialog
        open={xmlOpen}
        packName={packName}
        rules={rules}
        onOpenChange={setXmlOpen}
        onReplace={onReplace}
      />
    </section>
  )
}

function DictionaryEditor({
  rule,
  error,
  onUpdate,
  onError,
}: {
  rule: Rule
  error: string
  onUpdate: (patch: Partial<Rule>) => void
  onError: (message: string) => void
}) {
  const stored = dictionaryRows(rule.dictionary)
  const rows = [...stored, { key: "", value: "" }]
  const named = /^\$\{辞書\(\$<([^>]+)>\)\}$/.exec(rule.replacement.trim())
  const groupName = named?.[1] ?? "語"
  const whole = rule.replacement.trim() === "${辞書($&)}"

  function change(index: number, patch: Partial<DictionaryRow>) {
    const next = stored.slice()
    if (index === stored.length) next.push({ key: "", value: "", ...patch })
    else next[index] = { ...next[index], ...patch }
    onUpdate({ dictionary: serializeDictionary(next) })
  }

  function choose(kind: "all" | "group", name = groupName) {
    const safe = name.replace(/[<>]/g, "") || "語"
    onUpdate({
      replacement: kind === "all" ? "${辞書($&)}" : `\${辞書($<${safe}>)}`,
      literal: false,
    })
  }

  return (
    <div className="mt-3 rounded-md bg-bg px-3 py-3">
      <p className="text-sm font-medium">置換辞書</p>
      <p className="mt-1 text-xs text-pretty text-muted">
        完全一致です。取れた文字がキーとまったく同じときだけ、値に置き換えます。行の途中や、キーの一部では置き換えません。
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        <button type="button" className={clsx("btn min-h-11 px-3", whole ? "btn-primary" : "btn-ghost")} onClick={() => choose("all")}>
          一致した全体
        </button>
        <button
          type="button"
          className={clsx("btn min-h-11 px-3", named ? "btn-primary" : "btn-ghost")}
          onClick={() => choose("group")}
        >
          名前付きグループ
        </button>
      </div>
      {named ? (
        <label className="mt-2 block text-xs text-muted">
          グループ名
          <input
            className="field mt-1 font-mono"
            value={groupName}
            aria-label="辞書に使うグループ名"
            onChange={(event) => choose("group", event.target.value)}
          />
        </label>
      ) : null}
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-1">
        <span className="text-xs text-muted">キー</span>
        <span className="text-xs text-muted">値</span>
        <span />
        {rows.map((row, index) => (
          <Fragment key={index}>
            <input
              className="field font-mono"
              value={row.key}
              aria-label={`辞書 ${index + 1} のキー`}
              placeholder="東京"
              onChange={(event) => change(index, { key: event.target.value })}
            />
            <input
              className="field font-mono"
              value={row.value}
              aria-label={`辞書 ${index + 1} の値`}
              placeholder="Tokyo"
              onChange={(event) => change(index, { value: event.target.value })}
            />
            <IconButton
              label={`辞書 ${index + 1} を削除`}
              disabled={index === stored.length}
              onClick={() => onUpdate({ dictionary: serializeDictionary(stored.filter((_, item) => item !== index)) })}
            >
              <Trash2 className="size-4" />
            </IconButton>
          </Fragment>
        ))}
      </div>
      {error ? (
        <p className="mt-2 text-xs text-accent" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        className="mt-3"
        onClick={() => {
          const built = patternFromDictionary(rule.dictionary, named ? groupName : undefined)
          if ("error" in built) {
            onError(built.error)
            return
          }
          let flags = rule.flags
          if (!flags.includes("g")) flags += "g"
          if (!flags.includes("m")) flags += "m"
          if (!flags.includes("u") && !flags.includes("v")) flags += "u"
          onError("")
          onUpdate({
            pattern: built.pattern,
            replacement: built.replacement,
            literal: false,
            flags,
          })
        }}
      >
        行を完全一致で探す
      </Button>
    </div>
  )
}

function MatchNote({ step }: { step: StepInfo | undefined }) {
  if (!step || step.skipped) return <p className="mt-2 text-xs text-muted">この規則はいま通していません。</p>
  if (step.error) return null
  if (!step.sample) return <p className="mt-2 text-xs text-muted">いまの原文には一致がありません。</p>
  return (
    <div className="mt-3 rounded-md bg-bg px-3 py-2">
      <p className="text-xs text-muted">
        一致 <span className="font-mono text-fg tabular-nums">{step.count}</span> 件 · 先頭「
        <span className="font-mono text-fg">{clip(step.sample.full, 48)}</span>」 · 位置{" "}
        <span className="font-mono tabular-nums">{step.sample.index}</span>
      </p>
      {step.sample.rendered !== undefined ? (
        <p className="mt-2 text-xs text-muted">
          先頭の置換「<span className="font-mono text-fg">{clip(step.sample.rendered, 48)}</span>」
        </p>
      ) : null}
      {step.sample.groups.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1">
          {step.sample.groups.slice(0, 8).map((group) => (
            <li key={group.key} className="rounded-sm bg-raised px-2 py-1 font-mono text-xs">
              <span className="text-muted">{group.key}</span> {clip(group.value, 24)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-muted">この一致にグループはありません。</p>
      )}
    </div>
  )
}
