const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const VueRouter = require('vue-router')

// Source-level service/DOM boundary fixtures, not API/browser acceptance evidence.
const root = process.env.TARGET_ROOT || path.resolve(__dirname, '../..')
const source = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const policy = require(path.join(root, 'src/utils/permission-policy'))
const stripImports = (script) => script.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
function component(file, bindings = {}) {
  const script = source(file).match(/<script>([\s\S]*?)<\/script>/)[1]
  const defaults = {PageLayout: {}, AssetTypeFieldDrawer: {}, MonitoringHealthCard: {}, themeMixin: {},
    moment: (value) => value, parseTimeFun: (value) => value.toISOString(), expiryStatus: () => '',
    mapState: () => ({}), VueRouter, ...require(path.join(root, 'src/pages/host/asset-tags')), ...bindings}
  const localRequire = (name) => require(name.startsWith('@/')
    ? path.join(root, 'src', name.slice(2)) : path.resolve(root, path.dirname(file), name))
  return new Function('require', ...Object.keys(defaults), stripImports(script).replace('export default', 'return'))(
    localRequire, ...Object.values(defaults))
}
function instance(options, extras = {}) {
  const notices = []
  const vm = {...(options.data ? options.data() : {}), ...options.methods,
    $message: Object.fromEntries(['warning', 'error', 'success'].map((type) => [type, (text) => notices.push([type, text])])),
    $emit: () => {}, ...extras}
  for (const [key, fn] of Object.entries(options.computed || {})) Object.defineProperty(vm, key, {get: () => fn.call(vm)})
  return {vm, notices}
}
const allow = (permissions) => (resource, action) => policy.canPerform(permissions, resource, action)
const permissions = [{id: 'tenant.assets', operation: ['read', 'export']}]
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done }); return {promise, resolve} }
const business = (code, data, message) => ({data: {code, data, message}})

test('batch019 global asset field configuration requires platform permission', async () => {
  let writes = 0
  const options = component('src/pages/system/asset-type-fields.vue', {updateAssetTypeFields: async () => { writes++; return business(200) }})
  const {vm, notices} = instance(options, {assetType: {id: 7}, fields: [{key: 'name', label: '设备', custom: false}], $can: allow(permissions)})
  assert.equal(vm.canConfigureFields, false)
  await vm.handleSave()
  assert.equal(writes, 0); assert.equal(notices[0][0], 'warning')
  vm.$can = allow([{id: 'platform.assets', operation: ['update']}])
  assert.equal(vm.canConfigureFields, true)
  await vm.handleSave(); assert.equal(writes, 1)
  const list = source('src/pages/host/GenericDeviceList.vue')
  assert.match(list, /v-if="typeId && \$can\('platform\.assets', 'update'\)"/)
  assert.match(list, /<asset-type-field-drawer\s+v-if="\$can\('platform\.assets', 'update'\)"/)
  assert.match(source('src/pages/system/asset-type-fields.vue'), /v-if="canConfigureFields"[^>]*@click="handleSave"/)
})

function exportFixture(response, access = permissions) {
  let requests = 0, clicks = 0, removed = 0
  const blobs = [], revoked = [], attributes = {}
  const options = component('src/pages/host/GenericDeviceList.vue', {
    hostExport: async () => { requests++; return response },
    window: {URL: {createObjectURL: (blob) => { blobs.push(blob); return 'blob:fixture' }, revokeObjectURL: (url) => revoked.push(url)}},
    document: {createElement: () => ({setAttribute: (key, value) => { attributes[key] = value }, click: () => { clicks++ }, remove: () => { removed++ }}), body: {appendChild: () => {}}},
  })
  const {vm, notices} = instance(options, {$can: allow(access), effectiveTypeCode: 'linux', typeName: '设备'})
  return {vm, notices, blobs, revoked, attributes, counts: () => ({requests, clicks, removed})}
}
test('batch019 host export refuses viewer and JSON business errors', async () => {
  const bytes = new TextEncoder().encode('{"code":403,"message":"无导出权限"}').buffer
  const viewer = exportFixture({data: bytes, headers: {}}, [{id: 'tenant.assets', operation: ['read']}])
  await viewer.vm.handleExport(); assert.equal(viewer.counts().requests, 0)
  for (const headers of [{'content-type': 'application/json; charset=utf-8'}, {}]) {
    const denied = exportFixture({status: 200, data: bytes, headers})
    await denied.vm.handleExport(); assert.equal(denied.counts().clicks, 0); assert.equal(denied.blobs.length, 0)
    assert.equal(denied.notices[0][1], '无导出权限')
  }
  const malformed = exportFixture({status: 200, data: new TextEncoder().encode('not JSON').buffer, headers: {'content-type': 'application/json'}})
  await malformed.vm.handleExport(); assert.equal(malformed.counts().clicks, 0); assert.equal(malformed.notices[0][0], 'error')
  assert.match(source('src/pages/host/GenericDeviceList.vue'), /v-if="\$can\('tenant\.assets', 'export'\)"[^>]*@click="handleExport"/)
})
test('batch019 host export downloads only the received workbook and revokes its URL', async () => {
  const bytes = Uint8Array.from([80, 75, 3, 4, 1, 2, 3, 4]).buffer
  const valid = exportFixture({status: 200, data: bytes, headers: {'content-disposition': 'attachment;filename=devices.xlsx'}})
  await valid.vm.handleExport()
  assert.deepEqual(valid.counts(), {requests: 1, clicks: 1, removed: 1})
  assert.equal(valid.attributes.download, 'devices.xlsx')
  assert.deepEqual(await valid.blobs[0].arrayBuffer(), bytes)
  assert.deepEqual(valid.revoked, ['blob:fixture']); assert.deepEqual(valid.notices, [])
})

test('batch019 reused detail route clears denied targets and ignores stale responses', async () => {
  const pending = deferred(), calls = [], loads = []
  const options = component('src/pages/host/GenericDeviceDetail.vue', {
    getAssetTypes: async () => business(200, []),
    hostDetail: (id, zid) => { calls.push([id, zid]); return id === 'old' ? pending.promise : Promise.resolve(business(404, null, '无此设备')) },
    hostGraph: () => { throw new Error('denied detail must not request graph') },
  })
  const old = {query: {id: 'old', zid: 'B', typeCode: 'linux'}, meta: {}}
  const {vm} = instance(options, {$route: old, detail: {hostid: 'cached'}, sortedPngData: [{name: 'cached'}]})
  const loadRoute = vm.loadRoute
  vm.loadRoute = function () { const result = loadRoute.call(this); loads.push(result); return result }
  options.created.call(vm)
  assert.deepEqual(vm.detail, {}); assert.deepEqual(vm.sortedPngData, [])
  await Promise.resolve(); assert.deepEqual(calls, [['old', 'B']])
  const next = {query: {id: 'new', zid: 'A', typeCode: 'server'}, meta: {}}
  vm.$route = next; options.watch.$route.call(vm, next, old)
  assert.deepEqual(vm.detail, {}); await loads[1]
  pending.resolve(business(200, {hostid: 'old', name: 'foreign previous host'})); await loads[0]
  assert.equal(vm.id, 'new'); assert.deepEqual(vm.detail, {}); assert.deepEqual(vm.fieldConfigs, []); assert.equal(vm.loading, false)
})
test('batch019 detail graph requests are instance-bound and cannot cross a route change', async () => {
  const oldGraph = deferred(), calls = []
  const options = component('src/pages/host/GenericDeviceDetail.vue', {
    getAssetTypes: async () => business(200, []), hostDetail: async () => business(403, null, '拒绝'),
    hostGraph: (id, input) => { calls.push([id, input]); return oldGraph.promise },
  })
  const {vm} = instance(options, {id: 'old', zid: 'B', detail: {hostid: 'old'}, beginTime: 'start', endTime: 'end', $route: {query: {id: 'new', zid: 'A'}, meta: {}}})
  const graph = vm.fetchGraph(); assert.deepEqual(calls, [['old', {start: 'start', end: 'end', zid: 'B'}]])
  await vm.loadRoute(); oldGraph.resolve(business(200, {items: [{name: 'previous graph'}]})); await graph
  assert.deepEqual(vm.sortedPngData, []); assert.equal(vm.graphLoading, false)
  assert.equal(vm.fetchGraph(), undefined); assert.equal(calls.length, 1)
})

test('batch019 installer locales resolve login labels and copyright as strings', () => {
  const messages = require(path.join(root, 'src/pages/login/i18n')).messages
  const Vue = require('vue'), VueI18n = require('vue-i18n'); Vue.use(VueI18n)
  for (const [locale, legacy] of [['zh-CN', 'CN'], ['zh-TW', 'HK'], ['en-US', 'US']]) {
    assert.equal(messages[locale], messages[legacy])
    const i18n = new VueI18n({locale, messages})
    assert.equal(i18n.t('login'), messages[legacy].login)
    assert.equal(typeof i18n.t('loggingIn'), 'string'); assert.equal(i18n.t('copyright'), messages[legacy].copyright)
  }
})
test('batch019 anonymous 404 recovery uses login and consumes only router failures', async () => {
  let authenticated = false, error = null
  const calls = []
  const options = component('src/pages/exception/404.vue', {checkAuthorization: () => authenticated})
  const {vm} = instance(options, {$route: {path: '/missing'}, $router: {push: (path) => { calls.push(path); return error ? Promise.reject(error) : Promise.resolve() }}})
  await vm.backHome(); assert.deepEqual(calls, ['/login'])
  authenticated = true; await vm.backHome(); assert.equal(calls[1], '/dashboard/workplace')
  error = Object.assign(new Error('redirected'), {_isRouter: true, type: VueRouter.NavigationFailureType.redirected})
  await vm.backHome()
  error = new Error('unrelated routing failure'); await assert.rejects(() => vm.backHome(), /unrelated routing failure/)
  vm.$route.path = '/dashboard/workplace'; await vm.backHome(); assert.equal(calls.length, 4)
})

function bootstrapFixture(permissionResponse, routeResponse, authenticated = true) {
  const events = [], committed = {}
  const store = {commit: (key, value) => { events.push(key); committed[key] = value }}
  const bindings = {...policy, VueRouter, guards: [], interceptors: [],
    setAppOptions: () => {}, loadInterceptors: () => {}, checkAuthorization: () => authenticated,
    getPermissionContext: async () => { if (permissionResponse instanceof Error) throw permissionResponse; return permissionResponse },
    getRoutesConfig: async () => routeResponse, logout: () => { events.push('logout'); authenticated = false },
    loadRoutes: (routes) => { events.push('routes'); committed.routes = routes }, loadGuards: () => events.push('guards'),
  }
  const code = stripImports(source('src/bootstrap.js')).replace(/^export \{[^\n]*\}\s*$/gm, '').replace('export default bootstrap', 'return bootstrap')
  const run = new Function(...Object.keys(bindings), code)(...Object.values(bindings))
  const router = {currentRoute: {path: '/dashboard/workplace'}, replace: async (path) => { events.push(path); router.currentRoute.path = path }}
  return {events, committed, run: () => run({router, store, i18n: {}, message: {warning: () => events.push('warning')}})}
}
test('batch019 bootstrap expires failed sessions but preserves fresh authorized navigation', async () => {
  const permitted = business(200, {roles: [{id: 'viewer'}], permissions: [{id: 'tenant.assets', operation: ['read']}]})
  for (const failed of [business(50014), business(403), new Error('offline')]) {
    const expired = bootstrapFixture(failed, business(200, [])); await expired.run()
    assert.equal(expired.events.filter((item) => item === 'logout').length, 1)
    assert.equal(expired.committed['account/setUser'], null); assert.equal(expired.committed['account/setCurrentTenant'], null)
    for (const key of ['Tenants', 'Permissions', 'Roles', 'RoutesConfig']) assert.deepEqual(expired.committed['account/set' + key], [])
    assert.deepEqual(expired.committed.routes, [])
    assert.ok(expired.events.indexOf('guards') < expired.events.indexOf('/login'))
  }
  const rejectedRoutes = bootstrapFixture(permitted, business(403)); await rejectedRoutes.run(); assert.ok(rejectedRoutes.events.includes('/login'))
  const routes = [{path: '/dashboard/workplace'}], fresh = bootstrapFixture(permitted, business(200, routes))
  await fresh.run(); assert.deepEqual(fresh.committed.routes, routes)
  assert.equal(policy.canPerform(fresh.committed['account/setPermissions'], 'tenant.assets', 'read'), true)
  assert.equal(fresh.events.includes('logout'), false); assert.equal(fresh.events.includes('/login'), false)
})
