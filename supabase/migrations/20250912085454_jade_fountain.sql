/*
  # Import CSV + Règles intelligentes

  1. New Tables
    - `rules` - Règles d'auto-catégorisation pour l'import CSV
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `pattern` (text, motif de recherche)
      - `target_category_id` (uuid, foreign key to categories)
      - `target_account_id` (uuid, foreign key to accounts, optional)
      - `notes` (text, optional)
      - `priority` (integer, ordre d'application)
      - `is_active` (boolean, règle active/inactive)
      - `match_type` (text, type de correspondance)
      - `confidence_threshold` (decimal, seuil de confiance)
      - `created_at`, `updated_at` (timestamps)

    - `vendor_aliases` - Alias de commerçants pour améliorer la reconnaissance
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `alias` (text, nom original du commerçant)
      - `normalized` (text, nom normalisé)
      - `category_id` (uuid, foreign key to categories, optional)
      - `account_id` (uuid, foreign key to accounts, optional)
      - `created_at` (timestamp)

    - `import_jobs` - Historique des imports CSV
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `filename` (text, nom du fichier importé)
      - `started_at` (timestamp, début de l'import)
      - `completed_at` (timestamp, fin de l'import)
      - `rows_total` (integer, nombre total de lignes)
      - `rows_imported` (integer, lignes importées avec succès)
      - `rows_skipped` (integer, lignes ignorées)
      - `rows_duplicates` (integer, doublons détectés)
      - `errors_json` (jsonb, erreurs rencontrées)
      - `status` (text, statut de l'import)
      - `created_at` (timestamp)

  2. Table Updates
    - `transactions` - Ajout de colonnes pour l'import
      - `source` (text, source de la transaction: 'manual', 'import', 'recurring')
      - `dup_hash` (text, hash pour détecter les doublons)

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to manage their own data
    - Add indexes for performance
*/

-- Create rules table
CREATE TABLE IF NOT EXISTS rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pattern TEXT NOT NULL,
  target_category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  target_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  notes TEXT,
  priority INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  match_type TEXT NOT NULL DEFAULT 'contains' CHECK (match_type IN ('exact', 'contains', 'regex', 'fuzzy')),
  confidence_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.8 CHECK (confidence_threshold >= 0 AND confidence_threshold <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vendor_aliases table
CREATE TABLE IF NOT EXISTS vendor_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  alias TEXT NOT NULL,
  normalized TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create import_jobs table
CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  rows_skipped INTEGER NOT NULL DEFAULT 0,
  rows_duplicates INTEGER NOT NULL DEFAULT 0,
  errors_json JSONB,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns to transactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'source'
  ) THEN
    ALTER TABLE transactions ADD COLUMN source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'import', 'recurring'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'dup_hash'
  ) THEN
    ALTER TABLE transactions ADD COLUMN dup_hash TEXT;
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for rules
CREATE POLICY "Users can view own rules" ON rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rules" ON rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rules" ON rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rules" ON rules FOR DELETE USING (auth.uid() = user_id);

-- Create RLS Policies for vendor_aliases
CREATE POLICY "Users can view own vendor aliases" ON vendor_aliases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own vendor aliases" ON vendor_aliases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own vendor aliases" ON vendor_aliases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own vendor aliases" ON vendor_aliases FOR DELETE USING (auth.uid() = user_id);

-- Create RLS Policies for import_jobs
CREATE POLICY "Users can view own import jobs" ON import_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own import jobs" ON import_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own import jobs" ON import_jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own import jobs" ON import_jobs FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rules_user_id ON rules(user_id);
CREATE INDEX IF NOT EXISTS idx_rules_priority ON rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_aliases_user_id ON vendor_aliases(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_aliases_normalized ON vendor_aliases(normalized);
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id ON import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_dup_hash ON transactions(dup_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(source);

-- Create updated_at triggers
CREATE TRIGGER update_rules_updated_at BEFORE UPDATE ON rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();