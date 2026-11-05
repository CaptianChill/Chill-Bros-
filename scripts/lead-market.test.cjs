/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, deps = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const m = { exports: {} };
  new Function('require','module','exports',source)((name) => { if(name in deps)return deps[name]; if(name==='server-only')return {}; if(name.startsWith('node:'))return require(name); throw new Error('Unexpected dependency '+name); },m,m.exports);
  return m.exports;
}
const rules = load('lib/lead-market/rules.ts');
test('CSV neutralizes spreadsheet formulas and quotes purchased data', () => {
  for (const value of ['=HYPERLINK("https://bad.test")','+cmd','-1+1','@SUM(1)','  =1+1','\tformula']) assert.match(rules.csvCell(value), /^"'/);
  assert.equal(rules.csvCell('a"b'), '"a""b"');
  assert.equal(rules.cents('12.34'),1234);
  for (const bad of ['-1','NaN','Infinity','1.001','1e3']) assert.throws(()=>rules.cents(bad));
});
test('SMTP destinations reject loopback, private, link-local and mapped internal IPs', () => {
  for (const ip of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.2.1','169.254.169.254','100.64.0.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1','::ffff:7f00:1','2001:db8::1']) assert.equal(rules.publicIp(ip),false,ip);
  assert.equal(rules.publicIp('8.8.8.8'),true);
  assert.equal(rules.publicIp('2001:4860:4860::8888'),true);
});
test('introductory copy discloses commercial purpose and never claims an observed problem', () => {
  const mail=rules.introductoryEmail('Fixture Services','refrigeration','100 Fixture Road','https://fixture.test/u');
  assert.match(mail.text,/not confirmed a current equipment problem/);
  assert.match(mail.text,/commercial introduction/);
  assert.match(mail.text,/100 Fixture Road/);
  assert.match(mail.text,/https:\/\/fixture.test\/u/);
});
test('mailbox encryption is authenticated and bound to the buyer; opt-out signatures cannot be transferred', () => {
  const prior=process.env.LEAD_MARKET_SECRET;process.env.LEAD_MARKET_SECRET='isolated-fixture-secret';
  try {
    const secrets=load('lib/lead-market/secrets.ts');
    const encrypted=secrets.sealCredentials('buyer-one',{password:'fixture-password'});
    assert.ok(!encrypted.includes('fixture-password'));
    assert.deepEqual(secrets.unsealCredentials('buyer-one',encrypted),{password:'fixture-password'});
    assert.throws(()=>secrets.unsealCredentials('buyer-two',encrypted));
    const chunks=encrypted.split('.');chunks[3]=(chunks[3][0]==='A'?'B':'A')+chunks[3].slice(1);assert.throws(()=>secrets.unsealCredentials('buyer-one',chunks.join('.')));
    const sig=secrets.optOutSignature('buyer-one','person@fixture.test');
    assert.equal(secrets.validOptOut('buyer-one','person@fixture.test',sig),true);
    assert.equal(secrets.validOptOut('buyer-two','person@fixture.test',sig),false);
    assert.equal(secrets.validOptOut('buyer-one','another@fixture.test',sig),false);
  } finally { if(prior===undefined)delete process.env.LEAD_MARKET_SECRET;else process.env.LEAD_MARKET_SECRET=prior; }
});
test('order lookup always scopes by the signed-in buyer, never just the order id', async () => {
  const filters=[];const client={from:()=>({select(){return this},eq(k,v){filters.push([k,v]);return this},maybeSingle:async()=>({data:null})})};
  const store=load('lib/lead-market/store.ts',{'next/navigation':{},'./auth':{},'@/lib/supabase/auth-server':{},'@/lib/supabase/service-client':{createServiceRoleClient:()=>client}});
  await assert.rejects(store.buyerOrder('order-one','buyer-one'),/Order not found/);
  assert.deepEqual(filters,[['id','order-one'],['buyer_id','buyer-one']]);
});
function commerceFixture(overrides={}) {
  let settled=0;const order={id:'order-one',buyer_id:'buyer-one',status:'pending_payment',square_order_id:'square-order',total_cents:1083,...overrides};
  const db={from:()=>({select(){return this},eq(){return this},single:async()=>({data:{square_refund_id:null}})}),rpc:async()=>{settled++;return {data:'delivered'}}};
  return {module:load('lib/lead-market/commerce.ts',{'./store':{marketDb:()=>db,buyerOrder:async(id,buyer)=>{assert.equal(buyer,'buyer-one');return order;}},'./config':{marketBase:()=> 'https://fixture.test'}}),settled:()=>settled};
}
test('only provider-verified matching USD payment can release a lead', async () => {
  const oldFetch=global.fetch;const token=process.env.SQUARE_ACCESS_TOKEN;const location=process.env.SQUARE_LOCATION_ID;
  process.env.SQUARE_ACCESS_TOKEN='fixture-token';process.env.SQUARE_LOCATION_ID='fixture-location';
  try {
    for (const [currency,amount,reference,expected] of [['USD',1083,'order-one',true],['EUR',1083,'order-one',false],['USD',1000,'order-one',false],['USD',1083,'wrong-order',false]]) {
      const fixture=commerceFixture();
      global.fetch=async(url)=>({ok:true,json:async()=>url.includes('/payments/')?{payment:{id:'payment-one',status:'COMPLETED',order_id:'square-order',location_id:'fixture-location',amount_money:{currency,amount}}}:{order:{reference_id:reference,location_id:'fixture-location',tenders:[{payment_id:'payment-one'}]}}});
      if(expected)assert.equal(await fixture.module.reconcileMarketOrder('order-one','buyer-one'),'delivered');
      else await assert.rejects(fixture.module.reconcileMarketOrder('order-one','buyer-one'),/mismatch|needs review/);
      assert.equal(fixture.settled(),expected?1:0);
    }
  } finally {global.fetch=oldFetch;if(token===undefined)delete process.env.SQUARE_ACCESS_TOKEN;else process.env.SQUARE_ACCESS_TOKEN=token;if(location===undefined)delete process.env.SQUARE_LOCATION_ID;else process.env.SQUARE_LOCATION_ID=location;}
});
test('repeated card-checkout taps return the saved link without creating another checkout', async () => {
  const oldFetch=global.fetch;global.fetch=()=>{throw new Error('must not call provider')};
  try {assert.equal(await commerceFixture({checkout_url:'https://square.link/u/fixture'}).module.openMarketCheckout('order-one','buyer-one'),'https://square.link/u/fixture');}
  finally {global.fetch=oldFetch;}
});

function mailboxFixture(deps={}) {
  return load('lib/lead-market/mailbox.ts', {
    './store': {}, './rules': rules, './secrets': {}, './config': {}, nodemailer: {}, ...deps,
  });
}
test('OAuth rejects unverified Google identity and nonrenewable provider grants', async () => {
  const oldFetch=global.fetch;
  const keys=['LEAD_MARKET_GOOGLE_CLIENT_ID','LEAD_MARKET_GOOGLE_CLIENT_SECRET'];
  const old=keys.map(k=>process.env[k]);keys.forEach(k=>process.env[k]='fixture');
  try {
    for (const [tokens,identity,accepted] of [
      [{access_token:'access',refresh_token:'refresh',expires_in:3600},{email:'buyer@fixture.test',email_verified:true},true],
      [{access_token:'access',refresh_token:'refresh',expires_in:3600},{email:'buyer@fixture.test',email_verified:false},false],
      [{access_token:'access',expires_in:3600},{email:'buyer@fixture.test',email_verified:true},false],
    ]) {
      const requests=[];
      global.fetch=async(url,init)=>{requests.push({url,init});return {ok:true,json:async()=>url.includes('/token')?tokens:identity};};
      const promise=mailboxFixture().exchangeMailboxCode('google','fixture-code','fixture-verifier','https://fixture.test/callback');
      if(accepted) assert.equal((await promise).email,'buyer@fixture.test');
      else await assert.rejects(promise,/verify|renewable/);
      assert.equal(requests[0].init.body.get('code_verifier'),'fixture-verifier');
      assert.equal(requests[0].init.body.get('redirect_uri'),'https://fixture.test/callback');
      assert.equal(requests[0].init.redirect,'error');
    }
  } finally {global.fetch=oldFetch;keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];});}
});
test('SMTP blocks mixed private DNS answers and pins verified TLS before persisting credentials', async () => {
  for(const privateAnswer of [true,false]) {
    let saved=0,verified=0,closed=0,options;
    const box=mailboxFixture({
      'node:dns/promises':{lookup:async()=>[{address:'8.8.8.8'},...(privateAnswer?[{address:'127.0.0.1'}]:[])]},
      nodemailer:{createTransport:o=>{options=o;return {verify:async()=>{verified++;},close:()=>{closed++;},sendMail:()=>assert.fail('connection verification must not send mail')};}},
      './store':{marketDb:()=>({from:()=>({upsert:async()=>{saved++;return {error:null};}})})},
      './secrets':{sealCredentials:()=> 'encrypted-fixture'},
    });
    const pending=box.connectSmtp({id:'buyer-one',email:'buyer@fixture.test'},'buyer@fixture.test',{host:'smtp.fixture.test',port:587,user:'buyer',password:'fixture'});
    if(privateAnswer){await assert.rejects(pending,/Private or reserved/);assert.equal(saved,0);assert.equal(verified,0);}
    else {await pending;assert.equal(saved,1);assert.equal(verified,1);assert.equal(closed,1);assert.equal(options.host,'8.8.8.8');assert.equal(options.requireTLS,true);assert.equal(options.tls.servername,'smtp.fixture.test');assert.equal(options.tls.rejectUnauthorized,true);}
  }
});
