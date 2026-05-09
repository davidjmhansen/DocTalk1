/*
  # Add topic column to queries

  Adds an optional `topic` text column to the queries table
  to store the clinical question/topic submitted with each query.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queries' AND column_name = 'topic'
  ) THEN
    ALTER TABLE queries ADD COLUMN topic text;
  END IF;
END $$;
