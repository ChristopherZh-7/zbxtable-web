const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../../src/pages/dashboard/domains/view.js'), 'utf8')
const view = vm.runInNewContext(source.replace(/export /g, '') + '\n;({defaultForm,writePayload,validateForm,statusMeta,reasonText,chartOption})')
test('defaults, payload whitelist and no forged tenant identifiers', () => {
  const f = view.defaultForm()
  assert.equal(f.interval, 60)
  assert.equal(f.config.timeout, 5)
  f.config.tenant_id = 99
  f.host_id = 'forged'
  const p = view.writePayload(f)
  assert.equal(p.config.tenant_id, undefined)
  assert.equal(p.host_id, undefined)
  p.config.codes.push(503)
  assert.equal(f.config.codes.length, 1)
})
test('validation and unavailable states never render as healthy', () => {
  const f = view.defaultForm()
  assert.ok(view.validateForm(f, '200'))
  f.name = 'test'; f.config.domain = 'a.example.com'; f.group_id = '1'; f.zid = 1
  assert.equal(view.validateForm(f, '200,204'), '')
  assert.ok(view.validateForm(f, '200,999'))
  for (const state of ['no_data', 'disabled', 'sync_error', 'unavailable', 'unknown']) assert.notEqual(view.statusMeta(state)[0], '正常')
  assert.equal(view.reasonText('tls_invalid'), '证书校验失败')
})
test('failed HTTP samples create a gap, not a zero-latency success', () => {
  const result = view.chartOption([{clock: 2, status_code: 0, response_ms: 0}, {clock: 1, status_code: 200, response_ms: 12}])
  assert.equal(result.series[0].data[0][1], 12)
  assert.equal(result.series[0].data[1][1], null)
})
test('first real observation is visible before a line can be formed', () => {
  const result = view.chartOption([{clock: 1000, status_code: 200, response_ms: 12}])
  assert.equal(result.series[0].showSymbol, true)
  assert.equal(result.xAxis.min, 940000)
  assert.equal(result.xAxis.max, 1060000)
})
