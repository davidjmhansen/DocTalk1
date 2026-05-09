import { useState } from "react"
import { Plus, Trash2, Send, Globe, User, Mail, MessageSquare, Lock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"

interface LandingPageProps {
  onSubmit: (data: {
    urls: string[]
    topic: string
    fullName: string
    email: string
    password: string
  }) => Promise<void>
  submitting: boolean
  submitError: string
}

export function LandingPage({ onSubmit, submitting, submitError }: LandingPageProps) {
  const [urls, setUrls] = useState([""])
  const [topic, setTopic] = useState("")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  function addUrl() { if (urls.length < 5) setUrls([...urls, ""]) }
  function removeUrl(index: number) { setUrls(urls.filter((_, i) => i !== index)) }
  function updateUrl(index: number, value: string) {
    const next = [...urls]; next[index] = value; setUrls(next)
  }

  function handlePaste(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text")
    const lines = pasted.split(/[\n\r\s]+/).map((s) => s.trim()).filter(Boolean)
    if (lines.length <= 1) return
    e.preventDefault()
    const merged = [...urls]
    merged[index] = lines[0]
    for (let i = 1; i < lines.length; i++) {
      if (merged.length < 5) merged.push(lines[i])
    }
    setUrls(merged)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const filteredUrls = urls.map((u) => u.trim()).filter(Boolean)
    if (filteredUrls.length === 0) return
    await onSubmit({ urls: filteredUrls, topic, fullName, email, password })
  }

  return (
    <div className="min-h-svh bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
              D
            </div>
            <span className="font-bold tracking-tight text-foreground">DocTalk</span>
            <Badge variant="secondary" className="text-xs hidden sm:flex">Beta</Badge>
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("doctalk:show-login"))}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            Sign in <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Clinical evidence synthesis for busy clinicians
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4 leading-tight">
          Medical evidence,<br />synthesised instantly
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
          Paste trusted medical source URLs, ask your clinical question, and get a structured evidence summary — diagnosis, treatment, risks, and red flags.
        </p>
      </section>

      {/* Form */}
      <section className="max-w-2xl mx-auto px-4 pb-20">
        <div className="rounded-xl border border-border bg-card shadow-sm p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Topic */}
            <div className="space-y-2">
              <Label htmlFor="lp-topic" className="text-sm font-medium flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                Clinical question / topic
              </Label>
              <Textarea
                id="lp-topic"
                placeholder="e.g. Paediatric sepsis management, first-line antibiotic choices and dosing"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="resize-none min-h-[80px] text-sm"
                required
              />
            </div>

            <Separator />

            {/* URLs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Source URLs</Label>
                <Badge variant="secondary" className="text-xs">{urls.length} / 5</Badge>
              </div>
              <div className="space-y-2">
                {urls.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="relative flex-1">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder={i === 0 ? "https://pubmed.ncbi.nlm.nih.gov/..." : `https://source-${i + 1}.org/...`}
                        value={url}
                        onChange={(e) => updateUrl(i, e.target.value)}
                        onPaste={(e) => handlePaste(i, e)}
                        className="pl-9"
                        required={i === 0}
                      />
                    </div>
                    {urls.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeUrl(i)} className="shrink-0 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {urls.length < 5 && (
                <Button type="button" variant="outline" size="sm" onClick={addUrl} className="w-full border-dashed">
                  <Plus className="h-4 w-4 mr-1" />
                  Add another source
                </Button>
              )}
            </div>

            <Separator />

            {/* User details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lp-name" className="text-sm font-medium">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="lp-name" type="text" placeholder="Dr. Jane Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-9" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lp-email" className="text-sm font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="lp-email" type="email" placeholder="doctor@hospital.org" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" required />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lp-password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="lp-password" type="password" placeholder="Create a password to save your results" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" required minLength={6} />
              </div>
              <p className="text-xs text-muted-foreground">Creates your account or signs you in automatically</p>
            </div>

            {submitError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                <p className="text-sm text-destructive">{submitError}</p>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting
                ? <><Spinner className="mr-2 h-4 w-4" />Retrieving evidence...</>
                : <><Send className="mr-2 h-4 w-4" />Retrieve Evidence</>
              }
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          For clinical reference only. Always apply professional judgment. Not a substitute for medical advice.
        </p>
      </section>
    </div>
  )
}
