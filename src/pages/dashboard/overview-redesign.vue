<template>
  <page-layout :noTitle="true">
    <div class="overview-container">
      <div class="smartops-page-heading overview-heading">
        <div>
          <p class="overview-kicker">运行脉络</p>
          <h1>资产运行总览</h1>
        </div>
        <div class="smartops-heading-metric">纳管资产<strong>{{ totalAssets }}</strong></div>
      </div>

      <section class="smartops-signal-rail" aria-label="运行指标">
        <div
          v-for="metric in signalMetrics"
          :key="metric.key"
          class="signal-metric"
          :class="`is-${metric.tone}`"
        >
          <div class="signal-index">{{ metric.index }}</div>
          <div class="signal-content">
            <span>{{ metric.label }}</span>
            <strong data-smartops-mono>{{ metric.value }}</strong>
          </div>
          <i class="signal-node" aria-hidden="true"></i>
        </div>
      </section>

      <section class="asset-status-panel">
        <header class="panel-heading">
          <div>
            <span class="smartops-section-label">资产状态分布</span>
            <p>方块代表实际纳管资产，颜色与形状共同表达运行状态。</p>
          </div>
          <div class="status-legend" aria-label="状态图例">
            <span><i class="legend-node healthy"></i>采集健康</span>
            <span><i class="legend-node warning"></i>等待 / 降级</span>
            <span><i class="legend-node error"></i>监控不可用</span>
            <span><i class="legend-node unknown"></i>未知 / 停用</span>
          </div>
        </header>

        <a-spin :spinning="loading">
          <div v-if="sections.length" class="host-sections">
            <article v-for="section in sections" :key="section.type_code" class="host-section">
              <header class="section-header">
                <div class="section-title-group">
                  <span class="section-icon-box"><a-icon :type="getSectionIcon(section.type_code)" /></span>
                  <div>
                    <h2>{{ section.name }}</h2>
                    <p>
                      共 <b data-smartops-mono>{{ section.hosts.length }}</b> 台，
                      采集健康 <b data-smartops-mono>{{ getHealthyCount(section.hosts) }}</b> 台，
                      关注 <b data-smartops-mono>{{ getAttentionCount(section.hosts) }}</b> 台
                    </p>
                  </div>
                </div>
                <span v-if="getAlarmCount(section.hosts)" class="section-alarm">
                  {{ getAlarmCount(section.hosts) }} 台受告警影响
                </span>
              </header>

              <div v-if="section.hosts.length" class="host-grid">
                <a-popover
                  v-for="(item, index) in section.hosts"
                  :key="`${section.type_code}-${index}`"
                  :title="$t('title_device_info')"
                  placement="top"
                >
                  <template slot="content">
                    <div class="popover-content">
                      <p><strong>{{ $t('label_hostname') }}：</strong>{{ item.name }}</p>
                      <p v-if="item.instance_name"><strong>{{ $t('label_instance_name') }}：</strong>{{ item.instance_name }}</p>
                      <p><strong>{{ $t('label_IP') }}：</strong><span data-smartops-mono>{{ item.interfaces }}</span></p>
                      <p><strong>采集健康：</strong>{{ getStatusLabel(item) }}</p>
                      <p class="health-summary">{{ collectionHealth(item).summary }}</p>
                      <p><strong>{{ $t('label_cpu_usage') }}：</strong>{{ item.cpu_utilization }}</p>
                      <p><strong>{{ $t('label_memory_usage') }}：</strong>{{ item.memory_utilization }}</p>
                      <p><strong>{{ $t('label_num_errors') }}：</strong>{{ item.error }}</p>
                      <p><strong>{{ $t('label_num_alarms') }}：</strong>{{ item.alarm }}</p>
                    </div>
                  </template>
                  <button
                    type="button"
                    class="host-node"
                    :class="getStatusClass(item)"
                    :aria-label="`${item.name || '资产'}，${getStatusLabel(item)}`"
                  ></button>
                </a-popover>
              </div>
              <a-empty v-else :image="simpleImage" description="暂无资产" class="section-empty" />
            </article>
          </div>
          <a-empty v-else-if="!loading" description="暂无资产运行数据" />
        </a-spin>
      </section>
    </div>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import { Empty } from 'ant-design-vue'
import { indexOverview, getAssetTypes } from '@/services/admin'

const monitoringHealthPolicy = require('@/utils/monitoring-health')
const {unclassifiedMonitoringHosts} = require('../host/all-monitoring-devices')

export default {
  i18n: require('./i18n'),
  name: 'AssetOverview',
  components: { PageLayout },
  data() {
    return {
      sections: [],
      assetTypes: [],
      loading: false,
      simpleImage: Empty.PRESENTED_IMAGE_SIMPLE
    }
  },
  computed: {
    allHosts() {
      return this.sections.reduce((hosts, section) => hosts.concat(section.hosts || []), [])
    },
    totalAssets() {
      return this.allHosts.length
    },
    totalHealthy() {
      return this.getHealthyCount(this.allHosts)
    },
    totalAffected() {
      return this.getAlarmCount(this.allHosts)
    },
    totalAlarms() {
      return this.allHosts.reduce((total, host) => total + (Number(host.alarm) || 0), 0)
    },
    totalUnavailable() {
      return this.getErrorCount(this.allHosts)
    },
    signalMetrics() {
      return [
        { key: 'assets', index: '01', label: '资产总数', value: this.totalAssets, tone: 'blue' },
        { key: 'healthy', index: '02', label: '采集健康', value: this.totalHealthy, tone: 'healthy' },
        { key: 'affected', index: '03', label: '受告警影响', value: this.totalAffected, tone: this.totalAffected ? 'warning' : 'muted' },
        { key: 'alarms', index: '04', label: '告警总数', value: this.totalAlarms, tone: this.totalAlarms ? 'warning' : 'muted' },
        { key: 'unavailable', index: '05', label: '监控不可用', value: this.totalUnavailable, tone: this.totalUnavailable ? 'error' : 'muted' }
      ]
    }
  },
  created() {
    this.init()
  },
  methods: {
    getPrimaryName(name) {
      if (!name) return ''
      return String(name).replace(/\s*[（(][^（）()]*[）)]\s*$/u, '').trim()
    },
    async init() {
      this.loading = true
      try {
        const [assetTypeResponse, overviewResponse] = await Promise.all([getAssetTypes(), indexOverview()])
        const assetTypeBusiness = assetTypeResponse && assetTypeResponse.data ? assetTypeResponse.data : assetTypeResponse
        if (assetTypeBusiness && assetTypeBusiness.code === 200) {
          this.assetTypes = assetTypeBusiness.data || []
        }
        const overviewBusiness = overviewResponse && overviewResponse.data ? overviewResponse.data : overviewResponse
        if (overviewBusiness && overviewBusiness.code === 200) {
          const dataMap = overviewBusiness.data || {}
          this.sections = this.assetTypes.map(assetType => ({
            name: this.getPrimaryName(assetType.name),
            type_code: assetType.type_code,
            icon: assetType.icon || '',
            hosts: dataMap[assetType.type_code] || []
          }))
          const unclassified = unclassifiedMonitoringHosts(this.assetTypes, dataMap)
          if (unclassified.length) {
            this.sections.push({name: '未分类监控设备', type_code: '__unclassified__', icon: 'database', hosts: unclassified})
          }
        }
      } finally {
        this.loading = false
      }
    },
    getSectionIcon(typeCode) {
      const section = this.sections.find(item => item.type_code === typeCode)
      if (section && section.icon) return section.icon
      const assetType = this.assetTypes.find(item => item.type_code === typeCode)
      if (assetType && assetType.icon) return assetType.icon
      const fallback = { VM_LIN: 'desktop', VM_WIN: 'windows', HW_NET: 'global', HW_SRV: 'database' }
      return fallback[typeCode] || 'folder'
    },
    getStatusClass(item) {
      const state = this.collectionHealth(item).state
      if (state === 'healthy') return 'status-healthy'
      if (state === 'waiting_first_data' || state === 'degraded') return 'status-warning'
      if (state === 'unavailable') return 'status-error'
      return 'status-unknown'
    },
    getStatusLabel(item) {
      return this.collectionHealth(item).label
    },
    collectionHealth(item) {
      return monitoringHealthPolicy.normalizeMonitoringHealth(item && item.monitoring_health)
    },
    getHealthyCount(hosts) {
      return (hosts || []).filter(host => this.collectionHealth(host).state === 'healthy').length
    },
    getWarningCount(hosts) {
      return (hosts || []).filter(host => ['waiting_first_data', 'degraded'].includes(this.collectionHealth(host).state)).length
    },
    getErrorCount(hosts) {
      return (hosts || []).filter(host => this.collectionHealth(host).state === 'unavailable').length
    },
    getAttentionCount(hosts) {
      return (hosts || []).filter(host => !['healthy', 'disabled'].includes(this.collectionHealth(host).state)).length
    },
    getAlarmCount(hosts) {
      return (hosts || []).filter(host => Number(host.alarm) > 0).length
    }
  }
}
</script>

<style lang="less" scoped>
.overview-container { min-height: calc(100vh - 104px); padding: 2px 0 24px; }
.overview-heading { margin-bottom: 14px; }
.overview-kicker { margin: 0 0 4px !important; color: #1b5a96 !important; font-size: 11px !important; font-weight: 700; letter-spacing: .24em; }
.smartops-signal-rail { position: relative; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin-bottom: 14px; border: 1px solid #dce4ed; background: #fff; }
.smartops-signal-rail::before { position: absolute; top: 50%; right: 6%; left: 6%; height: 1px; background: #cbd7e3; content: ''; }
.signal-metric { position: relative; z-index: 1; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; min-height: 102px; padding: 18px; border-right: 1px solid #e3e9ef; background: rgba(255, 255, 255, .92); }
.signal-metric:last-child { border-right: 0; }
.signal-index { color: #8a98a8; font-family: "SFMono-Regular", Consolas, monospace; font-size: 10px; }
.signal-content { display: flex; min-width: 0; flex-direction: column; }
.signal-content span { color: #68778a; font-size: 12px; }
.signal-content strong { margin-top: 4px; color: #0a1f44; font-size: 28px; font-weight: 650; line-height: 1; }
.signal-node { width: 10px; height: 10px; border: 2px solid #1b5a96; background: #fff; transform: rotate(45deg); }
.is-healthy .signal-node { border-color: #2f6f62; background: #2f6f62; }
.is-warning .signal-node { border-color: #c68a2b; background: #c68a2b; }
.is-error .signal-node { border-color: #c94b4b; background: #c94b4b; }
.is-muted .signal-node { border-color: #9aa8b6; }
.asset-status-panel { border: 1px solid #dce4ed; background: #fff; }
.panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 17px 20px; border-bottom: 1px solid #dce4ed; }
.panel-heading p { margin: 5px 0 0; color: #758497; font-size: 12px; }
.status-legend { display: flex; flex-wrap: wrap; gap: 18px; color: #637388; font-size: 11px; }
.status-legend span { display: inline-flex; align-items: center; gap: 7px; }
.legend-node { width: 8px; height: 8px; border: 1px solid currentColor; background: currentColor; }
.legend-node.healthy { color: #2f6f62; }
.legend-node.warning { color: #c68a2b; transform: rotate(45deg); }
.legend-node.error { color: #c94b4b; border-radius: 50%; }
.legend-node.unknown { color: #a6b2bf; background: transparent; }
.host-sections { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.host-section { min-height: 210px; padding: 18px 20px 22px; border-right: 1px solid #e2e8ef; border-bottom: 1px solid #e2e8ef; }
.host-section:nth-child(2n) { border-right: 0; }
.section-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.section-title-group { display: flex; align-items: center; gap: 12px; }
.section-icon-box { display: grid; width: 34px; height: 34px; flex: 0 0 34px; place-items: center; border: 1px solid #cbd9e6; background: #eef4fa; color: #1b5a96; }
.section-title-group h2 { margin: 0; color: #0a1f44; font-size: 15px; font-weight: 650; }
.section-title-group p { margin: 4px 0 0; color: #758497; font-size: 11px; }
.section-title-group b { color: #334b65; font-weight: 650; }
.section-alarm { padding: 4px 7px; border-left: 2px solid #c68a2b; background: #fbf5e9; color: #8b621f; font-size: 11px; white-space: nowrap; }
.host-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(24px, 1fr)); gap: 11px; }
.host-node { position: relative; display: block; width: 22px; height: 22px; padding: 0; border: 1px solid transparent; border-radius: 1px; outline: none; cursor: pointer; transition: border-color .15s ease, transform .15s ease; }
.host-node:hover, .host-node:focus-visible { border-color: #0a1f44; transform: scale(1.08); }
.host-node::after { position: absolute; inset: 6px; border: 1px solid rgba(255, 255, 255, .58); content: ''; }
.host-node.status-healthy { background: #2f6f62; }
.host-node.status-warning { background: #c68a2b; transform: rotate(45deg) scale(.82); }
.host-node.status-warning:hover, .host-node.status-warning:focus-visible { transform: rotate(45deg) scale(.9); }
.host-node.status-error { border-radius: 50%; background: #c94b4b; }
.host-node.status-unknown { border-color: #a6b2bf; background: #fff; }
.host-node.status-unknown::after { border-color: #a6b2bf; }
.popover-content p { margin: 6px 0; color: #43576d; font-size: 12px; }
.popover-content strong { color: #0a1f44; font-weight: 650; }
.popover-content .health-summary { max-width: 320px; color: #758497; line-height: 1.5; }
.section-empty { margin: 26px 0 10px; }
@media (max-width: 1180px) {
  .smartops-signal-rail { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .signal-metric:nth-child(3) { border-right: 0; }
  .signal-metric:nth-child(n + 4) { border-top: 1px solid #e3e9ef; }
  .smartops-signal-rail::before { display: none; }
}
@media (max-width: 760px) {
  .smartops-signal-rail { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .signal-metric, .signal-metric:nth-child(3) { min-height: 86px; border-right: 1px solid #e3e9ef; border-top: 1px solid #e3e9ef; }
  .signal-metric:nth-child(odd) { border-left: 0; }
  .signal-metric:nth-child(even) { border-right: 0; }
  .signal-content strong { font-size: 24px; }
  .host-sections { grid-template-columns: 1fr; }
  .host-section { border-right: 0; }
  .panel-heading { align-items: flex-start; flex-direction: column; }
  .section-header { align-items: flex-start; flex-direction: column; }
}
</style>
