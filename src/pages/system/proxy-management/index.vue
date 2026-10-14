<template>
  <page-layout :noTitle="true" content-title="代理管理" content-description="查看代理组、在线状态、主机分配与采集负载。">
    <a-alert v-if="!pricingBasis.complete" class="proxy-error" type="warning" show-icon :message="$t('billingIncomplete')" />

    <div class="proxy-toolbar">
      <div class="last-success">{{ $t('lastSuccess') }}：{{ generatedAtLabel }}</div>
      <div>
        <span class="auto-refresh-label">{{ $t('autoRefresh') }}</span>
        <a-switch v-model="autoRefresh" @change="changeAutoRefresh" />
        <a-button type="primary" icon="reload" :loading="loading" @click="reload">{{ $t('refresh') }}</a-button>
      </div>
    </div>

    <div class="summary-grid">
      <a-card v-for="card in summaryCards" :key="card.key" :bordered="false" class="summary-card">
        <div class="summary-label">{{ card.label }}</div>
        <div class="summary-value" :class="card.tone">{{ card.value }}</div>
      </a-card>
    </div>

    <a-alert v-if="globalError" class="proxy-error" type="error" show-icon :message="globalError" />
    <a-alert
      v-for="instance in instanceProblems"
      :key="`instance-error-${instance.zid}`"
      class="proxy-error"
      :type="instance.available ? 'warning' : 'error'"
      show-icon
      :message="`${instance.name || instance.instance}：${instance.error || instance.warnings.join('；')}`"
    />

    <a-form-model layout="inline" class="proxy-filters smartops-filter-panel">
      <a-form-model-item :label="$t('instance')">
        <a-select v-model="filters.zid" allow-clear :placeholder="$t('allInstances')" style="width: 190px">
          <a-select-option v-for="instance in instanceOptions" :key="instance.zid" :value="instance.zid">
            {{ instance.name || instance.instance }}
          </a-select-option>
        </a-select>
      </a-form-model-item>
      <a-form-model-item :label="$t('group')">
        <a-select v-model="filters.proxy_group_key" allow-clear :placeholder="$t('allGroups')" style="width: 190px">
          <a-select-option v-for="group in groupOptions" :key="`${group.zid}:${group.proxy_groupid}`" :value="`${group.zid}:${group.proxy_groupid}`">
            {{ group.name }}（{{ group.instance_name || group.instance }}）
          </a-select-option>
        </a-select>
      </a-form-model-item>
      <a-form-model-item :label="$t('state')">
        <a-select v-model="filters.state" allow-clear :placeholder="$t('allStates')" style="width: 140px">
          <a-select-option value="online">{{ $t('online') }}</a-select-option>
          <a-select-option value="offline">{{ $t('offline') }}</a-select-option>
          <a-select-option value="unknown">{{ $t('unknown') }}</a-select-option>
          <a-select-option value="recovering">{{ $t('recovering') }}</a-select-option>
          <a-select-option value="degrading">{{ $t('degrading') }}</a-select-option>
        </a-select>
      </a-form-model-item>
      <a-form-model-item>
        <a-input v-model.trim="filters.keyword" allow-clear :placeholder="$t('keyword')" style="width: 190px" />
      </a-form-model-item>
      <a-form-model-item><a-button icon="undo" @click="resetFilters">{{ $t('reset') }}</a-button></a-form-model-item>
    </a-form-model>

    <a-card :title="$t('groupList')" :bordered="false" class="table-card">
      <a-table
        :loading="loading && snapshot.instances.length === 0"
        :columns="groupColumns"
        :data-source="visibleGroups"
        :row-key="record => `${record.zid}:${record.proxy_groupid}`"
        :locale="{emptyText: $t('empty')}"
        :pagination="{pageSize: 10, showSizeChanger: true}"
      >
        <template slot="instance" slot-scope="record">
          <div>{{ record.instance_name || record.instance }}</div><div class="secondary">监控源编号 {{ record.zid }}</div>
        </template>
        <template slot="groupState" slot-scope="record"><a-badge :status="badgeStatus(record.state_name)" :text="$t(record.state_name || 'unknown')" /></template>
        <template slot="onlineMinimum" slot-scope="record">{{ record.online_proxies }} / {{ record.minimum_online || '-' }}</template>
        <template slot="average" slot-scope="record">{{ Number(record.average_assigned_hosts || 0).toFixed(1) }}</template>
      </a-table>
    </a-card>

    <a-card :title="$t('proxyList')" :bordered="false" class="table-card">
      <a-table
        :loading="loading && snapshot.instances.length === 0"
        :columns="proxyColumns"
        :data-source="visibleProxies"
        :row-key="record => `${record.zid}:${record.proxyid}`"
        :locale="{emptyText: $t('empty')}"
        :pagination="{pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100']}"
        :scroll="{x: 1350}"
      >
        <template slot="instance" slot-scope="record">
          <div>{{ record.instance_name || record.instance }}</div><div class="secondary">监控源编号 {{ record.zid }}</div>
        </template>
        <template slot="group" slot-scope="record">{{ record.proxy_group_name || $t('standalone') }}</template>
        <template slot="proxyState" slot-scope="record"><a-badge :status="badgeStatus(record.state_name)" :text="$t(record.state_name || 'unknown')" /></template>
        <template slot="mode" slot-scope="record">{{ $t(record.operating_mode_name || 'active') }}</template>
        <template slot="lastAccess" slot-scope="record">{{ formatTime(record.last_access_at) }}</template>
        <template slot="version" slot-scope="record"><div>{{ record.version_name || '-' }}</div><a-tag :color="compatibilityColor(record.compatibility_name)">{{ $t(record.compatibility_name || 'undefined') }}</a-tag></template>
        <template slot="deviation" slot-scope="record"><span :class="deviationClass(record.load_deviation)">{{ formatDeviation(record.load_deviation) }}</span></template>
      </a-table>
    </a-card>
  </page-layout>
</template>

<script>
import moment from 'moment'
import PageLayout from '@/layouts/PageLayout'
import {getProxyManagement} from '@/services/zabbix'
import {
  emptySnapshot,
  filterGroupRows,
  filterProxyRows,
  flattenGroups,
  flattenProxies,
  formatDeviation,
  proxyPricingBasis,
  readBusinessSnapshot,
} from './model'

const REFRESH_INTERVAL_MS = 15000

export default {
  name: 'ProxyManagement',
  i18n: require('./i18n'),
  components: {PageLayout},
  data() {
    return {
      loading: false,
      autoRefresh: true,
      refreshTimer: null,
      globalError: '',
      snapshot: emptySnapshot(),
      filters: {zid: undefined, proxy_group_key: undefined, state: undefined, keyword: ''},
      groupColumns: [
        {title: this.$t('instance'), scopedSlots: {customRender: 'instance'}, width: 180},
        {title: this.$t('name'), dataIndex: 'name'},
        {title: this.$t('state'), scopedSlots: {customRender: 'groupState'}, width: 120},
        {title: this.$t('failoverDelay'), dataIndex: 'failover_delay', width: 130},
        {title: this.$t('onlineMinimum'), scopedSlots: {customRender: 'onlineMinimum'}, width: 130},
        {title: this.$t('members'), dataIndex: 'proxy_count', width: 90},
        {title: this.$t('assignedHosts'), dataIndex: 'assigned_hosts', width: 150},
        {title: this.$t('average'), scopedSlots: {customRender: 'average'}, width: 110},
      ],
      proxyColumns: [
        {title: this.$t('instance'), scopedSlots: {customRender: 'instance'}, width: 180},
        {title: this.$t('name'), dataIndex: 'name', width: 180},
        {title: this.$t('group'), scopedSlots: {customRender: 'group'}, width: 170},
        {title: this.$t('state'), scopedSlots: {customRender: 'proxyState'}, width: 100},
        {title: this.$t('mode'), scopedSlots: {customRender: 'mode'}, width: 90},
        {title: this.$t('lastAccess'), scopedSlots: {customRender: 'lastAccess'}, width: 170},
        {title: this.$t('version'), scopedSlots: {customRender: 'version'}, width: 125},
        {title: this.$t('assignedHosts'), dataIndex: 'assigned_host_count', width: 145},
        {title: this.$t('monitoredHosts'), dataIndex: 'monitored_host_count', width: 145},
        {title: this.$t('deviation'), scopedSlots: {customRender: 'deviation'}, width: 110},
      ],
    }
  },
  computed: {
    generatedAtLabel() { return this.snapshot.generated_at ? this.formatTime(this.snapshot.generated_at) : this.$t('never') },
    summaryCards() {
      const value = this.snapshot.summary
      return [
        {key: 'instances', label: this.$t('instances'), value: value.instance_count},
        {key: 'available', label: this.$t('availableInstances'), value: value.available_instance_count, tone: 'success'},
        {key: 'groups', label: this.$t('proxyGroups'), value: value.group_count},
        {key: 'proxies', label: this.$t('billableProxies'), value: this.pricingBasis.display, tone: this.pricingBasis.complete ? '' : 'danger'},
        {key: 'online', label: this.$t('online'), value: value.online_proxy_count, tone: 'success'},
        {key: 'offline', label: this.$t('offline'), value: value.offline_proxy_count, tone: value.offline_proxy_count ? 'danger' : ''},
      ]
    },
    pricingBasis() { return proxyPricingBasis(this.snapshot, Boolean(this.globalError)) },
    instanceOptions() { return this.snapshot.instances },
    groupOptions() { return flattenGroups(this.snapshot).filter((group) => !this.filters.zid || Number(group.zid) === Number(this.filters.zid)) },
    instanceProblems() { return this.snapshot.instances.filter((instance) => instance.error || instance.warnings.length) },
    visibleGroups() { return filterGroupRows(flattenGroups(this.snapshot), this.filters) },
    visibleProxies() { return filterProxyRows(flattenProxies(this.snapshot), this.filters) },
  },
  created() {
    this.reload()
    this.startRefreshTimer()
  },
  beforeDestroy() {
    this.stopRefreshTimer()
  },
  methods: {
    async reload() {
      if (this.loading) return
      this.loading = true
      try {
        const next = readBusinessSnapshot(await getProxyManagement())
        this.snapshot = next
        this.globalError = ''
      } catch (error) {
        this.globalError = error.message || '加载代理管理数据失败'
      } finally {
        this.loading = false
      }
    },
    startRefreshTimer() {
      this.stopRefreshTimer()
      if (this.autoRefresh) this.refreshTimer = window.setInterval(() => this.reload(), REFRESH_INTERVAL_MS)
    },
    stopRefreshTimer() {
      if (this.refreshTimer) window.clearInterval(this.refreshTimer)
      this.refreshTimer = null
    },
    changeAutoRefresh() { this.startRefreshTimer() },
    resetFilters() { this.filters = {zid: undefined, proxy_group_key: undefined, state: undefined, keyword: ''} },
    badgeStatus(state) { return {online: 'success', offline: 'error', recovering: 'processing', degrading: 'warning'}[state] || 'default' },
    compatibilityColor(value) { return {current: 'green', outdated: 'orange', unsupported: 'red'}[value] || 'default' },
    deviationClass(value) { return Number(value) > 0 ? 'load-high' : (Number(value) < 0 ? 'load-low' : '') },
    formatDeviation,
    formatTime(value) { return value ? moment(value).format('YYYY-MM-DD HH:mm:ss') : '-' },
  },
}
</script>

<style lang="less" scoped>
.proxy-error, .proxy-filters, .table-card { margin-bottom: 16px; }
.proxy-toolbar { display: flex; justify-content: space-between; align-items: center; margin: 16px 0; }
.last-success, .secondary { color: rgba(0, 0, 0, .45); font-size: 12px; }
.auto-refresh-label { margin-right: 8px; }
.proxy-toolbar .ant-switch { margin-right: 12px; }
.summary-grid { display: grid; grid-template-columns: repeat(6, minmax(120px, 1fr)); gap: 12px; margin-bottom: 16px; }
.summary-card { text-align: center; }
.summary-label { color: rgba(0, 0, 0, .45); }
.summary-value { margin-top: 4px; font-size: 28px; font-weight: 600; }
.summary-value.success, .load-low { color: #52c41a; }
.summary-value.danger, .load-high { color: #f5222d; }
.proxy-filters .ant-form-item { margin-bottom: 10px; }
@media (max-width: 1100px) { .summary-grid { grid-template-columns: repeat(3, 1fr); } }
</style>
