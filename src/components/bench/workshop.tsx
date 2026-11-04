import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import clsx from "clsx"
import { BookMarked, FileText, FlaskConical, ListFilter } from "lucide-react"
import { SAMPLE_SOURCE } from "@/lib/regex/presets"
import { loadShare } from "@/lib/regex/share.functions"
import type { RuleDraft } from "@/lib/regex/xml"
import { usePipeline } from "@/lib/regex/use-pipeline"
import { activePack, uid, useWorkspace } from "@/lib/workspace-store"
import { PackDialog } from "./packs"
import { ResultPane, SourcePane } from "./manuscript"
import { RuleColumn } from "./rules"
import { ShareInbox } from "./share-inbox"
import { TestBench, scoreTests } from "./tests"
import { Button, Stamp } from "./ui"

type Tab = "source" | "rules" | "result" | "tests"

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: "source", label: "原文", icon: FileText },
  { id: "rules", label: "規則", icon: ListFilter },
  { id: "result", label: "結果", icon: BookMarked },
  { id: "tests", label: "試験", icon: FlaskConical },
]

export function Workshop({ shareId = "" }: { shareId?: string }) {
  const packs = useWorkspace((state) => state.packs)
  const activeId = useWorkspace((state) => state.activeId)
  const source = useWorkspace((state) => state.source)
  const setSource = useWorkspace((state) => state.setSource)
  const setActive = useWorkspace((state) => state.setActive)
  const renamePack = useWorkspace((state) => state.renamePack)
  const updateRule = useWorkspace((state) => state.updateRule)
  const addRule = useWorkspace((state) => state.addRule)
  const removeRule = useWorkspace((state) => state.removeRule)
  const moveRule = useWorkspace((state) => state.moveRule)
  const duplicateRule = useWorkspace((state) => state.duplicateRule)
  const addTest = useWorkspace((state) => state.addTest)
  const updateTest = useWorkspace((state) => state.updateTest)
  const removeTest = useWorkspace((state) => state.removeTest)
  const newPack = useWorkspace((state) => state.newPack)
  const duplicatePack = useWorkspace((state) => state.duplicatePack)
  const deletePack = useWorkspace((state) => state.deletePack)
  const importPacks = useWorkspace((state) => state.importPacks)
  const replaceRules = useWorkspace((state) => state.replaceRules)

  const pack = activePack({ packs, activeId })
  const pipeline = usePipeline(source, pack.rules, pack.tests)
  const [tab, setTab] = useState<Tab>("result")
  const [packsOpen, setPacksOpen] = useState(false)
  const [testsOpen, setTestsOpen] = useState(true)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareOffer, setShareOffer] = useState<{ name: string; rules: RuleDraft[] } | { error: string } | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    void useWorkspace.persist.rehydrate()
  }, [])

  useEffect(() => {
    if (!shareId) {
      setShareOffer(null)
      setShareLoading(false)
      return
    }
    let cancel = false
    setShareLoading(true)
    setShareOffer(null)
    void loadShare({ data: { id: shareId } })
      .then((result) => {
        if (!cancel) setShareOffer(result)
      })
      .catch(() => {
        if (!cancel) setShareOffer({ error: "共有を読めませんでした" })
      })
      .finally(() => {
        if (!cancel) setShareLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [shareId])

  function closeShare() {
    void navigate({ to: "/", search: { s: "" }, replace: true })
  }

  function withIds(rules: RuleDraft[]) {
    return rules.map((rule) => ({ ...rule, id: uid("rule") }))
  }

  const output = pipeline.data?.output ?? ""
  const steps = pipeline.data?.steps ?? []
  const testResults = pipeline.data?.tests ?? []
  const score = scoreTests(pack.tests, testResults)
  const showTests = tab === "tests" || testsOpen

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2">
        <Stamp />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg leading-tight font-medium">置換台</h1>
          <p className="truncate text-xs text-muted">{pack.name || "無題の帳"}</p>
        </div>
        {score.total > 0 ? (
          <span
            className={clsx(
              "text-xs tabular-nums",
              score.pass === score.total ? "text-muted" : "text-accent",
            )}
          >
            試験 {score.pass}/{score.total}
          </span>
        ) : null}
        <Button onClick={() => setPacksOpen(true)}>
          <BookMarked className="size-4" />
          帳
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={clsx(
            "min-h-0 flex-1 gap-3 p-3 lg:grid-cols-3 lg:grid-rows-1",
            tab === "tests" ? "hidden lg:grid" : "grid grid-rows-1",
          )}
        >
          <RuleColumn
            className={tab === "rules" ? "flex" : "hidden lg:flex"}
            packName={pack.name}
            rules={pack.rules}
            steps={steps}
            onRename={(name) => renamePack(pack.id, name)}
            onUpdate={updateRule}
            onAdd={addRule}
            onRemove={removeRule}
            onMove={moveRule}
            onDuplicate={duplicateRule}
            onReplace={replaceRules}
          />
          <SourcePane
            className={tab === "source" ? "flex" : "hidden lg:flex"}
            source={source}
            onChange={setSource}
            onLoadSample={() => setSource(SAMPLE_SOURCE)}
          />
          <ResultPane
            className={tab === "result" ? "flex" : "hidden lg:flex"}
            source={source}
            output={output}
            rules={pack.rules}
            steps={steps}
            hung={pipeline.hung}
            fatal={pipeline.data?.fatal}
            packName={pack.name}
            onUseAsSource={() => {
              setSource(output)
              setTab("source")
            }}
          />
        </div>
        <TestBench
          className={clsx(
            tab === "tests" ? "flex min-h-0 flex-1" : "hidden lg:flex",
            showTests ? "lg:h-72 lg:flex-none" : "lg:h-12 lg:flex-none",
          )}
          open={showTests}
          tests={pack.tests}
          results={testResults}
          onToggle={() => {
            if (window.matchMedia("(min-width: 1024px)").matches) setTestsOpen((value) => !value)
            else setTab(tab === "tests" ? "result" : "tests")
          }}
          onAdd={(fromSource) => {
            const id = addTest()
            if (fromSource) updateTest(id, { input: source, name: "原文" })
          }}
          onUpdate={updateTest}
          onRemove={removeTest}
          onLock={(id, next) => updateTest(id, { expected: next })}
        />
      </div>

      <nav className="nav-safe grid shrink-0 grid-cols-4 border-t border-line bg-surface lg:hidden" aria-label="作業">
        {TABS.map((item) => {
          const Icon = item.icon
          const selected = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={clsx(
                "relative flex h-14 flex-col items-center justify-center gap-0.5 text-xs",
                selected ? "text-fg" : "text-muted",
              )}
              onClick={() => setTab(item.id)}
            >
              {selected ? <span className="absolute inset-x-4 top-0 h-0.5 bg-accent" /> : null}
              <Icon className="size-4" />
              {item.label}
              {item.id === "tests" && score.total > 0 ? (
                <span className="sr-only">
                  {score.pass} / {score.total}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>

      <PackDialog
        open={packsOpen}
        packs={packs}
        activeId={pack.id}
        onOpenChange={setPacksOpen}
        onSelect={setActive}
        onCreate={newPack}
        onDuplicate={duplicatePack}
        onDelete={deletePack}
        onImport={(next) => importPacks(next, true)}
      />
      <ShareInbox
        open={shareId.length > 0}
        loading={shareLoading}
        error={shareOffer && "error" in shareOffer ? shareOffer.error : ""}
        share={shareOffer && !("error" in shareOffer) ? shareOffer : null}
        onOpenChange={(next) => {
          if (!next) closeShare()
        }}
        onReplace={(rules) => {
          replaceRules(withIds(rules))
          setTab("rules")
          closeShare()
        }}
        onCreate={(name, rules) => {
          importPacks(
            [
              {
                id: uid("pack"),
                name,
                rules: withIds(rules),
                tests: [],
                updatedAt: Date.now(),
              },
            ],
            true,
          )
          setTab("rules")
          closeShare()
        }}
      />
    </div>
  )
}
