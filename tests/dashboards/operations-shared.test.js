const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {OPERATIONS_TYPES, OPERATIONS_PRESET, operationsKpi, resourceTopEmptyLabel} = require('../../src/pages/screen/operations-model')
const {defaultNodeData, normalizeDashboardNodes, validateDashboardNodes, registerDashboardChartNode} = require('../../src/pages/dashboard/custom/dashboard-canvas')
test('seven operations widgets persist independently of item-bound legacy charts', () => {
  const nodes = OPERATIONS_PRESET.nodes.map((item, index) => ({...item, id: 'ops-' + index, data: {...defaultNodeData(item.chart_type), data_source: {kind:'operations', metric:'mem'}, operations:{forged:42}, loadState:'error'}}))
  assert.equal(nodes.length, 7)
  assert.equal(validateDashboardNodes(nodes), '')
  for (const node of normalizeDashboardNodes(nodes)) {
    assert.equal(node.data.operations, undefined)
    assert.equal(node.data.loadState, undefined)
    assert.equal(node.data.data_source.kind, 'operations')
    assert.equal(node.data.data_source.metric, 'mem')
    assert.ok(OPERATIONS_TYPES.some(item => item.value === node.data.chart_type))
    assert.ok(node.position.x + node.size.width <= OPERATIONS_PRESET.width)
    assert.ok(node.position.y + node.size.height <= OPERATIONS_PRESET.height)
  }
})
test('operations calculations preserve fixed-screen semantics and genuine zeros', () => {
  assert.deepEqual(operationsKpi(), {total:0, alarms:0, critical:0, online:null})
  assert.deepEqual(operationsKpi({online_rate:90, asset_type_counts:[{count:4},{count:6}]}, [{severity:'5'}, {severity:'2'}]), {total:10, alarms:2, critical:1, online:90})
  assert.equal(operationsKpi({lin_count:3, net_count:2}).total, 5)
})

test('resource rankings distinguish no hosts, missing samples and genuine zero for the selected metric', () => {
  assert.equal(resourceTopEmptyLabel('ops-windows', 'mem', {host_count: 0, cpu: [], mem: []}), '当前租户暂无 Windows 主机')
  assert.match(resourceTopEmptyLabel('ops-linux', 'cpu', {host_count: 1, cpu: []}), /暂无有效的 Linux CPU 采样/)
  assert.match(resourceTopEmptyLabel('ops-linux', 'mem', {cpu: [{cpu: 42}]}), /Linux 内存 采样/)
  assert.equal(resourceTopEmptyLabel('ops-linux', 'cpu', {cpu: [{cpu: 0}]}), '')
  assert.equal(resourceTopEmptyLabel('ops-windows', 'mem', {mem: [{mem: '0'}]}), '')
  assert.match(resourceTopEmptyLabel('ops-linux', 'cpu', {cpu: [{cpu: null}, {cpu: 101}]}), /暂无有效/)
  assert.doesNotMatch(resourceTopEmptyLabel('ops-windows', 'mem', {host_count: null}), /暂无 Windows 主机/)
})

test('the built-in screen passes the measured availability through its API adapter', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../../src/pages/screen/index.vue'), 'utf8')
  const body = source.match(/    fetchInfo\(\) \{([\s\S]*?)\n    \},/)[1]
  for (const value of [100, 0, null]) {
    const fetchInfo = new Function('indexInfo', `return function () {${body}}`)(() => Promise.resolve({data: {code: 200, data: {online_rate: value, lin_count: 1}}}))
    const screen = {dataStatus: {info: 'loading'}, info: {}}
    await fetchInfo.call(screen)
    assert.equal(operationsKpi(screen.info).online, value)
    assert.equal(screen.dataStatus.info, '')
  }
})
test('editor and public projection mount exactly the shared fixed-screen widget', () => {
  const read = file => fs.readFileSync(path.join(__dirname, '../../src/pages', file), 'utf8')
  assert.match(read('screen/index.vue'), /import OperationsWidget/)
  assert.match(read('dashboard/custom/operations-renderer.js'), /import OperationsWidget/)
  for (const file of ['dashboard/custom/designer.vue', 'dashboard/custom/share.vue']) assert.match(read(file), /renderOperationsNode\(node, this\)/)
  assert.match(read('dashboard/custom/designer.vue'), /this\.applyPreset\(OPERATIONS_PRESET\)/)
  assert.match(read('dashboard/custom/operations-renderer.js'), /parent\.isReadonly/)
})
test('X6 operation refresh reuses Vue instance; delete and graph disposal release resources', () => {
  let config, removed, created = 0, updated = 0, disposed = 0
  const data = {chart_type:'ops-hosts'}
  const node = {getData: () => data, once: (_, fn) => { removed = fn }}
  const cleanup = registerDashboardChartNode({registerNode: (_, c) => {config = c}}, {}, () => {
    created++
    return {element:{}, update() {updated++}, dispose() {disposed++}}
  })
  const element = config.html.render(node)
  assert.equal(config.html.render(node), element)
  assert.equal(created, 1); assert.equal(updated, 1)
  removed(); assert.equal(disposed, 1)
  config.html.render(node); cleanup(); assert.equal(disposed, 2)
})
