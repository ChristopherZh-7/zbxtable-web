const assert = require('node:assert/strict')
const test = require('node:test')
const { recoverChunkLoadError, installChunkRecovery } = require('../../src/utils/chunkRecovery')

test('old deployment chunks reload once, ordinary errors and blocked storage do not loop', () => {
  let reloads = 0
  const values = new Map()
  const browser = {
    location: { href: 'https://example.invalid/#/host', reload: () => { reloads++ } },
    sessionStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
  }
  let onError, onReady
  installChunkRecovery({ beforeEach: () => {}, afterEach: () => {}, onError: fn => { onError = fn }, onReady: fn => { onReady = fn } }, browser)
  assert.equal(recoverChunkLoadError(new Error('Forbidden'), browser), false)
  onError(new Error('Loading CSS chunk 7 failed.'))
  onError(new Error('Loading CSS chunk 7 failed.'))
  assert.equal(reloads, 1)
  onReady()
  onError(new Error('Loading chunk 8 failed.'))
  assert.equal(reloads, 2)
  const blocked = { ...browser, sessionStorage: { getItem() { throw Error('disabled') } } }
  assert.equal(recoverChunkLoadError(new Error('Loading chunk 9 failed.'), blocked), false)
  assert.equal(reloads, 2)
})

function routeBrowser() {
  const values = new Map()
  const reloads = []
  const browser = {
    location: { href: 'https://example.invalid/index.html#/login', reload: () => reloads.push(browser.location.href) },
    sessionStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
  }
  browser.history = { state: { key: 'owned' }, replaceState: (state, unused, url) => {
    assert.equal(state, browser.history.state)
    const before = new URL(browser.location.href), after = new URL(url)
    assert.equal(after.origin, before.origin)
    assert.equal(after.pathname, before.pathname)
    assert.equal(after.search, before.search)
    browser.location.href = after.href
  } }
  return { browser, reloads }
}

test('failed pending route is retained as a same-origin hash and reloads only once', () => {
  const { browser, reloads } = routeBrowser()
  const error = new Error('Loading CSS chunk chunk-ac1894bc failed.')
  assert.equal(recoverChunkLoadError(error, browser, '/dashboard/workplace'), true)
  assert.equal(browser.location.href, 'https://example.invalid/index.html#/dashboard/workplace')
  assert.equal(recoverChunkLoadError(error, browser, '/dashboard/workplace'), false)
  assert.deepEqual(reloads, ['https://example.invalid/index.html#/dashboard/workplace'])
})

test('router passes its pending destination without bypassing navigation guards', () => {
  const { browser, reloads } = routeBrowser()
  let beforeEach, afterEach, onError, onReady, nextCalls = 0
  installChunkRecovery({ beforeEach: fn => { beforeEach = fn }, afterEach: fn => { afterEach = fn }, onError: fn => { onError = fn }, onReady: fn => { onReady = fn } }, browser)
  assert.equal(typeof beforeEach, 'function')
  beforeEach({ fullPath: '/dashboard/workplace' }, { fullPath: '/login' }, () => { nextCalls++ })
  onError(new Error('Forbidden'))
  assert.equal(reloads.length, 0)
  onError(new Error('Loading chunk chunk-ac1894bc failed.'))
  assert.equal(browser.location.href, 'https://example.invalid/index.html#/dashboard/workplace')
  assert.equal(nextCalls, 1)
  onError(new Error('Loading chunk chunk-ac1894bc failed.'))
  assert.equal(reloads.length, 1)
  afterEach()
  onReady()
})

test('external destinations and blocked storage never cause navigation or reload', () => {
  for (const route of ['https://external.invalid/', '//external.invalid/', '/\\external.invalid/']) {
    const { browser, reloads } = routeBrowser()
    assert.equal(recoverChunkLoadError(new Error('Loading chunk 7 failed.'), browser, route), false)
    assert.equal(browser.location.href, 'https://example.invalid/index.html#/login')
    assert.equal(reloads.length, 0)
  }
  const { browser, reloads } = routeBrowser()
  browser.sessionStorage = { getItem() { throw Error('disabled') } }
  assert.equal(recoverChunkLoadError(new Error('Loading chunk 7 failed.'), browser, '/dashboard/workplace'), false)
  assert.equal(browser.location.href, 'https://example.invalid/index.html#/login')
  assert.equal(reloads.length, 0)
})


const fs = require('node:fs')
const path = require('node:path')
const sourceRoot = process.env.OBS004_SOURCE_ROOT || path.resolve(__dirname, '../..')
const recovery = require(path.join(sourceRoot, 'src/utils/chunkRecovery.js'))
const {selectInitialTenant} = require(path.join(sourceRoot, 'src/pages/system/tenant-context.js'))
const authoritySource = fs.readFileSync(path.join(sourceRoot, 'src/utils/authority-utils.js'), 'utf8')
const actualAuthority = new Function(authoritySource.replace('export {filterMenu, hasAuthority}', 'return hasAuthority'))()

function loginRecoveryFixture({marker = true, authorized = true, fresh = true, permitted = true} = {}) {
  const {browser} = routeBrowser()
  if (marker) browser.sessionStorage.setItem('smartops:chunk-reload-url', browser.location.href)
  let ready
  const target = {path: '/dashboard/workplace', fullPath: '/dashboard/workplace', matched: [{}], meta: {authority: {permission: 'portal.read'}}}
  const router = {beforeEach() {}, afterEach() {}, onError() {}, onReady(fn) { ready = fn }, resolve: () => ({route: target})}
  recovery.installChunkRecovery(router, browser)
  const permissions = permitted ? ['portal.read'] : []
  const account = {permissions: fresh ? permissions : null, roles: fresh ? [] : null, routesConfig: fresh ? [{path: '/dashboard'}] : null}
  const tenant = {id: 10, status: 0}
  const store = {state: {account}, getters: {'account/user': {role: 'member'}, 'account/tenants': [tenant], 'account/permissions': permissions, 'account/roles': []}}
  const raw = fs.readFileSync(path.join(sourceRoot, 'src/router/guards.js'), 'utf8')
  const code = raw.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '').replace('export const', 'const').replace('export default', 'return')
  const guards = new Function('hasAuthority','loginIgnore','checkAuthorization','getTenantContext','consumeLoginChunkRecovery','selectInitialTenant','getInstallStatus','NProgress',code)(actualAuthority,{includes: to => to.path === '/login'},() => authorized,() => tenant,recovery.consumeLoginChunkRecovery,selectInitialTenant,async () => ({installed:true}),{configure(){},isStarted(){return false},start(){},done(){}})
  const nextCalls = []
  const options = {router, store, message: {warning(){},error(){}}}
  return {browser, ready: () => ready(), login: () => guards.beforeEach[2]({path: '/login'}, {}, value => nextCalls.push(value), options), authority: () => guards.beforeEach[3](target, {}, value => nextCalls.push(value), options), protectedLogin: () => guards.beforeEach[2](target, {}, value => nextCalls.push(value), options), nextCalls}
}

test('genuine old login reload marker survives onReady and resumes permitted default route once', () => {
  const f = loginRecoveryFixture()
  f.ready()
  assert.equal(f.browser.sessionStorage.getItem('smartops:chunk-reload-url'), undefined)
  f.login()
  assert.deepEqual(f.nextCalls, [{path: '/dashboard/workplace', replace: true}])
  f.login()
  assert.deepEqual(f.nextCalls, [{path: '/dashboard/workplace', replace: true}, undefined])
})

test('ordinary already-authorized login without a reload marker remains unchanged', () => {
  const f = loginRecoveryFixture({marker: false})
  f.ready(); f.login()
  assert.deepEqual(f.nextCalls, [undefined])
})

test('expired access and missing fresh server context do not restore a protected page', () => {
  const expired = loginRecoveryFixture({authorized: false})
  expired.ready(); expired.login(); expired.protectedLogin()
  assert.deepEqual(expired.nextCalls, [undefined, {path: '/login'}])
  const stale = loginRecoveryFixture({fresh: false})
  stale.ready(); stale.login()
  assert.deepEqual(stale.nextCalls, [undefined])
})

test('denied default route is not restored and the original authority guard still refuses it', () => {
  const f = loginRecoveryFixture({permitted: false})
  f.ready(); f.login(); f.authority()
  assert.deepEqual(f.nextCalls, [undefined, {path: '/403'}])
})
