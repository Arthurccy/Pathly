import test from 'node:test';
import assert from 'node:assert/strict';
import { insertImportBatch } from '../src/utils/importBatch.ts';

test('a successful batch is inserted once', async () => {
  let calls=0;
  const result=await insertImportBatch([1,2],async()=>{calls++;return {error:null};});
  assert.deepEqual(result,{imported:2,errors:[],uncertain:false});
  assert.equal(calls,1);
});

test('only confirmed atomic integrity failures permit row-by-row fallback', async () => {
  const payloads=[];
  const result=await insertImportBatch([1,2],async rows=>{
    payloads.push(rows);
    return rows.length===2 || rows[0]===2 ? {error:{code:'23505',message:'duplicate'}} : {error:null};
  });
  assert.deepEqual(payloads,[[1,2],[1],[2]]);
  assert.equal(result.imported,1);
  assert.equal(result.uncertain,false);
  assert.equal(result.errors.length,1);
});

test('timeout aborts the request and does not resend an ambiguous batch', async () => {
  let calls=0, signal;
  const result=await insertImportBatch([1,2],(_rows,s)=>{calls++;signal=s;return new Promise(()=>{});},10);
  assert.equal(signal.aborted,true);
  assert.equal(calls,1);
  assert.equal(result.imported,0);
  assert.equal(result.uncertain,true);
  assert.match(result.errors[0],/Rechargez/);
});

test('network failure stops retries even after partial row fallback', async () => {
  let calls=0;
  const result=await insertImportBatch([1,2,3],async rows=>{
    calls++;
    if(rows.length===3)return {error:{code:'23514',message:'constraint'}};
    if(rows[0]===1)return {error:null};
    throw new Error('connection lost');
  });
  assert.equal(calls,3);
  assert.equal(result.imported,1);
  assert.equal(result.uncertain,true);
});
