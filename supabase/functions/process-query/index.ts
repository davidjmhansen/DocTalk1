import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  queryId: string;
  urls: string[];
  topic: string;
  fullName: string;
  email: string;
}

interface ScrapedContent {
  url: string;
  content: string;
  title?: string;
  publishedDate?: string;
}

interface ResultRow {
  query_id: string;
  url: string;
  title: string;
  overview: string;
  diagnosis: string;
  treatment: string;
  risks: string;
  red_flags: string;
  citations: object[];
  source_credibility: string;
  published_date: string;
}

async function scrapeUrl(url: string, firecrawlKey: string): Promise<ScrapedContent> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${firecrawlKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`Firecrawl failed for ${url}: ${res.status}`);
  }

  const data = await res.json();
  return {
    url,
    content: data.data?.markdown ?? "",
    title: data.data?.metadata?.title ?? url,
    publishedDate: data.data?.metadata?.publishedTime ?? "",
  };
}

async function synthesiseWithOpenAI(
  scraped: ScrapedContent,
  topic: string,
  openaiKey: string
): Promise<ResultRow & { query_id: string }> {
  const systemPrompt = `You are a clinical evidence synthesiser. Given scraped medical article content and a clinical question, produce a structured JSON summary for clinicians. Be concise, accurate, and flag safety concerns. Return ONLY valid JSON, no markdown fences.`;

  const userPrompt = `Clinical question/topic: ${topic}

Source URL: ${scraped.url}
Source title: ${scraped.title ?? "Unknown"}
Published date: ${scraped.publishedDate ?? "Unknown"}

Scraped content:
${scraped.content.slice(0, 12000)}

Return a JSON object with exactly these fields:
{
  "title": "string — article/source title",
  "overview": "string — 2-3 sentence clinical overview relevant to the question",
  "diagnosis": "string — key diagnostic points, criteria, or findings from this source",
  "treatment": "string — treatment recommendations, protocols, or drug dosing",
  "risks": "string — risks, contraindications, adverse effects",
  "red_flags": "string — urgent warning signs or safety concerns (empty string if none)",
  "citations": [{"title": "string", "url": "string", "date": "string", "source": "string"}],
  "source_credibility": "high" | "medium" | "low",
  "published_date": "string — ISO date or empty string"
}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  return {
    query_id: "",
    url: scraped.url,
    title: (parsed.title as string) || scraped.title || scraped.url,
    overview: (parsed.overview as string) || "",
    diagnosis: (parsed.diagnosis as string) || "",
    treatment: (parsed.treatment as string) || "",
    risks: (parsed.risks as string) || "",
    red_flags: (parsed.red_flags as string) || "",
    citations: Array.isArray(parsed.citations) ? parsed.citations : [],
    source_credibility: (["high", "medium", "low"].includes(parsed.source_credibility as string)
      ? parsed.source_credibility
      : "medium") as string,
    published_date: (parsed.published_date as string) || scraped.publishedDate || "",
  };
}

function credibilityBadge(level: string): string {
  const colours: Record<string, string> = {
    high: "#16a34a",
    medium: "#d97706",
    low: "#dc2626",
  };
  const bg: Record<string, string> = {
    high: "#dcfce7",
    medium: "#fef3c7",
    low: "#fee2e2",
  };
  const colour = colours[level] ?? colours.medium;
  const background = bg[level] ?? bg.medium;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;color:${colour};background:${background};text-transform:uppercase;letter-spacing:0.05em">${level} credibility</span>`;
}

function resultBlock(r: ResultRow, index: number): string {
  const sections = [
    { label: "Overview", value: r.overview },
    { label: "Diagnosis", value: r.diagnosis },
    { label: "Treatment", value: r.treatment },
    { label: "Risks", value: r.risks },
    { label: "Red Flags", value: r.red_flags, highlight: true },
  ].filter((s) => s.value?.trim());

  const sectionHtml = sections
    .map(
      (s) => `
      <div style="margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${s.highlight ? "#dc2626" : "#6b7280"};margin-bottom:4px">${s.label}</div>
        <div style="font-size:14px;color:#1f2937;line-height:1.6">${s.value}</div>
      </div>`
    )
    .join("");

  return `
  <div style="border:1px solid #e5e7eb;border-radius:10px;padding:20px 24px;margin-bottom:20px;background:#fff">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;gap:12px">
      <div>
        <div style="font-size:11px;color:#9ca3af;margin-bottom:4px">Source ${index + 1}</div>
        <div style="font-size:15px;font-weight:600;color:#111827">${r.title}</div>
        <a href="${r.url}" style="font-size:12px;color:#2563eb;word-break:break-all">${r.url}</a>
      </div>
      <div style="flex-shrink:0">${credibilityBadge(r.source_credibility)}</div>
    </div>
    ${sectionHtml}
  </div>`;
}

function buildEmailHtml(
  fullName: string,
  topic: string,
  results: ResultRow[],
  appUrl: string
): string {
  const date = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:640px;margin:32px auto;background:#f3f4f6;padding:0 16px 32px">

    <!-- Header -->
    <div style="background:#111827;border-radius:10px 10px 0 0;padding:20px 28px;display:flex;align-items:center;gap:12px">
      <div style="width:32px;height:32px;background:#2563eb;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff">D</div>
      <span style="color:#fff;font-weight:700;font-size:16px">DocTalk</span>
      <span style="color:#6b7280;font-size:12px;margin-left:auto">${date}</span>
    </div>

    <!-- Body -->
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:28px">
      <div style="margin-bottom:24px">
        <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:4px">Clinical Evidence Report</div>
        <div style="font-size:13px;color:#6b7280">Hi ${fullName}, here are your synthesised results for:</div>
        <div style="margin-top:8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:10px 14px;font-size:14px;font-weight:500;color:#1d4ed8">${topic}</div>
      </div>

      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:12px">${results.length} source${results.length !== 1 ? "s" : ""} retrieved</div>

      ${results.map((r, i) => resultBlock(r, i)).join("")}

      <!-- View in app CTA -->
      <div style="margin-top:24px;text-align:center">
        <a href="${appUrl}?tab=history" style="display:inline-block;background:#2563eb;color:#fff;font-size:13px;font-weight:600;text-decoration:none;padding:11px 24px;border-radius:8px">View in DocTalk</a>
        <div style="font-size:11px;color:#9ca3af;margin-top:8px">Sign in to browse all your past queries and results</div>
      </div>

      <div style="margin-top:20px;padding:14px 18px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;color:#6b7280;line-height:1.6">
        <strong style="color:#374151">Disclaimer:</strong> This report is for clinical reference only. Always apply professional judgment. Not a substitute for medical advice or formal clinical guidelines.
      </div>
    </div>

  </div>
</body>
</html>`;
}

async function sendEmail(
  to: string,
  fullName: string,
  topic: string,
  results: ResultRow[],
  resendKey: string,
  appUrl: string
): Promise<void> {
  const html = buildEmailHtml(fullName, topic, results, appUrl);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: "DocTalk <onboarding@resend.dev>",
      to: [to],
      subject: `Clinical Evidence Report: ${topic}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[email] Resend failed: ${res.status} ${err}`);
    throw new Error(`Resend failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  console.log(`[email] Sent to ${to}, id: ${data.id}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!firecrawlKey || !openaiKey) {
      return new Response(
        JSON.stringify({ error: "Missing API keys" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: RequestBody = await req.json();
    const { queryId, urls, topic, fullName, email } = body;

    if (!queryId || !urls?.length) {
      return new Response(
        JSON.stringify({ error: "Missing queryId or urls" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: ResultRow[] = [];
    const errors: string[] = [];

    for (const url of urls) {
      try {
        console.log(`[scrape] START ${url}`);
        const scraped = await scrapeUrl(url, firecrawlKey);
        console.log(`[scrape] OK ${url} — content length: ${scraped.content.length}`);

        console.log(`[openai] START ${url}`);
        const synthesised = await synthesiseWithOpenAI(scraped, topic || "general clinical summary", openaiKey);
        console.log(`[openai] OK ${url} — title: ${synthesised.title}`);

        synthesised.query_id = queryId;
        results.push(synthesised);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[error] ${url}: ${msg}`);
        errors.push(`${url}: ${msg}`);
      }
    }

    if (results.length > 0) {
      const { error: insertError } = await supabase.from("results").insert(results);
      if (insertError) {
        console.error("Insert error:", JSON.stringify(insertError));
      }

      if (resendKey && email) {
        try {
          const appUrl = req.headers.get("origin") ?? req.headers.get("referer")?.replace(/\/$/, "") ?? "https://doctalk.care";
          await sendEmail(email, fullName || "Clinician", topic || "Clinical Query", results, resendKey, appUrl);
        } catch (emailErr) {
          const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
          console.error(`[email] Failed: ${msg}`);
          errors.push(`Email delivery failed: ${msg}`);
        }
      } else {
        console.warn("[email] Skipped — missing RESEND_API_KEY or email address");
      }
    }

    const finalStatus = results.length > 0 ? "completed" : "failed";
    await supabase
      .from("queries")
      .update({ status: finalStatus, completed_at: new Date().toISOString() })
      .eq("id", queryId);

    const { data: savedResults } = await supabase
      .from("results")
      .select("*")
      .eq("query_id", queryId);

    return new Response(
      JSON.stringify({ results: savedResults ?? [], errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
