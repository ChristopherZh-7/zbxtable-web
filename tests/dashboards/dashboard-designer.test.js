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
const {DASHBOARD_PRESETS} = require('../../src/pages/dashboard/custom/designer-presets')

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

test('designer provides readable built-in layout presets with non-overlapping coordinates', () => {
  assert.equal(DASHBOARD_PRESETS.length, 3)
  for (const preset of DASHBOARD_PRESETS) {
    assert.ok(preset.nodes.length >= 3)
    for (const node of preset.nodes) {
      assert.ok(node.position.x >= 0 && node.position.y >= 0)
      assert.ok(node.position.x + node.size.width <= preset.width)
      assert.ok(node.position.y + node.size.height <= preset.height)
    }
    for (let i = 0; i < preset.nodes.length; i += 1) {
      for (let j = i + 1; j < preset.nodes.length; j += 1) {
        const left = preset.nodes[i]
        const right = preset.nodes[j]
        const separated = left.position.x + left.size.width <= right.position.x ||
          right.position.x + right.size.width <= left.position.x ||
          left.position.y + left.size.height <= right.position.y ||
          right.position.y + right.size.height <= left.position.y
        assert.equal(separated, true, preset.key + ' nodes overlap')
      }
    }
  }
})

test('designer exposes numeric layout controls beside the data editor', () => {
  const designer = fs.readFileSync(path.join(__dirname, '../../src/pages/dashboard/custom/designer.vue'), 'utf8')
  assert.match(designer, /X 坐标/)
  assert.match(designer, /Y 坐标/)
  assert.match(designer, /applyLayout/)
  assert.match(designer, /套用模板/)
})

// ISSUE-035: saved precision applies only to display; retain the raw runtime series.
const issue035Inputs = {
  "pie_saved": {
    "data": {
      "chart_type": "pie",
      "title": "F31 饼图 磁盘",
      "data_source": {
        "host_name": "f31n-ed7b8ec0a28c-host-a",
        "item_name": "f31n-ed7b8ec0a28c-disk",
        "units": "%"
      },
      "style": {
        "color": "#722ed1",
        "background": "#ffffff",
        "precision": 4
      },
      "series": [
        {
          "clock": "1791457576",
          "value": 61
        },
        {
          "clock": "1791482776",
          "value": 62
        },
        {
          "clock": "1791511576",
          "value": 64
        },
        {
          "clock": "1791540356",
          "value": 65.4321
        }
      ]
    },
    "expected_remainder": "剩余\n34.5679%"
  },
  "gauge_saved": {
    "data": {
      "chart_type": "gauge",
      "title": "F31 仪表盘 零值",
      "data_source": {
        "host_name": "f31n-ed7b8ec0a28c-host-a",
        "item_name": "f31n-ed7b8ec0a28c-load",
        "units": ""
      },
      "style": {
        "color": "#fa8c16",
        "background": "#fffbe6",
        "precision": 0
      },
      "series": [
        {
          "clock": "1791457576",
          "value": 0.5
        },
        {
          "clock": "1791482776",
          "value": 1.2
        },
        {
          "clock": "1791511576",
          "value": 2.1
        },
        {
          "clock": "1791540356",
          "value": 0
        },
        {
          "clock": "1791540922",
          "value": 2.71828
        }
      ]
    },
    "expected_detail": "3"
  },
  "precision_boundaries": [
    {
      "precision": 0,
      "value": 2.71828,
      "units": "%",
      "expected_latest": "3%",
      "expected_remainder": "97%"
    },
    {
      "precision": 0,
      "value": 0,
      "units": "%",
      "expected_latest": "0%",
      "expected_remainder": "100%"
    },
    {
      "precision": 4,
      "value": 12.3,
      "units": "%",
      "expected_latest": "12.3000%",
      "expected_remainder": "87.7000%"
    },
    {
      "precision": 4,
      "value": 0,
      "units": "%",
      "expected_latest": "0.0000%",
      "expected_remainder": "100.0000%"
    }
  ],
  "fallbacks": {
    "precision_inputs": [
      {
        "precision": -1
      },
      {
        "precision": 5
      },
      {
        "precision": 1.5
      },
      {
        "precision": "invalid"
      },
      {}
    ],
    "value": "12.345678",
    "units": "ms",
    "expected_latest": "12.35ms",
    "expected_remainder": "0.00ms"
  }
}

function issue035Label(option, index = 0) {
  const item = option.series[0].data[index]
  const formatter = option.series[0].label.formatter
  return typeof formatter === 'function' ? formatter({name: item.name, value: item.value}) : formatter.replace('{b}', item.name).replace('{c}', String(item.value))
}

function issue035Detail(option) {
  const value = option.series[0].data[0].value
  const formatter = option.series[0].detail.formatter
  return typeof formatter === 'function' ? formatter(value) : formatter.replace('{value}', String(value))
}

function issue035Check(data, latest, remainder) {
  const pristine = structuredClone(data)
  const raw = Number(data.series[data.series.length - 1].value)
  const option = chartOption(data)
  assert.equal(option.series[0].data[0].value, raw, 'option retains the unrounded monitoring value')
  if (data.chart_type === 'pie') {
    const max = data.data_source.units === '%' ? 100 : Math.max(raw, 1)
    assert.equal(option.series[0].data[1].value, Math.max(0, max - raw), 'remainder arithmetic stays raw')
    if (latest !== undefined) assert.equal(issue035Label(option), `${option.series[0].data[0].name}\n${latest}`)
    if (remainder !== undefined) assert.equal(issue035Label(option, 1), `${option.series[0].data[1].name}\n${remainder}`)
  } else {
    assert.equal(issue035Detail(option), latest)
  }
  assert.deepEqual(data, pristine, 'formatting must not mutate persisted style/source or raw series')
  assert.equal(option.series[0].data[0].value, raw, 'formatter must not round the numeric series')
}

test('ISSUE035 pie remainder uses saved precision four', () => {
  const data = structuredClone(issue035Inputs.pie_saved.data)
  const pristine = structuredClone(data)
  const option = chartOption(data)
  assert.equal(option.series[0].data[0].value, 65.4321)
  assert.equal(option.series[0].data[1].value, 100 - 65.4321)
  assert.equal(issue035Label(option, 1), issue035Inputs.pie_saved.expected_remainder)
  assert.deepEqual(data, pristine)
  assert.equal(option.series[0].data[1].value, 100 - 65.4321)
})

test('ISSUE035 gauge detail uses saved precision zero', () => {
  issue035Check(structuredClone(issue035Inputs.gauge_saved.data), issue035Inputs.gauge_saved.expected_detail)
})

test('ISSUE035 both formatters honor precision endpoints zero values and units', () => {
  for (const saved of issue035Inputs.precision_boundaries) {
    for (const type of ['pie', 'gauge']) {
      const data = defaultNodeData(type)
      data.style.precision = saved.precision
      data.data_source = {item_name: '真实值', units: saved.units}
      data.series = [{clock: '1', value: saved.value}]
      issue035Check(data, saved.expected_latest, saved.expected_remainder)
    }
  }
})

test('ISSUE035 formatters preserve existing fallback and unrounded source series', () => {
  const saved = issue035Inputs.fallbacks
  for (const input of saved.precision_inputs) {
    for (const type of ['pie', 'gauge']) {
      const data = defaultNodeData(type)
      if (Object.prototype.hasOwnProperty.call(input, 'precision')) data.style.precision = input.precision
      else delete data.style.precision
      data.data_source = {item_name: '真实值', units: saved.units}
      data.series = [{clock: '1', value: saved.value}]
      issue035Check(data, saved.expected_latest, saved.expected_remainder)
    }
  }
})
