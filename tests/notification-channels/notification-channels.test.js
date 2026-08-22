const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  CONFIG_MASK,
  GROUP_KEYS,
  SECRET_CONFIG_KEYS,
  buildAtomicGroupRequest,
  normalizeSecretValue,
} = require('../../src/pages/system/system-management-policy')

const source = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

test('DingTalk secrets are atomic masked configuration values', () => {
  assert.deepEqual(GROUP_KEYS.dingtalk, [
    'dingtalk_enabled',
    'dingtalk_access_token',
    'dingtalk_secret',
  ])
  assert.equal(SECRET_CONFIG_KEYS.includes('dingtalk_access_token'), true)
  assert.equal(SECRET_CONFIG_KEYS.includes('dingtalk_secret'), true)
  assert.deepEqual(normalizeSecretValue('dingtalk_secret', CONFIG_MASK), {configured: true, value: ''})

  const configs = GROUP_KEYS.dingtalk.map((configKey, id) => ({id, config_key: configKey}))
  const request = buildAtomicGroupRequest('dingtalk', configs, {
    dingtalk_enabled: '1',
    dingtalk_access_token: '',
    dingtalk_secret: '',
  }, {dingtalk_secret: true})
  assert.deepEqual(request.clear_keys, ['dingtalk_secret'])
})

test('system configuration exposes saved-only DingTalk test action', () => {
  const page = source('src/pages/system/config.vue')
  assert.match(page, /key="dingtalk"/)
  assert.match(page, /saveCategory\('dingtalk'\)/)
  assert.match(page, /\/v1\/system\/test-dingtalk/)
  assert.match(page, /testDingTalkHint/)
  assert.doesNotMatch(page, /dingtalk_webhook_url/)
})

test('alarm rules enable DingTalk and keep SMS disabled', () => {
  const rule = source('src/pages/alarm/rule.vue')
  assert.match(rule, /\{ value: "dingding", label: this\.\$t\('channel_dingding'\) \}/)
  assert.match(rule, /\/\/ \{ value: "sms"/)
})
