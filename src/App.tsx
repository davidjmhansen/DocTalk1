import { useEffect, useRef, useState } from "react"
import { LogOut, History, Search, Moon, Sun, CircleCheck as CheckCircle2, MailCheck } from "lucide-react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import type { Result } from "@/lib/supabase"
import { LandingPage } from "@/components/LandingPage"
import { AuthModal } from "@/components/AuthModal"
import { QueryForm } from "@/components/QueryForm"
import { ResultCard } from "@/components/ResultCard"
import { ResultsSkeleton } from "@/components/ResultsSkeleton"
import { PastQueries } from "@/components/PastQueries"
import { ProcessingLog } from "@/components/ProcessingLog"
import type { UrlStep } from "@/components/ProcessingLog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { useTheme } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [showLogin, setShowLogin] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [currentResults, setCurrentResults] = useState<Result[]>([])
  const [queryStatus, setQueryStatus] = useState<"idle" | "processing" | "done" | "error">("idle")
  const [emailSent, setEmailSent] = useState(false)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [urlSteps, setUrlSteps] = useState<UrlStep[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [activeTab, setActiveTab] = useState<"query" | "history">(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get("tab") === "history" ? "history" : "query"
  })

  const { theme, setTheme } = useTheme()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    const showLoginHandler = () => setShowLogin(true)
    window.addEventListener("doctalk:show-login", showLoginHandler)

    return () => {
      listener.subscription.unsubscribe()
      window.removeEventListener("doctalk:show-login", showLoginHandler)
      stopPolling()
    }
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setCurrentResults([])
    setQueryStatus("idle")
    setEmailSent(false)
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  function startPolling(queryId: string, urls: string[]) {
    // initialise all urls as pending, first one as scraping
    setUrlSteps(urls.map((url, i) => ({ url, status: i === 0 ? "scraping" : "pending" })))

    let completedCount = 0
    let pollTick = 0

    pollRef.current = setInterval(async () => {
      pollTick++
      const { data: done } = await supabase
        .from("results")
        .select("url")
        .eq("query_id", queryId)

      const doneUrls = new Set((done ?? []).map((r: { url: string }) => r.url))
      const newCompleted = doneUrls.size

      if (newCompleted > completedCount) {
        completedCount = newCompleted
      }

      // after ~5s on the active URL, advance from scraping → analysing
      const activeStatus = (i: number): UrlStep["status"] => {
        if (i < completedCount) return "done"
        if (i === completedCount) return pollTick % 6 < 3 ? "scraping" : "analysing"
        return "pending"
      }

      setUrlSteps(urls.map((url, i) => ({
        url,
        status: doneUrls.has(url) ? "done" : activeStatus(i),
      })))
    }, 2500)
  }

  async function runQuery(
    userId: string,
    formData: { urls: string[]; topic?: string; fullName: string; email: string }
  ) {
    const { data: query, error: queryError } = await supabase
      .from("queries")
      .insert({
        user_id: userId,
        full_name: formData.fullName,
        email: formData.email,
        urls: formData.urls,
        topic: formData.topic ?? null,
        status: "processing",
      })
      .select()
      .maybeSingle()

    if (queryError || !query) {
      setQueryStatus("error")
      setSubmitting(false)
      toast.error("Failed to save query. Please try again.")
      return
    }

    startPolling(query.id, formData.urls)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token ?? SUPABASE_ANON_KEY

      const response = await fetch(`${SUPABASE_URL}/functions/v1/process-query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          queryId: query.id,
          urls: formData.urls,
          topic: formData.topic,
          fullName: formData.fullName,
          email: formData.email,
        }),
      })

      stopPolling()

      if (!response.ok) {
        throw new Error(`Edge function error: ${response.status}`)
      }

      const data = await response.json()

      if (data?.results && Array.isArray(data.results) && data.results.length > 0) {
        setCurrentResults(data.results as Result[])
        setQueryStatus("done")
        setEmailSent(true)
        toast.success("Evidence retrieved successfully.")
      } else {
        setQueryStatus("done")
        toast.warning("Query processed but no results were returned. Check your URLs and try again.")
      }
    } catch {
      stopPolling()
      await supabase.from("queries").update({ status: "failed" }).eq("id", query.id)
      setQueryStatus("error")
      toast.error("Failed to retrieve evidence. Please try again.")
    }

    setSubmitting(false)
    setHistoryRefreshKey((k) => k + 1)
  }

  async function handleLandingSubmit(data: {
    urls: string[]
    topic: string
    fullName: string
    email: string
    password: string
  }) {
    setSubmitError("")
    setSubmitting(true)
    setQueryStatus("processing")
    setCurrentResults([])
    setEmailSent(false)

    let userId: string | undefined
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (!signInError && signInData.session) {
      userId = signInData.session.user.id
    } else {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      })
      if (signUpError || !signUpData.session) {
        setSubmitError(signUpError?.message ?? "Account creation failed. Try signing in instead.")
        setSubmitting(false)
        setQueryStatus("idle")
        return
      }
      userId = signUpData.session.user.id
    }

    await runQuery(userId!, { urls: data.urls, topic: data.topic, fullName: data.fullName, email: data.email })
  }

  async function handleDashboardSubmit(formData: { urls: string[]; topic: string; fullName: string; email: string }) {
    if (!session) return
    setSubmitting(true)
    setQueryStatus("processing")
    setCurrentResults([])
    setEmailSent(false)
    await runQuery(session.user.id, formData)
  }

  if (authLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <>
        {showLogin ? (
          <AuthModal onSuccess={() => setShowLogin(false)} onBack={() => setShowLogin(false)} />
        ) : (
          <LandingPage
            onSubmit={handleLandingSubmit}
            submitting={submitting}
            submitError={submitError}
          />
        )}
        <Toaster position="bottom-right" />
      </>
    )
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
              D
            </div>
            <span className="font-bold tracking-tight text-foreground">DocTalk</span>
            <Badge variant="secondary" className="text-xs hidden sm:flex">Beta</Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[180px]">
              {session.user.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-8 w-8"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-8 w-8">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "query" | "history")}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Evidence Retrieval</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Synthesised clinical summaries from trusted medical sources
              </p>
            </div>
            <TabsList>
              <TabsTrigger value="query" className="gap-1.5">
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Query</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5">
                <History className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">History</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="query">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2">
                <QueryForm onSubmit={handleDashboardSubmit} loading={submitting} />
              </div>

              <div className="lg:col-span-3 space-y-4">
                {queryStatus === "idle" && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Search className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Results will appear here</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Submit a query to retrieve clinical evidence from your selected sources
                    </p>
                  </div>
                )}

                {queryStatus === "processing" && (
                  <>
                    <ProcessingLog steps={urlSteps} />
                    <ResultsSkeleton count={1} />
                  </>
                )}

                {(queryStatus === "done" || queryStatus === "error") && (
                  <>
                    {emailSent && (
                      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 px-4 py-3">
                        <MailCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <p className="text-sm text-emerald-800 dark:text-emerald-300">
                          Report sent to your email
                        </p>
                      </div>
                    )}

                    {queryStatus === "done" && currentResults.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span>
                          {currentResults.length} source{currentResults.length > 1 ? "s" : ""} retrieved
                        </span>
                        <Separator orientation="vertical" className="h-4" />
                        <button
                          className="hover:text-foreground transition-colors underline-offset-2 hover:underline text-xs"
                          onClick={() => {
                            setQueryStatus("idle")
                            setCurrentResults([])
                          }}
                        >
                          Clear results
                        </button>
                      </div>
                    )}

                    {queryStatus === "error" && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                        <p className="text-sm text-destructive font-medium">Query failed</p>
                        <p className="text-xs text-destructive/80 mt-0.5">
                          Please try again or contact support.
                        </p>
                      </div>
                    )}

                    <div className="space-y-4">
                      {currentResults.map((result) => (
                        <ResultCard key={result.id} result={result} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="max-w-2xl">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-foreground">Past Queries</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  View and expand your previous evidence retrievals
                </p>
              </div>
              <PastQueries refreshKey={historyRefreshKey} />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Toaster position="bottom-right" />
    </div>
  )
}

export default App
