const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {baselineChartOption, defaultBaselineForm, numericTrendItems, severityMeta, validateBaselineForm} = require('../../src/pages/dashboard/baseline/baseline-view')

test('F14 form freezes historical-period baseline boundaries', () => {
  const form = defaultBaselineForm()
  assert.equal(form.season_unit, 'd')
  assert.equal(form.seasons, 7)
  assert.equal(form.deviation, 3)
  form.name = 'CPU 动态基线'
  assert.match(validateBaselineForm(form), /监控项/)
  Object.assign(form, {zid: 1, itemid: '101', name: 'CPU 动态基线'})
  assert.equal(validateBaselineForm(form), '')
  form.seasons = 31
  assert.match(validateBaselineForm(form), /3-30/)
})

test('only numeric, enabled and trend-retained items are selectable', () => {
  const items = numericTrendItems([
    {itemid: '1', value_type: '0', trends: '365d', status: '0'},
    {itemid: '2', value_type: '3', trends: '0', status: '0'},
    {itemid: '3', value_type: '1', trends: '365d', status: '0'},
    {itemid: '4', value_type: '0', trends: '365d', status: '1'},
  ])
  assert.deepEqual(items.map(item => item.itemid), ['1'])
})

test('preview renders actual and weighted baseline series', () => {
  const option = baselineChartOption([{clock: '1', actual: 20, baseline: 10}, {clock: '2', actual: 22, baseline: null}], '%')
  assert.deepEqual(option.series.map(series => series.name), ['实际值', '加权基线'])
  assert.deepEqual(option.series[1].data, [10, null])
  assert.equal(severityMeta(5).label, '灾难')
})

test('page exposes read-only viewer flow and permission-gated mutations', () => {
  const page = fs.readFileSync(path.join(__dirname, '../../src/pages/dashboard/baseline/index.vue'), 'utf8')
  const router = fs.readFileSync(path.join(__dirname, '../../src/router/async/router.map.js'), 'utf8')
  assert.match(page, /v-auth="'create'"/)
  assert.match(page, /v-auth="'update'"/)
  assert.match(page, /v-auth="'delete'"/)
  assert.match(page, /baselineRulePreview/)
  assert.match(page, /baselineRuleEvents/)
  assert.match(page, /label="数据周期">1 小时/)
  assert.match(page, /v-if="preview.message"/)
  assert.doesNotMatch(page, /基线固定使用|不是 AI 预测/)
  assert.match(router, /dynamicBaselines/)
})
