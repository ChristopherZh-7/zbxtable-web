const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const test = require('node:test')
const {defaultNodeData, emptyMessage, normalizeDashboardNodes, registerDashboardChartNode} = require('../../src/pages/dashboard/custom/dashboard-canvas')
const {previewGraphic, darkBackground} = require('../../src/pages/dashboard/custom/component-preview')
const {isOperationsType, OPERATIONS_PRESET} = require('../../src/pages/screen/operations-model')

function methods(overrides = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../../src/pages/dashboard/custom/designer.vue'), 'utf8')
  const script = source.split('<script>')[1].split('</script>')[0]
    .replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?\n/gm, '')
    .replace('registerDashboardChartNode(Graph, echarts)', '')
    .replace('export default', 'module.exports =')
  const sandbox = {module: {exports: {}}, PageLayout: {}, OperationsWidget: {}, HeaderBar: {}, ScreenPanel: {}, defaultNodeData, previewGraphic, isOperationsType, OPERATIONS_PRESET, ...overrides}
  vm.runInNewContext(script, sandbox)
  return sandbox.module.exports.methods
}

function node(data = defaultNodeData('gauge')) {
  return {
    id: 'component-1', data,
    getData() { return this.data },
    setData(next) { this.data = next },
    getPosition: () => ({x: 45, y: 90}),
    getSize: () => ({width: 360, height: 240}),
  }
}

test('operations refresh deduplicates tenant requests and preserves in-flight edits', async () => {
  let resolveInfo, calls = 0
  const pending = new Promise(resolve => { resolveInfo = resolve })
  const impl = methods({indexInfo: () => {calls++; return pending}, indexTrigger: () => Promise.resolve({data:{code:200,data:{items:[]}}})})
  const hosts = node({...defaultNodeData('ops-hosts'), data_source:{kind:'operations',metric:'cpu'}})
  const kpi = node({...defaultNodeData('ops-kpi'), data_source:{kind:'operations',metric:'cpu'}})
  const context = {graph:{getNodes:() => [hosts,kpi]}}
  const result = impl.refreshOperations.call(context)
  hosts.data.title = 'edited while fetching'
  resolveInfo({data:{code:200,data:{lin_count:5}}})
  await result
  assert.equal(calls,1)
  assert.equal(hosts.data.title,'edited while fetching')
  assert.equal(hosts.data.operations.info.lin_count,5)
  assert.equal(kpi.data.operations.info.lin_count,5)
})

test('failed operations refresh is explicit and cannot overwrite a changed module', async () => {
  let resolveInfo
  const impl = methods({indexInfo: () => new Promise(resolve => {resolveInfo = resolve})})
  const hosts = node({...defaultNodeData('ops-hosts'), data_source:{kind:'operations',metric:'cpu'}})
  const context = {graph:{getNodes:() => [hosts]}}
  const first = impl.refreshOperations.call(context)
  resolveInfo({data:{code:500}}); await first
  assert.equal(hosts.data.loadState,'error')
  const next = impl.refreshOperations.call(context)
  hosts.data = defaultNodeData('line')
  resolveInfo({data:{code:200,data:{lin_count:99}}}); await next
  assert.equal(hosts.data.operations, undefined)
})

test('empty widgets explain missing sources and samples without hiding a genuine zero', () => {
  for (const type of ['line', 'bar', 'pie', 'gauge', 'table', 'topology']) {
    const data = defaultNodeData(type)
    assert.equal(emptyMessage(data)[0], '待绑定数据源')
    data.data_source.item_name = 'CPU'
    assert.equal(emptyMessage(data)[0], '暂无采样数据')
    data.series = [{clock: '123', value: 0}]
    assert.equal(emptyMessage(data), null)
    data.loadState = 'error'
    assert.equal(emptyMessage(data)[0], '数据加载失败')
    data.loadState = 'loading'
    assert.equal(emptyMessage(data)[0], '正在加载数据')
  }
})

test('X6 HTML nodes redraw on data and size edits, not on position-only changes', () => {
  let config
  registerDashboardChartNode({registerNode(name, options) { config = options }}, {})
  assert.equal(typeof config.html.render, 'function')
  for (const key of ['data', 'size']) {
    assert.equal(config.html.shouldComponentUpdate({hasChanged: field => field === key}), true)
  }
  assert.equal(config.html.shouldComponentUpdate({hasChanged: field => field === 'position'}), false)
})

test('six visual styles are distinct decorative previews and never saved as monitoring data', () => {
  const types = ['line', 'bar', 'pie', 'gauge', 'table', 'topology']
  assert.equal(new Set(types.map(previewGraphic)).size, 6)
  types.forEach(type => assert.match(previewGraphic(type), /<svg/))
  const impl = methods()
  const newNode = impl.nodeConfig.call({visualizationMode: true, isReadonly: false}, 'gauge', {x: 0, y: 0})
  assert.equal(newNode.data.preview_enabled, true)
  assert.equal(newNode.data.style.background, '#061226')
  assert.equal(newNode.data.series.length, 0)
  const saved = normalizeDashboardNodes([newNode])[0]
  assert.equal(saved.data.preview_enabled, undefined)
  assert.equal(saved.data.series, undefined)
  assert.equal(saved.data.data_source.itemid, '')
  assert.equal(darkBackground(saved.data.style.background), true)
  assert.equal(darkBackground('#ffffff'), false)
  assert.equal(impl.nodeConfig.call({isReadonly: true}, 'line', {x: 0, y: 0}).data.preview_enabled, false)
})

test('visual previews are editor-only and real zero samples render the actual chart', () => {
  const savedDocument = global.document
  const savedFrame = global.requestAnimationFrame
  global.document = {createElement: () => ({children: [], style: {setProperty() {}}, classList: {add() {}}, isConnected: true, appendChild(child) { this.children.push(child) }})}
  global.requestAnimationFrame = render => render()
  try {
    let config
    let chartCalls = 0
    registerDashboardChartNode({registerNode(name, options) { config = options }}, {
      init: () => { chartCalls += 1; return {setOption() {}, dispose() {}} },
    })
    const selected = node()
    selected.once = () => {}
    selected.data.preview_enabled = true
    const hasPreview = el => el.className === 'dashboard-chart-node__preview' || el.children.some(hasPreview)
    assert.equal(hasPreview(config.html.render(selected)), true)
    assert.equal(chartCalls, 0)
    selected.data.preview_enabled = false
    assert.equal(hasPreview(config.html.render(selected)), false)
    selected.data.preview_enabled = true
    selected.data.series = [{clock: '123', value: 0}]
    assert.equal(hasPreview(config.html.render(selected)), false)
    assert.equal(chartCalls, 1)
  } finally {
    global.document = savedDocument
    global.requestAnimationFrame = savedFrame
  }
})

test('canvas resizing uses the visible parent instead of X6 stale inline width', () => {
  const calls = []
  const ctx = {
    $refs: {canvas: {clientWidth: 1200}, canvasWrap: {clientWidth: 800}},
    graph: {resize: (width, height) => calls.push([width, height]), zoomToFit: () => calls.push('fit')},
    nodes: [node()], canvasViewMode: 'fit',
  }
  const impl = methods({window: {innerHeight: 800}})
  ctx.fitDesignCanvas = impl.fitDesignCanvas.bind(ctx)
  impl.resizeCanvas.call(ctx)
  assert.deepEqual(calls, [[800, 520], 'fit'])
})

test('component picker opens readable editing scale and readonly refuses selection', () => {
  const selected = node()
  const calls = []
  const impl = methods()
  const ctx = {
    nodes: [selected], isReadonly: false,
    selectNode(value) { this.selectedNode = value },
    graph: {zoomTo: value => calls.push(value), centerCell: value => calls.push(value.id)},
  }
  ctx.resetZoom = impl.resetZoom.bind(ctx)
  impl.selectComponent.call(ctx, selected.id)
  assert.equal(ctx.selectedNode, selected)
  assert.deepEqual(calls, [1, selected.id])
  ctx.isReadonly = true
  ctx.selectedNode = null
  impl.selectComponent.call(ctx, selected.id)
  assert.equal(ctx.selectedNode, null)
})

test('dragged geometry is reflected in the configuration panel', () => {
  const selected = node()
  const ctx = {selectedNode: selected, graph: {getNodes: () => [selected]}}
  methods().syncNodes.call(ctx)
  assert.equal(ctx.layout.x, 45)
  assert.equal(ctx.layout.y, 90)
  assert.equal(ctx.layout.width, 360)
})

test('changing sources clears old samples; editing a title preserves fresh samples', () => {
  const selected = node()
  selected.data.series = [{clock: '123', value: 27}]
  const ctx = {selectedNode: selected, editor: JSON.parse(JSON.stringify(selected.data)), isReadonly: false}
  ctx.editor.title = '新标题'
  methods().applyEditor.call(ctx)
  assert.equal(selected.data.title, '新标题')
  assert.equal(selected.data.series[0].value, 27)
  ctx.editor.data_source.itemid = 'new-item'
  methods().applyEditor.call(ctx)
  assert.equal(selected.data.series.length, 0)
  assert.equal(normalizeDashboardNodes([{data: selected.data}])[0].data.loadState, undefined)
})

test('in-flight history cannot undo a title edit or overwrite a new source', async () => {
  const pending = []
  const impl = methods({
    hostMockd: () => new Promise(resolve => pending.push(resolve)),
    moment: () => ({subtract() { return this }, format() { return 'time' }}),
  })
  const selected = node()
  selected.data.data_source = {itemid: '1', history: '0'}
  const ctx = {graph: {getNodes: () => [selected]}}
  const first = impl.refreshNode.call(ctx, selected)
  selected.data = {...selected.data, title: '用户编辑后的标题'}
  pending.shift()({data: {code: 200, data: {items: [{clock: '123', value: '42'}]}}})
  await first
  assert.equal(selected.data.title, '用户编辑后的标题')
  assert.equal(selected.data.series[0].value, 42)
  const second = impl.refreshNode.call(ctx, selected)
  selected.data = {...selected.data, data_source: {itemid: '2', history: '0'}, series: []}
  pending.shift()({data: {code: 200, data: {items: [{clock: '124', value: '99'}]}}})
  await second
  assert.equal(selected.data.series.length, 0)
  assert.equal(selected.data.data_source.itemid, '2')
})

test('older history requests cannot replace newer samples and failures are explicit', async () => {
  const pending = []
  const impl = methods({
    hostMockd: () => new Promise((resolve, reject) => pending.push({resolve, reject})),
    moment: () => ({subtract() { return this }, format() { return 'time' }}),
  })
  const selected = node()
  selected.data.data_source = {itemid: '1', history: '0'}
  const ctx = {graph: {getNodes: () => [selected]}}
  const older = impl.refreshNode.call(ctx, selected)
  const newer = impl.refreshNode.call(ctx, selected)
  pending[1].resolve({data: {code: 200, data: {items: [{clock: '124', value: 8}]}}})
  await newer
  pending[0].resolve({data: {code: 200, data: {items: [{clock: '123', value: 1}]}}})
  await older
  assert.equal(selected.data.series[0].value, 8)
  const failed = impl.refreshNode.call(ctx, selected)
  pending[2].reject(new Error('offline'))
  await assert.rejects(failed, /offline/)
  assert.equal(emptyMessage(selected.data)[0], '数据加载失败')
  assert.equal(selected.data.series.length, 0)
})
