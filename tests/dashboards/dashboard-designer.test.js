const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  CHART_TYPES,
  chartOption,
  defaultNodeData,
  normalizeDashboardNodes,
  validateDashboardNodes,
} = require('../../src/pages/dashboard/custom/dashboard-canvas')

test('F13 freezes four X6 chart types', () => {
  assert.deepEqual(CHART_TYPES.map(item => item.value), ['line', 'bar', 'pie', 'gauge'])
})

test('dashboard serialization preserves layout and source while dropping runtime series', () => {
  const data = defaultNodeData('line')
  data.title = 'CPU 24h'
  data.data_source = {
    zid: 2, hostid: '10001', host_name: 'host-a', itemid: '20001',
    item_name: 'CPU utilization', history: '0', units: '%',
  }
  data.series = [{clock: '1', value: 42}]
  const nodes = normalizeDashboardNodes([{
    id: 'chart-1', shape: 'dashboard-chart',
    position: {x: 120, y: 80}, size: {width: 480, height: 300}, data,
  }])
  assert.deepEqual(nodes, [{
    id: 'chart-1', shape: 'dashboard-chart',
    position: {x: 120, y: 80}, size: {width: 480, height: 300},
    data: {
      chart_type: 'line', title: 'CPU 24h',
      data_source: {
        zid: 2, hostid: '10001', host_name: 'host-a', itemid: '20001',
        item_name: 'CPU utilization', history: '0', units: '%',
      },
    },
  }])
})

test('unbound and unsupported dashboard nodes are rejected before save', () => {
  const unbound = {id: 'x', shape: 'dashboard-chart', position: {}, size: {}, data: defaultNodeData('line')}
  assert.match(validateDashboardNodes([unbound]), /绑定数值监控项/)
  unbound.data.chart_type = 'table'
  assert.match(validateDashboardNodes([unbound]), /不支持/)
  assert.match(validateDashboardNodes([]), /至少添加/)
})

test('all chart types produce ECharts options from the same bound series', () => {
  for (const chartType of CHART_TYPES.map(item => item.value)) {
    const data = defaultNodeData(chartType)
    data.data_source = {item_name: 'CPU', units: '%'}
    data.series = [{clock: '1', value: 22}, {clock: '2', value: 44}]
    const option = chartOption(data)
    assert.ok(Array.isArray(option.series) && option.series.length > 0, chartType)
  }
})

test('designer uses X6 drag, live history and permission-aware routes', () => {
  const designer = fs.readFileSync(path.join(__dirname, '../../src/pages/dashboard/custom/designer.vue'), 'utf8')
  const list = fs.readFileSync(path.join(__dirname, '../../src/pages/dashboard/custom/index.vue'), 'utf8')
  const router = fs.readFileSync(path.join(__dirname, '../../src/router/async/router.map.js'), 'utf8')
  assert.match(designer, /new Addon\.Dnd\(\{target: this\.graph\}\)/)
  assert.match(designer, /@mousedown\.stop="startDrag/)
  assert.match(designer, /@click="addChart/)
  assert.match(designer, /hostMockd/)
  assert.match(designer, /normalizeDashboardNodes/)
  assert.match(designer, /Boolean\(this\.dashboardId && !this\.\$can/)
  assert.match(designer, /tenant\.dashboard.*update/)
  assert.match(list, /v-auth="'create'"/)
  assert.match(list, /v-auth="'delete'"/)
  assert.match(router, /customDashboards/)
  assert.match(router, /customDashboardDesigner/)
})
