/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { latestReport, boundedGet, main } = require('../tools/revenue-radar-pc/city-scan.cjs');
const path = '/files/assets/main/v/1/samhd/documents/health-data-statistics/fe/2026/1018-1024.xlsx';
test('PC scanner accepts only current official report links', () => {
 const now=new Date('2026-11-01T09:00:00Z');
 assert.equal(latestReport(`<a href="https://other.invalid${path}">bad</a><a href="${path}">good</a>`,now),`https://www.sa.gov${path}`);
 assert.equal(latestReport(`<a href="${path.replace('1018','0101')}">stale</a>`,now),null);
});
test('PC scan forwards only workbook bytes and sends the key only to the production importer', async t => {
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-01T09:00:00Z').getTime()});
 const original=global.fetch, saved=process.env.CHILL_RADAR_SECRET;
 process.env.CHILL_RADAR_SECRET='fixture-only-key'; let count=0;
 global.fetch=async (url,init={})=>{
  count++;
  if(count<=2){assert.equal(init.headers,undefined); return count===1?new Response(`<a href="${path}">report</a>`):new Response(Buffer.from('PKfixture'));}
  assert.equal(url,'https://chill-bros.vercel.app/api/cron/radar-city-import');
  assert.equal(init.headers.authorization,'Bearer fixture-only-key');
  assert.equal(init.body.toString(),'PKfixture');
  return Response.json({ok:true,inReport:2,added:1,skippedCustomers:1});
 };
 try{await main(); assert.equal(count,3);}finally{global.fetch=original;if(saved===undefined)delete process.env.CHILL_RADAR_SECRET;else process.env.CHILL_RADAR_SECRET=saved;}
});
test('PC scanner rejects public-source failures and oversized responses',async()=>{
 const original=global.fetch;
 try{
  global.fetch=async()=>new Response('denied',{status:403});await assert.rejects(boundedGet('https://www.sa.gov'),/HTTP 403/);
  global.fetch=async()=>new Response('x',{headers:{'content-length':'3000000'}});await assert.rejects(boundedGet('https://www.sa.gov'),/size limit/);
 }finally{global.fetch=original;}
});
