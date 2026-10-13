const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Vue = require('vue')
const compiler = require('vue-template-compiler')

const source = fs.readFileSync(path.resolve(__dirname, '../../src/pages/alarm/query.vue'), 'utf8')
const template = compiler.parseComponent(source).template.content.trim()
const parsed = compiler.compile(template, {outputSourceRange: true})
assert.deepEqual(parsed.errors, [])
const nodes = []
function visit(node) {
  if (node.type !== 1) return
  nodes.push(node)
  for (const child of node.children || []) visit(child)
}
visit(parsed.ast)
const button = key => {
  const matches = nodes.filter(node => node.tag === 'a-button' &&
    node.children.some(child => (child.text || '').includes(`$t('${key}')`)))
  assert.equal(matches.length, 1, `one literal ${key} button`)
  return matches[0]
}
const queryButton = button('btn_query')
const resetButton = button('btn_reset')
const tables = nodes.filter(node => node.tag === 'a-table' && node.events && node.events.change)
assert.equal(tables.length, 1, 'one literal pagination table')
const pieces = [queryButton, resetButton, tables[0]].map(node => template.slice(node.start, node.end))
const render = compiler.compile(`<div>${pieces.join('\n')}</div>`)
assert.deepEqual(render.errors, [])

// Real Vue2 compiles the actual source bindings. Inert Ant component boundaries
// expose their generated listeners; no fabricated VNodes or browser claims.
const LocalVue = Vue.extend()
LocalVue.component('a-button', {render(h) { return h('button', this.$slots.default) }})
LocalVue.component('a-table', {render(h) { return h('div') }})
const tick = () => new Promise(resolve => setImmediate(resolve))
const filter = {hosts: 'unique-host', status: '0', level: '0', hostIp: '192.0.2.9',
  selectedInstance: 17, beginTime: '2026-10-01 00:00:00', endTime: '2026-10-02 23:59:59'}
const defaultBegin = '2026-10-03 00:00:00'
const defaultEnd = '2026-10-09 23:59:59'

function literalMethod(name, bindings) {
  assert.match(name, /^[A-Za-z_$][A-Za-z0-9_$]*$/, 'method reference, not a substituted handler')
  const start = source.indexOf(`    ${name}(`)
  const end = source.indexOf('\n    },', start)
  assert.ok(start >= 0 && end > start, `literal ${name} method exists`)
  return new Function(...Object.keys(bindings), `return ({${source.slice(start, end + 6).trim()}}).${name}`)(...Object.values(bindings))
}

function setup(t, values = {}) {
  const requests = []
  const range = [defaultBegin, defaultEnd].map(value => ({toDate: () => new Date(value.replace(' ', 'T') + 'Z')}))
  const bindings = {
    alarm(params) { return new Promise(resolve => requests.push({params: {...params}, resolve})) },
    getDefaultAlarmTimeRange: () => range,
    parseTimeFun: date => date.toISOString().slice(0, 19).replace('T', ' '),
  }
  const names = new Set(['init', 'changePage', 'resetData', 'applyTimeRange',
    queryButton.events.click.value, resetButton.events.click.value, tables[0].events.change.value])
  const methods = Object.fromEntries([...names].map(name => [name, literalMethod(name, bindings)]))
  methods.$t = key => key
  methods.getEvent = () => {} // Unused row-expansion boundary on the real table tag.
  const vm = new LocalVue({
    data: () => ({...filter, page: 2, pageSize: 10, pagination: {current: 2, pageSize: 10, total: 25},
      list: [], columns: [], loading: false, expandedAlarmKeys: [99], listSequence: 0,
      sourceTenantKey: 'TENANT_A', timeValue: null, ...values}),
    methods, render: new Function(render.render),
    staticRenderFns: render.staticRenderFns.map(code => new Function(code)),
  })
  t.after(() => vm.$destroy())
  function children() { return vm._render().children.filter(node => node.componentOptions) }
  function click(key) {
    const node = children().find(node => node.componentOptions.tag === 'a-button' &&
      node.componentOptions.children.some(child => (child.text || '').trim() === key))
    assert.ok(node, `compiled ${key} button exists`)
    node.componentOptions.listeners.click({type: 'click'})
  }
  function changePage(current, pageSize) {
    const table = children().find(node => node.componentOptions.tag === 'a-table')
    assert.ok(table)
    table.componentOptions.listeners.change({current, pageSize})
  }
  async function respond(index, items = [{id: 100 + index}], total = items.length) {
    requests[index].resolve({data: {code: 200, data: {items, total}}})
    await tick()
  }
  return {vm, requests, click, changePage, respond}
}

function expected(page, limit, values = filter) {
  const params = {page, limit, hosts: values.hosts, status: values.status, level: values.level,
    host_ip: values.hostIp, order: 'desc', order_by: 'id'}
  if (values.selectedInstance) params.zid = values.selectedInstance
  if (values.beginTime) { params.begin = values.beginTime; params.end = values.endTime }
  return params
}

test('actual Query button applies second-page filters from page1 without losing any filter', async t => {
  const f = setup(t)
  f.changePage(2, 10)
  await f.respond(0, [{id: 12}], 25)
  f.vm.hosts = 'one-matching-host'
  f.click('btn_query')
  assert.deepEqual(f.requests[1].params, expected(1, 10, {...filter, hosts: 'one-matching-host'}))
  assert.equal(f.vm.page, 1)
  assert.equal(f.vm.pagination.current, 1)
  await f.respond(1, [{id: 7}], 1)
  assert.deepEqual(f.vm.list.map(row => row.id), [7])
  assert.equal(f.vm.pagination.total, 1)
})

test('repeated native-bound Query clicks keep page1 and the existing latest-response guard', async t => {
  const f = setup(t)
  f.click('btn_query'); f.click('btn_query')
  assert.deepEqual(f.requests.map(row => row.params.page), [1, 1])
  await f.respond(1, [{id: 22}], 1)
  await f.respond(0, [{id: 11}], 1)
  assert.deepEqual(f.vm.list.map(row => row.id), [22])
  assert.equal(f.vm.pagination.current, 1)
  assert.equal(f.vm.loading, false)
})

test('actual Reset clears filters, restores the default window and returns to page1 preserving page size', async t => {
  const f = setup(t, {page: 3, pageSize: 50, pagination: {current: 3, pageSize: 50, total: 101}})
  f.click('btn_reset')
  assert.deepEqual(f.requests[0].params, expected(1, 50, {hosts: '', status: '', level: '', hostIp: '',
    selectedInstance: '', beginTime: defaultBegin, endTime: defaultEnd}))
  assert.equal(f.vm.page, 1)
  assert.equal(f.vm.pagination.current, 1)
  assert.equal(f.vm.selectedInstance, '')
  await f.respond(0)
  assert.equal(f.vm.pagination.pageSize, 50)
})

test('actual table pagination listener retains the requested page, size and filters', async t => {
  const f = setup(t, {page: 1})
  f.changePage(3, 20)
  assert.deepEqual(f.requests[0].params, expected(3, 20))
  await f.respond(0, [{id: 42}], 60)
  assert.equal(f.vm.page, 3)
  assert.equal(f.vm.pagination.current, 3)
  assert.equal(f.vm.pagination.pageSize, 20)
})

test('generic init refresh preserves its current page instead of unconditionally resetting it', async t => {
  const f = setup(t, {page: 4})
  f.vm.init()
  assert.deepEqual(f.requests[0].params, expected(4, 10))
  await f.respond(0, [], 35)
  assert.equal(f.vm.pagination.current, 4)
})

test('Query with cleared optional instance/time fields requests page1 without inventing filters', async t => {
  const cleared = {hosts: '', status: '', level: '', hostIp: '', selectedInstance: '', beginTime: '', endTime: ''}
  const f = setup(t, {...cleared, page: 5})
  f.click('btn_query')
  assert.deepEqual(f.requests[0].params, expected(1, 10, cleared))
  await f.respond(0, [], 0)
  assert.equal(f.vm.pagination.current, 1)
  assert.deepEqual(Array.from(f.vm.list), [])
})
