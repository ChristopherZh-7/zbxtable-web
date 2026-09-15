<template>
  <component :is="embedded ? 'div' : 'page-layout'" v-bind="embedded ? {} : { noTitle: true }">
    <div class="asset-binding-page">
      <a-alert
        message="历史只读 · 已废弃"
        description="这些设备绑定曾向监控中心写入资产类型和监控项。配置管理中心现为唯一 CMDB 字段权威，旧配置不会再创建、修改、初始化、重试或自动执行；仅保留列表和历史记录用于核对。"
        type="warning"
        show-icon
        class="legacy-alert"
      />

      <a-card :bordered="false" class="table-card">
        <template #title>
          <div class="table-card__title-wrap">
            <div class="table-card__title">旧设备绑定配置</div>
            <div class="table-card__subtitle">只读保留，不属于当前 CMDB 配置流程</div>
          </div>
        </template>
        <template #extra>
          <a-tag color="orange">共 {{ dataSource.length }} 项历史配置</a-tag>
        </template>

        <a-table
          data-testid="system-binding-table"
          :columns="columns"
          :data-source="dataSource"
          :loading="loading"
          :pagination="false"
          row-key="id"
          :row-class-name="getRowClassName"
          :scroll="{ x: 1450 }"
        >
          <span slot="name" slot-scope="text, record">
            <div class="binding-name-cell">
              <a-icon :type="getAssetTypeIcon(record.type_code)" class="binding-name-icon" />
              <div class="binding-name">{{ record.name || getAssetTypeName(record.type_code) }}</div>
            </div>
          </span>
          <span slot="asset_type" slot-scope="text, record">
            <div class="asset-type-cell">
              <a-icon :type="getAssetTypeIcon(record.type_code)" class="asset-type-icon" />
              <span>{{ getAssetTypeName(record.type_code) }}</span>
              <a-tag color="blue">{{ record.type_code }}</a-tag>
            </div>
          </span>
          <span slot="zabbix_instance" slot-scope="text, record">
            <div class="instance-cell">
              <a-icon type="cloud-server" />
              <span>{{ getInstanceName(record.zid) }}</span>
            </div>
          </span>
          <span slot="group_id" slot-scope="text, record">
            <a-tooltip :title="formatGroupNames(record)">
              <div class="group-cell">{{ formatGroupNames(record) }}</div>
            </a-tooltip>
          </span>
          <span slot="legacy_automation" slot-scope="text, record">
            <a-tag color="default">已停用</a-tag>
            <span class="legacy-meta">{{ legacyAutomationLabel(record) }}</span>
          </span>
          <span slot="status" slot-scope="text, record">
            <div class="status-cell">
              <a-badge v-if="record.status === 1" status="success" text="历史成功" />
              <a-badge v-else-if="record.status === 2" status="error" text="历史失败" />
              <a-badge v-else status="default" text="未执行" />
              <a-tooltip v-if="record.status === 2 && record.init_error" :title="record.init_error">
                <a-icon type="info-circle" class="status-error-icon" />
              </a-tooltip>
            </div>
          </span>
          <span slot="last_success_at" slot-scope="text">
            <div class="last-success-cell">
              <a-icon type="clock-circle" />
              <span>{{ text ? formatTime(text) : '暂无成功记录' }}</span>
            </div>
          </span>
          <span slot="action" slot-scope="text, record">
            <a-space>
              <a-button data-testid="system-binding-detail-button" :data-record-id="String(record.id)" size="small" @click="showSystemDetail(record)">查看详情</a-button>
              <a-button data-testid="system-binding-history-button" :data-record-id="String(record.id)" size="small" @click="showHistory(record)">查看历史</a-button>
            </a-space>
          </span>
        </a-table>
      </a-card>

      <a-card :bordered="false" class="table-card">
        <template #title>
          <div class="table-card__title-wrap">
            <div class="table-card__title">旧指标映射配置</div>
            <div class="table-card__subtitle">历史监控侧资产信息指标关联只读保留，不会再执行或写入监控中心</div>
          </div>
        </template>
        <template #extra>
          <a-tag color="orange">共 {{ metricMappingDataSource.length }} 项历史配置</a-tag>
        </template>

        <a-table
          data-testid="metric-mapping-table"
          :columns="metricMappingColumns"
          :data-source="metricMappingDataSource"
          :loading="metricMappingLoading"
          :pagination="false"
          row-key="id"
          :scroll="{ x: 1260 }"
        >
          <span slot="mapping_system_type" slot-scope="text, record" data-testid="metric-mapping-row">
            <div class="binding-name-cell">
              <a-icon type="line-chart" class="binding-name-icon" />
              <div class="binding-name">{{ record.system_type || '-' }}</div>
            </div>
          </span>
          <span slot="mapping_instance" slot-scope="text, record">
            <div class="instance-cell">
              <a-icon type="cloud-server" />
              <span>{{ getInstanceName(record.zid) }}</span>
            </div>
          </span>
          <span slot="mapping_groups" slot-scope="text, record">
            <a-tooltip :title="formatMetricMappingGroups(record)">
              <div class="group-cell">{{ formatMetricMappingGroups(record) }}</div>
            </a-tooltip>
          </span>
          <span slot="metric_count" slot-scope="text, record">
            <a-tag color="blue">{{ metricCount(record) }} 项历史关联</a-tag>
          </span>
          <span slot="mapping_automation" slot-scope="text, record">
            <a-tag color="default">已停用</a-tag>
            <span class="legacy-meta">{{ legacyAutomationLabel(record) }}</span>
          </span>
          <span slot="mapping_status" slot-scope="text, record">
            <div class="status-cell">
              <a-badge v-if="record.status === 1" status="success" text="历史成功" />
              <a-badge v-else-if="record.status === 2" status="error" text="历史失败" />
              <a-badge v-else status="default" text="未执行" />
            </div>
          </span>
          <span slot="mapping_last_success_at" slot-scope="text">
            <div class="last-success-cell">
              <a-icon type="clock-circle" />
              <span>{{ text ? formatTime(text) : '暂无成功记录' }}</span>
            </div>
          </span>
          <span slot="mapping_action" slot-scope="text, record">
            <a-space>
              <a-button data-testid="metric-mapping-detail-button" :data-record-id="String(record.id)" size="small" @click="showMetricMappingDetail(record)">查看详情</a-button>
              <a-button data-testid="metric-mapping-history-button" :data-record-id="String(record.id)" size="small" @click="showMetricMappingHistory(record)">查看历史</a-button>
            </a-space>
          </span>
        </a-table>
      </a-card>

      <a-modal
        data-testid="system-binding-detail-modal"
        title="旧设备绑定详情（只读）"
        :visible="systemDetailVisible"
        width="900px"
        :footer="null"
        @cancel="systemDetailVisible = false"
      >
        <a-spin :spinning="systemDetailLoading">
          <a-alert message="原始配置仅用于核对，不会保存、初始化或再次执行。" type="info" show-icon />
          <a-descriptions v-if="systemDetailRecord" bordered :column="2" size="small" class="detail-descriptions">
            <a-descriptions-item label="名称">{{ systemDetailRecord.name || '-' }}</a-descriptions-item>
            <a-descriptions-item label="历史资产类型">{{ systemDetailRecord.type_code || '-' }}</a-descriptions-item>
            <a-descriptions-item label="监控源">{{ getInstanceName(systemDetailRecord.zid) }}</a-descriptions-item>
            <a-descriptions-item label="历史主机组">{{ formatGroupNames(systemDetailRecord) }}</a-descriptions-item>
            <a-descriptions-item label="原自动化">{{ legacyAutomationLabel(systemDetailRecord) }}</a-descriptions-item>
            <a-descriptions-item label="历史状态">{{ systemDetailRecord.status }}</a-descriptions-item>
          </a-descriptions>
          <div v-if="systemDetailRecord" class="raw-record">
            <div class="raw-record__title">完整原始记录</div>
            <pre data-testid="system-binding-detail-raw">{{ prettyRecord(systemDetailRecord) }}</pre>
          </div>
        </a-spin>
      </a-modal>

      <a-modal
        data-testid="metric-mapping-detail-modal"
        title="旧指标映射详情（只读）"
        :visible="metricMappingDetailVisible"
        width="900px"
        :footer="null"
        @cancel="metricMappingDetailVisible = false"
      >
        <a-spin :spinning="metricMappingDetailLoading">
          <a-alert message="完整指标配置仅用于核对，不会保存、执行或写入监控侧资产信息。" type="info" show-icon />
          <a-descriptions v-if="metricMappingDetailRecord" bordered :column="2" size="small" class="detail-descriptions">
            <a-descriptions-item label="历史系统类型">{{ metricMappingDetailRecord.system_type || '-' }}</a-descriptions-item>
            <a-descriptions-item label="监控源">{{ getInstanceName(metricMappingDetailRecord.zid) }}</a-descriptions-item>
            <a-descriptions-item label="历史主机组">{{ formatMetricMappingGroups(metricMappingDetailRecord) }}</a-descriptions-item>
            <a-descriptions-item label="历史指标关联">{{ metricCount(metricMappingDetailRecord) }} 项</a-descriptions-item>
            <a-descriptions-item label="原自动化">{{ legacyAutomationLabel(metricMappingDetailRecord) }}</a-descriptions-item>
            <a-descriptions-item label="历史状态">{{ metricMappingDetailRecord.status }}</a-descriptions-item>
          </a-descriptions>
          <div v-if="metricMappingDetailRecord" class="raw-record">
            <div class="raw-record__title">完整原始记录</div>
            <pre data-testid="metric-mapping-detail-raw">{{ prettyRecord(metricMappingDetailRecord) }}</pre>
          </div>
        </a-spin>
      </a-modal>

      <a-modal
        data-testid="system-binding-history-modal"
        title="历史执行记录（只读）"
        :visible="historyVisible"
        width="900px"
        :footer="null"
        @cancel="historyVisible = false"
      >
        <a-alert
          message="历史记录仅用于审计和迁移核对，不会再次执行。"
          type="info"
          show-icon
          style="margin-bottom: 12px;"
        />
        <a-table
          data-testid="system-binding-history-table"
          :loading="historyLoading"
          :columns="historyColumns"
          :data-source="historyList"
          :pagination="historyPagination"
          row-key="id"
          @change="handleHistoryPageChange"
        >
          <span slot="exec_type" slot-scope="text">
            <a-tag :color="execTypeColor(text)">{{ execTypeLabel(text) }}</a-tag>
          </span>
          <span slot="status" slot-scope="text">
            <a-tag :color="historyStatusColor(text)">{{ text }}</a-tag>
          </span>
          <span slot="start_time" slot-scope="text">{{ formatTime(text) }}</span>
          <span slot="duration" slot-scope="text">{{ text ? text + 's' : '-' }}</span>
        </a-table>
      </a-modal>

      <a-modal
        data-testid="metric-mapping-history-modal"
        title="指标映射执行历史（只读）"
        :visible="metricMappingHistoryVisible"
        width="900px"
        :footer="null"
        @cancel="metricMappingHistoryVisible = false"
      >
        <a-alert
          message="历史记录仅用于审计和迁移核对，不会再次执行或建立监控侧资产信息关联。"
          type="info"
          show-icon
          style="margin-bottom: 12px;"
        />
        <a-table
          data-testid="metric-mapping-history-table"
          :loading="metricMappingHistoryLoading"
          :columns="metricMappingHistoryColumns"
          :data-source="metricMappingHistoryList"
          :pagination="metricMappingHistoryPagination"
          row-key="id"
          @change="handleMetricMappingHistoryPageChange"
        >
          <span slot="mapping_history_row" slot-scope="text" data-testid="metric-mapping-history-row">{{ text || '-' }}</span>
          <span slot="mapping_history_exec_type" slot-scope="text">
            <a-tag :color="execTypeColor(text)">{{ execTypeLabel(text) }}</a-tag>
          </span>
          <span slot="mapping_history_status" slot-scope="text">
            <a-tag :color="historyStatusColor(text)">{{ text }}</a-tag>
          </span>
          <span slot="mapping_history_start_time" slot-scope="text">{{ formatTime(text) }}</span>
          <span slot="mapping_history_duration" slot-scope="text">{{ text ? text + 's' : '-' }}</span>
        </a-table>
      </a-modal>
    </div>
  </component>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import {
  getAssetTypes,
  getSystemBinding,
  getSystemBindings,
  getSystemBindingHistory,
  hostgroupList,
  metricMappingHistory,
  metricMappingGet,
  metricMappingList,
} from '@/services/admin'
import { listZabbixInstance } from '@/services/zabbix'

export default {
  name: 'AssetBinding',
  components: { PageLayout },
  props: {
    embedded: { type: Boolean, default: false },
  },
  data() {
    return {
      loading: false,
      dataSource: [],
      metricMappingLoading: false,
      metricMappingDataSource: [],
      assetTypes: [],
      instanceList: [],
      groupNameMapByZid: {},
      columns: [
        { title: '名称', dataIndex: 'name', key: 'name', scopedSlots: { customRender: 'name' }, width: 220 },
        { title: '历史资产类型', key: 'asset_type', scopedSlots: { customRender: 'asset_type' }, width: 300 },
        { title: '监控源', key: 'zabbix_instance', scopedSlots: { customRender: 'zabbix_instance' }, width: 180 },
        { title: '历史主机组', dataIndex: 'group_id', key: 'group_id', scopedSlots: { customRender: 'group_id' }, ellipsis: true, width: 260 },
        { title: '旧自动化', key: 'legacy_automation', scopedSlots: { customRender: 'legacy_automation' }, width: 220 },
        { title: '历史状态', key: 'status', scopedSlots: { customRender: 'status' }, width: 130 },
        { title: '最近成功', dataIndex: 'last_success_at', key: 'last_success_at', scopedSlots: { customRender: 'last_success_at' }, width: 190 },
        { title: '操作', key: 'action', width: 190, scopedSlots: { customRender: 'action' }, fixed: 'right' },
      ],
      historyVisible: false,
      historyLoading: false,
      historyList: [],
      currentSystemId: null,
      historyPagination: { current: 1, pageSize: 20, total: 0, showTotal: total => `共 ${total} 条` },
      historyColumns: [
        { title: '原执行类型', dataIndex: 'exec_type', key: 'exec_type', width: 100, scopedSlots: { customRender: 'exec_type' } },
        { title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 170, scopedSlots: { customRender: 'start_time' } },
        { title: '耗时', dataIndex: 'duration', key: 'duration', width: 70, scopedSlots: { customRender: 'duration' } },
        { title: '状态', dataIndex: 'status', key: 'status', width: 80, scopedSlots: { customRender: 'status' } },
        { title: '影响主机', dataIndex: 'affected_hosts', key: 'affected_hosts', width: 90 },
        { title: '错误信息', dataIndex: 'error_message', key: 'error_message', ellipsis: true },
      ],
      systemDetailVisible: false,
      systemDetailLoading: false,
      systemDetailRecord: null,
      metricMappingColumns: [
        { title: '历史系统类型', dataIndex: 'system_type', key: 'system_type', scopedSlots: { customRender: 'mapping_system_type' }, width: 220 },
        { title: '监控源', key: 'mapping_instance', scopedSlots: { customRender: 'mapping_instance' }, width: 180 },
        { title: '历史主机组', dataIndex: 'host_group_ids', key: 'host_group_ids', scopedSlots: { customRender: 'mapping_groups' }, width: 260 },
        { title: '历史指标关联', key: 'metric_count', scopedSlots: { customRender: 'metric_count' }, width: 150 },
        { title: '旧自动化', key: 'mapping_automation', scopedSlots: { customRender: 'mapping_automation' }, width: 220 },
        { title: '历史状态', key: 'mapping_status', scopedSlots: { customRender: 'mapping_status' }, width: 130 },
        { title: '最近成功', dataIndex: 'last_success_at', key: 'mapping_last_success_at', scopedSlots: { customRender: 'mapping_last_success_at' }, width: 190 },
        { title: '操作', key: 'mapping_action', width: 190, scopedSlots: { customRender: 'mapping_action' }, fixed: 'right' },
      ],
      metricMappingDetailVisible: false,
      metricMappingDetailLoading: false,
      metricMappingDetailRecord: null,
      metricMappingHistoryVisible: false,
      metricMappingHistoryLoading: false,
      metricMappingHistoryList: [],
      currentMetricMappingId: null,
      metricMappingHistoryPagination: { current: 1, pageSize: 20, total: 0, showTotal: total => `共 ${total} 条` },
      metricMappingHistoryColumns: [
        { title: '历史系统类型', dataIndex: 'system_type', key: 'system_type', width: 150, scopedSlots: { customRender: 'mapping_history_row' } },
        { title: '原执行类型', dataIndex: 'exec_type', key: 'exec_type', width: 100, scopedSlots: { customRender: 'mapping_history_exec_type' } },
        { title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 170, scopedSlots: { customRender: 'mapping_history_start_time' } },
        { title: '耗时', dataIndex: 'duration', key: 'duration', width: 70, scopedSlots: { customRender: 'mapping_history_duration' } },
        { title: '状态', dataIndex: 'status', key: 'status', width: 80, scopedSlots: { customRender: 'mapping_history_status' } },
        { title: '影响主机', dataIndex: 'affected_hosts', key: 'affected_hosts', width: 90 },
        { title: '错误信息', dataIndex: 'error_message', key: 'error_message', ellipsis: true },
      ],
    }
  },
  mounted() {
    this.loadAssetTypes()
    this.loadInstances()
    this.loadData()
    this.loadMetricMappings()
  },
  methods: {
    async loadAssetTypes() {
      try {
        const response = await getAssetTypes()
        const business = response && response.data ? response.data : response
        if (business && business.code === 200) this.assetTypes = business.data || []
      } catch (error) {
        console.error(error)
      }
    },
    async loadInstances() {
      try {
        const response = await listZabbixInstance()
        const business = response && response.data ? response.data : response
        if (business && business.code === 200) {
          this.instanceList = (business.data || []).map(item => ({
            ...item,
            instance: String(item.id || item.instance || ''),
            name: item.name || item.host || String(item.id || item.instance || '-'),
          }))
        }
      } catch (error) {
        console.error(error)
      }
    },
    async loadData() {
      this.loading = true
      try {
        const response = await getSystemBindings()
        const business = response && response.data ? response.data : response
        if (business && business.code === 200) {
          const data = business.data
          this.dataSource = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : [])
          await this.loadGroupNamesForRows(this.dataSource)
        } else {
          this.dataSource = []
        }
      } catch (error) {
        this.$message.error('加载历史绑定配置失败')
        this.dataSource = []
      } finally {
        this.loading = false
      }
    },
    async loadMetricMappings() {
      this.metricMappingLoading = true
      try {
        const response = await metricMappingList()
        const business = response && response.data ? response.data : response
        if (business && business.code === 200) {
          const data = business.data
          this.metricMappingDataSource = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : [])
          await this.loadGroupNamesForRows(this.metricMappingDataSource.map(item => ({
            ...item,
            group_id: item.host_group_ids,
          })))
        } else {
          this.metricMappingDataSource = []
        }
      } catch (error) {
        this.$message.error('加载历史指标映射失败')
        this.metricMappingDataSource = []
      } finally {
        this.metricMappingLoading = false
      }
    },
    async loadGroupNamesForRows(rows) {
      const zids = [...new Set(
        (rows || [])
          .filter(row => row && row.group_id && Number(row.zid) > 0)
          .map(row => String(row.zid))
      )]
      const pending = zids.filter(zid => !this.groupNameMapByZid[zid])
      if (!pending.length) return
      try {
        const responses = await Promise.all(pending.map(zid => hostgroupList(zid)))
        const next = { ...this.groupNameMapByZid }
        pending.forEach((zid, index) => {
          const response = responses[index]
          const groups = response && response.data && response.data.code === 200 ? (response.data.data || []) : []
          next[zid] = groups.reduce((result, group) => {
            const id = String(group.groupid || '')
            if (id) result[id] = group.name || id
            return result
          }, {})
        })
        this.groupNameMapByZid = next
      } catch (error) {
        console.error(error)
      }
    },
    getAssetTypeName(typeCode) {
      const assetType = this.assetTypes.find(item => item.type_code === typeCode)
      return assetType ? assetType.name : (typeCode || '-')
    },
    getAssetTypeIcon(typeCode) {
      const assetType = this.assetTypes.find(item => item.type_code === typeCode)
      return (assetType && assetType.icon) || 'folder'
    },
    getInstanceName(zid) {
      const instance = this.instanceList.find(item => String(item.instance) === String(zid))
      return instance ? instance.name : (Number(zid) > 0 ? String(zid) : '-')
    },
    formatGroupNames(record) {
      if (!record || !record.group_id) return '-'
      const nameMap = this.groupNameMapByZid[String(record.zid)] || {}
      const groups = String(record.group_id).split(',').filter(Boolean).map(id => nameMap[id] || id)
      return groups.length <= 2 ? groups.join(' , ') : `${groups.slice(0, 2).join(' , ')} 等 ${groups.length} 个主机组`
    },
    formatMetricMappingGroups(record) {
      return this.formatGroupNames({ zid: record.zid, group_id: record.host_group_ids })
    },
    metricCount(record) {
      try {
        const config = JSON.parse(record.metric_config || '{}')
        return config && config.metrics && typeof config.metrics === 'object' ? Object.keys(config.metrics).length : 0
      } catch (error) {
        return 0
      }
    },
    legacyAutomationLabel(record) {
      const labels = []
      if (record.auto_init === 1) labels.push('原定时')
      if (record.init_on_new_host === 1) labels.push('原新主机触发')
      return labels.length ? labels.join(' / ') : '原手动配置'
    },
    getRowClassName(record) {
      if (record.status === 2) return 'row-failed'
      if (record.status === 1) return 'row-success'
      return ''
    },
    async showSystemDetail(record) {
      this.systemDetailVisible = true
      this.systemDetailLoading = true
      this.systemDetailRecord = null
      try {
        const response = await getSystemBinding(record.id)
        const business = response && response.data ? response.data : response
        if (!business || business.code !== 200) throw new Error('unexpected response')
        const data = business.data || {}
        this.systemDetailRecord = data.items && !Array.isArray(data.items) ? data.items : data
      } catch (error) {
        this.$message.error('加载历史绑定详情失败')
      } finally {
        this.systemDetailLoading = false
      }
    },
    showHistory(record) {
      this.currentSystemId = record.id
      this.historyPagination.current = 1
      this.historyVisible = true
      this.fetchHistory()
    },
    async fetchHistory() {
      this.historyLoading = true
      try {
        const response = await getSystemBindingHistory(this.currentSystemId, {
          page: this.historyPagination.current,
          limit: this.historyPagination.pageSize,
        })
        const business = response && response.data ? response.data : response
        if (business && business.code === 200) {
          this.historyList = business.data && business.data.items ? business.data.items : []
          this.historyPagination.total = business.data && business.data.total ? business.data.total : 0
        }
      } catch (error) {
        this.$message.error('加载历史记录失败')
      } finally {
        this.historyLoading = false
      }
    },
    handleHistoryPageChange(pagination) {
      this.historyPagination.current = pagination.current
      this.historyPagination.pageSize = pagination.pageSize
      this.fetchHistory()
    },
    showMetricMappingHistory(record) {
      this.currentMetricMappingId = record.id
      this.metricMappingHistoryPagination.current = 1
      this.metricMappingHistoryVisible = true
      this.fetchMetricMappingHistory()
    },
    async showMetricMappingDetail(record) {
      this.metricMappingDetailVisible = true
      this.metricMappingDetailLoading = true
      this.metricMappingDetailRecord = null
      try {
        const response = await metricMappingGet(record.id)
        const business = response && response.data ? response.data : response
        if (!business || business.code !== 200) throw new Error('unexpected response')
        this.metricMappingDetailRecord = business.data || null
      } catch (error) {
        this.$message.error('加载历史指标映射详情失败')
      } finally {
        this.metricMappingDetailLoading = false
      }
    },
    async fetchMetricMappingHistory() {
      this.metricMappingHistoryLoading = true
      try {
        const response = await metricMappingHistory({
          mapping_id: this.currentMetricMappingId,
          page: this.metricMappingHistoryPagination.current,
          limit: this.metricMappingHistoryPagination.pageSize,
        })
        const business = response && response.data ? response.data : response
        if (business && business.code === 200) {
          this.metricMappingHistoryList = business.data && business.data.items ? business.data.items : []
          this.metricMappingHistoryPagination.total = business.data && business.data.total ? business.data.total : 0
        } else {
          this.metricMappingHistoryList = []
          this.metricMappingHistoryPagination.total = 0
        }
      } catch (error) {
        this.$message.error('加载指标映射历史失败')
        this.metricMappingHistoryList = []
        this.metricMappingHistoryPagination.total = 0
      } finally {
        this.metricMappingHistoryLoading = false
      }
    },
    handleMetricMappingHistoryPageChange(pagination) {
      this.metricMappingHistoryPagination.current = pagination.current
      this.metricMappingHistoryPagination.pageSize = pagination.pageSize
      this.fetchMetricMappingHistory()
    },
    prettyRecord(record) { return JSON.stringify(record || {}, null, 2) },
    formatTime(value) { return value ? new Date(value).toLocaleString('zh-CN') : '-' },
    execTypeLabel(value) { return { manual: '原手动', auto: '原自动', retry: '原重试', new_host: '原新主机触发' }[value] || value },
    execTypeColor(value) { return { manual: 'blue', auto: 'green', retry: 'orange', new_host: 'purple' }[value] || 'default' },
    historyStatusColor(value) { return { success: 'green', failed: 'red', running: 'orange' }[value] || 'default' },
  },
}
</script>

<style lang="less" scoped>
.asset-binding-page { min-height: 100%; background: #f5f7fb; }
.legacy-alert { margin-bottom: 16px; }
.table-card { margin-bottom: 20px; border-radius: 14px; box-shadow: 0 10px 30px rgba(31, 35, 41, 0.04); }
.table-card__title-wrap { display: flex; flex-direction: column; gap: 4px; }
.table-card__title { color: #1f2329; font-size: 18px; font-weight: 600; }
.table-card__subtitle, .legacy-meta { color: #667085; font-size: 12px; }
.binding-name-cell,
.asset-type-cell,
.instance-cell,
.status-cell,
.last-success-cell { display: flex; align-items: center; gap: 8px; }
.binding-name-icon, .asset-type-icon { color: #1890ff; }
.binding-name { color: #1f2329; font-weight: 600; }
.asset-type-cell { flex-wrap: nowrap; white-space: nowrap; }
.instance-cell, .last-success-cell { color: #475467; }
.group-cell { overflow: hidden; color: #344054; line-height: 1.5; text-overflow: ellipsis; white-space: nowrap; }
.status-error-icon { color: #f5222d; }
.detail-descriptions { margin-top: 16px; }
.raw-record { margin-top: 16px; }
.raw-record__title { margin-bottom: 8px; color: #344054; font-weight: 600; }
.raw-record pre {
  max-height: 360px;
  margin: 0;
  padding: 14px;
  overflow: auto;
  border: 1px solid #eaecf0;
  border-radius: 8px;
  background: #f8fafc;
  color: #344054;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-all;
}
::v-deep .row-failed td { background: #fff7f7 !important; }
::v-deep .row-success td { background: #f7fff9 !important; }
</style>
