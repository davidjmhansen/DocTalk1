import { ExternalLink, TriangleAlert as AlertTriangle, Calendar, ShieldCheck, ShieldAlert, Shield } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { Result, Citation } from "@/lib/supabase"

interface ResultCardProps {
  result: Result
}

function CredibilityBadge({ level }: { level: string }) {
  if (level === "high") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 gap-1 font-medium">
        <ShieldCheck className="h-3 w-3" />High Credibility
      </Badge>
    )
  }
  if (level === "low") {
    return (
      <Badge className="bg-destructive/10 text-destructive gap-1 font-medium">
        <ShieldAlert className="h-3 w-3" />Low Credibility
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1 font-medium">
      <Shield className="h-3 w-3" />Medium Credibility
    </Badge>
  )
}

function Section({ title, content, accent }: { title: string; content: string; accent?: boolean }) {
  if (!content) return null
  return (
    <div className={`space-y-1.5 rounded-md p-3 ${accent ? "bg-destructive/5 border border-destructive/20" : "bg-muted/50"}`}>
      <p className={`text-xs font-semibold uppercase tracking-wider ${accent ? "text-destructive" : "text-muted-foreground"}`}>{title}</p>
      <p className="text-sm text-foreground leading-relaxed">{content}</p>
    </div>
  )
}

function CitationRow({ citation }: { citation: Citation }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0">
      <div className="flex-1 min-w-0">
        <a href={citation.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:underline flex items-center gap-1 truncate">
          {citation.title || citation.url}
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
        </a>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{citation.source}</span>
          {citation.date && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />{citation.date}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function ResultCard({ result }: ResultCardProps) {
  const citations: Citation[] = Array.isArray(result.citations) ? result.citations : []

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start gap-2 justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold leading-snug">{result.title || result.url}</CardTitle>
            <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:underline flex items-center gap-1 mt-1 truncate">
              {result.url}<ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <CredibilityBadge level={result.source_credibility} />
            {result.published_date && (
              <Badge variant="outline" className="text-xs gap-1">
                <Calendar className="h-3 w-3" />{result.published_date}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {result.overview && <Section title="Clinical Overview" content={result.overview} />}
        {result.diagnosis && <Section title="Diagnosis / Criteria" content={result.diagnosis} />}
        {result.treatment && <Section title="Treatment Guidance" content={result.treatment} />}
        {result.risks && <Section title="Risks & Contraindications" content={result.risks} />}
        {result.red_flags && <Section title="Red Flags" content={result.red_flags} accent />}

        {citations.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Citations ({citations.length})</p>
              {citations.map((c, i) => <CitationRow key={i} citation={c} />)}
            </div>
          </>
        )}

        <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 flex gap-2 mt-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            This information is retrieved from third-party sources for reference only. Always apply clinical judgment. Not a substitute for professional medical advice, diagnosis, or treatment.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
