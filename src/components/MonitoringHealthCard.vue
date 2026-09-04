<template>
  <a-card title="监控状态" :body-style="{ padding: '12px' }" class="monitoring-health-card">
    <a-descriptions bordered size="small" :column="{ xxl: 3, xl: 3, lg: 3, md: 1, sm: 1 }">
      <a-descriptions-item label="采集健康">
        <a-tag :color="healthMeta.color">{{ normalizedHealth.label }}</a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="配置状态">
        <a-tag :color="configurationMeta.color">{{ configuration.label }}</a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="判定依据">
        {{ normalizedHealth.summary }}
      </a-descriptions-item>
    </a-descriptions>
    <a-alert
      v-if="reasonLabels.length"
      :message="reasonLabels.join('；')"
      type="warning"
      show-icon
      style="margin-top: 12px;"
    />
  </a-card>
</template>

<script>
const monitoringHealthPolicy = require('@/utils/monitoring-health')

export default {
  name: 'MonitoringHealthCard',
  props: {
    health: {
      type: Object,
      default: () => ({}),
    },
  },
  computed: {
    normalizedHealth() {
      return monitoringHealthPolicy.normalizeMonitoringHealth(this.health)
    },
    healthMeta() {
      return monitoringHealthPolicy.monitoringHealthMeta(this.normalizedHealth)
    },
    configuration() {
      return this.normalizedHealth.configuration
    },
    configurationMeta() {
      return monitoringHealthPolicy.monitoringConfigurationMeta(this.configuration)
    },
    reasonLabels() {
      return monitoringHealthPolicy.monitoringReasonLabels(this.normalizedHealth)
    },
  },
}
</script>

<style lang="less" scoped>
.monitoring-health-card {
  margin-bottom: 12px;
}
</style>
