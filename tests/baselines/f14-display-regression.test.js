const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const compiler = require('vue-template-compiler')
const Vue = require('vue')

const root = process.env.F14_TEST_ROOT || path.resolve(__dirname, '../..')
const page = fs.readFileSync(path.join(root, 'src/pages/dashboard/baseline/index.vue'), 'utf8')
const view = require(path.join(root, 'src/pages/dashboard/baseline/baseline-view.js'))
const template = compiler.parseComponent(page).template.content
const points = [
  {clock: 1791424800, actual: 10, baseline: null, deviation: null, complete: false},
  {clock: 1791511200, actual: 100, baseline: 10.107142857142858, deviation: 90, complete: true},
]
const fixtureRule = {name: 'F14 fixture', host_name: 'Fixture host', item_name: 'Fixture item', season_unit: 'd', seasons: 7, deviation: 2.5}

function renderText(fragment, data, methods = {}) {
  const compiled = compiler.compile(fragment)
  assert.deepEqual(compiled.errors, [])
  const vm = new Vue({data: () => data, methods, render: new Function(compiled.render), staticRenderFns: compiled.staticRenderFns.map(code => new Function(code))})
  const out = []
  function walk(node) {
    if (!node) return
    if (node.text) out.push(node.text)
    if (node.data && node.data.attrs) {
      if (node.data.attrs.text) out.push(String(node.data.attrs.text))
      if (node.data.attrs.label) out.push(String(node.data.attrs.label))
    }
    for (const child of node.children || []) walk(child)
  }
  walk(vm._render())
  vm.$destroy()
  return out.join(' ').replace(/\s+/g, ' ').trim()
}

function stateText(record) {
  const start = template.search(/<(?:span|div) slot="status"/)
  const end = template.indexOf('<span slot="operation"', start)
  assert.ok(start >= 0 && end > start)
  const fragment = template.slice(start, end).replace(/ slot="status"| slot-scope="record"/g, '').trim()
  return renderText(fragment, {record})
}

function tooltip(index, values = points) {
  const option = view.baselineChartOption(values, '%')
  assert.equal(typeof option.tooltip.formatter, 'function', 'actual deviation must be part of the chart tooltip')
  return option.tooltip.formatter([{dataIndex: index}])
}

for (const enabled of [false, true]) {
  for (const problem of [false, true]) {
    test(`F14 ISSUE-008 enabled=${enabled}, problem=${problem}: monitoring and last problem are separate`, () => {
      const text = stateText({enabled, problem})
      assert.ok(text.includes(enabled ? '已启用' : '已停用'), text)
      assert.ok(text.includes(`最后问题：${problem ? '已偏离' : '未偏离'}`), text)
    })
  }
}

test('F14 ISSUE-009 actual 90 sigma is included in tooltip without adding a differently scaled third line', () => {
  const option = view.baselineChartOption(points, '%')
  assert.deepEqual(option.series.map(series => series.name), ['实际值', '加权基线'])
  const content = tooltip(1)
  assert.match(content, /实际值[：:]100/)
  assert.match(content, /加权基线[：:]10\.107142857142858/)
  assert.match(content, /实际偏离度[：:]90σ/)
  assert.doesNotMatch(content, /2\.5σ/)
})

test('F14 missing deviation is explicit no-data, not zero sigma', () => {
  const content = tooltip(0)
  assert.match(content, /实际偏离度[：:]无数据/)
  assert.doesNotMatch(content, /实际偏离度[：:]0σ/)
})

test('F14 strict deviation display rejects null, blank, boolean, arrays and nonfinite values', () => {
  assert.equal(typeof view.formatDeviation, 'function')
  for (const value of [null, undefined, '', '  ', false, true, [], {}, NaN, Infinity, -Infinity, 'NaN', 'Infinity', 'not-a-number']) {
    assert.match(view.formatDeviation(value), /无数据/, String(value))
  }
})

test('F14 real numeric zero and decimal deviation remain measurable values', () => {
  assert.equal(typeof view.formatDeviation, 'function')
  assert.equal(view.formatDeviation(0), '0σ')
  assert.equal(view.formatDeviation('0'), '0σ')
  assert.equal(view.formatDeviation(2.75), '2.75σ')
  assert.equal(view.formatDeviation('90'), '90σ')
})

test('F14 null and blank actual/baseline samples remain gaps instead of fabricated zero', () => {
  const option = view.baselineChartOption([
    {clock: 1, actual: null, baseline: null},
    {clock: 2, actual: '', baseline: '  '},
    {clock: 3, actual: false, baseline: []},
    {clock: 4, actual: Infinity, baseline: NaN},
    {clock: 5, actual: 0, baseline: '0'},
  ], '%')
  assert.deepEqual(option.series[0].data, [null, null, null, null, 0])
  assert.deepEqual(option.series[1].data, [null, null, null, null, 0])
})

test('F14 missing latest sample never silently reuses an older valid deviation', () => {
  assert.equal(typeof view.latestBaselinePoint, 'function')
  const last = {clock: 1791514800, actual: 100, baseline: null, deviation: null, complete: false}
  assert.equal(view.latestBaselinePoint([...points, last]), last)
  assert.match(view.formatDeviation(view.latestBaselinePoint([...points, last]).deviation), /无数据/)
  assert.equal(view.latestBaselinePoint([]), null)
  assert.equal(view.latestBaselinePoint(null), null)
})

test('F14 detail renders actual deviation and sample time separately from configured 2.5 sigma threshold', () => {
  const descriptions = template.match(/<a-descriptions bordered[\s\S]*?<\/a-descriptions>/)[0]
  const text = renderText(descriptions, {selectedRule: fixtureRule, latestPreviewPoint: points[1]}, {
    formatDeviation: value => view.formatDeviation ? view.formatDeviation(value) : 'MISSING',
    formatClock: value => String(value),
  })
  assert.ok(text.includes('超过 2.5σ'), text)
  assert.ok(text.includes('实际偏离度') && text.includes('90σ'), text)
  assert.ok(text.includes('样本时间') && text.includes('1791511200'), text)
})

test('F14 empty details render explicit no-data and no false zero', () => {
  const descriptions = template.match(/<a-descriptions bordered[\s\S]*?<\/a-descriptions>/)[0]
  const text = renderText(descriptions, {selectedRule: fixtureRule, latestPreviewPoint: null}, {
    formatDeviation: value => view.formatDeviation ? view.formatDeviation(value) : 'MISSING',
    formatClock: value => String(value),
  })
  assert.ok(text.includes('实际偏离度') && text.includes('无数据'), text)
  assert.doesNotMatch(text, /0σ/)
})

test('F14 unknown tooltip index is no-data rather than a previous valid reading', () => {
  const content = tooltip(999)
  assert.match(content, /实际偏离度[：:]无数据/)
  assert.doesNotMatch(content, /90σ/)
})

test('F14 presentation helpers do not mutate API preview inputs', () => {
  const before = JSON.stringify(points)
  view.baselineChartOption(points, '%')
  if (view.latestBaselinePoint) view.latestBaselinePoint(points)
  assert.equal(JSON.stringify(points), before)
})

test('F14 full page template remains compilable without changing permission directives or warning boundary', () => {
  assert.deepEqual(compiler.compile(template).errors, [])
  for (const action of ['create', 'update', 'delete']) assert.ok(template.includes(`v-auth="'${action}'"`))
  assert.ok(template.includes('v-if="preview.message"'))
})
