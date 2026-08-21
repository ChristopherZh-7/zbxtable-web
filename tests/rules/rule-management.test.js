const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const read = relative => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

test('F16 distribution rule UI exposes safe condition choices and readable summaries', () => {
  const page = read('src/pages/alarm/rule.vue')
  assert.match(page, /value: "contains"/)
  assert.match(page, /ruleConditionSummary/)
  assert.match(page, /condition_summary/)
  assert.match(page, /\$can\('platform\.rules', 'delete'\)/)
  assert.doesNotMatch(page, /type:\s*'role'/)
  assert.doesNotMatch(page, /console\.log\(this\.instanceList\)/)
})

test('F16 distribution and mute rule writes serialize the backend contract', () => {
  const distribution = read('src/pages/alarm/rule.vue')
  const mute = read('src/pages/alarm/mutes.vue')
  for (const source of [distribution, mute]) {
    assert.match(source, /JSON\.stringify\(/)
    assert.match(source, /s_week/)
    assert.match(source, /s_time/)
    assert.match(source, /e_time/)
  }
  assert.match(mute, /buildRulePayload/)
  assert.match(mute, /value: "contains"/)
})
