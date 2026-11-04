import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import type { RuleDraft } from "@/lib/regex/xml"
import { Button } from "./ui"

type Props = {
  open: boolean
  loading: boolean
  error: string
  share: { name: string; rules: RuleDraft[] } | null
  onOpenChange: (open: boolean) => void
  onReplace: (rules: RuleDraft[]) => void
  onCreate: (name: string, rules: RuleDraft[]) => void
}

export function ShareInbox({ open, loading, error, share, onOpenChange, onReplace, onCreate }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="veil" />
        <Dialog.Content className="sheet" aria-describedby="share-help">
          <div className="flex items-start gap-3 px-4 pt-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-lg font-medium">共有された規則</Dialog.Title>
              <Dialog.Description id="share-help" className="mt-1 text-sm text-pretty text-muted">
                リンクに入っているのは番号だけです。中身はこの端末にはまだ入っていません。
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-btn" aria-label="閉じる">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-3 px-4 py-4">
            {loading ? <p className="text-sm text-muted">読み込んでいます…</p> : null}
            {error ? (
              <p className="text-sm text-accent" role="alert">
                {error}
              </p>
            ) : null}
            {share ? (
              <>
                <p className="text-sm">
                  <span className="font-medium">{share.name}</span>
                  <span className="text-muted"> · 規則 {share.rules.length}件</span>
                </p>
                <ul className="card max-h-40 overflow-auto px-3 py-2 text-sm">
                  {share.rules.slice(0, 8).map((rule, index) => (
                    <li key={`${index}-${rule.pattern}`} className="truncate py-1 font-mono text-xs">
                      {rule.label || rule.pattern}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button tone="primary" onClick={() => onReplace(share.rules)}>
                    この帳に入れる
                  </Button>
                  <Button onClick={() => onCreate(share.name, share.rules)}>新しい帳にする</Button>
                </div>
              </>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
