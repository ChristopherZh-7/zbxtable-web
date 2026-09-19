<template>
  <page-layout :noTitle="true">
    <div class="baseline-page">
      <div class="baseline-page__header">
        <div>
          <h2>动态基线</h2>
        </div>
        <div>
          <a-button :loading="loading" @click="load"><a-icon type="reload" /> 刷新</a-button>
          <a-button v-auth="'create'" type="primary" style="margin-left: 8px" @click="openCreate">
            <a-icon type="plus" /> 新建基线
          </a-button>
        </div>
      </div>

      <a-table :loading="loading" :columns="columns" :data-source="rules" :row-key="record => `${record.zid}:${record.triggerid}`">
        <span slot="source" slot-scope="record">
          <strong>{{ record.host_name }}</strong><br />
          <span class="muted">{{ record.item_name }} · {{ record.instance_name }}</span>
        </span>
        <span slot="season" slot-scope="record">
          {{ record.season_unit === 'w' ? '周' : '日' }}周期 / {{ record.seasons }} 个同期 / {{ record.deviation }}σ
        </span>
        <span slot="severity" slot-scope="record">
          <a-tag :color="severityMeta(record.severity).color">{{ severityMeta(record.severity).label }}</a-tag>
        </span>
        <span slot="status" slot-scope="record">
          <a-badge :status="record.problem ? 'error' : (record.enabled ? 'success' : 'default')" :text="record.problem ? '已偏离' : (record.enabled ? '正常监控' : '已停用')" />
        </span>
        <span slot="operation" slot-scope="record">
          <a-button type="link" size="small" @click="openDetail(record)">查看曲线</a-button>
          <a-button v-auth="'update'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <a-popconfirm title="确认删除该基线规则和监控触发器？" @confirm="remove(record)">
            <a-button v-auth="'delete'" type="link" size="small">删除</a-button>
          </a-popconfirm>
        </span>
      </a-table>
    </div>

    <a-modal :visible="modalVisible" :title="editing ? '编辑动态基线' : '新建动态基线'" :confirm-loading="saving" width="660px" @ok="save" @cancel="closeModal">
      <a-form-model layout="vertical">
        <a-form-model-item label="规则名称">
          <a-input v-model.trim="form.name" placeholder="例如：CPU 日周期动态基线" />
        </a-form-model-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-model-item label="当前租户主机">
              <a-select v-model="selectedHostKey" show-search option-filter-prop="children" placeholder="选择主机" @change="selectHost">
                <a-select-option v-for="host in hosts" :key="hostKey(host)" :value="hostKey(host)">
                  {{ host.name }}（{{ host.instance_name }}）
                </a-select-option>
              </a-select>
            </a-form-model-item>
          </a-col>
          <a-col :span="12">
            <a-form-model-item label="数值趋势监控项">
              <a-select v-model="form.itemid" show-search option-filter-prop="children" :loading="itemsLoading" :disabled="!selectedHostKey" placeholder="选择监控项">
                <a-select-option v-for="item in items" :key="item.itemid" :value="String(item.itemid)">
                  {{ item.name }}{{ item.units ? `（${item.units}）` : '' }}
                </a-select-option>
              </a-select>
            </a-form-model-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-model-item label="同期周期">
              <a-select v-model="form.season_unit">
                <a-select-option value="d">每日同期</a-select-option>
                <a-select-option value="w">每周同期</a-select-option>
              </a-select>
            </a-form-model-item>
          </a-col>
          <a-col :span="8">
            <a-form-model-item label="同期样本数（3-30）">
              <a-input-number v-model="form.seasons" :min="3" :max="30" style="width: 100%" />
            </a-form-model-item>
          </a-col>
          <a-col :span="8">
            <a-form-model-item label="偏差阈值（1-10σ）">
              <a-input-number v-model="form.deviation" :min="1" :max="10" :step="0.5" style="width: 100%" />
            </a-form-model-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-model-item label="告警级别">
              <a-select v-model="form.severity">
                <a-select-option v-for="item in severities" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
              </a-select>
            </a-form-model-item>
          </a-col>
          <a-col :span="12">
            <a-form-model-item label="启用规则">
              <a-switch v-model="form.enabled" checked-children="启用" un-checked-children="停用" />
            </a-form-model-item>
          </a-col>
        </a-row>
      </a-form-model>
    </a-modal>

    <a-drawer :visible="drawerVisible" title="基线曲线与触发事件" width="760" @close="closeDrawer">
      <a-spin :spinning="detailLoading">
        <template v-if="selectedRule">
          <a-descriptions bordered size="small" :column="2">
            <a-descriptions-item label="规则">{{ selectedRule.name }}</a-descriptions-item>
            <a-descriptions-item label="数据周期">1 小时</a-descriptions-item>
            <a-descriptions-item label="数据源">{{ selectedRule.host_name }} / {{ selectedRule.item_name }}</a-descriptions-item>
            <a-descriptions-item label="判定">{{ selectedRule.seasons }} 个{{ selectedRule.season_unit === 'w' ? '周' : '日' }}同期，超过 {{ selectedRule.deviation }}σ</a-descriptions-item>
          </a-descriptions>
          <a-alert v-if="preview.message" :message="preview.message" type="warning" show-icon style="margin-top: 16px" />
          <div ref="chart" class="baseline-chart"></div>
          <h3>最近 30 天触发事件</h3>
          <a-table size="small" :pagination="false" :columns="eventColumns" :data-source="events" :row-key="record => record.eventid">
            <span slot="eventTime" slot-scope="record">{{ formatClock(record.clock) }}</span>
            <span slot="eventSeverity" slot-scope="record"><a-tag :color="severityMeta(record.severity).color">{{ severityMeta(record.severity).label }}</a-tag></span>
            <span slot="acknowledged" slot-scope="record">{{ record.acknowledged === '1' ? '已确认' : '未确认' }}</span>
          </a-table>
        </template>
      </a-spin>
    </a-drawer>
  </page-layout>
</template>

<script>
import * as echarts from 'echarts'
import PageLayout from '@/layouts/PageLayout'
import {
  baselineRuleEvents, baselineRuleList, baselineRulePreview, createBaselineRule,
  deleteBaselineRule, hostList, itemList, updateBaselineRule,
} from '@/services/admin'
import {SEVERITIES, baselineChartOption, defaultBaselineForm, numericTrendItems, severityMeta, validateBaselineForm} from './baseline-view'

export default {
  name: 'DynamicBaselines',
  components: {PageLayout},
  data() {
    return {
      loading: false, saving: false, itemsLoading: false, detailLoading: false,
      rules: [], hosts: [], items: [], modalVisible: false, drawerVisible: false,
      editing: null, selectedRule: null, selectedHostKey: '', form: defaultBaselineForm(),
      preview: {points: [], complete: false, message: ''}, events: [], chart: null,
      severities: SEVERITIES,
      columns: [
        {title: '规则名称', dataIndex: 'name', width: 180},
        {title: '数据源', key: 'source', scopedSlots: {customRender: 'source'}},
        {title: '基线策略', key: 'season', scopedSlots: {customRender: 'season'}, width: 220},
        {title: '级别', key: 'severity', scopedSlots: {customRender: 'severity'}, width: 100},
        {title: '状态', key: 'status', scopedSlots: {customRender: 'status'}, width: 120},
        {title: '操作', key: 'operation', scopedSlots: {customRender: 'operation'}, width: 220},
      ],
      eventColumns: [
        {title: '时间', key: 'eventTime', scopedSlots: {customRender: 'eventTime'}, width: 170},
        {title: '事件', dataIndex: 'name'},
        {title: '级别', key: 'eventSeverity', scopedSlots: {customRender: 'eventSeverity'}, width: 100},
        {title: '确认', key: 'acknowledged', scopedSlots: {customRender: 'acknowledged'}, width: 90},
      ],
    }
  },
  created() {
    this.load()
    this.loadHosts()
  },
  beforeDestroy() {
    if (this.chart) this.chart.dispose()
  },
  methods: {
    severityMeta,
    unwrap(response) {
      const result = response.data
      if (!result || result.code !== 200) throw new Error(result && result.message || '请求失败')
      return result.data
    },
    async load() {
      this.loading = true
      try {
        const data = this.unwrap(await baselineRuleList())
        this.rules = Array.isArray(data) ? data : (data && data.items || [])
      } catch (error) {
        this.$message.error(error.message || '基线规则加载失败')
      } finally { this.loading = false }
    },
    async loadHosts() {
      try {
        const data = this.unwrap(await hostList({page: 1, limit: 200}))
        this.hosts = data && data.items || []
      } catch (error) { this.$message.error(error.message || '主机加载失败') }
    },
    hostKey(host) { return `${host.zid}:${host.hostid}` },
    async selectHost(key) {
      const host = this.hosts.find(candidate => this.hostKey(candidate) === key)
      this.items = []
      this.form.itemid = ''
      if (!host) return
      this.form.zid = Number(host.zid)
      await this.loadItems(host.zid, host.hostid)
    },
    async loadItems(zid, hostid, retainItemID) {
      this.itemsLoading = true
      try {
        const data = this.unwrap(await itemList({zid, hostid}))
        this.items = numericTrendItems(data && data.items || [])
        if (retainItemID && this.items.some(item => String(item.itemid) === String(retainItemID))) this.form.itemid = String(retainItemID)
      } catch (error) { this.$message.error(error.message || '监控项加载失败')
      } finally { this.itemsLoading = false }
    },
    openCreate() {
      this.editing = null
      this.form = defaultBaselineForm()
      this.selectedHostKey = ''
      this.items = []
      this.modalVisible = true
    },
    openEdit(rule) {
      this.editing = rule
      this.form = {
        zid: Number(rule.zid), itemid: String(rule.itemid), name: rule.name,
        season_unit: rule.season_unit, seasons: Number(rule.seasons), deviation: Number(rule.deviation),
        severity: Number(rule.severity), enabled: Boolean(rule.enabled),
      }
      this.selectedHostKey = `${rule.zid}:${rule.hostid}`
      this.modalVisible = true
      this.loadItems(rule.zid, rule.hostid, rule.itemid)
    },
    closeModal() { this.modalVisible = false },
    async save() {
      const validation = validateBaselineForm(this.form)
      if (validation) { this.$message.warning(validation); return }
      this.saving = true
      try {
        if (this.editing) this.unwrap(await updateBaselineRule(this.editing.triggerid, this.editing.zid, this.form))
        else this.unwrap(await createBaselineRule(this.form))
        this.$message.success(this.editing ? '基线已更新' : '基线已创建')
        this.modalVisible = false
        await this.load()
      } catch (error) { this.$message.error(error.message || '保存失败')
      } finally { this.saving = false }
    },
    async remove(rule) {
      try {
        this.unwrap(await deleteBaselineRule(rule.triggerid, rule.zid))
        this.$message.success('基线规则已删除')
        await this.load()
      } catch (error) { this.$message.error(error.message || '删除失败') }
    },
    async openDetail(rule) {
      this.selectedRule = rule
      this.preview = {points: [], complete: false, message: ''}
      this.events = []
      this.drawerVisible = true
      this.detailLoading = true
      try {
        const [preview, events] = await Promise.all([
          baselineRulePreview(rule.triggerid, rule.zid), baselineRuleEvents(rule.triggerid, rule.zid),
        ])
        this.preview = this.unwrap(preview) || this.preview
        this.events = this.unwrap(events) || []
        this.$nextTick(this.renderChart)
      } catch (error) { this.$message.error(error.message || '基线详情加载失败')
      } finally { this.detailLoading = false }
    },
    renderChart() {
      if (!this.$refs.chart) return
      if (this.chart) this.chart.dispose()
      this.chart = echarts.init(this.$refs.chart)
      this.chart.setOption(baselineChartOption(this.preview.points, this.selectedRule && this.selectedRule.units), true)
    },
    closeDrawer() {
      this.drawerVisible = false
      if (this.chart) { this.chart.dispose(); this.chart = null }
    },
    formatClock(clock) {
      const value = Number(clock)
      return value ? new Date(value * 1000).toLocaleString() : '--'
    },
  },
}
</script>

<style lang="less" scoped>
.baseline-page__header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.baseline-page__header h2 { margin-bottom: 4px; }
.baseline-page__header p, .muted { color: #78849a; }
.baseline-chart { width: 100%; height: 360px; margin: 18px 0; }
</style>
