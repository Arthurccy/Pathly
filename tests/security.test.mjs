import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const A = '00000000-0000-0000-0000-000000000001';
const B = '00000000-0000-0000-0000-000000000002';

test('RLS isolates owners and rejects foreign financial references and shared learning', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon, authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;`);
    for (const name of ['20250707082001_twilight_base.sql', '20250912085454_jade_fountain.sql', '20260525200000_community_import_rules.sql', '20261013120000_account_balance_snapshots.sql']) {
      await db.exec(await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'));
    }
    await db.exec(`GRANT USAGE ON SCHEMA public TO anon, authenticated;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
      INSERT INTO auth.users VALUES ('${A}'), ('${B}');
      INSERT INTO accounts(id,user_id,name,type) VALUES ('${A}','${A}','A','checking'),('${B}','${B}','B','checking');
      INSERT INTO categories(id,user_id,name,icon,color,type) VALUES ('${A}','${A}','A','x','blue','expense'),('${B}','${B}','B','x','blue','expense');`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261112090000_security_hardening.sql', import.meta.url), 'utf8'));
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${A}';`);
    assert.deepEqual((await db.query('SELECT name FROM accounts')).rows, [{name:'A'}]);
    const insertTx = (account, category, transfer = 'NULL') => `INSERT INTO transactions(user_id,account_id,category_id,amount,description,date,type,transfer_to_account_id) VALUES ('${A}','${account}','${category}',10,'test',CURRENT_DATE,'expense',${transfer})`;
    await db.exec(insertTx(A,A));
    await assert.rejects(db.exec(insertTx(B,A)), /row-level security/);
    await assert.rejects(db.exec(insertTx(A,B)), /row-level security/);
    await assert.rejects(db.exec(insertTx(A,A,`'${B}'`)), /row-level security/);
    await assert.rejects(db.exec(`UPDATE transactions SET account_id='${B}'`), /row-level security/);
    await db.exec(`INSERT INTO account_balance_snapshots(user_id,account_id,snapshot_date,balance) VALUES ('${A}','${A}',CURRENT_DATE,100)`);
    await assert.rejects(db.exec(`INSERT INTO account_balance_snapshots(user_id,account_id,snapshot_date,balance) VALUES ('${A}','${B}',CURRENT_DATE,100)`), /row-level security/);
    await assert.rejects(db.exec(`UPDATE categories SET parent_id='${B}' WHERE id='${A}'`), /same owner/);
    await assert.rejects(db.exec('SELECT * FROM community_rules'), /permission denied/);
    await assert.rejects(db.exec(`INSERT INTO community_rules(normalized_pattern,suggested_category_name,suggested_category_type) VALUES ('private','x','expense')`), /permission denied/);
    await assert.rejects(db.exec('SELECT * FROM rule_feedback'), /permission denied/);
    await db.exec(`SET request.jwt.claim.sub = '${B}';`);
    assert.equal((await db.query('SELECT * FROM transactions')).rows.length, 0);
    assert.equal((await db.query('UPDATE transactions SET amount=999 RETURNING id')).rows.length,0);
    assert.equal((await db.query('DELETE FROM transactions RETURNING id')).rows.length,0);
    await db.exec(`SET ROLE anon; SET request.jwt.claim.sub = '';`);
    assert.equal((await db.query('SELECT * FROM accounts')).rows.length,0);
    await assert.rejects(db.exec(insertTx(A,A)), /row-level security/);
  } finally { await db.close(); }
});
