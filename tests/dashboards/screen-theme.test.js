const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const theme = require('../../src/pages/screen/chart-theme')
const {chartOption, defaultNodeData} = require('../../src/pages/dashboard/custom/dashboard-canvas')
const {SCREEN_PRESETS, DASHBOARD_PRESETS} = require('../../src/pages/dashboard/custom/designer-presets')

function chartData(type, units = '%', value = 0) {
  return {...defaultNodeData(type), style: {background: '#061226', color: '#00e6ff', precision: 2},
    data_source: {item_name: '指标', units}, series: [{clock: '100', value}]}
}

function originalOption(component, context) {
  const source = fs.readFileSync(path.join(__dirname, '../../src/pages/screen/components', component + '.vue'), 'utf8')
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import[^\n]+\n/gm, '').replace('export default', 'module.exports =')
  const sandbox = {module: {exports: {}}, require: () => ({}), ...theme}
  vm.runInNewContext(script, sandbox)
  let option
  const ctx = {$t: key => key, ...context, chart: {setOption(value) { option = value }}}
  for (const [key, method] of Object.entries(sandbox.module.exports.methods)) ctx[key] = method.bind(ctx)
  ctx.render()
  return JSON.parse(JSON.stringify(option))
}

test('custom line and pie share the actual original chart decorations and typography', () => {
  const originalLine = originalOption('EgressArea', {history: [{t: '12:00', in: 12, out: 6}]})
  const line = chartOption(chartData('line'))
  for (const key of ['lineStyle', 'itemStyle', 'areaStyle', 'showSymbol']) assert.deepEqual(line.series[0][key], originalLine.series[0][key])
  assert.deepEqual(line.xAxis.axisLabel, originalLine.xAxis.axisLabel)
  assert.deepEqual(line.yAxis.splitLine, originalLine.yAxis.splitLine)
  assert.deepEqual(line.grid, originalLine.grid)
  const originalPie = originalOption('HostTypePie', {data: {lin_count: 1}})
  const pie = chartOption(chartData('pie'))
  for (const key of ['radius', 'center', 'itemStyle', 'labelLine']) assert.deepEqual(pie.series[0][key], originalPie.series[0][key])
  assert.equal(line.textStyle.fontFamily, theme.SCREEN_FONT)
})

test('screen byte labels fit while zero, saved precision and raw numeric series are retained', () => {
  const raw = 14.25 * 1024 ** 3
  for (const type of ['line', 'bar', 'gauge', 'pie']) {
    const data = chartData(type, 'B', raw)
    const before = structuredClone(data)
    const option = chartOption(data)
    assert.equal(option.tooltip.valueFormatter(raw), '14.25 GiB')
    if (type === 'gauge') {
      assert.equal(option.series[0].detail.formatter(raw), '14.25 GiB')
      assert.equal(option.series[0].axisLabel.formatter(4 * 1024 ** 3), '4')
      assert.equal(option.series[0].data[0].value, raw)
      assert.ok(option.series[0].max > raw)
    } else if (type === 'pie') {
      assert.equal(option.series[0].label.formatter({value: raw}), '14.25 GiB')
      assert.equal(option.series[0].data[0].value, raw)
    } else {
      assert.equal(option.yAxis.name, 'GiB')
      assert.equal(option.yAxis.axisLabel.formatter(raw), '14.25')
      assert.deepEqual(option.series[0].data, [raw])
    }
    assert.deepEqual(data, before)
  }
  for (const [value, unit, precision, expected] of [[0, 'B', 2, '0.00 B'], [1024, 'Bps', 0, '1 KiB/s'], [1024 ** 2, 'B/s', 4, '1.0000 MiB/s'], [0, '%', 0, '0%'], [12.3456, 'ms', -1, '12.35ms']]) {
    assert.equal(theme.formatScreenValue(value, unit, precision), expected)
  }
  const light = chartData('gauge', 'B', raw)
  light.style.background = '#ffffff'
  assert.equal(chartOption(light).series[0].detail.formatter(raw), raw.toFixed(2) + 'B')
})

test('new screen presets reserve the original heading and keep all components within the canvas', () => {
  assert.equal(SCREEN_PRESETS.length, DASHBOARD_PRESETS.length)
  for (const preset of SCREEN_PRESETS) {
    assert.equal(preset.width, 1920)
    assert.equal(preset.height, 1080)
    for (const node of preset.nodes) {
      assert.ok(node.position.x >= 18 && node.position.y >= 94)
      assert.ok(node.position.x + node.size.width <= 1902)
      assert.ok(node.position.y + node.size.height <= 1066)
    }
    for (const [i, left] of preset.nodes.entries()) for (const right of preset.nodes.slice(i + 1)) {
      assert.ok(left.position.x + left.size.width <= right.position.x || right.position.x + right.size.width <= left.position.x ||
        left.position.y + left.size.height <= right.position.y || right.position.y + right.size.height <= left.position.y)
    }
  }
  assert.equal(DASHBOARD_PRESETS[0].nodes[0].position.y, 32, 'ordinary dashboards are not moved')
})
