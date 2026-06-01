-- Allow dedicated meal voucher accounts such as Tickets Restaurant.
ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_type_check;

ALTER TABLE accounts
  ADD CONSTRAINT accounts_type_check
  CHECK (type IN (
    'checking',
    'savings',
    'credit',
    'investment',
    'cash',
    'crypto',
    'meal_voucher'
  ));
