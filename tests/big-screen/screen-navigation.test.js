const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const navigation = require('../../src/utils/screen-navigation')
const {SCREEN_PATH, FALLBACK_PATH, isWorkbenchRoute, screenContextKey, rememberScreenReturn, screenReturnPath, captureScreenScroll} = navigation

const source = file => fs.readFileSync(path.join(__dirname, '../../src', file), 'utf8')
const workbenchRoute = fullPath => ({path: fullPath.split('?')[0], fullPath, matched: [{components: {default: {name: 'TabsView'}}}]})
const storage = () => {
  const values = new Map()
  return {getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value)}
}
const router = {resolve: path => ({route: path.startsWith('/assets/tree') || path === FALLBACK_PATH ? workbenchRoute(path) : {path, fullPath: path, matched: []}})}

test('screen return keeps the exact source path and query after a screen refresh', () => {
  const session = storage()
  const from = workbenchRoute('/assets/tree?type=VM_LIN&name=app%20one#detail')
  rememberScreenReturn(session, 'scope', from)
  assert.equal(screenReturnPath(session, 'scope', router), from.fullPath)
  rememberScreenReturn(session, 'scope', {path: SCREEN_PATH, fullPath: SCREEN_PATH, matched: []})
  assert.equal(screenReturnPath(session, 'scope', router), from.fullPath)
})

test('screen refresh resolves workbench destinations before the lazy root layout loads', () => {
  const root = {path: '', components: {default: () => Promise.resolve({name: 'TabsView'})}}
  const child = {path: '/assets/tree', parent: root, components: {default: () => Promise.resolve({})}}
  const destination = {path: '/assets/tree', fullPath: '/assets/tree?type=VM_LIN', matched: [root, child]}
  const session = storage()
  session.setItem('scope', destination.fullPath)
  assert.equal(screenReturnPath(session, 'scope', {resolve: () => ({route: destination})}), destination.fullPath)
  assert.equal(isWorkbenchRoute({matched: [root]}), false)
  assert.equal(isWorkbenchRoute({matched: [{path: '/login', components: root.components}]}), false)
  assert.equal(isWorkbenchRoute({matched: [{path: '*', components: root.components}]}), false)
})

test('direct entry, unsafe destinations and missing routes have a local fallback', () => {
  const session = storage()
  for (const value of [null, '', 'https://example.com', '//example.com', '/\\example.com', '/assets/tree\n', SCREEN_PATH, '/login', '/missing']) {
    session.setItem('scope', value)
    assert.equal(screenReturnPath(session, 'scope', router), FALLBACK_PATH, String(value))
  }
  const unavailable = {getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }}
  assert.doesNotThrow(() => rememberScreenReturn(unavailable, 'scope', workbenchRoute('/assets/tree')))
  assert.equal(screenReturnPath(unavailable, 'scope', router), FALLBACK_PATH)
  const blockedWindow = {get sessionStorage() { throw new Error('blocked storage getter') }}
  assert.equal(navigation.screenSessionStorage(blockedWindow), null)
  assert.equal(screenReturnPath(navigation.screenSessionStorage(blockedWindow), 'scope', router), FALLBACK_PATH)
})

test('return locations and workbench caches are isolated by account and tenant', () => {
  const store = (user, tenant) => ({getters: {'account/user': {id: user}, 'account/currentTenant': {id: tenant}}})
  const first = screenContextKey(store(1, 2))
  assert.notEqual(first, screenContextKey(store(2, 2)))
  assert.notEqual(first, screenContextKey(store(1, 3)))
  assert.equal(screenContextKey(store(null, 2)), null)
  assert.equal(screenContextKey(store(1, null)), null)
  const session = storage()
  rememberScreenReturn(session, first, workbenchRoute('/assets/tree?type=VM_LIN'))
  assert.equal(screenReturnPath(session, screenContextKey(store(2, 2)), router), FALLBACK_PATH)
})

test('scroll restoration retains table horizontal scroll and page position', () => {
  const table = {scrollTop: 0, scrollLeft: 320}
  const root = {scrollTop: 125, scrollLeft: 0, querySelectorAll: () => [table]}
  const calls = []
  const restore = captureScreenScroll(root, {scrollX: 0, scrollY: 89, scrollTo: (...position) => calls.push(position)})
  table.scrollLeft = 0
  root.scrollTop = 0
  restore()
  assert.equal(table.scrollLeft, 320)
  assert.equal(root.scrollTop, 125)
  assert.deepEqual(calls, [[0, 89]])
})

function component(file, additions = {}) {
  const sandbox = {module: {exports: {}}, ...navigation, ...additions}
  const script = source(file).match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import .+$/gm, '').replace('export default', 'module.exports =')
  vm.runInNewContext(script, sandbox)
  return sandbox.module.exports
}

test('app retains only the workbench and clears it on login or identity change', () => {
  const app = component('App.vue', {mapState: () => ({}), mapMutations: () => ({})})
  for (const route of [workbenchRoute('/assets/tree'), {path: SCREEN_PATH}]) {
    assert.deepEqual(Array.from(app.computed.workbenchCacheIncludes.call({$route: route})), ['TabsView'])
  }
  assert.deepEqual(Array.from(app.computed.workbenchCacheIncludes.call({$route: {path: '/login'}})), [])
  assert.ok(isWorkbenchRoute({matched: [{components: {default: {options: {name: 'TabsView'}}}}]}))
  assert.match(source('App.vue'), /<keep-alive :include="workbenchCacheIncludes" :key="workbenchCacheIdentity">/)
})

test('screen return exits browser fullscreen and replaces the route through normal router guards', async () => {
  const calls = []
  const session = storage()
  const store = {getters: {'account/user': {id: 1}, 'account/currentTenant': {id: 2}}}
  rememberScreenReturn(session, screenContextKey(store), workbenchRoute('/assets/tree?type=VM_LIN'))
  const header = component('pages/screen/components/HeaderBar.vue', {
    require: () => ({}), window: {sessionStorage: session},
    document: {fullscreenElement: {}, exitFullscreen: async () => calls.push('exit')},
  })
  await header.methods.goBack.call({$store: store, $router: {...router, replace: path => calls.push(path)}})
  assert.deepEqual(calls, ['exit', '/assets/tree?type=VM_LIN'])
  assert.doesNotMatch(source('pages/screen/components/HeaderBar.vue'), /\$router\.push\('\/dashboard\/workplace'\)/)
})
