const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const preferences = require('../../src/pages/dashboard/custom/screen-management')
const navigation = require('../../src/utils/screen-navigation')
const canvas = require('../../src/pages/dashboard/custom/dashboard-canvas')
const {OPERATIONS_PRESET} = require('../../src/pages/screen/operations-model')

const plain = value => JSON.parse(JSON.stringify(value))
const store = (user = 1, tenant = 1) => ({getters: {'account/user': {id: user}, 'account/currentTenant': {id: tenant}}})
function storage() {
  const values = new Map()
  return {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)}
}
function component(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../../src', file), 'utf8')
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace('export default', 'module.exports =')
  const sandbox = {module: {exports: {}}, PageLayout: {}, ...canvas, ...preferences, ...navigation,
    registerDashboardChartNode() {}, Graph: {}, echarts: {}, OperationsWidget: {}, HeaderBar: {}, ScreenPanel: {}, previewGraphic() {}, isOperationsType() {}, OPERATIONS_PRESET,
    ...dependencies}
  vm.runInNewContext(script, sandbox)
  return sandbox.module.exports
}
function instance(definition, fields = {}) {
  const result = {...fields}
  for (const [name, method] of Object.entries(definition.methods || {})) result[name] = method.bind(result)
  return result
}
const source = {
  id: 7, name: '生产监控', visibility: 'tenant', tenant_id: 8, share_enabled: true, share_token: 'not-in-draft',
  canvas_width: 1920, canvas_height: 1080,
  nodes: [{id: 'metric', position: {x: 32, y: 48}, size: {width: 400, height: 240}, data: {
    chart_type: 'line', title: 'CPU', data_source: {zid: 1, hostid: '100', itemid: '200', history: '0', units: '%'},
    style: {color: '#00ccff', background: '#061225', precision: 2}, series: [{clock: '1000', value: 18}], loadState: 'loading',
  }}],
}

test('default screen preferences persist independently for each account and tenant', () => {
  const local = storage(), own = preferences.defaultScreenKey(store())
  assert.equal(preferences.readDefaultScreen(local, own), null)
  assert.equal(preferences.writeDefaultScreen(local, own, 7), true)
  assert.equal(preferences.readDefaultScreen(local, preferences.defaultScreenKey(store())), '7')
  for (const other of [store(2, 1), store(1, 2)]) assert.equal(preferences.readDefaultScreen(local, preferences.defaultScreenKey(other)), null)
  assert.equal(preferences.defaultScreenKey(store(undefined, 0)), null)
  assert.equal(preferences.writeDefaultScreen(local, own, null), true)
  assert.equal(preferences.readDefaultScreen(local, own), null)
})

test('invalid IDs and unavailable browser storage never produce custom routes or false success', () => {
  const local = storage(), key = preferences.defaultScreenKey(store())
  for (const id of ['', '-1', '0', '1.5', '01', '9007199254740992', '/login', 'https://example.com']) {
    local.setItem(key, id)
    assert.equal(preferences.readDefaultScreen(local, key), null)
    assert.equal(preferences.writeDefaultScreen(local, key, id), false)
    assert.deepEqual(preferences.screenLocation(id), {path: '/screen/dashboard'})
  }
  const denied = {getItem() { throw Error('denied') }, setItem() { throw Error('denied') }, removeItem() { throw Error('denied') }}
  assert.equal(preferences.screenPreferenceStorage({get localStorage() { throw Error('denied') }}), null)
  assert.equal(preferences.readDefaultScreen(denied, key), null)
  for (const target of [null, denied]) assert.equal(preferences.writeDefaultScreen(target, key, 7), false)
})

test('copying preserves layout and bindings but excludes identity, sharing and sampled data', () => {
  const before = JSON.stringify(source)
  for (const input of [source, {...source, nodes: JSON.stringify(source.nodes)}]) {
    const draft = preferences.copyScreenDraft(input)
    assert.deepEqual(Object.keys(draft).sort(), ['form', 'nodes'])
    assert.deepEqual(draft.form, {name: '生产监控 - 副本', visibility: 'personal', canvasWidth: 1920, canvasHeight: 1080})
    assert.deepEqual(draft.nodes[0].position, source.nodes[0].position)
    assert.deepEqual(draft.nodes[0].size, source.nodes[0].size)
    assert.equal(draft.nodes[0].data.data_source.itemid, '200')
    assert.equal(draft.nodes[0].data.series, undefined)
    assert.equal(draft.nodes[0].data.loadState, undefined)
    assert.ok(!JSON.stringify(draft).includes('not-in-draft'))
  }
  assert.equal(JSON.stringify(source), before)
})

test('management routes preserve read-only viewing and enforce copy permission', () => {
  const routes = [], messages = [], local = storage()
  const definition = component('pages/dashboard/custom/index.vue', {window: {localStorage: local}})
  const ctx = instance(definition, {$store: store(), $router: {push: route => routes.push(plain(route))},
    $can: () => false, $message: {warning: msg => messages.push(msg), success: msg => messages.push(msg)},
    visualizationMode: true, designerPath: '/topology/custom-screen-designer'})
  ctx.copy(source); ctx.copyBuiltin()
  assert.equal(routes.length, 0)
  ctx.$can = () => true
  ctx.copy(source); ctx.copyBuiltin(); ctx.view(source); ctx.showBuiltin()
  assert.deepEqual(routes, [
    {path: ctx.designerPath, query: {copy_from: 7}}, {path: ctx.designerPath, query: {template: 'operations'}},
    {path: '/screen/dashboard', query: {custom: '7'}}, {path: '/screen/dashboard'},
  ])
  ctx.setDefault(source)
  assert.equal(ctx.defaultScreenID, '7')
  ctx.setDefault(null)
  assert.equal(ctx.defaultScreenID, null)
  ctx.visualizationMode = false
  ctx.view(source)
  assert.deepEqual(routes.at(-1), {path: ctx.designerPath, query: {id: 7, readonly: '1'}})
})

test('a blocked preference write reports a warning and leaves the selected default unchanged', () => {
  const messages = []
  const definition = component('pages/dashboard/custom/index.vue', {window: {get localStorage() { throw Error('denied') }}})
  const ctx = instance(definition, {$store: store(), defaultScreenID: '9', $message: {warning: msg => messages.push(msg), success() { assert.fail('false success') }}})
  ctx.setDefault(source)
  assert.equal(ctx.defaultScreenID, '9')
  assert.match(messages[0], /无法保存/)
})

function editor(dependencies = {}, fields = {}) {
  const definition = component('pages/dashboard/custom/designer.vue', dependencies)
  const loaded = [], messages = [], routes = []
  const ctx = instance(definition, {
    $route: {path: '/topology/custom-screen-designer', query: {copy_from: '7'}},
    $router: {replace: route => routes.push(plain(route))}, $can: () => true,
    $message: {warning: msg => messages.push(msg), error: msg => messages.push(msg), success: msg => messages.push(msg)},
    $nextTick: fn => fn(), $emit() {}, presentationOnly: false, screenId: '', dashboardId: 'old',
    isReadonly: false, visualizationMode: true, listPath: '/topology/custom-screens', designerPath: '/topology/custom-screen-designer', resourceLabel: '大屏',
    graph: {clearCells() {}, fromJSON: value => loaded.push(plain(value)), getNodes: () => source.nodes},
    ...fields,
  })
  Object.assign(ctx, {syncNodes() {}, fitCanvas() {}, resizeCanvas() {}, refreshAll() { return Promise.resolve() }})
  return {definition, ctx, loaded, messages, routes}
}

test('copying loads an unsaved personal draft and Save creates a new record without updating the source', async () => {
  const calls = [], before = JSON.stringify(source)
  const {ctx, routes} = editor({
    dashboardDetail: async id => { calls.push(['read', id]); return {data: {code: 200, data: source}} },
    createDashboard: async payload => { calls.push(['create', plain(payload)]); return {data: {code: 200, data: {...payload, id: 9}}} },
    updateDashboard() { assert.fail('copy overwrote source') },
  })
  await ctx.initializeDashboard()
  assert.deepEqual(calls, [['read', '7']])
  assert.equal(ctx.dashboardId, '')
  assert.equal(ctx.dashboard, null)
  assert.equal(ctx.form.visibility, 'personal')
  ctx.save()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls[1][0], 'create')
  assert.equal(calls[1][1].visibility, 'personal')
  assert.equal(calls[1][1].share_enabled, undefined)
  assert.deepEqual(routes.at(-1), {path: ctx.designerPath, query: {id: '9'}})
  assert.equal(JSON.stringify(source), before)
})

test('ambiguous copy/edit IDs and missing create permission cannot load or save a copy', async () => {
  for (const fields of [{$can: () => false}, {$route: {path: '/topology/custom-screen-designer', query: {id: '7', copy_from: '7'}}}]) {
    const {ctx, routes} = editor({dashboardDetail() { assert.fail('unauthorized/ambiguous load') }}, fields)
    await ctx.initializeDashboard()
    assert.deepEqual(routes, ['/topology/custom-screens'])
  }
  const {ctx} = editor({}, {$can: () => false, dashboardId: '', graph: null})
  assert.doesNotThrow(() => ctx.save())
})

test('switching editor sources rejects a delayed result and keeps the current draft', async () => {
  let resolveOld
  const {ctx, loaded} = editor({dashboardDetail: id => id === '7' ? new Promise(resolve => { resolveOld = resolve }) : Promise.resolve({data: {code: 200, data: {...source, id: 8, name: '新来源'}}})})
  const old = ctx.initializeDashboard()
  ctx.$route = {path: ctx.designerPath, query: {copy_from: '8'}}
  await ctx.initializeDashboard()
  resolveOld({data: {code: 200, data: source}})
  await old
  assert.equal(ctx.form.name, '新来源 - 副本')
  assert.equal(loaded.length, 1)
  assert.equal(ctx.loadingDashboard, false)
})

test('an unavailable custom default clears only its own preference; temporary errors retain it', () => {
  for (const [error, shouldClear] of [[{code: 404}, true], [{response: {status: 403}}, true], [{code: 500}, false], [Error('network'), false]]) {
    for (const selected of ['7', '8']) {
      const local = storage(), key = preferences.defaultScreenKey(store()), other = preferences.defaultScreenKey(store(1, 2)), routes = []
      preferences.writeDefaultScreen(local, key, selected)
      preferences.writeDefaultScreen(local, other, '7')
      const definition = component('pages/screen/ScreenEntry.vue', {CustomDashboardDesigner: {}, ScreenDashboard: {}, window: {localStorage: local}})
      const ctx = instance(definition, {customID: '7', $store: store(), $router: {replace: route => routes.push(plain(route))}, $message: {warning() {}}})
      ctx.fallback(error)
      assert.equal(preferences.readDefaultScreen(local, key), shouldClear && selected === '7' ? null : selected)
      assert.equal(preferences.readDefaultScreen(local, other), '7')
      assert.deepEqual(routes, [{path: '/screen/dashboard'}])
    }
  }
})

test('top entry uses the scoped default and custom-screen exit restores the validated workbench route', () => {
  const local = storage(), session = storage(), routes = [], scope = store()
  preferences.writeDefaultScreen(local, preferences.defaultScreenKey(scope), 7)
  const header = component('layouts/header/AdminHeader.vue', {HeaderSearch: {}, IMenu: {}, HeaderAvatar: {}, mapState: () => ({}), mapMutations: () => ({}), window: {localStorage: local}})
  header.methods.goToScreen.call({$store: scope, $router: {push: route => routes.push(plain(route))}})
  assert.deepEqual(routes[0], {path: '/screen/dashboard', query: {custom: '7'}})
  const returnRoute = '/assets/tree?type=VM_LIN', workbench = {fullPath: returnRoute, path: '/assets/tree', matched: [{components: {default: {name: 'TabsView'}}}]}
  navigation.rememberScreenReturn(session, navigation.screenContextKey(scope), workbench)
  const entry = component('pages/screen/ScreenEntry.vue', {CustomDashboardDesigner: {}, ScreenDashboard: {}, window: {sessionStorage: session}})
  entry.methods.goBack.call({$store: scope, $router: {resolve: () => ({route: workbench}), replace: route => routes.push(route)}})
  assert.equal(routes[1], returnRoute)
})

test('cached server menu labels consolidate without changing authorities or legacy route availability', () => {
  const read = name => fs.readFileSync(path.join(__dirname, '../../src', name), 'utf8')
  const util = read('utils/routerUtil.js').replace(/^import .*$/gm, '').replace(/export \{[^}]+\}/, 'module.exports = {parseRoutes}')
  const map = read('router/async/router.map.js').replace(/^import .*$/gm, '').replace('export default', 'module.exports =')
  const mapping = {module: {exports: {}}}
  vm.runInNewContext(map, mapping)
  const sandbox = {module: {exports: {}}, console}
  vm.runInNewContext(util, sandbox)
  const routes = sandbox.module.exports.parseRoutes([
    {router: 'screenDashboard', name: '运维大屏', authority: 'tenant.monitor.read'},
    {router: 'visualizationDashboards', name: '自定义大屏', path: '/topology/custom-screens', authority: 'tenant.dashboard.read'},
  ], mapping.module.exports)
  assert.equal(routes[0].path, '/screen/dashboard')
  assert.equal(typeof routes[0].component, 'function')
  assert.equal(routes[0].meta.invisible, true)
  assert.equal(routes[1].name, '大屏管理')
  assert.equal(routes[1].meta.authority, 'tenant.dashboard.read')
  assert.equal(routes[1].meta.invisible, undefined)
})

test('screen heading is reserved only when it cannot overlap existing components', () => {
  const {definition} = editor()
  const nodes = OPERATIONS_PRESET.nodes.map(node => ({getPosition: () => node.position}))
  const ctx = {visualizationMode: true, nodes}
  assert.equal(definition.computed.canvasHeading.call(ctx), true)
  ctx.nodes = [...nodes, {getPosition: () => ({x: 32, y: 32})}]
  assert.equal(definition.computed.canvasHeading.call(ctx), false)
  ctx.nodes = []
  assert.equal(definition.computed.canvasHeading.call(ctx), false)
  assert.equal(definition.computed.canvasHeading.call({visualizationMode: false, nodes}), false)
})

test('matching dark chart theme keeps genuine zero data and avoids opaque white chart furniture', () => {
  const base = {...source.nodes[0].data, series: [{clock: '1000', value: 0}]}
  const trend = canvas.chartOption(base)
  assert.equal(trend.backgroundColor, 'transparent')
  assert.deepEqual(trend.series[0].data, [0])
  assert.equal(trend.yAxis.splitLine.lineStyle.color, 'rgba(0,230,255,.08)')
  const gauge = canvas.chartOption({...base, chart_type: 'gauge'})
  assert.equal(gauge.series[0].data[0].value, 0)
  assert.equal(gauge.series[0].axisLine.lineStyle.color[0][1], 'rgba(0,230,255,.16)')
  const light = canvas.chartOption({...base, style: {...base.style, background: '#ffffff'}})
  assert.equal(light.backgroundColor, '#ffffff')
  assert.equal(light.yAxis.splitLine, undefined)
})
