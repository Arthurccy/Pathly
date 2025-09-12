@@ .. @@
 -- Supabase SQL Schema for BudgetDiary
 -- Run this in your Supabase SQL editor
 
--- Enable Row Level Security
-ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';
-
 -- Create accounts table
 CREATE TABLE IF NOT EXISTS accounts (