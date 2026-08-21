const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  CONFIG_MASK,
  GROUP_KEYS,
  buildAtomicGroupRequest,
  normalizeSecretValue,
} = require('../../src/pages/system/system-management-policy')

const source = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

function configsFor(category) {
  return GROUP_KEYS[category].map((configKey, index) => ({id: index + 1, config_key: configKey}))
}

test('system self-management builds one bounded group request', () => {
  const form = {
    system_name: '智能运维',
    system_subtitle: '演示环境',
    system_logo: '/logo.png',
    dash_top_lin_num: '8',
    dash_top_win_num: '9',
    webhook_url: 'https://ops.example.com/webhook',
    zbx_dash: '1',
  }
  const request = buildAtomicGroupRequest('system', configsFor('system'), form, {})
  assert.deepEqual(Object.keys(request.values), GROUP_KEYS.system)
  assert.equal(request.values.system_name, '智能运维')
  assert.equal(Object.hasOwn(request.values, 'zbx_dash'), false)
  assert.deepEqual(request.clear_keys, [])
})

test('masked secrets become status only and blank saves preserve them', () => {
  assert.deepEqual(normalizeSecretValue('email_secret', CONFIG_MASK), {configured: true, value: ''})
  assert.deepEqual(normalizeSecretValue('wechat_secret', ''), {configured: false, value: ''})

  const form = Object.fromEntries(GROUP_KEYS.email.map((key) => [key, key === 'email_secret' ? '' : 'value']))
  const preserve = buildAtomicGroupRequest('email', configsFor('email'), form, {email_secret: false})
  assert.equal(preserve.values.email_secret, '')
  assert.deepEqual(preserve.clear_keys, [])

  const clear = buildAtomicGroupRequest('email', configsFor('email'), form, {email_secret: true})
  assert.deepEqual(clear.clear_keys, ['email_secret'])
})

test('configuration page uses atomic endpoint and tests saved settings only', () => {
  const configPage = source('src/pages/system/config.vue')
  const service = source('src/services/admin.js')
  assert.match(configPage, /configUpdateGroup\(category, request\)/)
  assert.match(configPage, /buildAtomicGroupRequest/)
  assert.match(configPage, /secretClearPending/)
  assert.match(configPage, /testEmailHint/)
  assert.match(service, /\/config\/group\/.*METHOD\.PUT/)
})

test('unsafe in-page binary update action is absent', () => {
  const versionPage = source('src/pages/system/version.vue')
  const service = source('src/services/admin.js')
  assert.doesNotMatch(versionPage, /systemDoUpdate|handleUpdate|update_now|cloud-download/)
  assert.doesNotMatch(service, /systemDoUpdate|SYSTEM_UPDATE \+ '\/update'/)
  assert.match(versionPage, /check_available/)
  assert.match(versionPage, /managed_by/)
})
