import { useEffect, useState } from "react"
import { runJob } from "./engine"
import type { JobResponse, Rule, TestCase } from "./types"

function createRegexWorker(): Worker {
  return new Worker(new URL("./regex.worker.ts", import.meta.url), { type: "module" })
}

export function usePipeline(source: string, rules: Rule[], tests: TestCase[]) {
  const key = JSON.stringify({ source, rules, tests })
  const [data, setData] = useState<JobResponse | null>(() =>
    runJob({ requestId: 0, source, rules, tests }),
  )
  const [pending, setPending] = useState(false)
  const [hung, setHung] = useState(false)

  useEffect(() => {
    const payload = JSON.parse(key) as {
      source: string
      rules: Rule[]
      tests: TestCase[]
    }
    let worker: Worker | null = null
    let settled = false
    const timer = window.setTimeout(() => {
      const requestId = 1
      const job = { requestId, ...payload }
      setPending(true)
      try {
        worker = createRegexWorker()
      } catch {
        setData(runJob(job))
        setPending(false)
        setHung(false)
        return
      }
      const kill = window.setTimeout(() => {
        if (settled) return
        settled = true
        worker?.terminate()
        setHung(true)
        setPending(false)
      }, 2000)
      worker.onmessage = (event: MessageEvent<JobResponse>) => {
        if (settled || event.data.requestId !== requestId) return
        settled = true
        window.clearTimeout(kill)
        setData(event.data)
        setPending(false)
        setHung(false)
      }
      worker.onerror = () => {
        if (settled) return
        settled = true
        window.clearTimeout(kill)
        try {
          setData(runJob(job))
          setHung(false)
        } catch {
          setHung(true)
        }
        setPending(false)
      }
      worker.postMessage(job)
    }, 80)

    return () => {
      window.clearTimeout(timer)
      settled = true
      worker?.terminate()
    }
  }, [key])

  return { data, pending, hung }
}