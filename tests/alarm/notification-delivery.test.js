const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const {normalizeNotificationDelivery, notificationDeliveryMeta, notificationAttemptMeta, newNotificationRetryKey} = require('../../src/pages/alarm/notification-delivery-model')
const source = name => fs.readFileSync(path.join(__dirname, '../..', name), 'utf8')

test('delivery normalization is fail closed and only terminal durable failures can retry', () => {
  assert.equal(normalizeNotificationDelivery({}).delivery_status, 'unknown')
  assert.equal(normalizeNotificationDelivery({delivery_status: 'invented'}).delivery_status, 'unknown')
  assert.equal(normalizeNotificationDelivery({delivery_status: 'failed', delivery_id: 7, version: 3, can_retry: true}).can_retry, true)
  assert.equal(normalizeNotificationDelivery({delivery_status: 'retry_wait', delivery_id: 7, version: 3, can_retry: true}).can_retry, false)
  assert.equal(normalizeNotificationDelivery({delivery_status: 'failed', delivery_id: 0, version: 3, can_retry: true}).can_retry, false)
  assert.equal(notificationDeliveryMeta({delivery_status: 'delivered'}).status, 'success')
  assert.equal(notificationAttemptMeta('interrupted').color, '#c68a2b')
})

test('manual retry keys are UUID v4 and unavailable entropy fails closed', () => {
  assert.equal(newNotificationRetryKey({randomUUID: () => '01234567-89ab-4def-8123-456789abcdef'}), '01234567-89ab-4def-8123-456789abcdef')
  const key = newNotificationRetryKey({getRandomValues: bytes => { for (let index = 0; index < bytes.length; index += 1) bytes[index] = index; return bytes }})
  assert.match(key, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
  assert.equal(newNotificationRetryKey({}), '')
})

test('delivery panel exposes an attempt rail and permission-gated action without technical secrets', () => {
  const panel = source('src/pages/alarm/NotificationDeliveryPanel.vue')
  assert.match(panel, /data-testid="notification-attempt-rail"/)
  assert.match(panel, /canOperate && delivery.can_retry/)
  assert.match(panel, /data-testid="notification-delivery-retry"/)
  assert.match(panel, /i18n: require\('\.\/i18n'\)/)
  assert.match(panel, /width: calc\(100vw - 360px\)/)
  assert.match(panel, /Channel acceptance does not mean a person has read it|notification_delivery_hint/)
  assert.doesNotMatch(panel, /v-html|webhook_token|dingtalk_secret|wechat_secret|email_secret/)
  for (const color of ['#0b2147', '#1b5a96', '#2f6f62', '#c94b4b', '#c68a2b', '#f5f8fb']) assert.ok(panel.includes(color))
})

test('alarm page retries through the tenant endpoint and fences stale responses', () => {
  const page = source('src/pages/alarm/query.vue')
  const service = source('src/services/admin.js')
  assert.match(page, /retryNotificationDelivery\(record.id, delivery.delivery_id, delivery.version, key\)/)
  assert.match(page, /sequence !== this.listSequence \|\| tenant !== this.sourceTenantKey/)
  assert.match(page, /:can-operate="\$can\('tenant\.alarms', 'operate'\)"/)
  assert.match(service, /notifications\/' \+ deliveryId \+ '\/retry'/)
})
