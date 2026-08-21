const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const read = relative => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

test('F15 Webhook status view never renders authentication material', () => {
  const page = read('src/pages/system/zabbix.vue')
  assert.doesNotMatch(page, /webhookInfo\.webhook_token/)
  assert.doesNotMatch(page, /webhookInfo\.headers/)
  assert.match(page, /webhookInfo\.authentication/)
  assert.match(page, /handleInstallWebhook/)
  assert.match(page, /handleReinstallWebhook/)
  assert.match(page, /handleUninstallWebhook/)
})

test('F15 uses the authenticated platform Zabbix management endpoints', () => {
  const service = read('src/services/zabbix.js')
  assert.match(service, /\/v1\/zabbix\/instance\/\$\{id\}\/install-webhook/)
  assert.match(service, /\/v1\/zabbix\/instance\/\$\{id\}\/webhook-info/)
  assert.match(service, /\/v1\/zabbix\/instance\/\$\{id\}\/uninstall-webhook/)
})
