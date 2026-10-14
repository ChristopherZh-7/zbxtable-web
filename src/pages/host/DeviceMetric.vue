<template>
  <a-tooltip :title="tooltip" placement="topLeft">
    <div v-if="kind === 'uptime'" class="device-uptime" :class="{'is-empty': empty}">
      <a-icon type="clock-circle" aria-hidden="true" />
      <span>{{ display }}</span>
    </div>
    <div v-else class="device-utilization" :class="[kind, {'is-empty': empty}]">
      <div class="metric-value">
        <template v-if="!empty"><strong>{{ display }}</strong><span class="metric-unit">%</span></template>
        <template v-else><span class="metric-dash">—</span><span class="metric-empty-label">暂无数据</span></template>
      </div>
      <div
        class="metric-track"
        :role="empty ? undefined : 'progressbar'"
        :aria-label="kind === 'cpu' ? 'CPU使用率' : '内存使用率'"
        :aria-valuenow="empty ? undefined : percent"
        :aria-valuemin="empty ? undefined : 0"
        :aria-valuemax="empty ? undefined : 100"
      >
        <span v-if="!empty" class="metric-fill" :style="{width: percent + '%'}" />
      </div>
    </div>
  </a-tooltip>
</template>

<script>
const {metricText, utilization, utilizationLabel, uptimeLabel} = require('./device-metrics')

export default {
  name: 'DeviceMetric',
  props: {
    kind: {type: String, required: true},
    value: {type: [String, Number], default: null},
  },
  computed: {
    percent() { return utilization(this.value) },
    display() { return this.kind === 'uptime' ? uptimeLabel(this.value) : utilizationLabel(this.value) },
    empty() { return this.display === '暂无数据' },
    tooltip() {
      if (this.empty) return '当前设备暂未返回此项指标'
      return this.kind === 'uptime' ? metricText(this.value) : `${this.percent}%`
    },
  },
}
</script>

<style lang="less" scoped>
.device-uptime {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #314b66;
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  .anticon { color: #7b95ad; font-size: 15px; flex-shrink: 0; }
  span { overflow: hidden; text-overflow: ellipsis; }
}
.device-utilization {
  width: 100%;
  max-width: 156px;
  padding: 4px 0;
  font-variant-numeric: tabular-nums;
}
.metric-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 7px;
  line-height: 20px;
  white-space: nowrap;

  strong { font-size: 17px; font-weight: 600; color: #243e59; }
}
.metric-unit { font-size: 12px; color: #6e8196; }
.metric-track { height: 5px; overflow: hidden; border-radius: 3px; background: #eaf0f6; }
.metric-fill { display: block; height: 100%; border-radius: inherit; background: #3b7fc4; }
.memory .metric-fill { background: #4d958d; }
.metric-dash { color: #9aabbb; font-size: 16px; }
.metric-empty-label { color: #8292a3; font-size: 12px; margin-left: 3px; }
.is-empty { color: #8292a3; font-weight: 400; }
.is-empty .metric-track { background: #eff3f7; }
</style>
