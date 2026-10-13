const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const compiler = require('vue-template-compiler')
const Vue = require('vue')

const root = process.env.P6_TEST_ROOT || path.resolve(__dirname, '../..')
const pagePath = path.join(root, 'src/pages/dashboard/baseline/index.vue')
const page = fs.readFileSync(pagePath, 'utf8')
const view = require(path.join(root, 'src/pages/dashboard/baseline/baseline-view.js'))
const parsed = compiler.parseComponent(page)
const response = items => ({data: {code: 200, data: {items}}})
const trend = (itemid, patch = {}) => ({itemid, name: `Item ${itemid}`, value_type: '0', trends: '365d', status: '0', state: '0', units: '%', ...patch})
const tick = () => new Promise(resolve => setImmediate(resolve))

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return {promise, resolve, reject}
}

// The actual unmodified/modified SFC script is evaluated identically in B/M/R.
// Services are explicit offline contract inputs, not native API observations.
function component(itemList = async () => response([])) {
  let imports = 0
  const script = parsed.script.content
    .replace(/^import\s[\s\S]*?\sfrom\s['"][^'"]+['"]\s*$/gm, () => { imports++; return '' })
    .replace('export default', 'module.exports =')
  assert.equal(imports, 4)
  const writes = [], requests = [], notices = []
  const context = {
    module: {exports: {}}, ...view, PageLayout: {}, echarts: {},
    itemList: params => { requests.push(params); return itemList(params) },
    baselineRuleList: async () => ({data: {code: 200, data: []}}),
    createBaselineRule: async body => { writes.push({method: 'POST', body: JSON.parse(JSON.stringify(body))}); return {data: {code: 200, data: {}}} },
    updateBaselineRule: async (id, zid, body) => { writes.push({method: 'PUT', id, zid, body: JSON.parse(JSON.stringify(body))}); return {data: {code: 200, data: {}}} },
    baselineRuleEvents() { throw new Error('not a test input') },
    baselineRulePreview() { throw new Error('not a test input') },
    deleteBaselineRule() { throw new Error('not a test input') },
  }
  vm.runInNewContext(script, context, {filename: pagePath})
  const definition = context.module.exports
  const object = {...definition.data(), $message: {
    error: message => notices.push({type: 'error', message}),
    warning: message => notices.push({type: 'warning', message}),
    success: message => notices.push({type: 'success', message}),
  }}
  for (const [name, method] of Object.entries(definition.methods)) object[name] = method.bind(object)
  object.hosts = [{zid: 1, hostid: '101', name: 'A'}, {zid: 2, hostid: '202', name: 'B'}]
  return {object, writes, requests, notices, definition}
}

function select(object, key) {
  object.selectedHostKey = key // Real v-model precedes the change handler.
  return object.selectHost(key)
}

function rule(itemid = '10101', patch = {}) {
  return {zid: 1, hostid: '101', triggerid: '71', itemid, name: 'Current baseline',
    season_unit: 'd', seasons: 7, deviation: 2.5, severity: 3, enabled: false, ...patch}
}

function optionValues(items) {
  const fragment = parsed.template.content.match(/<a-select-option v-for="item in items"[\s\S]*?<\/a-select-option>/)[0]
  const compiled = compiler.compile('<div>' + fragment + '</div>')
  assert.deepEqual(compiled.errors, [])
  const instance = new Vue({data: () => ({items}), render: new Function(compiled.render), staticRenderFns: compiled.staticRenderFns.map(code => new Function(code))})
  const values = []
  function visit(node) {
    if (!node) return
    if (node.tag && node.tag.includes('a-select-option')) values.push(String(node.data.attrs.value))
    for (const child of node.children || []) visit(child)
  }
  visit(instance._render()); instance.$destroy()
  return values
}

test('ISSUE010 keeps both numeric types, raw positive retention and state-omitted legacy input', () => {
  const items = [trend('1'), trend('2', {value_type: '3'}), trend('3', {value_type: 0, status: 0}),
    {itemid: '4', value_type: '0', trends: '365d', status: '0'}]
  assert.deepEqual(view.numericTrendItems(items).map(item => item.itemid), ['1', '2', '3', '4'])
})

test('ISSUE010 does not invent retention duration/macro expansion or require existing history points', () => {
  const items = [trend('1', {trends: '{$RETENTION}'}), trend('2', {trends: '0d'}), trend('3', {trends: '86400'})]
  assert.deepEqual(view.numericTrendItems(items).map(item => item.itemid), ['1', '2', '3'])
})

for (const [label, value] of [['absent', undefined], ['null', null], ['empty', ''], ['blank', '  '], ['zero', '0'], ['numeric-zero', 0], ['spaced-zero', ' 0 '], ['boolean', false], ['array', []], ['object', {}]]) {
  test(`ISSUE010 rejects ${label} trends instead of assuming trend retention`, () => {
    const item = trend('10', {trends: value})
    if (value === undefined) delete item.trends
    assert.deepEqual(view.numericTrendItems([item]), [])
  })
}

for (const [label, value] of [['absent', undefined], ['null', null], ['empty', ''], ['boolean', false], ['disabled-string', '1'], ['disabled-number', 1], ['array', []], ['object', {}]]) {
  test(`ISSUE010 rejects ${label} status instead of defaulting to enabled`, () => {
    const item = trend('10', {status: value})
    if (value === undefined) delete item.status
    assert.deepEqual(view.numericTrendItems([item]), [])
  })
}

for (const value of ['1', 1]) {
  test(`ISSUE010 rejects explicit unsupported state ${JSON.stringify(value)}`, () => {
    assert.deepEqual(view.numericTrendItems([trend('10', {state: value})]), [])
  })
}

for (const [label, value] of [['text', '4'], ['character', '1'], ['log', '2'], ['array-zero', [0]], ['object', {}]]) {
  test(`ISSUE010 rejects ${label} value_type without object coercion`, () => {
    assert.deepEqual(view.numericTrendItems([trend('10', {value_type: value})]), [])
  })
}

test('ISSUE010 malformed collections/items fail closed without throwing or changing good input', () => {
  for (const value of [null, undefined, {}, 'bad']) assert.deepEqual(view.numericTrendItems(value), [])
  const good = trend('11')
  const input = [null, undefined, {}, [], false, 1, 'item', good]
  assert.deepEqual(view.numericTrendItems(input), [good])
  assert.equal(view.numericTrendItems(input)[0], good)
})

test('ISSUE010 filter preserves accepted order and does not mutate source records', () => {
  const input = [trend('2'), trend('1', {trends: '0'}), trend('3', {value_type: '3'})]
  const before = JSON.stringify(input)
  assert.deepEqual(view.numericTrendItems(input).map(item => item.itemid), ['2', '3'])
  assert.equal(JSON.stringify(input), before)
})

test('ISSUE010 actual loadItems and compiled options exclude incomplete, no-trends and unsupported rows', async () => {
  const input = [trend('1'), {itemid: '2', value_type: '0'}, trend('3', {trends: '0'}), trend('4', {state: '1'}), trend('5', {value_type: '4'})]
  const {object} = component(async () => response(input))
  object.openCreate(); await select(object, '1:101')
  assert.deepEqual(optionValues(object.items), ['1'])
})

test('ISSUE010 host A then B ignores A success arriving after B', async () => {
  const a = deferred(), b = deferred()
  const {object} = component(params => params.hostid === '101' ? a.promise : b.promise)
  object.openCreate(); const first = select(object, '1:101'); const second = select(object, '2:202')
  b.resolve(response([trend('20201')])); await second
  object.form.itemid = '20201'
  a.resolve(response([trend('10101')])); await first
  assert.equal(object.selectedHostKey, '2:202'); assert.equal(object.form.zid, 2)
  assert.deepEqual(object.items.map(item => item.itemid), ['20201'])
  assert.equal(object.form.itemid, '20201'); assert.equal(object.itemsLoading, false)
})

test('ISSUE010 stale success/finally cannot clear loading or expose A while B is pending', async () => {
  const a = deferred(), b = deferred()
  const {object} = component(params => params.hostid === '101' ? a.promise : b.promise)
  object.openCreate(); const first = select(object, '1:101'); const second = select(object, '2:202')
  a.resolve(response([trend('10101')])); await first
  assert.equal(object.itemsLoading, true); assert.equal(object.items.length, 0); assert.equal(object.form.itemid, '')
  b.resolve(response([trend('20201')])); await second
  assert.equal(object.itemsLoading, false); assert.equal(object.items[0].itemid, '20201')
})

test('ISSUE010 stale request failure cannot alter current selection, loading or messages', async () => {
  const a = deferred(), b = deferred()
  const {object, notices} = component(params => params.hostid === '101' ? a.promise : b.promise)
  object.openCreate(); const first = select(object, '1:101'); const second = select(object, '2:202')
  a.reject(new Error('stale A response')); await first
  assert.equal(object.itemsLoading, true); assert.deepEqual(notices, [])
  b.resolve(response([trend('20201')])); await second
})

test('ISSUE010 close then new create invalidates old item request', async () => {
  const pending = deferred(); const {object} = component(() => pending.promise)
  object.openCreate(); const first = select(object, '1:101')
  object.closeModal(); object.openCreate()
  pending.resolve(response([trend('10101')])); await first
  assert.equal(object.modalVisible, true); assert.equal(object.selectedHostKey, '')
  assert.equal(object.items.length, 0); assert.equal(object.form.itemid, ''); assert.equal(object.itemsLoading, false)
})

test('ISSUE010 close without reopening prevents stale options and clears selected item', async () => {
  const pending = deferred(); const {object} = component(() => pending.promise)
  object.openCreate(); const first = select(object, '1:101'); object.form.itemid = '10101'
  object.closeModal(); pending.resolve(response([trend('10101')])); await first
  assert.equal(object.modalVisible, false); assert.equal(object.items.length, 0); assert.equal(object.form.itemid, '')
})

test('ISSUE010 openEdit immediately clears previous host options and unverified selected ID', async () => {
  const pending = deferred(); const {object} = component(() => pending.promise)
  object.items = [trend('99999')]; object.openEdit(rule())
  assert.equal(object.items.length, 0); assert.equal(object.form.itemid, ''); assert.equal(object.itemsLoading, true)
  pending.resolve(response([trend('10101')])); await tick()
  assert.equal(object.form.itemid, '10101')
})

test('ISSUE010 eligible retained edit is restored and disabled status is unchanged', async () => {
  const {object, writes} = component(async () => response([trend('10101')]))
  object.openEdit(rule()); await tick(); await object.save()
  assert.equal(writes.length, 1); assert.equal(writes[0].method, 'PUT')
  assert.equal(writes[0].id, '71'); assert.equal(writes[0].zid, 1)
  assert.equal(writes[0].body.itemid, '10101'); assert.equal(writes[0].body.enabled, false)
})

test('ISSUE010 filtered item is not retained by edit and cannot invoke save service', async () => {
  const {object, writes} = component(async () => response([trend('10101', {trends: '0'})]))
  object.openEdit(rule()); await tick()
  assert.equal(object.items.length, 0); assert.equal(object.form.itemid, '')
  await object.save(); assert.equal(writes.length, 0)
})

test('ISSUE010 failed reload clears stale options and cannot invoke save service', async () => {
  const {object, writes, notices} = component(async () => { throw new Error('current item load failed') })
  object.items = [trend('99999')]; object.openEdit(rule()); await tick()
  assert.equal(object.items.length, 0); assert.equal(object.form.itemid, ''); assert.equal(object.itemsLoading, false)
  await object.save(); assert.equal(writes.length, 0)
  assert.ok(notices.some(item => item.type === 'error' && item.message === 'current item load failed'))
})

test('ISSUE010 stale edit retainItemID cannot enter another edit context', async () => {
  const a = deferred(), b = deferred()
  const {object} = component(params => params.hostid === '101' ? a.promise : b.promise)
  object.openEdit(rule()); object.openEdit(rule('20201', {zid: 2, hostid: '202', triggerid: '72'}))
  b.resolve(response([trend('20201')])); await tick()
  a.resolve(response([trend('10101')])); await tick()
  assert.equal(object.form.itemid, '20201'); assert.equal(object.form.zid, 2)
  assert.deepEqual(object.items.map(item => item.itemid), ['20201'])
})

test('ISSUE010 save refuses currently loading items even with otherwise valid form shape', async () => {
  const pending = deferred(); const {object, writes} = component(() => pending.promise)
  object.openEdit(rule()); object.form.itemid = '10101'
  await object.save(); assert.equal(writes.length, 0)
  pending.resolve(response([trend('10101')])); await tick()
})

test('ISSUE010 current eligible create preserves exact source and normal baseline parameters', async () => {
  const {object, writes} = component(async () => response([trend('10101')]))
  object.openCreate(); object.form.name = 'Valid new baseline'; await select(object, '1:101')
  object.form.itemid = '10101'; await object.save()
  assert.deepEqual(writes, [{method: 'POST', body: {zid: 1, itemid: '10101', name: 'Valid new baseline', season_unit: 'd', seasons: 7, deviation: 3, severity: 3, enabled: true}}])
})

test('ISSUE010 save independently rechecks current item eligibility, not just numeric ID', async () => {
  const {object, writes} = component(async () => response([trend('10101')]))
  object.openEdit(rule()); await tick(); object.items[0].trends = '0'
  await object.save(); assert.equal(writes.length, 0)
})

test('ISSUE010 save refuses changed host key or instance without a matching successful load', async () => {
  for (const change of [object => { object.selectedHostKey = '2:202' }, object => { object.form.zid = 2 }]) {
    const {object, writes} = component(async () => response([trend('10101')]))
    object.openEdit(rule()); await tick(); change(object)
    await object.save(); assert.equal(writes.length, 0)
  }
})

test('ISSUE010 invalid host selection clears previous instance and cannot save it', async () => {
  const {object, writes} = component(async () => response([trend('10101')]))
  object.openEdit(rule()); await tick(); await select(object, 'unknown')
  assert.equal(object.form.zid, 0); assert.equal(object.form.itemid, ''); assert.equal(object.items.length, 0)
  await object.save(); assert.equal(writes.length, 0)
})

test('ISSUE010 component destruction ignores an outstanding item response', async () => {
  const pending = deferred(); const {object, definition} = component(() => pending.promise)
  object.openCreate(); const first = select(object, '1:101')
  definition.beforeDestroy.call(object)
  pending.resolve(response([trend('10101')])); await first
  assert.equal(object.items.length, 0); assert.equal(object.form.itemid, '')
})

test('ISSUE010 entire template still compiles and prior status/deviation boundaries remain', () => {
  assert.deepEqual(compiler.compile(parsed.template.content).errors, [])
  assert.match(page, /最后问题/)
  assert.match(page, /record\.enabled \? '已启用' : '已停用'/)
  assert.equal(view.formatDeviation(90), '90σ')
  assert.match(view.formatDeviation(null), /无数据/)
  for (const action of ['create', 'update', 'delete']) assert.ok(page.includes(`v-auth="'${action}'"`))
})
