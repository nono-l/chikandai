export type DiffRow = {
  kind: "same" | "add" | "del"
  text: string
  fold?: number
}

export type LineDiff = {
  rows: DiffRow[]
  changed: boolean
  truncated: boolean
}

const LINE_CAP = 320

function foldContext(rows: DiffRow[], context = 1): DiffRow[] {
  if (rows.length === 0) return rows
  const keep = rows.map((row) => row.kind !== "same")
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].kind === "same") continue
    for (let k = Math.max(0, i - context); k <= Math.min(rows.length - 1, i + context); k++) {
      keep[k] = true
    }
  }
  const out: DiffRow[] = []
  let skipped = 0
  const flush = () => {
    if (skipped === 0) return
    out.push({ kind: "same", text: "", fold: skipped })
    skipped = 0
  }
  rows.forEach((row, index) => {
    if (keep[index]) {
      flush()
      out.push(row)
    } else {
      skipped += 1
    }
  })
  flush()
  return out
}

function lcsRows(a: string[], b: string[]): DiffRow[] {
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i]
    const next = dp[i + 1]
    for (let j = m - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? next[j + 1] + 1 : Math.max(next[j], row[j + 1])
    }
  }
  const rows: DiffRow[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ kind: "same", text: a[i] })
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ kind: "del", text: a[i] })
      i += 1
    } else {
      rows.push({ kind: "add", text: b[j] })
      j += 1
    }
  }
  while (i < n) rows.push({ kind: "del", text: a[i++] })
  while (j < m) rows.push({ kind: "add", text: b[j++] })
  return rows
}

function coarse(a: string[], b: string[]): DiffRow[] {
  const rows: DiffRow[] = []
  const n = Math.max(a.length, b.length)
  let shown = 0
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) continue
    if (a[i] !== undefined) rows.push({ kind: "del", text: a[i] })
    if (b[i] !== undefined) rows.push({ kind: "add", text: b[i] })
    shown += 1
    if (shown >= 60) {
      rows.push({ kind: "same", text: "", fold: Math.max(0, n - i - 1) })
      break
    }
  }
  return rows
}

export function diffLines(before: string, after: string): LineDiff {
  if (before === after) return { rows: [], changed: false, truncated: false }
  const a = before.split("\n")
  const b = after.split("\n")
  const heavy = a.length > LINE_CAP || b.length > LINE_CAP || a.length * b.length > 90_000
  if (heavy) return { rows: coarse(a, b), changed: true, truncated: true }
  return { rows: foldContext(lcsRows(a, b)), changed: true, truncated: false }
}
