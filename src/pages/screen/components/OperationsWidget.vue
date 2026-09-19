<template>
  <div class="operations-widget" :data-module="type">
    <div v-if="type === 'ops-kpi' && title && title !== '运维指标'" class="operations-widget__kpi-title">{{ title }}</div>
    <kpi-cards v-if="type === 'ops-kpi'" v-bind="kpi" />
    <screen-panel v-else :title="title">
      <template v-if="isTop" slot="extra">
        <div class="top-toggle">
          <button v-for="value in ['cpu', 'mem']" :key="value" class="toggle-btn" :class="{active: activeMetric === value}"
            @mousedown.stop @click.stop="setMetric(value)">{{ value === 'cpu' ? 'CPU' : '内存' }}</button>
        </div>
      </template>
      <host-type-pie v-if="type === 'ops-hosts'" :data="payload.info || {}" />
      <severity-rose v-else-if="type === 'ops-severity'" :triggers="payload.triggers || []" />
      <egress-area v-else-if="type === 'ops-egress'" :data="payload.egress || []" />
      <resource-top-bar v-else-if="isTop" :rows="activeMetric === 'cpu' ? (payload.cpu || []) : (payload.mem || [])" :metric="activeMetric" />
      <alert-marquee v-else-if="type === 'ops-alerts'" :list="payload.triggers || []" />
      <div v-if="emptyLabel && !status" class="operations-widget__empty">{{ emptyLabel }}</div>
    </screen-panel>
    <div v-if="status" class="operations-widget__status">{{ status === 'loading' ? '正在加载当前租户数据…' : '数据加载失败，请刷新重试' }}</div>
  </div>
</template>
<script>
import ScreenPanel from './ScreenPanel'
import KpiCards from './KpiCards'
import HostTypePie from './HostTypePie'
import SeverityRose from './SeverityRose'
import ResourceTopBar from './ResourceTopBar'
import EgressArea from './EgressArea'
import AlertMarquee from './AlertMarquee'
import {operationsKpi} from '../operations-model'
import '../style.less'
export default {
  name: 'OperationsWidget',
  components: {ScreenPanel, KpiCards, HostTypePie, SeverityRose, ResourceTopBar, EgressArea, AlertMarquee},
  props: {type: String, title: String, payload: {type: Object, default: () => ({})}, status: String, metric: {type: String, default: 'cpu'}},
  data() { return {activeMetric: this.metric} },
  watch: {metric(value) { this.activeMetric = value }},
  computed: {
    kpi() { return operationsKpi(this.payload.info, this.payload.triggers) },
    isTop() { return this.type === 'ops-linux' || this.type === 'ops-windows' },
    emptyLabel() {
      if (this.type === 'ops-egress' && !(this.payload.egress || []).length) return '当前租户暂无可展示的出口流量'
      if (this.type === 'ops-hosts' && !operationsKpi(this.payload.info).total) return '当前租户暂无主机'
      if (this.type === 'ops-severity' && !(this.payload.triggers || []).length) return '暂无活动告警'
      return ''
    },
  },
  methods: {setMetric(value) { this.activeMetric = value; this.$emit('metric-change', value) }},
}
</script>
<style lang="less">
.operations-widget { position: relative; width: 100%; height: 100%; color: #cfe8ff; font-family: 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif; }
.operations-widget .screen-panel { box-sizing: border-box; }
.operations-widget__kpi-title { position: absolute; top: 4px; left: 10px; z-index: 1; color: #cfe8ff; font-size: 12px; }
.operations-widget__empty { position: absolute; top: 45%; left: 0; width: 100%; text-align: center; color: #9ab8ca; pointer-events: none; }
.operations-widget__status { position: absolute; inset: 0; display: flex; justify-content: center; align-items: center; background: rgba(2,6,13,.9); color: #cfe8ff; }
</style>
