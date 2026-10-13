const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Vue = require('vue')
const compiler = require('vue-template-compiler')
const Antd = require('ant-design-vue')

// The same external test reads each selected smart-ops-web cwd. It executes the
// actual Vue2 component methods/computed values and compiles its source template;
// controlled service Promises are not API/browser acceptance evidence.
const source = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/visualization/Templates.vue'), 'utf8')
const sfc = compiler.parseComponent(source)
const template = sfc.template.content.trim()
const parsed = compiler.compile(template, {outputSourceRange: true})
assert.deepEqual(parsed.errors, [])
const content = parsed.ast.children.find(node => node.type === 1)
const compiled = compiler.compile(template.slice(content.start, content.end))
assert.deepEqual(compiled.errors, [])
const script = sfc.script.content.replace(/^import .*$/mg, '').replace('export default', 'return')
const serviceNames = ['indexInfo', 'resourceDiscoveryOverview', 'indexTrigger', 'alarmAnalysis', 'indexEgress']
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value))
const response = data => ({data: {code: 200, data}})
const alarm = {eventid: '701', hostid: '41', name: 'api-host-A', lasteventname: 'CPU pressure', severity: 4, instance_name: 'tenant-instance'}
const populated = () => [
  response({total_count: 7, lin_count: 4, win_count: 3, asset_type_counts: []}),
  response({profiles: [{count: 1}], resources: [{host_id: '41', host_name: 'switch-A', category_code: 'network'}], unmatched_host_count: 2}),
  response({items: [alarm]}), response({level_count: [{name: 'high', value: 1}]}), response([{name: 'egress-A'}]),
]
const tick = () => new Promise(resolve => setImmediate(resolve))
function nodes(root) {
  const result = [], seen = new Set()
  function visit(node) {
    if (!node || seen.has(node)) return
    seen.add(node); result.push(node)
    for (const child of [...(node.children || []), ...((node.componentOptions || {}).children || [])]) visit(child)
  }
  visit(root); return result
}
const text = root => nodes(root).map(node => node.text || '').join(' ').replace(/\s+/g, ' ').trim()
async function setup(t, initial = populated()) {
  let responses = initial
  const calls = []
  const services = serviceNames.map((name, index) => (...args) => {
    calls.push({name, args})
    return responses[index] instanceof Error ? Promise.reject(responses[index]) : Promise.resolve(copy(responses[index]))
  })
  const options = new Function('PageLayout', ...serviceNames, script)({}, ...services)
  const vm = new Vue({...options,
    components: {'a-button': Antd.Button, 'a-icon': Antd.Icon, 'a-radio-group': Antd.Radio.Group,
      'a-radio-button': Antd.Radio.Button, 'a-row': Antd.Row, 'a-col': Antd.Col,
      'a-table': Antd.Table, 'a-tag': Antd.Tag},
    render: new Function(compiled.render), staticRenderFns: compiled.staticRenderFns.map(code => new Function(code)),
  })
  t.after(() => vm.$destroy())
  await tick()
  assert.equal(vm.loading, false)
  async function refresh(next) {
    responses = next
    const buttons = nodes(vm._render()).filter(node => node.componentOptions && node.componentOptions.Ctor.options.name === 'AButton')
    assert.equal(buttons.length, 1, 'actual Refresh binding is unique')
    const button = new buttons[0].componentOptions.Ctor({_isComponent: true, _parentVnode: buttons[0], parent: vm})
    button.handleClick({type: 'click'})
    assert.equal(vm.loading, true)
    await tick(); button.$destroy()
    assert.equal(vm.loading, false)
  }
  function view(active) { vm.active = active; return vm._render() }
  return {vm, calls, refresh, view}
}

test('application table maps real trigger name and lasteventname to distinct object/content cells', async t => {
  const f = await setup(t)
  const table = nodes(f.view('application')).find(node => node.componentOptions && node.componentOptions.Ctor.options.name === 'ATable')
  assert.ok(table)
  const {columns, dataSource} = table.componentOptions.propsData
  assert.equal(dataSource.length, 1)
  const cells = columns.slice(0, 2).map(column => dataSource[0][column.dataIndex])
  t.diagnostic(JSON.stringify({columns: columns.slice(0, 2), cells}))
  assert.deepEqual(cells, ['api-host-A', 'CPU pressure'])
  assert.equal(f.vm.templates.length, 5)
  assert.deepEqual(f.calls.map(call => call.name), serviceNames)
  assert.deepEqual(f.calls.find(call => call.name === 'alarmAnalysis').args, [{}])
})

test('business failure on discovery is explicit, not a successful zero/empty refresh, while other sources remain usable', async t => {
  const values = populated(); values[1] = {data: {code: 500, message: '资源发现暂不可用'}}
  const f = await setup(t, values)
  t.diagnostic(JSON.stringify({updatedAt: f.vm.updatedAt, network: f.vm.activeMetrics, text: text(f.view('network'))}))
  assert.equal(f.vm.updatedAt, '')
  assert.deepEqual(f.vm.activeMetrics.map(item => item.value), ['—', 1, '—', 1])
  assert.match(text(f.view('network')), /资源发现.*加载失败|加载失败.*资源发现/)
  assert.doesNotMatch(text(f.view('network')), /暂无网络资源发现数据/)
  f.view('system'); assert.equal(f.vm.activeMetrics[0].value, 7)
  f.view('application'); assert.equal(f.vm.activeMetrics[0].value, 1)
  f.view('comprehensive'); assert.deepEqual(f.vm.activeMetrics.map(item => item.value), [7, 1, 90, '—'])
})

test('transport and missing-envelope failures cannot manufacture healthy business or empty asset/alarm views', async t => {
  const values = populated()
  values[0] = undefined; values[2] = new Error('offline'); values[3] = {data: {code: 403}}; values[4] = new Error('egress offline')
  const f = await setup(t, values)
  assert.equal(f.vm.updatedAt, '')
  assert.equal(f.vm.discovery.resources.length, 1, 'successful discovery is retained')
  assert.deepEqual(f.vm.activeMetrics.map(item => item.value), [1, '—', 2, 1])
  const system = text(f.view('system')); assert.match(system, /加载失败/); assert.doesNotMatch(system, /暂无系统资产数据/)
  const application = text(f.view('application')); assert.match(application, /加载失败/); assert.doesNotMatch(application, /暂无活动告警/)
  const business = text(f.view('business')); assert.match(business, /— \/ 100/)
  assert.deepEqual(f.vm.activeMetrics.map(item => item.value), ['—', '—', '—', 1])
  f.view('comprehensive'); assert.deepEqual(f.vm.activeMetrics.map(item => item.value), ['—', '—', '—', 1])
})

test('actual Refresh button preserves last success during partial failure and clears errors after genuine empty recovery', async t => {
  const f = await setup(t)
  assert.ok(f.vm.updatedAt)
  f.vm.updatedAt = 'prior-success'
  const values = populated(); values[2] = {data: {code: 500}}
  await f.refresh(values)
  assert.equal(f.vm.updatedAt, 'prior-success')
  assert.equal(f.vm.alarms[0].lasteventname, 'CPU pressure', 'failed source does not destroy last successful data')
  const failed = text(f.view('application'))
  assert.match(failed, /加载失败/); assert.doesNotMatch(failed, /暂无活动告警/)
  await f.refresh(Array.from({length: 5}, () => response(null)))
  assert.notEqual(f.vm.updatedAt, 'prior-success')
  assert.match(text(f.view('application')), /暂无活动告警/)
  assert.doesNotMatch(text(f.vm._render()), /加载失败/)
  assert.equal(f.vm.alarms.length, 0)
  assert.equal(f.calls.length, 15)
})

test('successful null/empty payloads retain five genuine zero/empty templates and deterministic health formula', async t => {
  const f = await setup(t, [response(null), response({profiles: [], resources: [], unmatched_host_count: 0}), response({items: []}), response(null), response(null)])
  assert.ok(f.vm.updatedAt)
  assert.deepEqual(f.vm.activeMetrics.map(item => item.value), [0, 0, 0, 1])
  assert.match(text(f.view('network')), /暂无网络资源发现数据/)
  assert.match(text(f.view('system')), /暂无系统资产数据/)
  assert.match(text(f.view('application')), /暂无活动告警/)
  f.view('business'); assert.equal(f.vm.businessHealth, 100)
  assert.deepEqual(f.vm.activeMetrics.map(item => item.value), [100, 0, 0, 1])
  f.view('comprehensive'); assert.deepEqual(f.vm.activeMetrics.map(item => item.value), [0, 0, 100, 0])
  assert.doesNotMatch(text(f.vm._render()), /加载失败/)
})
