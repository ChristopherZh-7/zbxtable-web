<template>
  <page-layout :noTitle="true" content-title="操作审计" content-description="按操作人、资源和时间追溯系统操作记录。">

    <a-form-model layout="inline" class="audit-filters smartops-filter-panel">
      <a-form-model-item label="操作人">
        <a-input v-model.trim="filters.actor" allow-clear placeholder="精确用户名" />
      </a-form-model-item>
      <a-form-model-item label="租户">
        <a-select v-model="filters.tenant_id" allow-clear placeholder="全部租户" style="width: 170px">
          <a-select-option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
            {{ tenant.name }}
          </a-select-option>
        </a-select>
      </a-form-model-item>
      <a-form-model-item label="资源">
        <a-select v-model="filters.resource" allow-clear show-search placeholder="全部资源" style="width: 190px">
          <a-select-option v-for="resource in resources" :key="resource" :value="resource">{{ resource }}</a-select-option>
        </a-select>
      </a-form-model-item>
      <a-form-model-item label="动作">
        <a-select v-model="filters.action" allow-clear placeholder="全部动作" style="width: 120px">
          <a-select-option v-for="(label, key) in actionLabels" :key="key" :value="key">{{ label }}</a-select-option>
        </a-select>
      </a-form-model-item>
      <a-form-model-item label="结果">
        <a-select v-model="filters.result" allow-clear placeholder="全部结果" style="width: 120px">
          <a-select-option v-for="(label, key) in resultLabels" :key="key" :value="key">{{ label }}</a-select-option>
        </a-select>
      </a-form-model-item>
      <a-form-model-item label="时间">
        <a-range-picker
          v-model="filters.range"
          show-time
          format="YYYY-MM-DD HH:mm:ss"
          :allow-clear="false"
        />
      </a-form-model-item>
      <a-form-model-item>
        <a-button type="primary" icon="search" @click="search">查询</a-button>
        <a-button icon="reload" @click="reset">重置</a-button>
      </a-form-model-item>
    </a-form-model>

    <a-table
      :loading="loading"
      :columns="columns"
      :data-source="logs"
      :row-key="record => record.id"
      :pagination="pagination"
      :scroll="{x: 1380}"
      @change="changeTable"
    >
      <template slot="actor" slot-scope="record">
        <div>{{ record.actor_username || '-' }}</div>
        <div class="secondary">{{ roleLabel(record) }}</div>
      </template>
      <template slot="tenant" slot-scope="record">
        <div>{{ record.tenant_name || '平台范围' }}</div>
        <div v-if="record.tenant_code" class="secondary">{{ record.tenant_code }}</div>
      </template>
      <template slot="action" slot-scope="record">
        <a-tag color="blue">{{ actionLabels[record.action] || record.action }}</a-tag>
      </template>
      <template slot="object" slot-scope="record">
        <div>{{ record.resource }}</div>
        <div v-if="record.object_id" class="secondary">ID: {{ record.object_id }}</div>
      </template>
      <template slot="result" slot-scope="record">
        <a-badge :status="resultStatus(record.result)" :text="resultLabels[record.result] || record.result" />
        <div v-if="record.reason_code" class="secondary">{{ record.reason_code }}</div>
      </template>
      <template slot="time" slot-scope="record">
        {{ formatTime(record.created_at) }}
      </template>
      <template slot="request" slot-scope="record">
        <a-tooltip :title="record.request_id">
          <span class="request-id">{{ record.request_id }}</span>
        </a-tooltip>
      </template>
    </a-table>
  </page-layout>
</template>

<script>
import moment from 'moment'
import PageLayout from '@/layouts/PageLayout'
import {listAuditLogs} from '@/services/audit'
import {listTenants} from '@/services/tenant'
import {ACTION_LABELS, RESULT_LABELS, buildAuditQuery} from './audit-policy'

const defaultFilters = () => ({
  actor: '',
  tenant_id: undefined,
  resource: undefined,
  action: undefined,
  result: undefined,
  range: [moment().subtract(24, 'hours'), moment()],
})
const business = (response) => response && response.data && response.data.code !== undefined ? response.data : response
const pageData = (response) => {
  const value = business(response)
  return value && value.data ? value.data : {items: [], total: 0}
}

export default {
  name: 'SystemAudit',
  components: {PageLayout},
  data() {
    return {
      loading: false,
      logs: [],
      tenants: [],
      filters: defaultFilters(),
      actionLabels: ACTION_LABELS,
      resultLabels: RESULT_LABELS,
      resources: [
        'platform.session', 'platform.account', 'platform.users', 'platform.tenants', 'platform.system',
        'platform.audit', 'platform.zabbix', 'platform.assets', 'platform.rules', 'platform.reports',
        'platform.menus', 'tenant.alarms', 'tenant.assets', 'tenant.monitoring',
        'tenant.visualizations', 'tenant.members',
      ],
      pagination: {current: 1, pageSize: 20, total: 0, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100']},
      columns: [
        {title: '时间', scopedSlots: {customRender: 'time'}, width: 170},
        {title: '操作人', scopedSlots: {customRender: 'actor'}, width: 150},
        {title: '租户范围', scopedSlots: {customRender: 'tenant'}, width: 170},
        {title: '动作', scopedSlots: {customRender: 'action'}, width: 90},
        {title: '操作对象', scopedSlots: {customRender: 'object'}, width: 220},
        {title: '结果', scopedSlots: {customRender: 'result'}, width: 150},
        {title: '来源 IP', dataIndex: 'source_ip', width: 140},
        {title: '请求 ID', scopedSlots: {customRender: 'request'}, width: 180},
      ],
    }
  },
  created() {
    this.reload()
    this.loadTenants()
  },
  methods: {
    async reload() {
      let params
      try {
        params = buildAuditQuery(this.filters, this.pagination.current, this.pagination.pageSize)
      } catch (error) {
        this.$message.warning(error.message)
        return
      }
      this.loading = true
      try {
        const result = pageData(await listAuditLogs(params))
        this.logs = Array.isArray(result.items) ? result.items : []
        this.pagination = {...this.pagination, total: Number(result.total || 0)}
      } catch (error) {
        this.$message.error(error.message || '加载操作审计失败')
      } finally {
        this.loading = false
      }
    },
    async loadTenants() {
      try {
        const result = pageData(await listTenants())
        this.tenants = Array.isArray(result.items) ? result.items : (Array.isArray(result) ? result : [])
      } catch (error) {
        this.tenants = []
      }
    },
    search() {
      this.pagination = {...this.pagination, current: 1}
      this.reload()
    },
    reset() {
      this.filters = defaultFilters()
      this.pagination = {...this.pagination, current: 1}
      this.reload()
    },
    changeTable(pagination) {
      this.pagination = {...this.pagination, current: pagination.current, pageSize: pagination.pageSize}
      this.reload()
    },
    resultStatus(result) {
      return {success: 'success', failed: 'error', denied: 'warning', pending: 'processing'}[result] || 'default'
    },
    roleLabel(record) {
      return record.tenant_role || record.actor_platform_role || '-'
    },
    formatTime(value) {
      return value ? moment(value).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
  },
}
</script>

<style lang="less" scoped>
.audit-filters { margin-bottom: 16px; }
.audit-filters .ant-form-item { margin-bottom: 10px; }
.secondary { color: rgba(0, 0, 0, .45); font-size: 12px; }
.request-id { display: inline-block; max-width: 155px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; }
</style>
