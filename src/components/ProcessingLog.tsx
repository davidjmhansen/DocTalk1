import { useEffect, useRef } from "react"
import { CircleCheck as CheckCircle2, Loader as Loader2, Globe, Clock, CircleAlert as AlertCircle } from "lucide-react"

export interface UrlStep {
  url: string
  status: "pending" | "scraping" | "analysing" | "done" | "error"
}

interface ProcessingLogProps {
  steps: UrlStep[]
}

const STEP_LABELS: Record<UrlStep["status"], string> = {
  pending: "Waiting...",
  scraping: "Scraping content",
  analysing: "Analysing with AI",
  done: "Complete",
  error: "Failed",
}

function StepIcon({ status }: { status: UrlStep["status"] }) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
  if (status === "error") return <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
  if (status === "pending") return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
  return <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />
}

function shortUrl(url: string) {
  try { return new URL(url).hostname } catch { return url }
}

export function ProcessingLog({ steps }: ProcessingLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [steps])

  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
        <span className="text-xs font-semibold text-foreground tracking-wide uppercase">Processing</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {steps.filter(s => s.status === "done").length} / {steps.length} sources
        </span>
      </div>
      <div className="divide-y divide-border">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-3 transition-colors ${
              step.status === "scraping" || step.status === "analysing"
                ? "bg-primary/5"
                : ""
            }`}
          >
            <StepIcon status={step.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-foreground truncate">{shortUrl(step.url)}</span>
              </div>
              <span className={`text-xs ${
                step.status === "error" ? "text-destructive" :
                step.status === "done" ? "text-emerald-600 dark:text-emerald-400" :
                step.status === "pending" ? "text-muted-foreground" :
                "text-primary"
              }`}>
                {STEP_LABELS[step.status]}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div ref={bottomRef} />
    </div>
  )
}
