/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path, deps = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', code)(name => name === 'server-only' ? {} : deps[name] || require(name), exports);
  return exports;
}
const research = load('lib/chillbros/parts-research.ts');
const url = 'https://oem.example/model.pdf';
function response(overrides = {}) {
  const data = { summary: 'Model found', serialCheck: '', parts: [{ name: 'Valve', partNumber: '123', evidence: 'Model list', url }], manuals: [{ title: 'Parts list', kind: 'Parts manual', applicability: 'Serial not checked', url }], contacts: [], nextSteps: ['Verify serial'], ...overrides };
  return { status: 'completed', output: [{ type: 'web_search_call', status: 'completed', action: { sources: [{url}] } }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }] };
}
test('retains only cited links and preserves serial uncertainty', () => {
  const result = research.parseResearchResponse(response({ parts: [{name:'Fake', partNumber:'999', url:'https://made-up.example/part'}] }));
  assert.equal(result.parts.length, 0); assert.equal(result.manuals[0].url, url);
  assert.match(result.serialCheck, /not been confirmed/);
});
test('rejects memory-only, incomplete and malformed answers', () => {
  assert.throws(() => research.parseResearchResponse({ ...response(), status:'incomplete' }));
  const missing = response(); missing.output.shift(); assert.throws(() => research.parseResearchResponse(missing));
  const bad = response(); bad.output[1].content[0].text='not json'; assert.throws(() => research.parseResearchResponse(bad));
});
test('rejects unsafe links and malformed dial numbers', () => {
  for(const url of ['javascript:alert(1)','data:text/html,x','https://user:pass@example.com','http://127.0.0.1/a','http://169.254.169.254/']) assert.equal(research.safeResearchUrl(url), null);
  assert.equal(research.parseResearchResponse(response({ contacts:[{name:'Fake',phone:'call some number',url}] })).contacts.length, 0);
});
test('normalizes tracking parameters and uses citation annotations', () => {
  const payload=response({manuals:[{title:'Parts',url:url+'?utm_source=openai',kind:'Parts manual'}]});
  payload.output[0].action.sources=[];
  payload.output[1].content[0].annotations=[{type:'url_citation',url,title:'OEM manual'}];
  assert.equal(research.parseResearchResponse(payload).manuals[0].url,url);
});
test('authorization and input errors prevent paid API calls', async () => {
  let called=0; let role='customer';
  const actions=load('app/parts-lookup/actions.ts', {
    '@/lib/supabase/auth-server':{getCurrentStaffProfile:async()=>({role})},
    '@/lib/chillbros/parts-research':{researchParts:async()=>{called++;return {};}}
  });
  const form=new FormData();form.set('brand','Hoshizaki');form.set('model','KM-515MAJ');
  assert.equal((await actions.lookupParts(form)).ok,false); role='technician';
  assert.equal((await actions.lookupParts(form)).ok,false); assert.equal(called,0);
  form.set('mode','manuals');assert.equal((await actions.lookupParts(form)).ok,true);assert.equal(called,1);
});
test('requires real search and keeps shared credential server-side', async () => {
  const oldFetch=global.fetch;const oldKey=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-only';
  try {
    global.fetch=async(_url,options)=>{const body=JSON.parse(options.body);assert.equal(body.tool_choice,'required');assert.equal(body.store,false);assert.equal(body.tools[0].type,'web_search');assert.equal(JSON.parse(body.input).serial,'S123');return {ok:true,json:async()=>response()};};
    const data=await research.researchParts({brand:'Hoshizaki',model:'KM-515MAJ',serial:'S123',details:'valve',mode:'parts'});
    assert.equal(data.parts[0].partNumber,'123');
  } finally {global.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;}
});
