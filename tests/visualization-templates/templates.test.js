const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const source = relative => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

test('five visualization templates are registered under visualization', () => {
  assert.match(source('src/router/async/router.map.js'), /visualizationTemplates:\s*\{[\s\S]*Visualization\/Templates/i)
  const page = source('src/pages/visualization/Templates.vue')
  for (const name of ['网络', '系统', '应用', '业务', '综合运行']) assert.ok(page.includes(`name: '${name}'`), `missing ${name} template`)
})

test('templates consume tenant APIs and retain empty states without mock numbers or explanatory banners', () => {
  const page = source('src/pages/visualization/Templates.vue')
  for (const call of ['indexInfo()', 'resourceDiscoveryOverview()', 'indexTrigger()', 'alarmAnalysis({})', 'indexEgress()']) assert.ok(page.includes(call), `missing ${call}`)
  for (const endpoint of ['/v1/index/baseinfo', '/v1/resource-discovery', '/v1/trigger', '/v1/alarm/analysis']) assert.ok(page.includes(endpoint), `missing source ${endpoint}`)
  assert.doesNotMatch(page, /<a-alert/)
  assert.match(page, /v-if="!networkRows.length"[^>]*>暂无网络资源发现数据/)
  assert.match(page, /Number\(this\.info\.total_count\) \|\| 0/)
  assert.doesNotMatch(page, /Math\.random|mockData|METHOD\.(POST|PUT|DELETE)/)
})

test('business score formula is transparent and deterministic', () => {
  const page = source('src/pages/visualization/Templates.vue')
  assert.match(page, /Math\.max\(0, 100 - this\.activeAlarms \* 2 - this\.criticalAlarms \* 8\)/)
  assert.match(page, /评分：100 − 活动告警数×2 − 严重告警数×8，最低为 0/)
})
