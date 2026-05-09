import { useState } from "react"
import { Plus, Trash2, Send, Globe, User, Mail, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"

interface QueryFormProps {
  onSubmit: (data: { urls: string[]; topic: string; fullName: string; email: string }) => Promise<void>
  loading: boolean
}

export function QueryForm({ onSubmit, loading }: QueryFormProps) {
  const [urls, setUrls] = useState([""])
  const [topic, setTopic] = useState("")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [keepFields, setKeepFields] = useState(false)

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
    await onSubmit({ urls: filteredUrls, topic, fullName, email })
    if (!keepFields) {
      setUrls([""])
      setTopic("")
      setFullName("")
      setEmail("")
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">New Evidence Query</CardTitle>
        </div>
        <CardDescription>Describe your clinical question and add up to 5 trusted medical source URLs.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="qf-topic" className="text-sm font-medium flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              Clinical question / topic
            </Label>
            <Textarea id="qf-topic" placeholder="e.g. Paediatric sepsis management, first-line antibiotic choices and dosing" value={topic} onChange={(e) => setTopic(e.target.value)} className="resize-none min-h-[72px] text-sm" required />
          </div>

          <Separator />

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
                    <Input type="text" placeholder={i === 0 ? "https://pubmed.ncbi.nlm.nih.gov/..." : `https://source-${i + 1}.org/...`} value={url} onChange={(e) => updateUrl(i, e.target.value)} onPaste={(e) => handlePaste(i, e)} className="pl-9" required={i === 0} />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full-name" className="text-sm font-medium">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="full-name" type="text" placeholder="Dr. Jane Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-9" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-email" className="text-sm font-medium">Report Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="report-email" type="email" placeholder="doctor@hospital.org" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" required />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={keepFields}
              onChange={(e) => setKeepFields(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
            />
            <span className="text-sm text-muted-foreground">Keep fields after submitting</span>
          </label>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? (<><Spinner className="mr-2 h-4 w-4" />Processing query...</>) : (<><Send className="mr-2 h-4 w-4" />Retrieve Evidence</>)}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
