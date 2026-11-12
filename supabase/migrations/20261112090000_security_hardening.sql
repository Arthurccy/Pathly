-- Apply after reviewing/testing on a Supabase staging project. No data is deleted.
BEGIN;
-- Disable the retired shared-learning feature even if old permissive policies remain.
REVOKE ALL ON public.community_rules, public.rule_feedback FROM anon, authenticated;
CREATE POLICY "Retired community access" ON public.community_rules
 AS RESTRICTIVE FOR ALL TO public USING (false) WITH CHECK (false);
CREATE POLICY "Retired feedback access" ON public.rule_feedback
 AS RESTRICTIVE FOR ALL TO public USING (false) WITH CHECK (false);

CREATE POLICY "Related objects belong to current user" ON public.transactions
 AS RESTRICTIVE FOR ALL TO authenticated
 USING (true)
 WITH CHECK ((account_id IS NULL OR EXISTS (SELECT 1 FROM public.accounts AS owner_row WHERE owner_row.id = transactions.account_id AND owner_row.user_id = auth.uid()))
 AND (category_id IS NULL OR EXISTS (SELECT 1 FROM public.categories AS owner_row WHERE owner_row.id = transactions.category_id AND owner_row.user_id = auth.uid()))
 AND (transfer_to_account_id IS NULL OR EXISTS (SELECT 1 FROM public.accounts AS owner_row WHERE owner_row.id = transactions.transfer_to_account_id AND owner_row.user_id = auth.uid())));

CREATE POLICY "Related objects belong to current user" ON public.debts
 AS RESTRICTIVE FOR ALL TO authenticated
 USING (true)
 WITH CHECK ((account_id IS NULL OR EXISTS (SELECT 1 FROM public.accounts AS owner_row WHERE owner_row.id = debts.account_id AND owner_row.user_id = auth.uid()))
 AND (category_id IS NULL OR EXISTS (SELECT 1 FROM public.categories AS owner_row WHERE owner_row.id = debts.category_id AND owner_row.user_id = auth.uid())));

CREATE POLICY "Related objects belong to current user" ON public.savings_goals
 AS RESTRICTIVE FOR ALL TO authenticated
 USING (true)
 WITH CHECK ((account_id IS NULL OR EXISTS (SELECT 1 FROM public.accounts AS owner_row WHERE owner_row.id = savings_goals.account_id AND owner_row.user_id = auth.uid()))
 AND (category_id IS NULL OR EXISTS (SELECT 1 FROM public.categories AS owner_row WHERE owner_row.id = savings_goals.category_id AND owner_row.user_id = auth.uid())));

CREATE POLICY "Related objects belong to current user" ON public.budgets
 AS RESTRICTIVE FOR ALL TO authenticated
 USING (true)
 WITH CHECK ((category_id IS NULL OR EXISTS (SELECT 1 FROM public.categories AS owner_row WHERE owner_row.id = budgets.category_id AND owner_row.user_id = auth.uid())));

CREATE POLICY "Related objects belong to current user" ON public.rules
 AS RESTRICTIVE FOR ALL TO authenticated
 USING (true)
 WITH CHECK ((target_account_id IS NULL OR EXISTS (SELECT 1 FROM public.accounts AS owner_row WHERE owner_row.id = rules.target_account_id AND owner_row.user_id = auth.uid()))
 AND (target_category_id IS NULL OR EXISTS (SELECT 1 FROM public.categories AS owner_row WHERE owner_row.id = rules.target_category_id AND owner_row.user_id = auth.uid())));

CREATE POLICY "Related objects belong to current user" ON public.vendor_aliases
 AS RESTRICTIVE FOR ALL TO authenticated
 USING (true)
 WITH CHECK ((account_id IS NULL OR EXISTS (SELECT 1 FROM public.accounts AS owner_row WHERE owner_row.id = vendor_aliases.account_id AND owner_row.user_id = auth.uid()))
 AND (category_id IS NULL OR EXISTS (SELECT 1 FROM public.categories AS owner_row WHERE owner_row.id = vendor_aliases.category_id AND owner_row.user_id = auth.uid())));

CREATE POLICY "Related objects belong to current user" ON public.account_balance_snapshots
 AS RESTRICTIVE FOR ALL TO authenticated
 USING (true)
 WITH CHECK ((account_id IS NULL OR EXISTS (SELECT 1 FROM public.accounts AS owner_row WHERE owner_row.id = account_balance_snapshots.account_id AND owner_row.user_id = auth.uid())));

CREATE POLICY "Related objects belong to current user" ON public.debt_payments
 AS RESTRICTIVE FOR ALL TO authenticated
 USING (true)
 WITH CHECK ((transaction_id IS NULL OR EXISTS (SELECT 1 FROM public.transactions AS owner_row WHERE owner_row.id = debt_payments.transaction_id AND owner_row.user_id = auth.uid())));

-- Categories are self-referencing: avoid an RLS policy recursively querying itself.
CREATE OR REPLACE FUNCTION public.validate_category_parent_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.categories p WHERE p.id = NEW.parent_id AND p.user_id = NEW.user_id
 ) THEN RAISE EXCEPTION 'Category parent must belong to the same owner' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER category_parent_owner BEFORE INSERT OR UPDATE OF parent_id, user_id
 ON public.categories FOR EACH ROW EXECUTE FUNCTION public.validate_category_parent_owner();
REVOKE EXECUTE ON FUNCTION public.validate_category_parent_owner() FROM PUBLIC;
NOTIFY pgrst, 'reload schema';
COMMIT;
