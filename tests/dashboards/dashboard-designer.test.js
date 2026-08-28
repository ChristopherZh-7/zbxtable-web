const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  CHART_TYPES,
  chartOption,
  defaultNodeData,
  formatDashboardValue,
  normalizeDashboardNodes,
  validateDashboardNodes,
} = require('../../src/pages/dashboard/custom/dashboard-canvas')

test('F31 extends the X6 designer to six scenario component types', () => {
  assert.deepEqual(CHART_TYPES.map(item => item.value), ['line', 'bar', 'pie', 'gauge', 'table', 'topology'])
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
      style: {color: '#1677ff', background: '#ffffff', precision: 2},
    },
  }])
})

test('unbound and unsupported dashboard nodes are rejected before save', () => {
  const unbound = {id: 'x', shape: 'dashboard-chart', position: {}, size: {}, data: defaultNodeData('line')}
  assert.match(validateDashboardNodes([unbound]), /绑定数值监控项/)
  unbound.data.chart_type = 'scatter'
  assert.match(validateDashboardNodes([unbound]), /不支持/)
  assert.match(validateDashboardNodes([]), /至少添加/)
})

test('all chart components share the same bound data and numeric formatting', () => {
  for (const chartType of ['line', 'bar', 'pie', 'gauge']) {
    const data = defaultNodeData(chartType)
    data.data_source = {item_name: 'CPU', units: '%'}
    data.series = [{clock: '1', value: 22}, {clock: '2', value: 44}]
    const option = chartOption(data)
    assert.ok(Array.isArray(option.series) && option.series.length > 0, chartType)
  }
  const data = defaultNodeData('table')
  data.data_source = {units: '%'}
  data.style.precision = 1
  assert.equal(formatDashboardValue(42.34, data), '42.3%')
})

test('designer uses X6 drag, styling, live history and secure public share routes', () => {
  const designer = fs.readFileSync(path.join(__dirname, '../../src/pages/dashboard/custom/designer.vue'), 'utf8')
  const list = fs.readFileSync(path.join(__dirname, '../../src/pages/dashboard/custom/index.vue'), 'utf8')
  const router = fs.readFileSync(path.join(__dirname, '../../src/router/async/router.map.js'), 'utf8')
  const publicPage = fs.readFileSync(path.join(__dirname, '../../src/pages/dashboard/custom/share.vue'), 'utf8')
  const services = fs.readFileSync(path.join(__dirname, '../../src/services/admin.js'), 'utf8')
  assert.match(designer, /new Addon\.Dnd\(\{target: this\.graph\}\)/)
  assert.match(designer, /@mousedown\.stop="startDrag/)
  assert.match(designer, /@click="addChart/)
  assert.match(designer, /hostMockd/)
  assert.match(designer, /normalizeDashboardNodes/)
  assert.match(designer, /Boolean\(this\.dashboardId && !this\.\$can/)
  assert.match(designer, /tenant\.dashboard.*update/)
  assert.match(designer, /editor\.style\.color/)
  assert.match(designer, /generateDashboardShare/)
  assert.match(designer, /revokeDashboardShare/)
  assert.match(list, /v-auth="'create'"/)
  assert.match(list, /v-auth="'delete'"/)
  assert.match(router, /customDashboards/)
  assert.match(router, /customDashboardDesigner/)
  assert.match(router, /visualizationDashboards/)
  assert.match(router, /visualizationDashboardDesigner/)
  assert.match(router, /dashboardShare/)
  assert.match(router, /\/share\/dashboard\/:token/)
  assert.match(publicPage, /withCredentials: false/)
  assert.match(publicPage, /setInterval\(this\.load, 30000\)/)
  assert.match(publicPage, /interacting: false/)
  assert.match(services, /DASHBOARD \+ '\/' \+ id \+ '\/share'/)
  assert.match(list, /\/topology\/custom-screen-designer/)
  assert.match(designer, /\/topology\/custom-screens/)
  assert.match(designer, /this\.designerPath/)
  assert.match(designer, /this\.listPath/)
})
