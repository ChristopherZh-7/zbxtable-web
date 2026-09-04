<template>
  <section class="notification-delivery-panel" aria-label="通知投递" data-testid="notification-delivery-panel">
    <header>
      <div><strong>{{ $t('notification_delivery_title') }}</strong><p>{{ $t('notification_delivery_hint') }}</p></div>
      <span>{{ normalized.length }} {{ $t('notification_delivery_count') }}</span>
    </header>
    <a-empty v-if="!normalized.length" :description="$t('notification_delivery_empty')" />
    <template v-else>
    <article v-for="delivery in normalized" :key="delivery.id" class="delivery-card" :data-delivery-status="delivery.delivery_status" data-testid="notification-delivery-card">
      <div class="delivery-summary">
        <div>
          <span class="channel">{{ channelName(delivery.channel) }}</span>
          <strong>{{ delivery.rule || $t('notification_delivery_unknown_rule') }}</strong>
          <small>{{ delivery.user || delivery.account || $t('notification_delivery_managed_recipient') }}</small>
        </div>
        <a-badge :status="meta(delivery).status" :text="$t(meta(delivery).key)" />
      </div>
      <div v-if="!delivery.legacy" class="delivery-facts">
        <span><small>{{ $t('notification_delivery_cycle_attempts') }}</small><b>{{ delivery.attempt_count }}/{{ delivery.max_attempts }}</b></span>
        <span><small>{{ $t('notification_delivery_total_attempts') }}</small><b>{{ delivery.total_attempt_count }}</b></span>
        <span><small>{{ $t('notification_delivery_next_attempt') }}</small><b>{{ delivery.next_attempt_at ? formatTime(delivery.next_attempt_at) : '—' }}</b></span>
      </div>
      <p v-if="delivery.last_error_message || delivery.notify_error" class="delivery-error">{{ delivery.last_error_message || delivery.notify_error }}</p>
      <p v-if="delivery.legacy" class="legacy-note">{{ $t('notification_delivery_legacy_hint') }}</p>
      <ol v-if="delivery.attempts.length" class="attempt-rail" data-testid="notification-attempt-rail">
        <li v-for="attempt in delivery.attempts" :key="attempt.attempt_no" :style="{'--attempt-color': attemptMeta(attempt.status).color}">
          <span class="attempt-dot" aria-hidden="true"></span>
          <div><strong>{{ $t('notification_attempt_number', {count: attempt.attempt_no}) }} · {{ $t(attemptMeta(attempt.status).key) }}</strong><time>{{ formatTime(attempt.finished_at || attempt.started_at) }}</time><small v-if="attempt.error_message">{{ attempt.error_message }}</small></div>
        </li>
      </ol>
      <div class="delivery-actions">
        <a-button v-if="canOperate && delivery.can_retry" size="small" icon="redo" :loading="retrying[String(delivery.delivery_id)]" data-testid="notification-delivery-retry" @click="$emit('retry', delivery)">{{ $t('notification_delivery_retry') }}</a-button>
      </div>
    </article>
    </template>
  </section>
</template>

<script>
import {normalizeNotificationDelivery, notificationDeliveryMeta, notificationAttemptMeta} from './notification-delivery-model'
export default {
  name: 'NotificationDeliveryPanel',
  i18n: require('./i18n'),
  props: {deliveries: {type: Array, default: () => []}, canOperate: {type: Boolean, default: false}, retrying: {type: Object, default: () => ({})}},
  computed: {normalized() { return this.deliveries.map(normalizeNotificationDelivery) }},
  methods: {
    meta: notificationDeliveryMeta,
    attemptMeta: notificationAttemptMeta,
    formatTime(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', {hour12: false}) },
    channelName(value) { const key = String(value || '').trim().toLowerCase(); return ({mail: this.$t('channel_mail'), wechat: this.$t('channel_wechat'), wechat_robot: this.$t('channel_wechat_robot'), dingding: this.$t('channel_dingding')})[key] || value || this.$t('msg_unknown') },
  },
}
</script>

<style scoped>
.notification-delivery-panel { --ink: #0b2147; --blue: #1b5a96; --ok: #2f6f62; --bad: #c94b4b; --retry: #c68a2b; --surface: #f5f8fb; box-sizing: border-box; width: calc(100vw - 360px); max-width: 1320px; color: var(--ink); background: var(--surface); border: 1px solid #d6e0ec; padding: 14px; }
header, .delivery-summary { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
header { padding-bottom: 10px; border-bottom: 1px solid #d6e0ec; }
header p { margin: 4px 0 0; color: #536780; font-size: 12px; }
header > span { color: #536780; font: 600 12px/1.6 'SFMono-Regular', Consolas, monospace; }
.delivery-card { margin-top: 10px; padding: 13px; background: #fff; border-left: 3px solid #9aa9ba; box-shadow: 0 1px 2px rgba(11, 33, 71, 0.06); }
.delivery-card[data-delivery-status='delivered'] { border-left-color: var(--ok); }
.delivery-card[data-delivery-status='failed'] { border-left-color: var(--bad); }
.delivery-card[data-delivery-status='retry_wait'] { border-left-color: var(--retry); }
.delivery-card[data-delivery-status='sending'], .delivery-card[data-delivery-status='pending'] { border-left-color: var(--blue); }
.delivery-summary > div { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; min-width: 0; }
.delivery-summary > .ant-badge { flex: none; }
.delivery-summary strong { font-size: 13px; }
.delivery-summary small { color: #536780; }
.channel { padding: 2px 7px; color: #fff; background: var(--ink); font-size: 11px; letter-spacing: .04em; }
.delivery-facts { display: grid; grid-template-columns: repeat(3, minmax(110px, 1fr)); gap: 1px; margin-top: 11px; background: #d6e0ec; border: 1px solid #d6e0ec; }
.delivery-facts span { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; background: #fff; }
.delivery-facts small { color: #536780; }
.delivery-facts b { font: 600 12px/1.5 'SFMono-Regular', Consolas, monospace; }
.delivery-error, .legacy-note { margin: 10px 0 0; color: #8f3434; font-size: 12px; }
.legacy-note { color: #536780; }
.attempt-rail { margin: 12px 0 0; padding: 0; list-style: none; }
.attempt-rail li { position: relative; display: grid; grid-template-columns: 12px 1fr; gap: 8px; padding-bottom: 9px; }
.attempt-rail li:not(:last-child)::before { content: ''; position: absolute; left: 5px; top: 10px; bottom: -1px; width: 1px; background: #d6e0ec; }
.attempt-dot { z-index: 1; width: 9px; height: 9px; margin-top: 4px; border: 2px solid var(--attempt-color); background: #fff; border-radius: 50%; }
.attempt-rail div { display: grid; grid-template-columns: minmax(170px, 1fr) auto; gap: 4px 12px; }
.attempt-rail strong { font-size: 12px; }
.attempt-rail time, .attempt-rail small { color: #536780; font-size: 11px; }
.attempt-rail small { grid-column: 1 / -1; }
.delivery-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
@media (max-width: 760px) { .notification-delivery-panel { width: calc(100vw - 40px); } .delivery-facts { grid-template-columns: 1fr; } .attempt-rail div { grid-template-columns: 1fr; } }
</style>
