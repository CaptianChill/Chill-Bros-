/* eslint-disable @typescript-eslint/no-require-imports -- Server action dependency doubles. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
const owner = { id: '8c81f12a-ad86-4ceb-bca1-3924be1cbfec', email: 'chillprostx@gmail.com', role: 'manager' };
const member = { id: 'employee', email: 'eric@example.com', full_name: 'Eric Lara', role: 'technician', status: 'active', auth_user_id: 'login' };
function harness({ role = 'manager', email = owner.email, rows = [owner, member], loginExists = true, readError, removeError } = {}) {
  rows = structuredClone(rows);
  const users = [{ id: 'owner-login', email: owner.email }, ...(loginExists ? [{ id: 'login', email: member.email }] : [])];
  const removed = [], passwords = [];
  const db = { from(table) {
    let filters = [], values, mode = 'read', single = false;
    const q = {
      select() { return q; }, order() { return q; }, limit() { return q; },
      eq(k,v) { filters.push(r => r[k] === v); return q; },
      ilike(k,v) { filters.push(r => String(r[k]).toLowerCase() === v.toLowerCase()); return q; },
      update(v) { values=v; mode='update'; return q; },
      insert(v) { values=v; mode='insert'; return q; },
      delete() { mode='delete'; return q; },
      maybeSingle() { single=true; return q; },
      then(resolve,reject) { return Promise.resolve().then(() => {
        if(table !== 'chillbros_profiles') return { data: [], error: null };
        if(readError && mode === 'read') return { data:null,error:{message:readError} };
        let matching=rows.filter(r=>filters.every(f=>f(r)));
        if(mode==='update') matching.forEach(r=>Object.assign(r,values));
        if(mode==='insert') { const r={...values}; rows.push(r); matching=[r]; }
        if(mode==='delete') rows=rows.filter(r=>!matching.includes(r));
        return {data:structuredClone(single?matching[0]??null:matching),error:null};
      }).then(resolve,reject); },
    }; return q;
  }};
  const mocks = {
    'next/cache': { revalidatePath() {} },
    '@/lib/neon/data-api/service-client': { createServiceRoleClient: () => db },
    '@/lib/neon/data-api/auth-server': { getCurrentStaffProfile: async () => ({...owner,role,email}) },
    '@/lib/auth/server': { auth: {
      getSession: async () => ({data:{user:users[0]}}),
      admin: {
        listUsers: async ({query}) => ({data:{users:users.filter(u=>u[query.filterField]===query.filterValue)},error:null}),
        removeUser: async ({userId}) => { if(removeError) return {error:{message:removeError}};removed.push(userId);const index=users.findIndex(u=>u.id===userId);if(index>=0)users.splice(index,1);return {error:null}; },
        createUser: async ({email,password,name}) => {const user={id:'new-login',email,name};users.push(user);passwords.push(password);return {data:{user},error:null};},
        setUserPassword: async ({newPassword}) => {passwords.push(newPassword);return {error:null};},
      },
    } },
  };
  function load(file) {
    const mod={exports:{}};
    const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','module','exports',source)(id=>mocks[id]??require(id),mod,mod.exports);return mod.exports;
  }
  return {rows,removed,passwords,load};
}

test('delete removes employee login and staff-list identity but preserves historical profile', async()=>{
  const h=harness();const result=await h.load('lib/chillbros/staff-delete-actions.ts').deleteStaffAccountAction('employee');
  assert.equal(result.ok,true);assert.deepEqual(h.removed,['login']);
  assert.equal(h.rows[1].status,'inactive');assert.equal(h.rows[1].email,'employee@removed.invalid');assert.equal(h.rows[1].full_name,'Eric Lara');assert.equal(h.rows[1].id,'employee');
  assert.equal(h.rows[0].email,owner.email);
});
test('only owner may delete and owner identifiers cannot be deleted', async()=>{
  for(const options of [{role:'technician'},{email:'other-manager@example.com'}]){
    const h=harness(options);assert.equal((await h.load('lib/chillbros/staff-delete-actions.ts').deleteStaffAccountAction('employee')).ok,false);assert.deepEqual(h.removed,[]);
  }
  const h=harness();assert.equal((await h.load('lib/chillbros/staff-delete-actions.ts').deleteStaffAccountAction(owner.id)).ok,false);
  const linked=harness({rows:[owner,{...member,auth_user_id:'owner-login'}]});assert.equal((await linked.load('lib/chillbros/staff-delete-actions.ts').deleteStaffAccountAction('employee')).ok,false);assert.deepEqual(linked.removed,[]);
});
test('bulk reset preserves owner and reports partial auth failures', async()=>{
  const h=harness();assert.deepEqual(await h.load('lib/chillbros/staff-delete-actions.ts').removeAllEmployeesAction(),{ok:true,removed:1});assert.equal(h.rows[0].email,owner.email);
  const failed=harness({removeError:'Auth unavailable'});const r=await failed.load('lib/chillbros/staff-delete-actions.ts').removeAllEmployeesAction();assert.equal(r.ok,false);assert.match(r.error,/Auth unavailable/);assert.equal(failed.rows[1].status,'inactive');assert.equal(failed.rows[1].email,member.email);
});
test('verified missing login can be deleted without touching another account', async()=>{
  const h=harness({loginExists:false});assert.equal((await h.load('lib/chillbros/staff-delete-actions.ts').deleteStaffAccountAction('employee')).ok,true);assert.deepEqual(h.removed,[]);
});
test('reset repairs an employee with no login and accepts a chosen password', async()=>{
  const h=harness({rows:[owner,{...member,auth_user_id:null}],loginExists:false});const r=await h.load('lib/chillbros/mutations.ts').resetStaffPasswordAction('employee','New password 123');assert.equal(r.ok,true);assert.equal(h.rows[1].auth_user_id,'new-login');assert.deepEqual(h.passwords,['New password 123']);
});
test('password reset shows actual read error and protects owner credentials', async()=>{
  const h=harness({readError:'column auth_user_id does not exist'});const r=await h.load('lib/chillbros/mutations.ts').resetStaffPasswordAction('employee');assert.equal(r.ok,false);assert.match(r.error,/column auth_user_id/);
  const o=harness();assert.equal((await o.load('lib/chillbros/mutations.ts').resetStaffPasswordAction(owner.id)).ok,false);assert.deepEqual(o.passwords,[]);
});

test('existing employee password uses owner input and rejects short passwords', async()=>{
  const h=harness();const actions=h.load('lib/chillbros/mutations.ts');assert.equal((await actions.resetStaffPasswordAction('employee','Chosen password 123')).ok,true);assert.deepEqual(h.passwords,['Chosen password 123']);assert.equal((await actions.resetStaffPasswordAction('employee','short')).ok,false);assert.equal(h.passwords.length,1);
});
