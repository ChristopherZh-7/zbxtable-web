const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const {normalizeAlarmSource, alarmSourceMeta, canHandleProblem} = require('../../src/pages/alarm/source-model')
const source = name => fs.readFileSync(path.join(__dirname, '../..', name), 'utf8')

test('source recovery is fail-closed and never inferred from manual handling or a partial group', () => {
  for (const value of [null, {}, {state: 'closed'}, {state: 'recovered', problem_count: 0}, {state: 'recovered', problem_count: 3, recovered_problem_count: 2, active_problem_count: 1}]) {
    assert.equal(normalizeAlarmSource(value).state, 'unverified')
  }
  assert.equal(normalizeAlarmSource({state: 'recovered', problem_count: 3, recovered_problem_count: 3, active_problem_count: 0}).state, 'recovered')
  assert.equal(alarmSourceMeta({state: 'problem', problem_count: 3, recovered_problem_count: 2, active_problem_count: 1}).label, '仍有未恢复问题')
  assert.equal(alarmSourceMeta({state: 'waiting_problem'}).label, '恢复待关联')
  assert.equal(alarmSourceMeta({}).color, '')
  assert.equal(canHandleProblem({status: '1', source: {state: 'recovered'}}), true)
  assert.equal(canHandleProblem({status: '0'}), false)
})

test('source card uses immutable event relationships and keeps human handling independent', () => {
  const card = source('src/pages/alarm/AlarmSourceCard.vue')
  for (const field of ['problem_event_id', 'recovery_event_id', 'problem_at', 'recovered_at', 'problem_alarm_id']) assert.ok(card.includes(field))
  assert.match(card, /不等于采集健康，也不代替下方人工处置/)
  assert.doesNotMatch(card, /v-html|\.post\(|\.put\(|claimAlarm|handleAlarm/)
})

test('alarm source view preserves role gates, tenant/selection epochs and truthful dispatch labels', () => {
  const page = source('src/pages/alarm/query.vue')
  assert.match(page, /\$can\('tenant\.alarms', 'operate'\) && canHandleProblem\(handlingRecord\)/)
  assert.match(page, /tenantContextChangingEvent, this.invalidateAlarmContext/)
  assert.match(page, /sequence !== this.handlingSequence \|\| tenant !== this.sourceTenantKey/)
  assert.match(page, /sequence === this.handlingSequence && tenant === this.sourceTenantKey/)
  assert.match(page, /sequence === this.listSequence && tenant === this.sourceTenantKey && this.list.some/)
  assert.match(page, /:expanded-row-keys="expandedAlarmKeys"/)
  assert.match(page, /this.expandedAlarmKeys = \[\]/)
  assert.match(page, /alarm-handling-refresh/)
  const words = source('src/pages/alarm/i18n.js')
  assert.match(words, /notify_status_notified: '已进入分发'/)
  assert.match(words, /notify_result_delivered: '渠道已接收'/)
  assert.match(words, /notify_result_failed: '发送失败'/)
  assert.match(words, /notify_status_source_recovered: '来源已恢复，未分发'/)
  assert.match(page, /record.notify_status === '3'/)
  assert.match(page, /notify_result_unknown/)
})
