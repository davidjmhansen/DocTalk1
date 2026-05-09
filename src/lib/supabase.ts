import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Citation = {
  title: string
  url: string
  date: string
  source: string
}

export type Result = {
  id: string
  query_id: string
  url: string
  title: string
  overview: string
  diagnosis: string
  treatment: string
  risks: string
  red_flags: string
  citations: Citation[]
  source_credibility: "high" | "medium" | "low"
  published_date: string
  created_at: string
}

export type Query = {
  id: string
  user_id: string
  full_name: string
  email: string
  urls: string[]
  topic: string | null
  status: "pending" | "processing" | "completed" | "failed"
  created_at: string
  completed_at: string | null
}
