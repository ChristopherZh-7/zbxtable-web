<template>
  <section class="alarm-source-card" aria-label="故障与恢复来源" data-testid="alarm-source-card" :data-source-state="value.state">
    <header><strong>故障与恢复来源</strong><a-tag :color="meta.color">{{ meta.label }}</a-tag></header>
    <p>{{ value.summary }}</p>
    <div v-if="value.problem_count" class="source-counts">
      <span>已知问题 <b>{{ value.problem_count }}</b></span>
      <span>未恢复 <b>{{ value.active_problem_count }}</b></span>
      <span>已恢复 <b>{{ value.recovered_problem_count }}</b></span>
    </div>
    <ol v-if="value.links.length" class="source-pairs">
      <li v-for="link in value.links" :key="link.id" data-testid="alarm-source-pair">
        <div class="source-pair">
          <span><small>问题事件</small><code>#{{ link.problem_event_id }}</code><time>{{ formatTime(link.problem_at) }}</time></span>
          <span class="source-arrow" aria-hidden="true">→</span>
          <span><small>恢复事件</small><code>{{ link.recovery_event_id ? '#' + link.recovery_event_id : '未确认恢复' }}</code><time>{{ link.recovered_at ? formatTime(link.recovered_at) : '等待来源证据' }}</time></span>
        </div>
        <small class="source-context">ZID {{ link.zid }} · Host {{ link.host_id }} · Trigger {{ link.trigger_id }}<template v-if="!link.problem_alarm_id"> · 原问题尚未入库</template></small>
      </li>
    </ol>
    <footer>来源状态是已核验事件的投影；不等于采集健康，也不代替下方人工处置。</footer>
  </section>
</template>

<script>
import {normalizeAlarmSource, alarmSourceMeta} from './source-model'
export default {
  name: 'AlarmSourceCard',
  props: {source: {type: Object, default: () => ({})}},
  computed: {value() { return normalizeAlarmSource(this.source) }, meta() { return alarmSourceMeta(this.source) }},
  methods: {formatTime(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '时间未核验' : date.toLocaleString('zh-CN', {hour12: false}) }},
}
</script>

<style scoped>
.alarm-source-card { --source-ink: #0b2147; --source-muted: #536780; --source-border: #d6e0ec; color: var(--source-ink); background: #f5f8fb; border: 1px solid var(--source-border); padding: 16px; margin-bottom: 20px; }
header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; font-size: 15px; }
header .ant-tag { margin: 0; }
p, footer { color: var(--source-muted); font-size: 12px; line-height: 1.75; margin: 10px 0 0; }
.source-counts { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px; font-size: 12px; }
.source-counts b { margin-left: 6px; }
.source-pairs { padding: 0; margin: 14px 0 0; list-style: none; }
.source-pairs li { padding: 12px 0; border-top: 1px solid var(--source-border); }
.source-pair { display: grid; grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr); gap: 6px; }
.source-pair span:not(.source-arrow) { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.source-arrow { align-self: center; text-align: center; color: #1b5a96; }
code { font: 600 13px/1.6 'SFMono-Regular', Consolas, monospace; overflow-wrap: anywhere; }
small, time { color: var(--source-muted); font-size: 11px; line-height: 1.6; }
.source-context { display: block; margin-top: 8px; overflow-wrap: anywhere; }
footer { border-top: 1px solid var(--source-border); padding-top: 10px; }
</style>
