import { createFileRoute, stripSearchParams } from "@tanstack/react-router"
import { Workshop } from "@/components/bench/workshop"

type HomeSearch = { s: string }

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    s: typeof search.s === "string" ? search.s : "",
  }),
  search: {
    middlewares: [stripSearchParams({ s: "" })],
  },
  component: Home,
})

function Home() {
  const { s } = Route.useSearch()
  return <Workshop shareId={s} />
}
