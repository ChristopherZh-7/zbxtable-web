const STATES = {
  unknown: {status: 'default', key: 'notification_delivery_unknown'},
  pending: {status: 'processing', key: 'notification_delivery_pending'},
  sending: {status: 'processing', key: 'notification_delivery_sending'},
  retry_wait: {status: 'warning', key: 'notification_delivery_retry_wait'},
  delivered: {status: 'success', key: 'notify_result_delivered'},
  failed: {status: 'error', key: 'notify_result_failed'},
  legacy: {status: 'default', key: 'notification_delivery_legacy'},
}

const ATTEMPTS = {
  sending: {color: '#1b5a96', key: 'notification_attempt_sending'},
  delivered: {color: '#2f6f62', key: 'notification_attempt_delivered'},
  failed: {color: '#c94b4b', key: 'notification_attempt_failed'},
  interrupted: {color: '#c68a2b', key: 'notification_attempt_interrupted'},
}

function asCount(value) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : 0
}

function normalizeNotificationDelivery(value) {
  const item = value && typeof value === 'object' ? value : {}
  const legacy = item.legacy === true || item.delivery_status === 'legacy'
  const state = legacy ? 'legacy' : Object.prototype.hasOwnProperty.call(STATES, item.delivery_status) && item.delivery_status !== 'legacy' ? item.delivery_status : 'unknown'
  const deliveryId = asCount(item.delivery_id)
  const version = asCount(item.version)
  const attempts = Array.isArray(item.attempts) ? item.attempts.map(attempt => ({
    attempt_no: asCount(attempt.attempt_no), cycle_attempt: asCount(attempt.cycle_attempt),
    status: Object.prototype.hasOwnProperty.call(ATTEMPTS, attempt.status) ? attempt.status : 'interrupted',
    error_code: String(attempt.error_code || ''), error_message: String(attempt.error_message || ''),
    started_at: attempt.started_at || '', finished_at: attempt.finished_at || '',
  })).sort((left, right) => left.attempt_no - right.attempt_no) : []
  return {...item, delivery_id: deliveryId, version, legacy, delivery_status: state,
    attempt_count: asCount(item.attempt_count), total_attempt_count: asCount(item.total_attempt_count),
    max_attempts: Math.max(1, asCount(item.max_attempts) || 1), attempts,
    can_retry: !legacy && state === 'failed' && item.can_retry === true && deliveryId > 0 && version > 0}
}

function notificationDeliveryMeta(value) { return STATES[normalizeNotificationDelivery(value).delivery_status] }
function notificationAttemptMeta(value) { return ATTEMPTS[value] || ATTEMPTS.interrupted }

function newNotificationRetryKey(random) {
  const source = random || (typeof crypto !== 'undefined' ? crypto : null)
  if (source && typeof source.randomUUID === 'function') return source.randomUUID()
  if (!source || typeof source.getRandomValues !== 'function') return ''
  const bytes = source.getRandomValues(new Uint8Array(16))
  bytes[6] = bytes[6] & 0x0f | 0x40
  bytes[8] = bytes[8] & 0x3f | 0x80
  const value = Array.from(bytes, item => item.toString(16).padStart(2, '0')).join('')
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

module.exports = {normalizeNotificationDelivery, notificationDeliveryMeta, notificationAttemptMeta, newNotificationRetryKey}
