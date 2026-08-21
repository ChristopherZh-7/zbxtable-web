const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8')

test('alarm analysis renders three charts from one filtered response', () => {
  const page = source('src/pages/alarm/analysis.vue')
  assert.match(page, /<e-line :mock="nameList" :numList="numList"/)
  assert.match(page, /<e-pie :mock="list"/)
  assert.match(page, /<e-trend :mock="trendList" :bucket="trendBucket"/)
  assert.match(page, /res\.data\.trend \|\| \[\]/)
  assert.match(page, /res\.data\.trend_bucket \|\| 'day'/)
})

test('alarm analysis uses unified export permission and filter payload', () => {
  const page = source('src/pages/alarm/analysis.vue')
  assert.match(page, /\$can\('tenant\.alarms', 'export'\)/)
  assert.doesNotMatch(page, /v-auth="'export'"/)
  assert.match(page, /begin: this\.beginTime/)
  assert.match(page, /end: this\.endTime/)
  assert.match(page, /params\.zid = this\.selectedInstance/)
})

test('severity labels cover all six Zabbix levels and trend keeps zero counts', () => {
  const pie = source('src/pages/alarm/ePie.vue')
  for (const [value, label] of [['0', '未分类'], ['1', '信息'], ['2', '警告'], ['3', '一般'], ['4', '严重'], ['5', '灾难']]) {
    assert.match(pie, new RegExp(`case "${value}": res = "${label}"`))
  }
  const trend = source('src/pages/alarm/eTrend.vue')
  assert.match(trend, /Number\(item\.count\) \|\| 0/)
  assert.match(trend, /minTickInterval: 1/)
})
