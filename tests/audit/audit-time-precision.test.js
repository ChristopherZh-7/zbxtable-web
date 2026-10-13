const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const moment = require('moment')

// Run from the selected smart-ops-web root. The same external test can exercise
// an untouched baseline; no new helper/import is required in that source.
const {buildAuditQuery, validateAuditRange, MAX_AUDIT_RANGE_MS} = require(
  path.resolve(process.cwd(), 'src/pages/system/audit/audit-policy.js'))

const state = value => ({epoch: value.valueOf(), iso: value.toISOString(),
  offset: value.utcOffset(), milliseconds: value.milliseconds()})

test('audit query clears both hidden fractions on copies while preserving moment inputs and filters', () => {
  const start = moment.parseZone('2026-10-10T04:38:57.217+08:00')
  const end = moment.parseZone('2026-10-10T04:38:58.217+08:00')
  const range = [start, end]
  const before = range.map(state)
  const filters = {range, actor: 'operator', tenant_id: 17, resource: 'platform.rules',
    action: 'update', result: 'success'}
  const query = buildAuditQuery(filters, 2, 50)
  assert.equal(filters.range, range)
  assert.equal(range[0], start)
  assert.equal(range[1], end)
  assert.deepEqual(range.map(state), before, 'neither original moment may be mutated')
  assert.deepEqual(query, {
    page: 2, limit: 50,
    start_time: '2026-10-09T20:38:57.000Z', end_time: '2026-10-09T20:38:58.000Z',
    actor: 'operator', tenant_id: 17, resource: 'platform.rules', action: 'update', result: 'success',
  })
  assert.deepEqual(buildAuditQuery(filters, 2, 50), query, 'repeat query must not alter the selected range')
})

test('audit precision keeps timezone conversion and the selected end second, without adding a second or .999', () => {
  for (const [start, end, expectedStart, expectedEnd] of [
    ['2026-12-31T23:59:59.999-07:00', '2027-01-01T00:00:00.987-07:00',
      '2027-01-01T06:59:59.000Z', '2027-01-01T07:00:00.000Z'],
    ['2026-10-10T04:38:57.000+08:00', '2026-10-10T04:38:57.000+08:00',
      '2026-10-09T20:38:57.000Z', '2026-10-09T20:38:57.000Z'],
  ]) {
    const range = [moment.parseZone(start), moment.parseZone(end)]
    const before = range.map(state)
    const query = buildAuditQuery({range}, 1, 20)
    assert.deepEqual(range.map(state), before)
    assert.equal(query.start_time, expectedStart)
    assert.equal(query.end_time, expectedEnd)
    assert.deepEqual(Object.keys(query), ['page', 'limit', 'start_time', 'end_time'])
  }
  const range = [new Date('2026-10-10T00:00:00.217Z'), new Date('2026-10-10T00:00:01.987Z')]
  const before = range.map(value => value.valueOf())
  assert.equal(buildAuditQuery({range}, 1, 20).end_time, '2026-10-10T00:00:01.000Z')
  assert.deepEqual(range.map(value => value.valueOf()), before, 'Date inputs also remain untouched')
})

test('existing range validation runs before normalization and still rejects over-31-day and reversed input', () => {
  const start = moment.parseZone('2026-10-01T00:00:00.217+08:00')
  const exact = start.clone().add(MAX_AUDIT_RANGE_MS, 'milliseconds')
  assert.equal(validateAuditRange([start, exact]), '')
  assert.doesNotThrow(() => buildAuditQuery({range: [start, exact]}, 1, 20))
  const tooLong = exact.clone().add(1, 'millisecond')
  assert.throws(() => buildAuditQuery({range: [start, tooLong]}, 1, 20), /31 天/)
  const reversed = start.clone().subtract(1, 'millisecond')
  assert.throws(() => buildAuditQuery({range: [start, reversed]}, 1, 20), /结束时间不能早于开始时间/)
  assert.throws(() => buildAuditQuery({range: [start, null]}, 1, 20), /请选择完整的时间范围/)
  assert.equal(start.milliseconds(), 217)
  assert.equal(exact.valueOf() - start.valueOf(), MAX_AUDIT_RANGE_MS)
})
