const assert = require('node:assert/strict')
const test = require('node:test')
const {utilization, utilizationLabel, uptimeLabel, deviceColumnWidth} = require('../../src/pages/host/device-metrics')

test('missing and malformed utilization never appears as zero or a full bar', () => {
  for (const value of [undefined, null, '', ' ', '--', '—', 'N/A', 'unknown', 'NaN', Infinity, false, [], {}, '-1', '100.01', '35oops', '0x10', '1e2', '50%%']) {
    assert.equal(utilization(value), null, String(value))
    assert.equal(utilizationLabel(value), '暂无数据', String(value))
  }
})

test('zero, percentages and range edges retain their meaning', () => {
  for (const value of [0, '0', '0%', ' 0.0 % ']) {
    assert.equal(utilization(value), 0)
    assert.equal(utilizationLabel(value), '0.0')
  }
  assert.equal(utilization(' 37.26 % '), 37.26)
  assert.equal(utilizationLabel('37.26%'), '37.3')
  assert.equal(utilizationLabel(100), '100.0')
  assert.equal(utilizationLabel(0.01), '<0.1')
  assert.equal(utilizationLabel(99.99), '>99.9')
})

test('uptime formats numeric seconds and preserves existing formatted durations', () => {
  for (const [input, output] of [[0, '0秒'], ['59', '59秒'], [60, '1分钟'], [3661, '1小时 1分钟'], [93784, '1天 2小时 3分钟'], ['12 days, 03:20:00', '12 days, 03:20:00']]) {
    assert.equal(uptimeLabel(input), output)
  }
  for (const value of ['', null, undefined, '-', 'N/A', -1, 'Infinity', NaN, Infinity, {}, '99999999999999999999']) {
    assert.equal(uptimeLabel(value), '暂无数据')
  }
})

test('automatic widths keep metrics readable and respect larger configured widths', () => {
  for (const key of ['uptime', 'cpu_utilization', 'memory_utilization']) {
    const automatic = deviceColumnWidth({key})
    assert.ok(automatic >= 128)
    assert.equal(deviceColumnWidth({key, width: 20}), automatic)
    assert.equal(deviceColumnWidth({key, width: 240}), 240)
    assert.equal(deviceColumnWidth({key, width: 0}), automatic)
    assert.equal(deviceColumnWidth({key, width: 'oops'}), automatic)
  }
  assert.equal(deviceColumnWidth({key: 'legacy_custom_field'}), 160)
  assert.equal(deviceColumnWidth({key: 'legacy_custom_field', width: 200}), 200)
})
