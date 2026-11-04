import { useRef, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import clsx from "clsx"
import type { Pack } from "@/lib/regex/types"
import { parseTransfer, serializeBundle, serializePack } from "@/lib/regex/transfer"
import { Button, downloadText, readFile, safeName } from "./ui"

type Props = {
  open: boolean
  packs: Pack[]
  activeId: string
  onOpenChange: (open: boolean) => void
  onSelect: (id: string) => void
  onCreate: () => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onImport: (packs: Pack[]) => void
}

export function PackDialog({
  open,
  packs,
  activeId,
  onOpenChange,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
  onImport,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState("")
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const active = packs.find((pack) => pack.id === activeId) ?? packs[0]

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="veil" />
        <Dialog.Content className="sheet" aria-describedby="pack-help">
          <div className="flex items-start gap-3 px-4 pt-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-lg font-medium">保存した帳</Dialog.Title>
              <Dialog.Description id="pack-help" className="mt-1 text-sm text-pretty text-muted">
                規則と試験のまとまりです。編集するとこのブラウザに残ります。別の端末へは書き出してください。
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-btn" aria-label="閉じる">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <ul className="mt-3 min-h-0 flex-1 overflow-auto overscroll-contain px-4">
            {packs.map((pack) => {
              const selected = pack.id === activeId
              return (
                <li key={pack.id} className="border-b border-line">
                  <button
                    type="button"
                    className={clsx(
                      "flex w-full flex-col gap-1 border-l-2 py-3 ps-3 pe-1 text-start",
                      selected ? "border-accent" : "border-transparent",
                    )}
                    onClick={() => {
                      onSelect(pack.id)
                      onOpenChange(false)
                    }}
                  >
                    <span className="font-medium">{pack.name || "無題の帳"}</span>
                    <span className="text-xs text-muted tabular-nums">
                      規則 {pack.rules.length} · 試験 {pack.tests.length}
                      {pack.updatedAt > 0 ? ` · ${formatAgo(pack.updatedAt)}` : " · 例"}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {error ? (
            <p className="px-4 pt-2 text-sm text-accent" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 px-4 py-4">
            <Button
              tone="primary"
              onClick={() => {
                onCreate()
                onOpenChange(false)
              }}
            >
              新しい帳
            </Button>
            <Button
              onClick={() => {
                onDuplicate(active.id)
                onOpenChange(false)
              }}
            >
              この帳を複製
            </Button>
            <Button
              onClick={() => downloadText(`${safeName(active.name)}.json`, serializePack(active), "application/json")}
            >
              この帳
            </Button>
            <Button
              onClick={() => downloadText("chikandai-packs.json", serializeBundle(packs), "application/json")}
            >
              すべて
            </Button>
            <Button
              onClick={() => {
                setError("")
                inputRef.current?.click()
              }}
            >
              読み込む
            </Button>
            <Button
              tone="quiet"
              onClick={() => {
                if (confirmId === active.id) {
                  onDelete(active.id)
                  setConfirmId(null)
                  return
                }
                setConfirmId(active.id)
              }}
            >
              {confirmId === active.id ? "本当に消す" : "この帳を消す"}
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (!file) return
              void readFile(file).then((text) => {
                const parsed = parseTransfer(text)
                if ("error" in parsed) {
                  setError(parsed.error)
                  return
                }
                onImport(parsed.packs)
                setError("")
                onOpenChange(false)
              })
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function formatAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 10) return "たった今"
  if (seconds < 60) return `${seconds}秒前`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}時間前`
  return `${Math.floor(hours / 24)}日前`
}
