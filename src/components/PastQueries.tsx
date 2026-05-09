import { useEffect, useState } from "react"
import { Clock, CircleCheck as CheckCircle2, Circle as XCircle, Loader as Loader2, ChevronRight, Globe } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Query, Result } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ResultCard } from "@/components/ResultCard"
import { ScrollArea } from "@/components/ui/scroll-area"

function StatusBadge({ status }: { status: Query["status"] }) {
  if (status === "completed") return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 gap-1"><CheckCircle2 className="h-3 w-3" />Completed</Badge>
  if (status === "failed") return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Failed</Badge>
  if (status === "processing") return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Processing</Badge>
  return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>
}

interface PastQueriesProps {
  refreshKey?: number
}

function PastQueries({ refreshKey }: PastQueriesProps) {
  const [queries, setQueries] = useState<Query[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, Result[]>>({})
  const [loadingResults, setLoadingResults] = useState<string | null>(null)

  useEffect(() => { loadQueries() }, [refreshKey])

  async function loadQueries() {
    setLoading(true)
    const { data } = await supabase.from("queries").select("*").order("created_at", { ascending: false }).limit(20)
    setLoading(false)
    if (data) setQueries(data as Query[])
  }

  async function toggleExpand(query: Query) {
    if (expandedId === query.id) { setExpandedId(null); return }
    setExpandedId(query.id)
    if (results[query.id]) return
    setLoadingResults(query.id)
    const { data } = await supabase.from("results").select("*").eq("query_id", query.id).order("created_at", { ascending: true })
    setLoadingResults(null)
    if (data) setResults((prev) => ({ ...prev, [query.id]: data as Result[] }))
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="pt-4">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (queries.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-10 text-center">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No past queries</p>
          <p className="text-xs text-muted-foreground mt-1">Your submitted queries will appear here</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {queries.map((query) => (
        <Card key={query.id} className="shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3 justify-between">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={query.status} />
                  <CardDescription className="text-xs">
                    {new Date(query.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </CardDescription>
                </div>
                <CardTitle className="text-sm font-semibold leading-snug">
                  {query.topic ?? "Untitled query"}
                </CardTitle>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {query.urls.slice(0, 3).map((url, i) => {
                    let hostname = url
                    try { hostname = new URL(url).hostname } catch { /* malformed url */ }
                    return (
                      <Badge key={i} variant="outline" className="text-xs gap-1 max-w-[200px] truncate">
                        <Globe className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{hostname}</span>
                      </Badge>
                    )
                  })}
                  {query.urls.length > 3 && <Badge variant="outline" className="text-xs">+{query.urls.length - 3} more</Badge>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => toggleExpand(query)} className="shrink-0">
                <ChevronRight className={`h-4 w-4 transition-transform ${expandedId === query.id ? "rotate-90" : ""}`} />
              </Button>
            </div>
          </CardHeader>

          {expandedId === query.id && (
            <CardContent className="pt-0 pb-4">
              {loadingResults === query.id ? (
                <div className="space-y-3 mt-3"><Skeleton className="h-32 w-full rounded-md" /></div>
              ) : (results[query.id] ?? []).length > 0 ? (
                <ScrollArea className="max-h-[600px] mt-3">
                  <div className="space-y-4 pr-2">
                    {(results[query.id] ?? []).map((r) => <ResultCard key={r.id} result={r} />)}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground mt-3 text-center py-4">No results yet for this query.</p>
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  )
}








// export { PastQueries }

export { PastQueries }