import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { SAMPLE_SOURCE, seedPacks } from "./regex/presets"
import type { Pack, Rule, TestCase } from "./regex/types"

type Patch<T> = Partial<Omit<T, "id">>

type Workspace = {
  packs: Pack[]
  activeId: string
  source: string
  setSource: (source: string) => void
  setActive: (id: string) => void
  renamePack: (id: string, name: string) => void
  updateRule: (ruleId: string, patch: Patch<Rule>) => void
  addRule: () => string
  removeRule: (ruleId: string) => void
  moveRule: (ruleId: string, direction: -1 | 1) => void
  duplicateRule: (ruleId: string) => void
  addTest: () => string
  updateTest: (testId: string, patch: Patch<TestCase>) => void
  removeTest: (testId: string) => void
  newPack: () => string
  duplicatePack: (id: string) => string
  deletePack: (id: string) => void
  importPacks: (packs: Pack[], activateFirst: boolean) => void
  replaceRules: (rules: Rule[]) => void
}

const memory = new Map<string, string>()

const storage = createJSONStorage(() => ({
  getItem: (key: string) =>
    typeof window === "undefined" ? (memory.get(key) ?? null) : window.localStorage.getItem(key),
  setItem: (key: string, value: string) => {
    if (typeof window === "undefined") memory.set(key, value)
    else window.localStorage.setItem(key, value)
  },
  removeItem: (key: string) => {
    if (typeof window === "undefined") memory.delete(key)
    else window.localStorage.removeItem(key)
  },
}))

export function uid(prefix: string): string {
  const cryptoApi = globalThis.crypto
  const rand =
    cryptoApi && "randomUUID" in cryptoApi
      ? cryptoApi.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${rand}`
}

export function blankRule(): Rule {
  return {
    id: uid("rule"),
    label: "",
    enabled: true,
    pattern: "",
    flags: "gu",
    replacement: "",
    literal: false,
    dictionary: "",
  }
}

function blankTest(): TestCase {
  return { id: uid("test"), name: "", input: "", expected: "" }
}

function blankPack(name = "無題の帳"): Pack {
  return {
    id: uid("pack"),
    name,
    rules: [blankRule()],
    tests: [],
    updatedAt: Date.now(),
  }
}

function mapActive(packs: Pack[], activeId: string, edit: (pack: Pack) => Pack): Pack[] {
  return packs.map((pack) => (pack.id === activeId ? edit(pack) : pack))
}

const seed = seedPacks()

export const useWorkspace = create<Workspace>()(
  persist(
    (set, get) => ({
      packs: seed,
      activeId: seed[0].id,
      source: SAMPLE_SOURCE,
      setSource: (source) => set({ source }),
      setActive: (id) => set({ activeId: id }),
      renamePack: (id, name) =>
        set((state) => ({
          packs: state.packs.map((pack) =>
            pack.id === id ? { ...pack, name, updatedAt: Date.now() } : pack,
          ),
        })),
      updateRule: (ruleId, patch) =>
        set((state) => ({
          packs: mapActive(state.packs, state.activeId, (pack) => ({
            ...pack,
            updatedAt: Date.now(),
            rules: pack.rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
          })),
        })),
      addRule: () => {
        const rule = blankRule()
        set((state) => ({
          packs: mapActive(state.packs, state.activeId, (pack) => ({
            ...pack,
            updatedAt: Date.now(),
            rules: [...pack.rules, rule],
          })),
        }))
        return rule.id
      },
      removeRule: (ruleId) =>
        set((state) => ({
          packs: mapActive(state.packs, state.activeId, (pack) => ({
            ...pack,
            updatedAt: Date.now(),
            rules: pack.rules.filter((rule) => rule.id !== ruleId),
          })),
        })),
      moveRule: (ruleId, direction) =>
        set((state) => ({
          packs: mapActive(state.packs, state.activeId, (pack) => {
            const index = pack.rules.findIndex((rule) => rule.id === ruleId)
            const next = index + direction
            if (index < 0 || next < 0 || next >= pack.rules.length) return pack
            const rules = pack.rules.slice()
            const [item] = rules.splice(index, 1)
            rules.splice(next, 0, item)
            return { ...pack, rules, updatedAt: Date.now() }
          }),
        })),
      duplicateRule: (ruleId) =>
        set((state) => ({
          packs: mapActive(state.packs, state.activeId, (pack) => {
            const index = pack.rules.findIndex((rule) => rule.id === ruleId)
            if (index < 0) return pack
            const copy: Rule = { ...pack.rules[index], id: uid("rule"), label: pack.rules[index].label }
            const rules = pack.rules.slice()
            rules.splice(index + 1, 0, copy)
            return { ...pack, rules, updatedAt: Date.now() }
          }),
        })),
      addTest: () => {
        const test = blankTest()
        set((state) => ({
          packs: mapActive(state.packs, state.activeId, (pack) => ({
            ...pack,
            updatedAt: Date.now(),
            tests: [...pack.tests, test],
          })),
        }))
        return test.id
      },
      updateTest: (testId, patch) =>
        set((state) => ({
          packs: mapActive(state.packs, state.activeId, (pack) => ({
            ...pack,
            updatedAt: Date.now(),
            tests: pack.tests.map((test) => (test.id === testId ? { ...test, ...patch } : test)),
          })),
        })),
      removeTest: (testId) =>
        set((state) => ({
          packs: mapActive(state.packs, state.activeId, (pack) => ({
            ...pack,
            updatedAt: Date.now(),
            tests: pack.tests.filter((test) => test.id !== testId),
          })),
        })),
      newPack: () => {
        const pack = blankPack()
        set((state) => ({ packs: [...state.packs, pack], activeId: pack.id }))
        return pack.id
      },
      duplicatePack: (id) => {
        const source = get().packs.find((pack) => pack.id === id)
        const pack: Pack = source
          ? {
              ...structuredClone(source),
              id: uid("pack"),
              name: `${source.name}の写し`,
              updatedAt: Date.now(),
              rules: source.rules.map((rule) => ({ ...rule, id: uid("rule") })),
              tests: source.tests.map((test) => ({ ...test, id: uid("test") })),
            }
          : blankPack()
        set((state) => ({ packs: [...state.packs, pack], activeId: pack.id }))
        return pack.id
      },
      deletePack: (id) =>
        set((state) => {
          const packs = state.packs.filter((pack) => pack.id !== id)
          if (packs.length === 0) {
            const pack = blankPack()
            return { packs: [pack], activeId: pack.id }
          }
          const activeId = state.activeId === id ? packs[0].id : state.activeId
          return { packs, activeId }
        }),
      importPacks: (packs, activateFirst) =>
        set((state) => ({
          packs: [...state.packs, ...packs],
          activeId: activateFirst && packs[0] ? packs[0].id : state.activeId,
        })),
      replaceRules: (rules) =>
        set((state) => ({
          packs: mapActive(state.packs, state.activeId, (pack) => ({
            ...pack,
            rules,
            updatedAt: Date.now(),
          })),
        })),
    }),
    {
      name: "chikandai-v1",
      storage,
      skipHydration: true,
      version: 1,
      merge: (persisted, current) => sanitizePersisted(persisted, current),
    },
  ),
)

export function activePack(state: Pick<Workspace, "packs" | "activeId">): Pack {
  return state.packs.find((pack) => pack.id === state.activeId) ?? state.packs[0]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function coerceRule(value: unknown): Rule | null {
  if (!isRecord(value) || typeof value.pattern !== "string" || typeof value.replacement !== "string") {
    return null
  }
  return {
    id: typeof value.id === "string" ? value.id : uid("rule"),
    label: typeof value.label === "string" ? value.label : "",
    enabled: value.enabled !== false,
    pattern: value.pattern,
    flags: typeof value.flags === "string" ? value.flags : "gu",
    replacement: value.replacement,
    literal: value.literal === true,
    dictionary: typeof value.dictionary === "string" ? value.dictionary : "",
  }
}

function coerceTest(value: unknown): TestCase | null {
  if (!isRecord(value) || typeof value.input !== "string") return null
  return {
    id: typeof value.id === "string" ? value.id : uid("test"),
    name: typeof value.name === "string" ? value.name : "",
    input: value.input,
    expected: typeof value.expected === "string" ? value.expected : "",
  }
}

function coercePack(value: unknown): Pack | null {
  if (!isRecord(value) || !Array.isArray(value.rules)) return null
  const rules = value.rules.map(coerceRule).filter((rule): rule is Rule => rule !== null)
  const tests = Array.isArray(value.tests)
    ? value.tests.map(coerceTest).filter((test): test is TestCase => test !== null)
    : []
  return {
    id: typeof value.id === "string" ? value.id : uid("pack"),
    name: typeof value.name === "string" && value.name.trim() ? value.name : "無題の帳",
    rules,
    tests,
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : 0,
  }
}

function sanitizePersisted(persisted: unknown, current: Workspace): Workspace {
  if (!isRecord(persisted) || !Array.isArray(persisted.packs)) return current
  const packs = persisted.packs.map(coercePack).filter((pack): pack is Pack => pack !== null)
  if (packs.length === 0) return current
  const ids = new Set(packs.map((pack) => pack.id))
  for (const pack of seedPacks()) {
    if (!ids.has(pack.id)) packs.push(pack)
  }
  const activeId =
    typeof persisted.activeId === "string" && packs.some((pack) => pack.id === persisted.activeId)
      ? persisted.activeId
      : packs[0].id
  const source = typeof persisted.source === "string" ? persisted.source : current.source
  return { ...current, packs, activeId, source }
}
