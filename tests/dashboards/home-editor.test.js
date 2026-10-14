const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const {createRequire} = require('node:module')
const model = require('../../src/pages/dashboard/home/home-layout')
const plain = value => JSON.parse(JSON.stringify(value))
const store = (user = 1, tenant = 1) => ({getters: {'account/user': {id: user}, 'account/currentTenant': {id: tenant}}})
function storage() {
  const values = new Map()
  return {getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value)}
}
function component(relative, deps = {}) {
  const file = path.join(__dirname, '../../src', relative)
  const source = fs.readFileSync(file, 'utf8')
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace('export default', 'module.exports =')
  const sandbox = {module: {exports: {}}, require: createRequire(file), ...model, draggable: {},
    PageLayout: {}, HomeLayout: {}, HomeExtras: {}, EgressBandwidth: {}, legent: {},
    mapState: () => ({}), mapGetters: () => ({}), console: {error() {}}, ...deps}
  vm.runInNewContext(script, sandbox)
  return sandbox.module.exports
}
function instance(def, fields = {}) {
  const ctx = {...(def.data ? def.data() : {}), ...fields}
  for (const [key, fn] of Object.entries(def.methods || {})) ctx[key] = fn.bind(ctx)
  for (const [key, computed] of Object.entries(def.computed || {})) {
    Object.defineProperty(ctx, key, {get: (typeof computed === 'function' ? computed : computed.get).bind(ctx),
      set: computed.set && computed.set.bind(ctx), configurable: true})
  }
  return ctx
}
function editor(local = storage(), account = store()) {
  const messages = [], def = component('pages/dashboard/home/HomeLayout.vue', {window: {localStorage: local}})
  const ctx = instance(def, {$store: account, $message: {error: value => messages.push(value), success: value => messages.push(value)}})
  ctx.load()
  return {ctx, def, local, messages}
}

test('home layout preserves original widgets and sanitizes unknown types, duplicates, sizes and runtime data', () => {
  const original = model.defaultHomeLayout()
  assert.deepEqual(original.map(item => item.type), ['alerts', 'devices', 'bandwidth', 'linux', 'windows'])
  const result = model.normalizeHomeLayout([{type: 'alerts', columns: 100, rows: -1, sampledData: 'private'},
    {type: 'devices', columns: 4, rows: 6}, {type: 'alerts'}, {type: '__proto__'}, null])
  assert.deepEqual(result, [original[0], {type: 'devices', columns: 4, rows: 6}])
  original[0].rows = 99
  assert.equal(model.defaultHomeLayout()[0].rows, 6)
  assert.deepEqual(model.normalizeHomeLayout([]), [])
})

test('saved layout survives reload and never crosses account or tenant scope', () => {
  const local = storage(), key = model.homeLayoutKey(store())
  const widgets = [{type: 'summary', columns: 12, rows: 2}, {type: 'devices', columns: 4, rows: 6}]
  assert.equal(model.saveHomeLayout(local, key, widgets, null).ok, true)
  assert.deepEqual(model.readHomeLayout(local, key).widgets, widgets)
  for (const other of [store(2, 1), store(1, 2)]) {
    assert.equal(model.readHomeLayout(local, model.homeLayoutKey(other)).status, 'default')
  }
  for (const id of [0, -1, false, true, undefined, '01', '1:2', 1.5, 1e20]) {
    const invalid = store()
    invalid.getters['account/user'].id = id
    assert.equal(model.homeLayoutKey(invalid), null)
  }
})

test('bad storage falls back, explicitly empty homes persist, and competing tabs cannot overwrite silently', () => {
  const local = storage(), key = model.homeLayoutKey(store())
  for (const value of ['oops', '{"version":2,"widgets":[]}', '{"version":1,"widgets":[{"type":"unknown"}]}']) {
    local.setItem(key, value)
    assert.equal(model.readHomeLayout(local, key).status, 'invalid')
    assert.deepEqual(model.readHomeLayout(local, key).widgets, model.defaultHomeLayout())
  }
  const before = local.getItem(key)
  assert.equal(model.saveHomeLayout(local, key, [], before).ok, true)
  assert.deepEqual(model.readHomeLayout(local, key).widgets, [])
  assert.equal(model.saveHomeLayout(local, key, model.defaultHomeLayout(), before).reason, 'conflict')
  const denied = {getItem() {throw Error('denied')}, setItem() {throw Error('denied')}}
  assert.equal(model.homeStorage({get localStorage() {throw Error('denied')}}), null)
  assert.equal(model.readHomeLayout(denied, key).status, 'unavailable')
  assert.equal(model.saveHomeLayout(denied, key, [], null).ok, false)
})

test('real editor edits only a draft until save; drag order, add, resize and remove survive reopening', () => {
  const {ctx, local, messages} = editor()
  const before = plain(ctx.savedWidgets)
  ctx.startEditing()
  ctx.add('summary'); ctx.add('summary'); ctx.add('fake')
  ctx.remove('windows')
  ctx.draftWidgets.find(widget => widget.type === 'devices').columns = 12
  ctx.draftWidgets.find(widget => widget.type === 'devices').rows = 4
  ctx.displayWidgets = [ctx.draftWidgets.at(-1), ...ctx.draftWidgets.slice(0, -1)]
  assert.deepEqual(plain(ctx.savedWidgets), before)
  assert.equal(local.getItem(ctx.contextKey), null)
  assert.equal(ctx.dirty, true)
  ctx.save()
  assert.equal(ctx.editing, false)
  assert.deepEqual(messages, ['主页已保存'])
  const reloaded = editor(local).ctx
  assert.deepEqual(plain(reloaded.savedWidgets), plain(ctx.savedWidgets))
  assert.equal(reloaded.savedWidgets[0].type, 'summary')
  assert.equal(reloaded.savedWidgets.find(widget => widget.type === 'devices').columns, 12)
  assert.equal(reloaded.savedWidgets.find(widget => widget.type === 'devices').rows, 4)
  assert.ok(!reloaded.savedWidgets.some(widget => widget.type === 'windows'))
})

test('cancel and restore default do not write until explicitly saved; movement is bounded and non-mutating', () => {
  const {ctx, local} = editor()
  ctx.startEditing(); ctx.remove('windows'); ctx.move('devices', -1); ctx.save()
  const saved = local.getItem(ctx.contextKey)
  ctx.startEditing(); ctx.add('severity'); ctx.cancelEditing()
  assert.equal(local.getItem(ctx.contextKey), saved)
  ctx.restoreDefault()
  assert.deepEqual(plain(ctx.draftWidgets), model.defaultHomeLayout())
  assert.equal(local.getItem(ctx.contextKey), saved)
  ctx.cancelEditing()
  assert.ok(!ctx.savedWidgets.some(widget => widget.type === 'windows'))
  ctx.restoreDefault(); ctx.save()
  assert.deepEqual(plain(ctx.savedWidgets), model.defaultHomeLayout())
  const original = model.defaultHomeLayout(), snapshot = plain(original)
  assert.deepEqual(model.moveHomeWidget(original, 'alerts', -1), original)
  assert.deepEqual(model.moveHomeWidget(original, 'missing', 2), original)
  assert.equal(model.moveHomeWidget(original, 'alerts', 99).at(-1).type, 'alerts')
  assert.deepEqual(original, snapshot)
})

test('save failure and stale account context preserve the draft and never show success', () => {
  const local = storage(), {ctx, messages} = editor(local)
  ctx.startEditing(); ctx.add('severity')
  local.setItem = () => {throw Error('quota')}
  ctx.save()
  assert.equal(ctx.editing, true)
  assert.equal(ctx.dirty, true)
  assert.match(ctx.notice, /无法保存/)
  assert.deepEqual(messages, ['主页尚未保存'])
  ctx.$store = store(2, 1)
  ctx.save()
  assert.match(ctx.notice, /账号或租户已变化/)
  ctx.load()
  assert.equal(ctx.editing, false)
  assert.deepEqual(plain(ctx.savedWidgets), model.defaultHomeLayout())
})

test('simultaneous editors reject a stale save instead of losing another window’s layout', () => {
  const local = storage(), first = editor(local).ctx, second = editor(local).ctx
  first.startEditing(); second.startEditing()
  first.remove('windows'); first.save()
  second.add('summary'); second.save()
  assert.equal(second.editing, true)
  assert.match(second.notice, /其他页面更新/)
  second.cancelEditing()
  assert.deepEqual(plain(second.savedWidgets), plain(first.savedWidgets))
})

test('unsaved edits prompt on reload or route leave and support staying or discarding', () => {
  const {ctx} = editor()
  let prevented = 0, next = [], confirm
  const event = {preventDefault() {prevented++}}
  ctx.beforeUnload(event)
  assert.equal(prevented, 0)
  ctx.startEditing(); ctx.add('summary'); ctx.beforeUnload(event)
  assert.equal(prevented, 1)
  assert.equal(event.returnValue, '')
  ctx.$confirm = value => {confirm = value}
  ctx.confirmLeave(value => next.push(value))
  confirm.onCancel()
  assert.deepEqual(next, [false])
  assert.equal(ctx.dirty, true)
  ctx.confirmLeave(value => next.push(value))
  confirm.onOk()
  assert.equal(ctx.editing, false)
  assert.deepEqual(next, [false, undefined])
})

test('homepage summaries aggregate real alarms, preserve zero and mark unavailable data unknown', () => {
  const alarms = [{severity: '3'}, {severity: 3}, {severity: 4}, {severity: '5'}, {severity: 0}]
  const before = plain(alarms)
  assert.deepEqual(model.alarmSeverityCounts(alarms), [1, 0, 0, 2, 1, 1])
  const def = component('pages/dashboard/home/HomeExtras.vue')
  const ctx = instance(def, {alerts: alarms, egress: [], info: {total_count: 0}, ready: {alerts: true, devices: true, bandwidth: true}, errors: {}})
  assert.deepEqual(plain(ctx.summary).map(item => item.value), [0, 5, 2, 0])
  ctx.errors.alerts = true
  ctx.ready.devices = false
  assert.deepEqual(plain(ctx.summary).map(item => item.value), ['—', '—', '—', 0])
  assert.equal(ctx.severityRows.reduce((sum, row) => sum + row.count, 0), alarms.length)
  assert.deepEqual(alarms, before)
})

test('quick links obey read permissions and resolve existing dynamic or static alarm routes', () => {
  const def = component('pages/dashboard/home/HomeExtras.vue')
  const ctx = instance(def, {$can: permission => permission === 'tenant.alarms',
    $router: {resolve: p => ({route: {matched: [{path: p === '/alarm/list' ? p : '*'}]}})}})
  assert.deepEqual(plain(ctx.links).map(link => link.path), ['/alarm/list'])
  ctx.$router.resolve = p => ({route: {matched: [{path: p === '/alarm/query' ? p : '*'}]}})
  assert.deepEqual(plain(ctx.links).map(link => link.path), ['/alarm/query'])
  ctx.$can = () => false
  assert.deepEqual(plain(ctx.links), [])
})

test('home API errors are visible and a later genuine zero response recovers without fake metrics', async () => {
  let response = {data: {code: 500, data: null}}
  const call = () => Promise.resolve(response)
  const def = component('pages/dashboard/index.vue', {indexTrigger: call, indexInfo: call, indexEgress: call, indexRestop: call})
  const ctx = instance(def)
  for (const method of ['initTrigger', 'initInfo', 'initEgress', 'loadLinTop', 'loadWinTop']) await ctx[method]()
  assert.deepEqual(plain(ctx.loadErrors), {alerts: true, devices: true, bandwidth: true, linux: true, windows: true})
  response = {data: {code: 200, data: {items: []}}}; await ctx.initTrigger()
  response = {data: {code: 200, data: {total_count: 0}}}; await ctx.initInfo()
  response = {data: {code: 200, data: []}}
  await ctx.initEgress(); await ctx.loadLinTop(); await ctx.loadWinTop()
  assert.deepEqual(plain(ctx.loadErrors), {alerts: false, devices: false, bandwidth: false, linux: false, windows: false})
  assert.equal(ctx.info.total_count, 0)
  assert.deepEqual(plain(ctx.egressData), [])
  assert.equal(ctx.egressUpdateTime, '')
})

test('the reused bandwidth component clears stale readings when a source disappears', () => {
  const def = component('components/egress/EgressBandwidth.vue')
  const ctx = {egressList: [{id: 1, in_value: 10}], updateTime: 'old'}
  def.watch.data.handler.call(ctx, [])
  assert.deepEqual(plain(ctx.egressList), [])
  assert.equal(ctx.updateTime, '--')
})
