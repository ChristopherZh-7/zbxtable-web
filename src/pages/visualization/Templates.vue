<template>
  <page-layout :noTitle="true">
    <div class="visualization-templates">
      <div class="content-page-header">
        <div>
          <h2>五类展示视图</h2>
        </div>
        <a-button :loading="loading" @click="loadAll"><a-icon type="reload" /> 刷新</a-button>
      </div>

      <div class="template-tabs">
        <a-radio-group v-model="active" button-style="solid">
          <a-radio-button v-for="item in templates" :key="item.code" :value="item.code">
            <a-icon :type="item.icon" /> {{ item.name }}
          </a-radio-button>
        </a-radio-group>
      </div>

      <div v-if="loadErrorLabels.length" class="load-error" role="alert">数据加载失败：{{ loadErrorLabels.join('、') }}。请重试刷新。</div>

      <section class="view-shell">
        <div class="view-title">
          <div><h3>{{ activeTemplate.name }}模板</h3><p>{{ activeTemplate.subtitle }}</p></div>
          <span>最近成功刷新：{{ updatedAt || '尚未刷新' }}</span>
        </div>

        <a-row :gutter="16" class="metric-grid">
          <a-col v-for="metric in activeMetrics" :key="metric.label" :xs="12" :md="6">
            <div class="metric-card"><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong><small>{{ metric.unit || '' }}</small></div>
          </a-col>
        </a-row>

        <div v-if="active === 'network'" class="data-section">
          <h4>网络资源与出口</h4>
          <div v-if="loadErrors.discovery" class="empty-state">网络资源加载失败</div>
          <template v-else>
          <a-table :columns="networkColumns" :data-source="networkRows" row-key="host_id" :pagination="false" size="small">
            <span slot="address" slot-scope="record">{{ record.address || '未采集' }}</span>
          </a-table>
          <div v-if="!networkRows.length" class="empty-state">暂无网络资源发现数据</div>
          </template>
        </div>

        <div v-else-if="active === 'system'" class="data-section">
          <h4>资产类型分布</h4>
          <div v-if="loadErrors.info" class="empty-state">系统资产加载失败</div>
          <div v-else-if="assetCounts.length" class="bar-list">
            <div v-for="item in assetCounts" :key="item.type_code"><span>{{ item.name }}</span><b>{{ item.count || 0 }}</b></div>
          </div>
          <div v-else class="empty-state">暂无系统资产数据</div>
        </div>

        <div v-else-if="active === 'application'" class="data-section">
          <h4>应用活动告警</h4>
          <div v-if="loadErrors.alarms" class="empty-state">活动告警加载失败</div>
          <template v-else>
          <a-table :columns="alarmColumns" :data-source="alarmRows" :row-key="alarmKey" :pagination="false" size="small" />
          <div v-if="!alarmRows.length" class="empty-state">暂无活动告警</div>
          </template>
        </div>

        <div v-else-if="active === 'business'" class="data-section business-section">
          <h4>业务健康口径</h4>
          <div class="health-score"><strong>{{ loadErrors.alarms ? '—' : businessHealth }}</strong><span>/ 100</span></div>
          <p>评分：100 − 活动告警数×2 − 严重告警数×8，最低为 0。</p>
          <div v-if="loadErrors.analysis" class="empty-state">告警分析加载失败</div>
          <div v-else class="severity-list"><a-tag v-for="item in severityRows" :key="item.name" color="orange">{{ item.name }} {{ item.value }}</a-tag></div>
        </div>

        <div v-else class="data-section comprehensive-grid">
          <div><h4>资源总览</h4><strong>{{ loadErrors.info ? '—' : totalAssets }}</strong><span> 台当前租户资产</span></div>
          <div><h4>活动告警</h4><strong>{{ loadErrors.alarms ? '—' : activeAlarms }}</strong><span> 条</span></div>
          <div><h4>业务健康</h4><strong>{{ loadErrors.alarms ? '—' : businessHealth }}</strong><span> 分</span></div>
          <div><h4>已发现类别</h4><strong>{{ loadErrors.discovery ? '—' : discoveredCategories }}</strong><span> / 5</span></div>
        </div>
      </section>
    </div>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import {alarmAnalysis, indexEgress, indexInfo, indexTrigger, resourceDiscoveryOverview} from '@/services/admin'

const TEMPLATES = [
  {code: 'network', name: '网络', icon: 'global', subtitle: '网络资源、地址与出口链路', sources: ['/v1/resource-discovery', '/v1/index/egress']},
  {code: 'system', name: '系统', icon: 'hdd', subtitle: '系统资产规模与类型分布', sources: ['/v1/index/baseinfo']},
  {code: 'application', name: '应用', icon: 'appstore', subtitle: '活动告警与受影响对象', sources: ['/v1/trigger', '/v1/alarm/analysis']},
  {code: 'business', name: '业务', icon: 'line-chart', subtitle: '基于真实告警透明推导业务健康', sources: ['/v1/trigger', '/v1/alarm/analysis']},
  {code: 'comprehensive', name: '综合运行', icon: 'dashboard', subtitle: '资源、网络、应用和业务统一总览', sources: ['/v1/index/baseinfo', '/v1/resource-discovery', '/v1/trigger', '/v1/alarm/analysis']},
]

export default {
  name: 'VisualizationTemplates',
  components: {PageLayout},
  data() {
    return {
      active: 'network', loading: false, updatedAt: '', loadErrors: {}, templates: TEMPLATES,
      info: {}, discovery: {profiles: [], resources: [], unmatched_host_count: 0},
      alarms: [], analysis: {level_count: [], host: [], host_count: []}, egress: [],
      networkColumns: [
        {title: '网络资源', dataIndex: 'host_name'},
        {title: '地址', key: 'address', scopedSlots: {customRender: 'address'}},
        {title: '产品', dataIndex: 'product'},
        {title: '模板证据', dataIndex: 'template_name'},
      ],
      alarmColumns: [
        {title: '告警对象', dataIndex: 'name'},
        {title: '告警内容', dataIndex: 'lasteventname'},
        {title: '级别', dataIndex: 'severity'},
        {title: '实例', dataIndex: 'instance_name'},
      ],
    }
  },
  computed: {
    loadErrorLabels() {
      const labels = {info: '系统资产', discovery: '资源发现', alarms: '活动告警', analysis: '告警分析', egress: '出口流量'}
      return Object.keys(this.loadErrors).map(key => labels[key])
    },
    activeTemplate() { return this.templates.find(item => item.code === this.active) || this.templates[0] },
    assetCounts() { return Array.isArray(this.info.asset_type_counts) ? this.info.asset_type_counts : [] },
    totalAssets() {
      if (this.assetCounts.length) return this.assetCounts.reduce((sum, item) => sum + (Number(item.count) || 0), 0)
      return Number(this.info.total_count) || 0
    },
    networkRows() { return (this.discovery.resources || []).filter(item => item.category_code === 'network') },
    alarmRows() { return this.alarms.slice(0, 8) },
    activeAlarms() { return this.alarms.length },
    criticalAlarms() { return this.alarms.filter(item => Number(item.severity) >= 4).length },
    affectedHosts() { return new Set(this.alarms.map(item => item.hostid || item.hostname).filter(Boolean)).size },
    discoveredCategories() { return (this.discovery.profiles || []).filter(item => Number(item.count) > 0).length },
    businessHealth() { return Math.max(0, 100 - this.activeAlarms * 2 - this.criticalAlarms * 8) },
    severityRows() { return (this.analysis.level_count || []).map(item => ({name: item.name || item.level || '未知', value: Number(item.value || item.count) || 0})) },
    activeMetrics() {
      const metrics = {
        network: [
          {label: '网络资源', value: this.networkRows.length, unit: '台'},
          {label: '出口链路', value: this.egress.length, unit: '条'},
          {label: '未匹配主机', value: Number(this.discovery.unmatched_host_count) || 0, unit: '台'},
          {label: '网络模板', value: 1, unit: '套'},
        ],
        system: [
          {label: '系统资产', value: this.totalAssets, unit: '台'},
          {label: 'Linux', value: Number(this.info.lin_count) || 0, unit: '台'},
          {label: 'Windows', value: Number(this.info.win_count) || 0, unit: '台'},
          {label: '资产类型', value: this.assetCounts.length, unit: '类'},
        ],
        application: [
          {label: '活动告警', value: this.activeAlarms, unit: '条'},
          {label: '严重告警', value: this.criticalAlarms, unit: '条'},
          {label: '受影响对象', value: this.affectedHosts, unit: '个'},
          {label: '应用模板', value: 1, unit: '套'},
        ],
        business: [
          {label: '业务健康', value: this.businessHealth, unit: '分'},
          {label: '告警扣分', value: 100 - this.businessHealth, unit: '分'},
          {label: '严重告警', value: this.criticalAlarms, unit: '条'},
          {label: '业务模板', value: 1, unit: '套'},
        ],
        comprehensive: [
          {label: '资产总数', value: this.totalAssets, unit: '台'},
          {label: '活动告警', value: this.activeAlarms, unit: '条'},
          {label: '业务健康', value: this.businessHealth, unit: '分'},
          {label: '发现类别', value: this.discoveredCategories, unit: '类'},
        ],
      }
      const sources = {
        network: ['discovery', 'egress', 'discovery', null],
        system: ['info', 'info', 'info', 'info'],
        application: ['alarms', 'alarms', 'alarms', null],
        business: ['alarms', 'alarms', 'alarms', null],
        comprehensive: ['info', 'alarms', 'alarms', 'discovery'],
      }
      return (metrics[this.active] || []).map((metric, index) => ({
        ...metric, value: this.loadErrors[sources[this.active][index]] ? '—' : metric.value,
      }))
    },
  },
  created() { this.loadAll() },
  methods: {
    unwrap(response, fallback) {
      const payload = response && response.data
      if (!payload || payload.code !== 200) throw new Error('数据加载失败')
      return payload.data || fallback
    },
    async loadAll() {
      this.loading = true
      try {
        const results = await Promise.allSettled([
          () => indexInfo(), () => resourceDiscoveryOverview(), () => indexTrigger(), () => alarmAnalysis({}), () => indexEgress(),
        ].map(request => Promise.resolve().then(request)))
        const errors = {}
        const update = (index, key, fallback, apply) => {
          try {
            if (results[index].status !== 'fulfilled') throw new Error('数据加载失败')
            apply(this.unwrap(results[index].value, fallback))
          } catch (error) { errors[key] = true }
        }
        update(0, 'info', {}, data => { this.info = data })
        update(1, 'discovery', {profiles: [], resources: [], unmatched_host_count: 0}, data => { this.discovery = data })
        update(2, 'alarms', {items: []}, data => { this.alarms = Array.isArray(data.items) ? data.items : [] })
        update(3, 'analysis', {level_count: [], host: [], host_count: []}, data => { this.analysis = data })
        update(4, 'egress', [], data => { this.egress = Array.isArray(data) ? data : (data && typeof data === 'object' ? [data] : []) })
        this.loadErrors = errors
        if (!Object.keys(errors).length) this.updatedAt = new Date().toLocaleString('zh-CN', {hour12: false})
      } finally { this.loading = false }
    },
    alarmKey(record, index) { return String(record.eventid || record.triggerid || index) },
  },
}
</script>

<style scoped>
.visualization-templates { padding: 0 4px; }
.content-page-header, .view-title { display: flex; align-items: flex-start; justify-content: space-between; }
.content-page-header { margin-bottom: 16px; }
.content-page-header h2 { margin: 0 0 6px; font-size: 24px; }
.content-page-header p, .view-title p, .view-title span { color: rgba(0,0,0,.45); }
.template-tabs { margin-bottom: 16px; }
.load-error { margin-bottom: 16px; padding: 12px; color: #a8071a; background: #fff1f0; border: 1px solid #ffa39e; border-radius: 4px; }
.template-tabs { overflow-x: auto; white-space: nowrap; }
.view-shell { min-height: 560px; padding: 22px; border: 1px solid #e8edf5; border-radius: 10px; background: linear-gradient(145deg,#fff,#f6f9ff); }
.view-title h3 { margin: 0; font-size: 22px; }
.view-title p { margin: 5px 0 0; }
.source-strip > span { margin-right: 6px; font-weight: 600; }
.metric-grid { margin-bottom: 18px; }
.metric-grid .ant-col { margin-bottom: 12px; }
.metric-card { height: 112px; padding: 18px; border: 1px solid #e8edf5; border-radius: 8px; background: #fff; box-shadow: 0 6px 18px rgba(31,72,126,.06); }
.metric-card span { display: block; color: rgba(0,0,0,.45); }
.metric-card strong { margin-right: 6px; color: #1677ff; font-size: 34px; line-height: 52px; }
.metric-card small { color: rgba(0,0,0,.45); }
.data-section { min-height: 260px; padding: 18px; border: 1px solid #edf0f5; border-radius: 8px; background: #fff; }
.data-section h4 { margin-bottom: 14px; font-size: 16px; }
.empty-state { padding: 52px 0; color: rgba(0,0,0,.35); text-align: center; }
.bar-list > div { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 10px 12px; background: #f5f8fc; }
.health-score { display: flex; align-items: baseline; color: #52c41a; }
.health-score strong { font-size: 72px; line-height: 82px; }
.business-section p { max-width: 760px; color: rgba(0,0,0,.55); }
.comprehensive-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 14px; }
.comprehensive-grid > div { padding: 22px; background: #f5f8fc; }
.comprehensive-grid strong { color: #1677ff; font-size: 36px; }
@media (max-width: 768px) { .content-page-header, .view-title { display: block; } .content-page-header button { margin-top: 10px; } .comprehensive-grid { grid-template-columns: 1fr; } }
</style>
