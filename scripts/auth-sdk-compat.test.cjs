/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('patched auth dependencies preserve cookie-aware admin endpoint routing', async () => {
  const { createAuthServer } = await import('@neondatabase/auth/server');
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, init = {}) => {
    const request = new Request(url, init);
    assert.equal(new URL(request.url).origin, 'https://auth-fixture.invalid');
    assert.match(request.headers.get('cookie') || '', /fixture-session/);
    requests.push({ path: new URL(request.url).pathname, method: request.method, query: new URL(request.url).searchParams, body: request.method === 'POST' ? await request.json() : null });
    const path = new URL(request.url).pathname;
    return Response.json(path.endsWith('/list-users') ? { users: [{ id: 'fixture-user', email: 'staff@example.invalid' }], total: 1 } : path.endsWith('/create-user') ? { user: { id: 'fixture-user', email: 'staff@example.invalid' } } : { success: true });
  };
  try {
    const auth = createAuthServer({
      baseUrl: 'https://auth-fixture.invalid/auth', cookieSecret: 'fixture-cookie-secret-at-least-32-characters',
      context: () => ({ getCookies: () => 'neon-auth.session_token=fixture-session', setCookie() {}, getHeader: () => null, getOrigin: () => 'https://app-fixture.invalid', getFramework: () => 'nextjs' }),
    });
    const listed = await auth.admin.listUsers({ query: { filterField: 'email', filterValue: 'staff@example.invalid', filterOperator: 'eq', limit: 2 } });
    assert.equal(listed.data.users[0].id, 'fixture-user');
    const created = await auth.admin.createUser({ email: 'staff@example.invalid', password: 'fixture-only-password', name: 'Fixture', role: 'user' });
    assert.equal(created.data.user.id, 'fixture-user');
    await auth.admin.setUserPassword({ userId: 'fixture-user', newPassword: 'fixture-replacement-password' });
    await auth.admin.removeUser({ userId: 'fixture-user' });
    assert.deepEqual(requests.map(r => [r.path, r.method]), [
      ['/auth/admin/list-users','GET'], ['/auth/admin/create-user','POST'], ['/auth/admin/set-user-password','POST'], ['/auth/admin/remove-user','POST'],
    ]);
    assert.equal(requests[0].query.get('filterValue'), 'staff@example.invalid');
    assert.equal(requests[1].body.role, 'user');
  } finally { global.fetch = originalFetch; }
});

test('patched SDK keeps upstream permission failures as failures', async () => {
  const { createAuthServer } = await import('@neondatabase/auth/server');
  const originalFetch = global.fetch;
  global.fetch = async url => {
    assert.equal(new URL(String(url)).origin, 'https://auth-fixture.invalid');
    return Response.json({ code: 'FORBIDDEN', message: 'Administrator required' }, { status: 403 });
  };
  try {
    const auth = createAuthServer({ baseUrl: 'https://auth-fixture.invalid/auth', cookieSecret: 'fixture-cookie-secret-at-least-32-characters',
      context: () => ({ getCookies: () => 'neon-auth.session_token=fixture-session', setCookie() {}, getHeader: () => null, getOrigin: () => 'https://app-fixture.invalid', getFramework: () => 'nextjs' }),
      log: { error() {}, warn() {}, info() {}, debug() {} },
    });
    const result = await auth.admin.removeUser({ userId: 'fixture-user' });
    assert.equal(result.data, null);
    assert.equal(result.error.status, 403);
  } finally { global.fetch = originalFetch; }
});

test('patched SDK forwards login cookies, restores sessions, and signs out', async () => {
  const { createAuthServer } = await import('@neondatabase/auth/server');
  const originalFetch = global.fetch;
  const jar = new Map();
  const user = { id: 'fixture-user', email: 'staff@example.invalid', name: 'Fixture', emailVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const session = { id: 'fixture-id', token: 'fixture-session', userId: user.id, expiresAt: new Date(Date.now()+86400000).toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  let restored = false;
  global.fetch = async (url, init = {}) => {
    const request = new Request(url, init);
    assert.equal(new URL(request.url).origin, 'https://auth-fixture.invalid');
    if (request.url.endsWith('/sign-in/email')) {
      const body = await request.json();
      assert.equal(body.email, user.email);
      return Response.json({ token: session.token, user }, { headers: { 'set-cookie': 'neon-auth.session_token=fixture-session; Path=/; Secure; HttpOnly; SameSite=Lax' } });
    }
    if (request.url.includes('/get-session')) {
      assert.match(request.headers.get('cookie') || '', /fixture-session/);
      restored = true;
      return Response.json({ session, user });
    }
    assert.ok(request.url.endsWith('/sign-out'));
    return Response.json({ success: true }, { headers: { 'set-cookie': 'neon-auth.session_token=; Max-Age=0; Path=/; Secure; HttpOnly' } });
  };
  try {
    const auth = createAuthServer({ baseUrl: 'https://auth-fixture.invalid/auth', cookieSecret: 'fixture-cookie-secret-at-least-32-characters', sessionDataTtl: 300,
      context: () => ({ getCookies: () => [...jar].map(([k,v]) => `${k}=${v}`).join('; '), setCookie(name,value,options) { if (options.maxAge===0) jar.delete(name); else jar.set(name,value); }, getHeader: () => null, getOrigin: () => 'https://app-fixture.invalid', getFramework: () => 'nextjs' }),
    });
    assert.equal((await auth.signIn.email({ email: user.email, password: 'fixture-only-password' })).error, null);
    assert.equal(jar.get('neon-auth.session_token'), session.token);
    // Simulate a request with only the durable session cookie, without the cache.
    for (const name of [...jar.keys()]) if (name !== 'neon-auth.session_token') jar.delete(name);
    const result = await auth.getSession();
    assert.equal(result.data.user.id, user.id);
    assert.equal(restored, true);
    assert.equal((await auth.signOut()).error, null);
    assert.equal(jar.has('neon-auth.session_token'), false);
  } finally { global.fetch = originalFetch; }
});
