import { runJob } from "./engine"
import type { JobRequest } from "./types"

self.onmessage = (event: MessageEvent<JobRequest>) => {
  const result = runJob(event.data)
  self.postMessage(result)
}
