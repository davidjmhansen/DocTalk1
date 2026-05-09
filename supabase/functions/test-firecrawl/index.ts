import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ error: "FIRECRAWL_API_KEY is not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const keyPreview = `${firecrawlKey.slice(0, 6)}...${firecrawlKey.slice(-4)}`;

    let targetUrl = "https://example.com";
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.url) targetUrl = body.url;
      } catch { /* no body, use default */ }
    }

    const firecrawlPayload = {
      url: targetUrl,
      formats: ["markdown"],
      onlyMainContent: true,
    };

    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${firecrawlKey}`,
      },
      body: JSON.stringify(firecrawlPayload),
    });

    const responseBody = await res.json();

    return new Response(
      JSON.stringify({
        keyPresent: true,
        keyPreview,
        firecrawlStatus: res.status,
        firecrawlOk: res.ok,
        firecrawlResponse: responseBody,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
