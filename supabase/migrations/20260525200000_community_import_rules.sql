-- Community import rules store anonymized patterns learned from confirmed imports.
CREATE TABLE IF NOT EXISTS community_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_pattern TEXT NOT NULL,
  suggested_category_name TEXT NOT NULL,
  suggested_category_type TEXT NOT NULL CHECK (suggested_category_type IN ('income', 'expense', 'savings', 'debt', 'bill')),
  confidence_score DECIMAL(4,3) NOT NULL DEFAULT 0.7 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  confirmations_count INTEGER NOT NULL DEFAULT 1,
  corrections_count INTEGER NOT NULL DEFAULT 0,
  locale TEXT NOT NULL DEFAULT 'fr',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (normalized_pattern, suggested_category_name, suggested_category_type, locale)
);

CREATE TABLE IF NOT EXISTS rule_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  community_rule_id UUID REFERENCES community_rules(id) ON DELETE CASCADE,
  normalized_pattern TEXT NOT NULL,
  accepted BOOLEAN NOT NULL,
  corrected_category_name TEXT,
  corrected_category_type TEXT CHECK (corrected_category_type IN ('income', 'expense', 'savings', 'debt', 'bill')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE community_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view community rules"
  ON community_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert community rules"
  ON community_rules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update community rules"
  ON community_rules FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own rule feedback"
  ON rule_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own rule feedback"
  ON rule_feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_community_rules_pattern ON community_rules(normalized_pattern);
CREATE INDEX IF NOT EXISTS idx_community_rules_confidence ON community_rules(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_rule_feedback_user_id ON rule_feedback(user_id);

CREATE TRIGGER update_community_rules_updated_at
  BEFORE UPDATE ON community_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

NOTIFY pgrst, 'reload schema';
