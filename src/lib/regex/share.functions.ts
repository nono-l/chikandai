import { createServerFn } from "@tanstack/react-start"
import { getSql } from "@/lib/db"
import { newShareId, parseShareBody, parseShareId } from "./share-body"
import type { RuleDraft } from "./xml"

async function dropExpired() {
  const sql = await getSql()
  await sql`delete from shares where expires_at <= now()`
  return sql
}

export const publishShare = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }): Promise<{ id: string } | { error: string }> => {
    const body = parseShareBody(data)
    if ("error" in body) return body
    const sql = await dropExpired()
    const id = newShareId()
    await sql`insert into shares (id, name, rules, expires_at) values (${id}, ${body.name}, ${JSON.stringify(body.rules)}, now() + interval '7 days')`
    return { id }
  })

export const loadShare = createServerFn({ method: "GET" })
  .validator((input: unknown) => input)
  .handler(async ({ data }): Promise<{ name: string; rules: RuleDraft[] } | { error: string }> => {
    const id = parseShareId(data)
    if (!id) return { error: "共有の番号が違います" }
    const sql = await dropExpired()
    const rows = await sql<{ name: string; rules: string }>`
      select name, rules from shares where id = ${id} and expires_at > now()
    `
    const row = rows[0]
    if (!row) return { error: "この共有は見つからないか、期限が切れています" }
    let stored: unknown
    try {
      stored = JSON.parse(row.rules)
    } catch {
      return { error: "共有を読めませんでした" }
    }
    const body = parseShareBody({ name: row.name, rules: stored })
    if ("error" in body) return { error: "共有を読めませんでした" }
    return body
  })
