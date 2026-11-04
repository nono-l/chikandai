import { useEffect, useRef, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import type { Rule } from "@/lib/regex/types"
import { SHARE_DAYS } from "@/lib/regex/share-body"
import { publishShare } from "@/lib/regex/share.functions"
import { rulesFromXml, rulesToXml } from "@/lib/regex/xml"
import { uid } from "@/lib/workspace-store"
import { Button, downloadText, readFile, safeName } from "./ui"

type Props = {
  open: boolean
  packName: string
  rules: Rule[]
  onOpenChange: (open: boolean) => void
  onReplace: (rules: Rule[]) => void
}

export function XmlDialog({ open, packName, rules, onOpenChange, onReplace }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const wasOpen = useRef(false)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState("")
  const [link, setLink] = useState("")
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(rulesToXml(rules))
      setError("")
      setLink("")
      setCopied(false)
    }
    wasOpen.current = open
  }, [open, rules])

  function apply(text: string) {
    const parsed = rulesFromXml(text)
    if ("error" in parsed) {
      setError(parsed.error)
      return
    }
    onReplace(parsed.rules.map((rule) => ({ ...rule, id: uid("rule") })))
    setError("")
    onOpenChange(false)
  }

  async function shareCurrent() {
    const parsed = rulesFromXml(draft)
    if ("error" in parsed) {
      setError(parsed.error)
      return
    }
    setSharing(true)
    setError("")
    try {
      const result = await publishShare({
        data: { name: packName, rules: parsed.rules },
      })
      if ("error" in result) {
        setError(result.error)
        return
      }
      const url = new URL(window.location.href)
      url.search = ""
      url.hash = ""
      url.searchParams.set("s", result.id)
      setLink(url.toString())
      setCopied(false)
    } catch {
      setError("共有リンクを作れませんでした")
    } finally {
      setSharing(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      return
    }
    setCopied(true)
  }

  async function systemShare() {
    if (!navigator.share) {
      await copyLink()
      return
    }
    try {
      await navigator.share({ title: packName || "置換台", text: packName || "置換台の規則", url: link })
    } catch {
      /* the sheet was dismissed */
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="veil" />
        <Dialog.Content className="sheet" aria-describedby="xml-help">
          <div className="flex items-start gap-3 px-4 pt-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-lg font-medium">規則のXML</Dialog.Title>
              <Dialog.Description id="xml-help" className="mt-1 text-sm text-pretty text-muted">
                いまの帳の規則だけです。読み込むと、この帳の規則をXMLの内容で置き換えます。試験はそのままです。
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-btn" aria-label="閉じる">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <form
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 pt-3 pb-4"
            onSubmit={(event) => {
              event.preventDefault()
              apply(draft)
            }}
          >
            <label className="flex min-h-40 flex-1 flex-col gap-1 text-xs text-muted">
              XML
              <textarea
                className="field min-h-40 flex-1 font-mono"
                value={draft}
                spellCheck={false}
                wrap="off"
                aria-label="規則のXML"
                onChange={(event) => {
                  setDraft(event.target.value)
                  setError("")
                  setLink("")
                }}
              />
            </label>
            {error ? (
              <p className="text-sm text-accent" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button tone="primary" type="submit">
                規則を置き換える
              </Button>
              <Button type="button" onClick={() => downloadText(`${safeName(packName)}.xml`, draft, "application/xml")}>
                ファイルに保存
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setDraft(rulesToXml(rules))
                  setError("")
                  setLink("")
                }}
              >
                いまの規則
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setError("")
                  fileRef.current?.click()
                }}
              >
                ファイルを開く
              </Button>
              <Button type="button" disabled={sharing} onClick={() => void shareCurrent()}>
                {sharing ? "作っています…" : "共有リンクを作る"}
              </Button>
            </div>
            {link ? (
              <div className="grid gap-2">
                <p className="text-xs text-pretty text-muted">
                  リンクに入るのは番号だけです。規則は{SHARE_DAYS}日で消えます。
                </p>
                <input className="field font-mono" readOnly value={link} aria-label="共有リンク" />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" tone="primary" onClick={() => void copyLink()}>
                    {copied ? "コピーしました" : "リンクをコピー"}
                  </Button>
                  <Button type="button" onClick={() => void systemShare()}>
                    共有
                  </Button>
                  <Button type="button" onClick={() => openSns(xUrl(link, packName))}>
                    X
                  </Button>
                  <Button type="button" onClick={() => openSns(lineUrl(link, packName))}>
                    LINE
                  </Button>
                </div>
              </div>
            ) : null}
          </form>
          <input
            ref={fileRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (!file) return
              void readFile(file).then((text) => {
                setDraft(text)
                setError("")
                setLink("")
              })
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function openSns(url: string) {
  window.open(url, "_blank", "noopener,noreferrer")
}

function xUrl(link: string, name: string): string {
  const text = `${name || "置換台"}の規則`
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`
}

function lineUrl(link: string, name: string): string {
  return `https://line.me/R/msg/text/?${encodeURIComponent(`${name || "置換台"}の規則\n${link}`)}`
}
