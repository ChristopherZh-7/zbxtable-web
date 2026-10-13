const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Vue = require('vue')
const compiler = require('vue-template-compiler')
const echarts = require('echarts')

const root = path.resolve(__dirname, '../..')
const source = fs.readFileSync(path.join(root, 'src/plugins/legacy-charts.js'), 'utf8')
const childNames = ['v-tooltip', 'v-axis', 'v-legend', 'v-line', 'v-point', 'v-bar',
  'v-interval', 'v-pie', 'v-coord', 'v-guide', 'v-series', 'v-stack-area', 'v-smooth-area']

function adapter(engine = echarts) {
  // Execute the actual adapter; adapt ESM linkage only. No fabricated VNodes.
  assert.match(source, /^import \* as echarts from 'echarts'/)
  const linked = source.replace("import * as echarts from 'echarts'", '')
    .replace('export default {', 'const plugin = {')
    .replace('export {buildOption}', 'return {plugin, buildOption}')
  return new Function('echarts', linked)(engine)
}

function setup(engine) {
  const api = adapter(engine)
  const LocalVue = Vue.extend()
  api.plugin.install(LocalVue)
  const owner = new LocalVue()
  return {...api, LocalVue, owner, h: owner.$createElement.bind(owner)}
}

function compiledChart(filename, data) {
  const page = fs.readFileSync(path.join(root, 'src/pages/alarm', filename), 'utf8')
  const match = page.match(/<v-chart\b[\s\S]*?<\/v-chart>/)
  assert.ok(match, 'actual F17 component must contain its chart template')
  const result = compiler.compile(match[0])
  assert.deepEqual(result.errors, [])
  const api = setup()
  const owner = new api.LocalVue({data: () => data,
    render: new Function(result.render), staticRenderFns: result.staticRenderFns.map(code => new Function(code)),
    methods: {formatLongText: value => String(value)}})
  owner.$themeColor = '#1890ff'
  const vnode = owner._render()
  assert.equal(vnode.componentOptions.tag, 'v-chart')
  return {api, owner, vnode, option: api.buildOption(vnode.componentOptions.propsData.data,
    vnode.componentOptions.propsData.scale, vnode.componentOptions.children)}
}

test('legacy adapter runs against real Vue2 and matching compiler, not synthetic VNodes', () => {
  assert.equal(Vue.version, '2.7.16')
  assert.equal(require('vue-template-compiler/package.json').version, Vue.version)
  assert.equal(echarts.version, '6.1.0')
})

for (const name of childNames) {
  test(`registered ${name} preserves Vue2 component identity, attrs and inert rendering`, () => {
    const {LocalVue, h} = setup()
    const attributes = {position: 'bucket*count', color: '#123456', type: 'rect', direction: 'LT'}
    const vnode = h(name, {attrs: attributes}, [h('span', 'nested-child')])
    assert.equal(vnode.isComment, false)
    assert.equal(vnode.componentOptions.tag, name)
    assert.deepEqual(vnode.data.attrs, attributes)
    assert.equal(vnode.componentOptions.children[0].tag, 'span')
    const Instance = LocalVue.component(name)
    const instance = new Instance()
    assert.equal(instance._render().isComment, true, 'metadata marker itself must remain visually inert')
    instance.$destroy()
  })
}

test('actual compiled host TOP chart keeps bar values, horizontal coord and formatter attrs', () => {
  const result = compiledChart('eLine.vue', {
    height: 380, data: [{name: '主机A [实例A]', value: 8}, {name: '主机B [实例A]', value: 0}],
    scale: [{dataKey: 'name', type: 'cat'}, {dataKey: 'value', min: 0, alias: '告警次数'}]
  })
  assert.equal(result.option.series.length, 1)
  assert.equal(result.option.series[0].type, 'bar')
  assert.deepEqual(result.option.series[0].data, [8, 0])
  assert.equal(result.option.yAxis.type, 'category')
  assert.deepEqual(result.option.yAxis.data, ['主机A [实例A]', '主机B [实例A]'])
  assert.equal(result.option.xAxis.axisLabel.formatter(8), '8次')
  assert.equal(result.option.xAxis.name, '告警次数')
})

test('actual compiled severity pie keeps all six names/counts and color attributes', () => {
  const labels = ['未分类', '信息', '警告', '一般', '严重', '灾难']
  const colors = ['#000001', '#000002', '#000003', '#000004', '#000005', '#000006']
  const rows = labels.map((item, index) => ({item, name: String(index), percent: (index + 1) / 21}))
  const result = compiledChart('ePie.vue', {height: 380, mockData: rows,
    scale: [{dataKey: 'percent', min: 0, formatter: '.0%'}], pieColors: ['item', colors], pieStyle: {}, labelConfig: []})
  assert.equal(result.option.series.length, 1)
  assert.equal(result.option.series[0].type, 'pie')
  assert.deepEqual(result.option.series[0].data, rows.map(row => ({name: row.item, value: row.percent})))
  assert.deepEqual(result.option.color, colors)
})

test('actual compiled trend keeps zero buckets, position, size, color and axis label', () => {
  const rows = [{bucket: '2026-10-11 00:00:00', count: 4}, {bucket: '2026-10-11 01:00:00', count: 0}]
  const result = compiledChart('eTrend.vue', {chartData: rows,
    scale: [{dataKey: 'bucket'}, {dataKey: 'count', min: 0, alias: '告警次数'}],
    axisLabel: {formatter: value => value.slice(5, 16)}})
  assert.equal(result.option.series.length, 1)
  assert.equal(result.option.series[0].type, 'line')
  assert.deepEqual(result.option.series[0].data, [4, 0])
  assert.equal(result.option.series[0].symbolSize, 2)
  assert.equal(result.option.series[0].itemStyle.color, '#1890ff')
  assert.equal(result.option.xAxis.axisLabel.formatter(rows[0].bucket), '10-11 00:00')
  assert.equal(result.option.yAxis.axisLabel.formatter(0), '0次')
})

test('real nested component children remain traversable through a coordinate marker', () => {
  const {h, buildOption} = setup()
  const nodes = [h('v-coord', {attrs: {type: 'rect', direction: 'LT'}}, [
    h('v-bar', {attrs: {position: 'host*events', color: '#abcdef'}})
  ])]
  const option = buildOption([{host: 'nested-host', events: 7}], [], nodes)
  assert.equal(option.series[0].type, 'bar')
  assert.deepEqual(option.series[0].data, [7])
  assert.deepEqual(option.yAxis.data, ['nested-host'])
})

test('real ordinary element children remain traversable', () => {
  const {h, buildOption} = setup()
  const option = buildOption([{bucket: 'day', count: 3}], [], [h('div', [h('v-line', {attrs: {position: 'bucket*count'}})])])
  assert.deepEqual(option.series[0].data, [3])
})

test('guide text and theta coordinate are preserved for a real interval geometry', () => {
  const {h, buildOption} = setup()
  const option = buildOption([{kind: 'ok', amount: 2}], [], [
    h('v-interval', {attrs: {position: 'amount', color: 'kind'}}), h('v-coord', {attrs: {type: 'theta'}}),
    h('v-guide', {attrs: {type: 'text', content: '总计2', vStyle: {fill: '#123456'}}})
  ])
  assert.equal(option.series[0].type, 'pie')
  assert.deepEqual(option.series[0].data, [{name: 'ok', value: 2}])
  assert.equal(option.title.text, '总计2')
  assert.equal(option.title.textStyle.color, '#123456')
  assert.deepEqual(option.series[0].radius, ['58%', '82%'])
})

test('real gauge marker preserves its existing scale and color semantics', () => {
  const {h, buildOption} = setup()
  const option = buildOption([{value: 42}], [{dataKey: 'value', min: 10, max: 80}], [h('v-series', {attrs: {color: '#102030'}})])
  assert.equal(option.series[0].type, 'gauge')
  assert.equal(option.series[0].min, 10)
  assert.equal(option.series[0].max, 80)
  assert.equal(option.series[0].itemStyle.color, '#102030')
  assert.deepEqual(option.series[0].data, [{value: 42}])
})

test('real polar coordinate preserves existing radar grouping and values', () => {
  const {h, buildOption} = setup()
  const rows = [{metric: 'cpu', amount: 2, tenant: 'A'}, {metric: 'memory', amount: 3, tenant: 'A'}]
  const option = buildOption(rows, [{dataKey: 'amount', max: 10}], [h('v-coord', {attrs: {type: 'polar'}}), h('v-line', {attrs: {position: 'metric*amount', color: 'tenant'}})])
  assert.equal(option.series[0].type, 'radar')
  assert.deepEqual(option.series[0].data, [{name: 'A', value: [2, 3]}])
  assert.deepEqual(option.radar.indicator, [{name: 'cpu', max: 10}, {name: 'memory', max: 10}])
})

for (const tag of ['v-stack-area', 'v-smooth-area']) {
  test(`real ${tag} retains its existing area/stack/smooth mapping`, () => {
    const {h, buildOption} = setup()
    const option = buildOption([{bucket: 'day', count: 5}], [], [h(tag, {attrs: {position: 'bucket*count'}})])
    assert.equal(option.series[0].type, 'line')
    assert.deepEqual(option.series[0].areaStyle, {})
    assert.equal(option.series[0].smooth, tag === 'v-smooth-area')
    assert.equal(option.series[0].stack, tag === 'v-stack-area' ? 'total' : undefined)
  })
}

test('missing geometry stays an empty option rather than inventing a series', () => {
  const {h, buildOption} = setup()
  assert.deepEqual(buildOption([{value: 1}], [], [h('v-tooltip'), h('v-axis')]), {series: []})
})

test('empty input retains an empty configured series and never stale values', () => {
  const {h, buildOption} = setup()
  const nodes = [h('v-line', {attrs: {position: 'bucket*count'}})]
  assert.deepEqual(buildOption([], [], nodes).series[0].data, [])
  assert.deepEqual(buildOption([{bucket: 'new', count: 0}], [], nodes).series[0].data, [0])
})

test('option construction does not mutate caller rows/scales/attribute values', () => {
  const {h, buildOption} = setup()
  const rows = [{bucket: 'day', count: 1}]; const scales = [{dataKey: 'count', min: 0}]
  const attrs = {position: 'bucket*count', color: '#987654'}
  const before = JSON.stringify({rows, scales, attrs})
  buildOption(rows, scales, [h('v-line', {attrs: {...attrs}})])
  assert.equal(JSON.stringify({rows, scales, attrs}), before)
})

function mountedChart(rows, observerEnabled = true) {
  const calls = {init: 0, options: [], resize: 0, dispose: 0, observed: [], disconnect: 0}
  const engine = {init: element => {
    calls.init++; calls.element = element
    return {setOption: (option, replace) => calls.options.push({option, replace}),
      resize: () => calls.resize++, dispose: () => calls.dispose++}
  }}
  const prior = global.ResizeObserver
  if (observerEnabled) global.ResizeObserver = class {
    constructor(callback) {calls.onResize = callback}
    observe(element) {calls.observed.push(element)}
    disconnect() {calls.disconnect++}
  }
  else delete global.ResizeObserver
  const {LocalVue, owner, h} = setup(engine)
  const data = Array.isArray(rows) ? Vue.observable(rows) : rows
  const scale = Vue.observable([{dataKey: 'count', min: 0}])
  const vnode = h('v-chart', {props: {data, scale, height: 220}},
    [h('v-line', {attrs: {position: 'bucket*count', color: '#123456'}})])
  // Mount this registered constructor directly as a root instance: Node's
  // no-DOM patcher cannot perform a parent insert hook for a child _parentVnode.
  const chart = new (LocalVue.component('v-chart'))({parent: owner,
    propsData: vnode.componentOptions.propsData, _renderChildren: vnode.componentOptions.children})
  chart.$mount() // Real Vue lifecycle. ECharts/ResizeObserver are boundary doubles, not browser evidence.
  return {chart, calls, h, restore: () => {chart.$destroy(); if (prior === undefined) delete global.ResizeObserver; else global.ResizeObserver = prior}}
}

test('real Vue mount/watch/update/resize/destroy call existing chart boundaries', async () => {
  const mounted = mountedChart([{bucket: 'old', count: 2}])
  const {chart, calls, h} = mounted
  try {
    assert.equal(chart.$options.name, 'LegacyChart')
    assert.equal(calls.init, 1)
    assert.deepEqual(calls.options.at(-1).option.series[0].data, [2])
    assert.equal(calls.options.at(-1).replace, true)
    assert.equal(chart._render().data.style.height, '220px')
    chart.data[0].count = 9
    await Vue.nextTick(); await Vue.nextTick()
    assert.deepEqual(calls.options.at(-1).option.series[0].data, [9])
    Vue.set(chart.scale[0], 'max', 15)
    chart.$forceUpdate(); await Vue.nextTick(); await Vue.nextTick()
    assert.equal(calls.options.at(-1).option.yAxis.max, 15)
    chart.$slots.default = [h('v-bar', {attrs: {position: 'bucket*count'}})]
    chart.$forceUpdate(); await Vue.nextTick()
    assert.equal(calls.options.at(-1).option.series[0].type, 'bar')
    calls.onResize(); assert.equal(calls.resize, 1)
    chart.data.splice(0); await Vue.nextTick(); await Vue.nextTick()
    assert.deepEqual(calls.options.at(-1).option.series[0].data, [])
    chart.$destroy(); chart.$destroy()
    assert.equal(calls.disconnect, 1)
    assert.equal(calls.dispose, 1)
  } finally {mounted.restore()}
})

test('real Vue instance without ResizeObserver handles nonarray data and destroys once', () => {
  const mounted = mountedChart('not-an-array', false)
  try {
    assert.deepEqual(mounted.calls.options.at(-1).option.series[0].data, [])
    assert.equal(mounted.calls.observed.length, 0)
    mounted.chart.$destroy()
    assert.equal(mounted.calls.dispose, 1)
  } finally {mounted.restore()}
})

for (const tag of ['v-bar', 'v-pie', 'v-line']) {
  test(`real Vue2 ${tag} options render through real ECharts SVG SSR (not browser)`, () => {
    const {h, buildOption} = setup()
    const rows = [{label: 'alpha', count: 3}, {label: 'beta', count: 2}]
    const attrs = tag === 'v-pie' ? {position: 'count', color: 'label'} : {position: 'label*count'}
    const option = buildOption(rows, [], [h(tag, {attrs})])
    assert.equal(option.series.length, 1)
    const chart = echarts.init(null, null, {renderer: 'svg', ssr: true, width: 640, height: 360})
    try {
      chart.setOption(option, true)
      const svg = chart.renderToSVGString()
      assert.match(svg, /<svg/)
      assert.match(svg, /<path/)
      assert.equal(chart.getOption().series[0].data.length, 2)
    } finally {chart.dispose()}
  })
}
