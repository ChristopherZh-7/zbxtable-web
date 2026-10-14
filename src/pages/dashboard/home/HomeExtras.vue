<template>
  <a-card :title="title" size="small" :headStyle="headStyle">
    <div v-if="kind === 'summary'" class="home-summary-grid">
      <div v-for="item in summary" :key="item.label" class="home-summary-item">
        <span class="home-summary-icon" :style="{color: item.color}"><a-icon :type="item.icon" /></span>
        <div><span class="home-summary-label">{{ item.label }}</span><strong>{{ item.value }}<small>{{ item.unit }}</small></strong></div>
      </div>
    </div>
    <a-spin v-else-if="kind === 'severity' && !ready.alerts" class="home-extras-loading" />
    <div v-else-if="kind === 'severity'" class="home-severity-list">
      <div v-for="item in severityRows" :key="item.level" class="home-severity-row">
        <span><i :style="{background: item.color}" />{{ item.label }}</span>
        <div class="home-severity-track"><div :style="{width: item.percent + '%', background: item.color}" /></div>
        <strong>{{ item.count }}<small> 条</small></strong>
      </div>
      <p class="home-extra-note">当前未恢复告警，共 {{ alerts.length }} 条</p>
    </div>
    <div v-else-if="kind === 'shortcuts'" class="home-shortcuts">
      <router-link v-for="item in links" :key="item.path" :to="item.path">
        <a-icon :type="item.icon" /><span>{{ item.title }}</span><a-icon type="right" />
      </router-link>
      <a-empty v-if="!links.length" description="暂无可访问的快捷入口" />
    </div>
  </a-card>
</template>

<script>
import {alarmSeverityCounts} from './home-layout'

const LINKS = [
  {title: '资产管理', icon: 'appstore', path: '/assets/tree', permission: 'tenant.assets'},
  {title: '告警查询', icon: 'alert', path: '/alarm/list', fallback: '/alarm/query', permission: 'tenant.alarms'},
  {title: '状态总览', icon: 'dashboard', path: '/dashboard/overview', permission: 'tenant.dashboard'},
  {title: '大屏管理', icon: 'fund', path: '/topology/custom-screens', permission: 'tenant.dashboard'},
]
export default {
  name: 'HomeExtras',
  props: {
    kind: String, headStyle: Object,
    info: {type: Object, default: () => ({})}, alerts: {type: Array, default: () => []},
    egress: {type: Array, default: () => []}, ready: {type: Object, default: () => ({})},
    errors: {type: Object, default: () => ({})},
  },
  computed: {
    title() { return {summary: '统计摘要', severity: '告警级别分布', shortcuts: '快捷入口'}[this.kind] },
    summary() {
      const value = (type, count) => this.ready[type] && !this.errors[type] ? count : '—'
      const counts = alarmSeverityCounts(this.alerts)
      return [
        {label: '监控设备', value: value('devices', this.info.total_count), unit: '台', icon: 'desktop', color: '#1b5a96'},
        {label: '未恢复告警', value: value('alerts', this.alerts.length), unit: '条', icon: 'alert', color: '#bc7321'},
        {label: '严重及灾难告警', value: value('alerts', counts[4] + counts[5]), unit: '条', icon: 'warning', color: '#c55353'},
        {label: '监控出口', value: value('bandwidth', this.egress.length), unit: '个', icon: 'swap', color: '#278579'},
      ]
    },
    severityRows() {
      const counts = alarmSeverityCounts(this.alerts), total = Math.max(1, this.alerts.length)
      const labels = ['未分类', '信息', '警告', '一般', '严重', '灾难']
      const colors = ['#8294a8', '#5d8ac5', '#d8ab3b', '#d98743', '#cb6254', '#b73b45']
      return [5, 4, 3, 2, 1, 0].map(level => ({level, label: labels[level], color: colors[level], count: counts[level], percent: counts[level] / total * 100}))
    },
    links() {
      return LINKS.filter(item => this.$can(item.permission, 'read')).flatMap(item => {
        const path = [item.path, item.fallback].filter(Boolean).find(path =>
          this.$router.resolve(path).route.matched.some(record => record.path === path))
        return path ? [{...item, path}] : []
      })
    },
  },
}
</script>

<style lang="less">
.home-summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(165px, 1fr)); gap: 12px; height: 100%; align-items: center; }
.home-summary-item { display: flex; gap: 12px; align-items: center; min-width: 0; strong { display: block; font-size: 26px; line-height: 1.35; color: #0a1f44; font-variant-numeric: tabular-nums; small { color: #6b7f95; font-size: 12px; font-weight: 400; margin-left: 6px; } } }
.home-summary-icon { font-size: 22px; width: 42px; height: 42px; display: grid; place-items: center; background: #f2f6fa; border-radius: 6px; flex: none; }
.home-summary-label { font-size: 12px; color: #61758c; }
.home-severity-list { display: flex; flex-direction: column; gap: 16px; padding: 6px 0; }
.home-severity-row { display: flex; gap: 14px; align-items: center; color: #294765; span { display: flex; align-items: center; gap: 7px; width: 60px; flex: none; font-size: 12px; } i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; } strong { width: 45px; text-align: right; font-variant-numeric: tabular-nums; flex: none; } small { font-weight: 400; color: #7b8b9c; } }
.home-severity-track { flex: 1; height: 7px; border-radius: 4px; background: #eef2f6; overflow: hidden; div { height: 100%; border-radius: 4px; } }
.home-extra-note { margin: 0; color: #61758c; font-size: 12px; }
.home-extras-loading { display: block; margin: 28px auto; }
.home-shortcuts { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 10px; a { display: flex; align-items: center; gap: 10px; border: 1px solid #dce4ed; border-radius: 4px; padding: 14px 12px; color: #244867; span { flex: 1; } &:hover { border-color: #87acce; background: #f5f9fd; } } }
@media (max-width: 600px) {
  .home-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .home-summary-item { gap: 8px; strong { font-size: 22px; } }
  .home-summary-icon { width: 30px; height: 30px; font-size: 18px; }
}
</style>
