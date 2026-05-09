/*
  # DocTalk Core Schema

  1. New Tables
    - `queries` — stores each evidence retrieval request
      - `id` (uuid, pk)
      - `user_id` (uuid, fk to auth.users)
      - `full_name` (text)
      - `email` (text)
      - `urls` (text[])
      - `status` (text: pending/processing/completed/failed)
      - `created_at` (timestamptz)
      - `completed_at` (timestamptz, nullable)
    - `results` — stores synthesised evidence for each query
      - `id` (uuid, pk)
      - `query_id` (uuid, fk to queries)
      - `url`, `title`, `overview`, `diagnosis`, `treatment`, `risks`, `red_flags` (text)
      - `citations` (jsonb)
      - `source_credibility` (text)
      - `published_date` (text)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on both tables
    - Users can only view/insert/update their own queries
    - Users can only view/insert results for their own queries

  3. Indexes
    - queries(user_id)
    - results(query_id)
*/

CREATE TABLE IF NOT EXISTS queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  urls text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own queries"
  ON queries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own queries"
  ON queries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own queries"
  ON queries FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid REFERENCES queries(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  overview text DEFAULT '',
  diagnosis text DEFAULT '',
  treatment text DEFAULT '',
  risks text DEFAULT '',
  red_flags text DEFAULT '',
  citations jsonb DEFAULT '[]',
  source_credibility text DEFAULT 'medium',
  published_date text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view results for own queries"
  ON results FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM queries
      WHERE queries.id = results.query_id
      AND queries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert results for own queries"
  ON results FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM queries
      WHERE queries.id = results.query_id
      AND queries.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS queries_user_id_idx ON queries(user_id);
CREATE INDEX IF NOT EXISTS results_query_id_idx ON results(query_id);
