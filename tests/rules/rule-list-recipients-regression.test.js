const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {createRequire} = require('node:module')
const compiler = require('vue-template-compiler')
const Vue = require('vue')
const moment = require('moment')

// Run identical source-derived Vue methods against each transaction copy.
// Services are isolated request/response fixtures; no HTTP or authorization bypass.
const root = process.env.RULE_TEST_ROOT || path.resolve(__dirname, '../..')
const file = path.join(root, 'src/pages/alarm/rule.vue')
const source = fs.readFileSync(file, 'utf8')
const sfc = compiler.parseComponent(source)
const script = sfc.script.content.replace(/^import[^\n]*$/gm, '').replace('export default', 'return')
const compiled = compiler.compile(sfc.template.content)
const user = id => ({id, username: `recipient-${id}`})
const users = count => Array.from({length: count}, (_, i) => user(i + 1))
const reply = (items, total = items.length) => ({data: {code: 200, data: {items, total}}})
const poolApi = pool => ({page, limit}) => {
  // Match GetUser: invalid limit >200 falls back to10, reproducing ISSUE-021.
  const size = Number.isInteger(limit) && limit >= 1 && limit <= 200 ? limit : 10
  return reply(pool.slice((page - 1) * size, page * size), pool.length)
}
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return {promise, resolve, reject}
}
async function settle() {
  for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve))
  await Vue.nextTick()
}
function nodes(vnode) {
  if (!vnode) return []
  return [vnode, ...(vnode.children || vnode.componentOptions && vnode.componentOptions.children || []).flatMap(nodes)]
}
const textOf = vnode => nodes(vnode).map(n => n.text || '').join('')

function setup(t, overrides = {}, options = {}) {
  const requests = []
  const messages = {error: [], success: [], warning: []}
  const handlers = {
    ruleList: () => reply([{id: 11, name: 'selected-rule'}]),
    userList: poolApi(users(30)),
    groupList: () => reply([]),
    listZabbixInstance: () => ({data: {code: 200, data: []}}),
    ruleGet: () => ({data: {code: 200, data: {id: 11, name: 'selected-rule', z_ids: '1', conditions: '[{"r_type":"host","r_func":"contains","r_value":"fixture"}]', user_ids: '401,402', group_ids: '', channel: 'mail', s_week: '1', s_time: '09:00', e_time: '18:00', status: '0'}}}),
    ruleAdd: () => ({data: {code: 200}}),
    rulePut: () => ({data: {code: 200}}),
    ruleDelete: () => ({data: {code: 200}}),
    ruleStatusPut: () => ({data: {code: 200}}),
    ...overrides,
  }
  const services = Object.fromEntries(Object.entries(handlers).map(([name, handle]) => [name, (...args) => {
    requests.push({name, args: JSON.parse(JSON.stringify(args))})
    return Promise.resolve().then(() => handle(...args))
  }]))
  const bindings = {require: createRequire(file), PageLayout: {}, parseTimeFun: value => String(value), moment, themeMixin: {}, ...services}
  const definition = new Function(...Object.keys(bindings), script)(...Object.values(bindings))
  const originalCreated = definition.created
  definition.created = options.created ? originalCreated : undefined
  definition.beforeCreate = function () {
    this.$t = key => key
    this.$can = () => options.allowed !== false
    this.$message = Object.fromEntries(Object.keys(messages).map(kind => [kind, value => messages[kind].push(value)]))
  }
  definition.render = new Function(compiled.render)
  definition.staticRenderFns = compiled.staticRenderFns.map(code => new Function(code))
  const vm = new Vue(definition)
  vm.initOptions()
  t.after(() => vm.$destroy())
  return {vm, requests, messages, calls: name => requests.filter(request => request.name === name).map(request => request.args)}
}
function clickQuery(vm) {
  const buttons = nodes(vm._render()).filter(node => node.tag === 'a-button' && textOf(node).includes('btn_query'))
  assert.equal(buttons.length, 1, 'exercise exactly one real template query button')
  buttons[0].data.on.click({})
}
function assertRecipientError(vm, messages) {
  assert.deepEqual([...vm.userlist], [], 'partial/stale recipients must not be published as complete')
  assert.equal(vm.userlistLoading, false)
  assert.ok(vm.userlistError && vm.userlistError.length > 0, 'persistent visible error state is required')
  assert.ok(messages.error.length > 0, 'failure must not be silent')
  const alerts = nodes(vm._render()).filter(node => node.tag === 'a-alert' && node.data.attrs.message === vm.userlistError)
  assert.ok(alerts.length > 0, 'actual Vue template must expose the failure')
}

test('ISSUE-011 real query click sends name and resets both page states without resetting page size', async t => {
  const {vm, calls} = setup(t)
  vm.name = 'complete rule name'; vm.page = 5; vm.pagination.current = 5; vm.pageSize = 20
  vm.status = '1'; vm.beginTime = 'begin'; vm.endTime = 'end'
  clickQuery(vm); await settle()
  const request = calls('ruleList')[0][0]
  assert.equal(request.name, 'complete rule name')
  assert.equal(request.page, 1); assert.equal(request.limit, 20)
  assert.equal(vm.page, 1); assert.equal(vm.pagination.current, 1)
  assert.equal(request.status, '1'); assert.equal(request.begin, 'begin'); assert.equal(request.end, 'end')
  t.diagnostic(JSON.stringify({request, page: vm.page, current: vm.pagination.current}))
})

test('ISSUE-011 reset clears name and existing filters, requesting first page', async t => {
  const {vm, calls} = setup(t)
  vm.name = 'old name'; vm.page = 7; vm.pagination.current = 7
  vm.hosts = 'host'; vm.tenantid = 'tenant'; vm.status = '1'; vm.level = '4'
  vm.resetData(); await settle()
  assert.equal(vm.name, ''); assert.equal(vm.page, 1); assert.equal(vm.pagination.current, 1)
  const request = calls('ruleList')[0][0]
  assert.equal(request.name, ''); assert.equal(request.page, 1)
  assert.equal(request.hosts, ''); assert.equal(request.status, ''); assert.equal(request.level, '')
  assert.equal(vm.tenantid, '')
})

test('ISSUE-011 table pagination retains current name and requests the selected page', async t => {
  const {vm, calls} = setup(t)
  vm.name = 'same-filter'
  vm.changePage({current: 3, pageSize: 50}); await settle()
  const request = calls('ruleList')[0][0]
  assert.equal(request.name, 'same-filter'); assert.equal(request.page, 3); assert.equal(request.limit, 50)
  assert.equal(vm.pagination.current, 3); assert.equal(vm.pagination.pageSize, 50)
})

test('ISSUE-011 refresh init preserves current page, request filter and successful list result', async t => {
  const {vm, calls} = setup(t)
  vm.page = 2; vm.name = 'selected-rule'
  vm.init(); await settle()
  assert.equal(calls('ruleList')[0][0].name, 'selected-rule')
  assert.equal(calls('ruleList')[0][0].page, 2)
  assert.equal(vm.list[0].name, 'selected-rule'); assert.equal(vm.pagination.total, 1); assert.equal(vm.loading, false)
})

test('ISSUE-021 actual created lifecycle loads all30 using a legal limit rather than backend fallback10', async t => {
  const {vm, calls} = setup(t, {}, {created: true})
  await settle()
  assert.equal(vm.userlist.length, 30)
  assert.deepEqual(calls('userList').map(args => args[0]), [{page: 1, limit: 200}])
  assert.equal(vm.userlist[29].username, 'recipient-30')
  t.diagnostic(JSON.stringify({requests: calls('userList'), recipients: vm.userlist.length}))
})

test('ISSUE-021 >200 recipients load every page through451 with unique stable IDs', async t => {
  const {vm, calls, messages} = setup(t, {userList: poolApi(users(451))})
  vm.init(); await settle()
  assert.equal(vm.userlist.length, 451)
  assert.deepEqual(calls('userList').map(args => args[0]), [1, 2, 3].map(page => ({page, limit: 200})))
  assert.equal(new Set(vm.userlist.map(item => String(item.id))).size, 451)
  assert.equal(vm.userlistLoading, false); assert.equal(vm.userlistError, '')
  assert.deepEqual(messages.error, [])
  t.diagnostic(JSON.stringify({requests: calls('userList'), count: vm.userlist.length, last: vm.userlist.at(-1)}))
})

test('ISSUE-021 page-boundary duplicates are removed without losing later recipients', async t => {
  const pages = [users(200), Array.from({length: 200}, (_, i) => user(i + 200)), [user(400), user(401)]]
  const {vm, calls} = setup(t, {userList: ({page}) => reply(pages[page - 1] || [], 401)})
  vm.init(); await settle()
  assert.equal(vm.userlist.length, 401); assert.equal(calls('userList').length, 3)
  assert.deepEqual(vm.userlist.map(item => item.id), users(401).map(item => item.id))
})

test('ISSUE-021 numeric/string representations of the same ID produce one option', async t => {
  const original = [user(1), {id: '1', username: 'same-id'}, user(2)]
  const before = JSON.stringify(original)
  const {vm} = setup(t, {userList: () => reply(original, 2)})
  vm.init(); await settle()
  assert.deepEqual(vm.userlist.map(item => String(item.id)), ['1', '2'])
  assert.equal(JSON.stringify(original), before)
})

test('ISSUE-021 no partial list is published while a later page remains pending', async t => {
  const next = deferred()
  const {vm, calls} = setup(t, {userList: ({page}) => page === 1 ? reply(users(200), 201) : next.promise})
  vm.init(); await settle()
  assert.equal(calls('userList').length, 2)
  assert.equal(vm.userlistLoading, true); assert.equal(vm.userlist.length, 0)
  next.resolve(reply([user(201)], 201)); await settle()
  assert.equal(vm.userlist.length, 201); assert.equal(vm.userlistLoading, false)
})

test('ISSUE-021 selected later-page recipients render names and survive edit/save unchanged', async t => {
  const {vm, calls} = setup(t, {userList: poolApi(users(402))})
  vm.init(); vm.seeEdit({id: 11}); await settle()
  assert.deepEqual([...vm.editRule.user_ids], ['401', '402'])
  const render = vm.columns.find(column => column.dataIndex === 'user_ids').customRender
  assert.equal(render('401,402').children, 'recipient-401,recipient-402')
  const options = nodes(vm._render()).filter(node => node.tag === 'a-select-option' && node.data.attrs.value === '402')
  assert.equal(options.length, 1); assert.equal(textOf(options[0]).trim(), 'recipient-402')
  await vm.saveRule(); await settle()
  assert.equal(calls('rulePut')[0][1].user_ids, '401,402')
})

test('ISSUE-021 first-page business denial remains a visible failure without privilege changes', async t => {
  const {vm, messages, calls} = setup(t, {userList: () => ({data: {code: 403, message: 'denied fixture'}})}, {allowed: false})
  vm.init(); await settle()
  assertRecipientError(vm, messages)
  assert.match(vm.userlistError, /denied fixture/); assert.equal(calls('userList').length, 1)
  assert.equal(vm.$can('platform.rules', 'create'), false)
})

for (const failure of ['business-denial', 'network-rejection']) {
  test(`ISSUE-021 later-page ${failure} rejects the entire list and preserves selected IDs`, async t => {
    const {vm, messages} = setup(t, {userList: ({page}) => page === 1 ? reply(users(200), 201) : failure === 'business-denial' ? {data: {code: 403, message: 'page2 denied'}} : Promise.reject(new Error('page2 network failure'))})
    vm.editRule.user_ids = ['201']; vm.init(); await settle()
    assertRecipientError(vm, messages)
    assert.deepEqual([...vm.editRule.user_ids], ['201'])
    assert.match(vm.userlistError, /page2/)
  })
}

for (const [label, data] of [
  ['missing-items', {total: 1}], ['missing-total', {items: [user(1)]}],
  ['negative-total', {items: [], total: -1}], ['fractional-total', {items: [], total: 1.5}],
  ['string-total', {items: [], total: '1'}], ['nonfinite-total', {items: [], total: Infinity}],
  ['null-items', {items: null, total: 0}], ['oversized-page', {items: users(201), total: 201}],
  ['missing-id', {items: [{username: 'no-id'}], total: 1}], ['missing-name', {items: [{id: 1}], total: 1}],
]) {
  test(`ISSUE-021 malformed ${label} does not masquerade as a complete list`, async t => {
    const {vm, messages} = setup(t, {userList: () => ({data: {code: 200, data}})})
    vm.init(); await settle(); assertRecipientError(vm, messages)
  })
}

test('ISSUE-021 an early empty page with positive total is an explicit incomplete result', async t => {
  const {vm, messages} = setup(t, {userList: () => reply([], 20)})
  vm.init(); await settle(); assertRecipientError(vm, messages)
})

test('ISSUE-021 short nonfinal page is not accepted or silently skipped by offset pagination', async t => {
  const {vm, messages, calls} = setup(t, {userList: () => reply(users(10), 300)})
  vm.init(); await settle(); assertRecipientError(vm, messages)
  assert.equal(calls('userList').length, 1)
})

test('ISSUE-021 repeated pages are detected rather than looping or claiming completion', async t => {
  const {vm, messages, calls} = setup(t, {userList: () => reply(users(200), 401)})
  vm.init(); await settle(); assertRecipientError(vm, messages)
  assert.equal(calls('userList').length, 2)
})

test('ISSUE-021 total changing between pages requires a visible retry, not a fabricated snapshot', async t => {
  const {vm, messages} = setup(t, {userList: ({page}) => page === 1 ? reply(users(200), 201) : reply([user(201), user(202)], 202)})
  vm.init(); await settle(); assertRecipientError(vm, messages)
})

test('ISSUE-021 a legitimate empty result succeeds and does not report failure', async t => {
  const {vm, messages} = setup(t, {userList: () => reply([], 0)})
  vm.init(); await settle()
  assert.equal(vm.userlist.length, 0); assert.equal(vm.userlistError, ''); assert.equal(vm.userlistLoading, false)
  assert.deepEqual(messages.error, [])
})

test('ISSUE-021 superseded async load cannot overwrite the latest complete options', async t => {
  const old = deferred(); const current = deferred(); let starts = 0
  const {vm, messages} = setup(t, {userList: () => ++starts === 1 ? old.promise : current.promise})
  vm.init(); vm.init(); await settle()
  current.resolve(reply([user(402)], 1)); await settle()
  old.resolve(reply([user(1)], 1)); await settle()
  assert.deepEqual(vm.userlist.map(item => item.id), [402]); assert.deepEqual(messages.error, [])
  assert.equal(vm.userlistLoading, false)
})

test('ISSUE-021 successful retry clears prior error and returns complete options', async t => {
  let attempt = 0
  const {vm, messages} = setup(t, {userList: () => ++attempt === 1 ? {data: {code: 500, message: 'retry fixture'}} : reply([user(301)], 1)})
  vm.init(); await settle(); assertRecipientError(vm, messages)
  vm.init(); await settle()
  assert.equal(vm.userlistError, ''); assert.equal(vm.userlistLoading, false)
  assert.deepEqual(vm.userlist.map(item => item.id), [301])
})

test('ISSUE-011/021 preserve compiled template, ISSUE-066 horizontal scrolling and existing permission controls', () => {
  assert.deepEqual(compiled.errors, [])
  assert.match(sfc.template.content, /:scroll="\{ x: true \}"/)
  for (const action of ['create', 'update', 'delete']) assert.ok(sfc.template.content.includes(`$can('platform.rules', '${action}')`))
  assert.ok(sfc.template.content.includes(':disabled="!$can(\'platform.rules\', \'update\')"'))
})
