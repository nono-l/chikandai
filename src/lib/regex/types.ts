export type Rule = {
  id: string
  label: string
  enabled: boolean
  pattern: string
  flags: string
  replacement: string
  literal: boolean
  /** One `key=value` entry per line. Look up a named group with `${辞書($<語>)}`. */
  dictionary: string
}

export type TestCase = {
  id: string
  name: string
  input: string
  expected: string
}

export type Pack = {
  id: string
  name: string
  rules: Rule[]
  tests: TestCase[]
  updatedAt: number
}

export type GroupChip = {
  key: string
  value: string
}

export type MatchSample = {
  full: string
  index: number
  groups: GroupChip[]
  rendered?: string
}

export type StepInfo = {
  id: string
  skipped: boolean
  error?: string
  count: number
  sample?: MatchSample
  /** Present when a Japanese/emoji shorthand was rewritten. */
  expanded?: string
  unicodeAdded?: boolean
}

export type TestInfo = {
  id: string
  output: string
  error?: string
  /** null when no expected string was given */
  pass: boolean | null
}

export type JobRequest = {
  requestId: number
  source: string
  rules: Rule[]
  tests: TestCase[]
}

export type JobResponse = {
  requestId: number
  output: string
  steps: StepInfo[]
  tests: TestInfo[]
  fatal?: string
}
