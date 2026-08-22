<template>
  <page-layout :noTitle="true">
    <div class="config-consumption">
      <div class="config-consumption__header">
        <div>
          <h2>配置消费</h2>
          <p>按业务系统和资产类型，把租户资产同步到指定 Zabbix 主机组并关联模板。</p>
        </div>
        <div>
          <a-button :loading="loading" @click="loadAll"><a-icon type="reload" /> 刷新</a-button>
          <a-button v-if="canCreate" type="primary" class="header-action" @click="openCreate">
            <a-icon type="plus" /> 新建场景
          </a-button>
          <a-button v-if="canUpdate" type="primary" ghost class="header-action" @click="openApply">
            <a-icon type="deployment-unit" /> 应用到资产
          </a-button>
        </div>
      </div>

      <a-alert
        message="同步任务每 15 秒执行一次，正常情况下 60 秒内完成；仅替换上一次由本功能管理的主机组和模板，其他配置保持不变。"
        type="info"
        show-icon
        class="section-alert"
      />

      <section class="section-card">
        <div class="section-title">
          <div><strong>配置场景</strong><span>业务系统 + 资产类型唯一</span></div>
          <a-tag color="blue">{{ scenarios.length }} 个</a-tag>
        </div>
        <a-table :loading="loading" :columns="scenarioColumns" :data-source="scenarios" :row-key="record => record.id" :pagination="false" :scroll="{x: 980}">
          <span slot="target" slot-scope="record">
            <strong>{{ record.target_host_group }}</strong><br />
            <span class="muted">{{ record.template_name }}</span>
          </span>
          <span slot="enabled" slot-scope="record">
            <a-badge :status="record.enabled ? 'success' : 'default'" :text="record.enabled ? '已启用' : '已停用'" />
          </span>
          <span slot="scenarioOperation" slot-scope="record">
            <a-button v-if="canUpdate" type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <a-popconfirm v-if="canDelete" title="仅未被资产使用的场景可以删除，确认继续？" @confirm="removeScenario(record)">
              <a-button type="link" size="small">删除</a-button>
            </a-popconfirm>
          </span>
        </a-table>
      </section>

      <section class="section-card">
        <div class="section-title">
          <div><strong>同步任务</strong><span>失败最多自动重试 3 次，也可手动重新排队</span></div>
          <a-tag :color="activeTasks ? 'orange' : 'green'">{{ activeTasks ? `${activeTasks} 个处理中` : '当前无待处理' }}</a-tag>
        </div>
        <a-table :loading="tasksLoading" :columns="taskColumns" :data-source="tasks" :row-key="record => record.id" :pagination="{pageSize: 10}" :scroll="{x: 1080}">
          <span slot="taskScenario" slot-scope="record">
            <strong>{{ record.scenario && record.scenario.name || '-' }}</strong><br />
            <span class="muted">{{ record.scenario && record.scenario.business_system || '-' }} · {{ record.scenario && assetTypeName(record.scenario.asset_type_code) || '-' }}</span>
          </span>
          <span slot="taskStatus" slot-scope="record">
            <a-tag :color="statusMeta(record.status).color">{{ statusMeta(record.status).label }}</a-tag>
            <span v-if="record.status === 'failed'" class="muted">{{ record.retry_count }}/{{ record.max_retry }}</span>
          </span>
          <span slot="taskTime" slot-scope="record">{{ formatTime(record.applied_at || record.updated_at) }}</span>
          <span slot="taskError" slot-scope="record" :title="record.error_message">
            {{ record.error_message ? truncate(record.error_message, 42) : '-' }}
          </span>
          <span slot="taskOperation" slot-scope="record">
            <a-button v-if="canOperate && record.status === 'failed'" type="link" size="small" @click="retry(record)">重新排队</a-button>
            <span v-else class="muted">-</span>
          </span>
        </a-table>
      </section>
    </div>

    <a-modal :visible="scenarioVisible" :title="editingScenario ? '编辑配置场景' : '新建配置场景'" :confirm-loading="saving" width="700px" @ok="saveScenario" @cancel="closeScenario">
      <a-form-model layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12"><a-form-model-item label="场景名称"><a-input v-model.trim="scenarioForm.name" placeholder="例如：订单系统 Linux 标准配置" /></a-form-model-item></a-col>
          <a-col :span="12"><a-form-model-item label="业务系统"><a-input v-model.trim="scenarioForm.business_system" placeholder="例如：订单系统" /></a-form-model-item></a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-model-item label="资产类型">
              <a-select v-model="scenarioForm.asset_type_code" show-search option-filter-prop="children" placeholder="选择资产类型">
                <a-select-option v-for="item in resources.asset_types" :key="item.type_code" :value="item.type_code">{{ item.name }}（{{ item.type_code }}）</a-select-option>
              </a-select>
            </a-form-model-item>
          </a-col>
          <a-col :span="12">
            <a-form-model-item label="目标主机组（仅当前租户范围）">
              <a-select v-model="selectedGroupKey" show-search option-filter-prop="children" placeholder="选择主机组" @change="selectGroup">
                <a-select-option v-for="group in resources.host_groups" :key="groupKey(group)" :value="groupKey(group)">{{ group.host_group_name }}（{{ group.instance_name }}）</a-select-option>
              </a-select>
            </a-form-model-item>
          </a-col>
        </a-row>
        <a-form-model-item label="Zabbix 模板">
          <a-select v-model="scenarioForm.template_id" show-search option-filter-prop="children" :disabled="!scenarioForm.zid" placeholder="选择同一 Zabbix 实例中的模板">
            <a-select-option v-for="item in filteredTemplates" :key="item.template_id" :value="item.template_id">{{ item.template_name }}</a-select-option>
          </a-select>
        </a-form-model-item>
        <a-form-model-item label="启用场景"><a-switch v-model="scenarioForm.enabled" checked-children="启用" un-checked-children="停用" /></a-form-model-item>
      </a-form-model>
    </a-modal>

    <a-modal :visible="applyVisible" title="应用配置场景" :confirm-loading="applying" width="620px" ok-text="加入同步队列" @ok="applyScenario" @cancel="closeApply">
      <a-alert message="这里只处理已经纳入当前租户的资产；新资产发现与自动纳管由后续功能负责。" type="warning" show-icon class="section-alert" />
      <a-form-model layout="vertical">
        <a-form-model-item label="当前租户资产">
          <a-select v-model="applyForm.host_key" show-search option-filter-prop="children" placeholder="选择资产" @change="selectApplyHost">
            <a-select-option v-for="host in hosts" :key="hostKey(host)" :value="hostKey(host)">{{ host.name }}（{{ host.instance_name }}）</a-select-option>
          </a-select>
        </a-form-model-item>
        <a-form-model-item label="配置场景">
          <a-select v-model="applyForm.scenario_id" :disabled="!applyForm.host_key" placeholder="选择与资产处于同一 Zabbix 实例的启用场景">
            <a-select-option v-for="item in applicableScenarios" :key="item.id" :value="item.id">{{ item.name }} · {{ item.business_system }} · {{ assetTypeName(item.asset_type_code) }}</a-select-option>
          </a-select>
        </a-form-model-item>
      </a-form-model>
    </a-modal>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import {
  applyConfigurationScenario, configurationResources, configurationScenarioList, configurationTaskList,
  createConfigurationScenario, deleteConfigurationScenario, hostList, retryConfigurationTask,
  updateConfigurationScenario,
} from '@/services/admin'

const emptyScenario = () => ({name: '', business_system: '', asset_type_code: undefined, zid: 0, target_host_group_id: '', template_id: undefined, enabled: true})

export default {
  name: 'ConfigConsumption',
  components: {PageLayout},
  data() {
    return {
      loading: false, tasksLoading: false, saving: false, applying: false,
      scenarios: [], tasks: [], hosts: [],
      resources: {host_groups: [], templates: [], asset_types: []},
      scenarioVisible: false, applyVisible: false, editingScenario: null,
      scenarioForm: emptyScenario(), selectedGroupKey: '',
      applyForm: {host_key: '', hostid: '', zid: 0, scenario_id: undefined}, timer: null,
      scenarioColumns: [
        {title: '场景名称', dataIndex: 'name', width: 190},
        {title: '业务系统', dataIndex: 'business_system', width: 150},
        {title: '资产类型', dataIndex: 'asset_type_code', customRender: value => this.assetTypeName(value), width: 150},
        {title: '目标配置', key: 'target', scopedSlots: {customRender: 'target'}},
        {title: '状态', key: 'enabled', scopedSlots: {customRender: 'enabled'}, width: 100},
        {title: '操作', key: 'scenarioOperation', scopedSlots: {customRender: 'scenarioOperation'}, width: 130},
      ],
      taskColumns: [
        {title: '资产', dataIndex: 'host_name', width: 170},
        {title: '配置场景', key: 'taskScenario', scopedSlots: {customRender: 'taskScenario'}, width: 250},
        {title: '状态', key: 'taskStatus', scopedSlots: {customRender: 'taskStatus'}, width: 130},
        {title: '最近处理', key: 'taskTime', scopedSlots: {customRender: 'taskTime'}, width: 175},
        {title: '错误信息', key: 'taskError', scopedSlots: {customRender: 'taskError'}},
        {title: '操作', key: 'taskOperation', scopedSlots: {customRender: 'taskOperation'}, width: 100},
      ],
    }
  },
  computed: {
    canCreate() { return this.$can('tenant.assets', 'create') },
    canUpdate() { return this.$can('tenant.assets', 'update') },
    canDelete() { return this.$can('tenant.assets', 'delete') },
    canOperate() { return this.$can('tenant.assets', 'operate') || this.canUpdate },
    filteredTemplates() { return this.resources.templates.filter(item => Number(item.zid) === Number(this.scenarioForm.zid)) },
    applicableScenarios() { return this.scenarios.filter(item => item.enabled && Number(item.zid) === Number(this.applyForm.zid)) },
    activeTasks() { return this.tasks.filter(item => item.status === 'pending' || item.status === 'running').length },
  },
  created() {
    this.loadAll()
    this.timer = window.setInterval(() => this.loadTasks(true), 5000)
  },
  beforeDestroy() { if (this.timer) window.clearInterval(this.timer) },
  methods: {
    unwrap(response) {
      const result = response.data
      if (!result || result.code !== 200) throw new Error(result && result.message || '请求失败')
      return result.data
    },
    async loadAll() {
      this.loading = true
      try {
        const [resources, scenarios, hosts] = await Promise.all([
          configurationResources(), configurationScenarioList(), hostList({page: 1, limit: 1000}),
        ])
        this.resources = this.unwrap(resources) || {host_groups: [], templates: [], asset_types: []}
        this.scenarios = this.unwrap(scenarios) || []
        const hostData = this.unwrap(hosts)
        this.hosts = hostData && hostData.items || []
        await this.loadTasks(true)
      } catch (error) { this.$message.error(error.message || '配置消费数据加载失败')
      } finally { this.loading = false }
    },
    async loadTasks(silent) {
      if (!silent) this.tasksLoading = true
      try { this.tasks = this.unwrap(await configurationTaskList()) || []
      } catch (error) { if (!silent) this.$message.error(error.message || '同步任务加载失败')
      } finally { this.tasksLoading = false }
    },
    groupKey(group) { return `${group.zid}:${group.host_group_id}` },
    hostKey(host) { return `${host.zid}:${host.hostid}` },
    assetTypeName(code) {
      const item = this.resources.asset_types.find(candidate => candidate.type_code === code)
      return item ? item.name : code
    },
    statusMeta(status) {
      return ({pending: {label: '等待同步', color: 'blue'}, running: {label: '同步中', color: 'orange'}, success: {label: '已完成', color: 'green'}, failed: {label: '失败', color: 'red'}})[status] || {label: status || '-', color: 'default'}
    },
    formatTime(value) { return value ? new Date(value).toLocaleString('zh-CN', {hour12: false}) : '-' },
    truncate(value, length) { return value.length > length ? `${value.slice(0, length)}…` : value },
    openCreate() {
      this.editingScenario = null
      this.scenarioForm = emptyScenario()
      this.selectedGroupKey = ''
      this.scenarioVisible = true
    },
    openEdit(record) {
      this.editingScenario = record
      this.scenarioForm = {
        name: record.name, business_system: record.business_system, asset_type_code: record.asset_type_code,
        zid: Number(record.zid), target_host_group_id: String(record.target_host_group_id),
        template_id: String(record.template_id), enabled: Boolean(record.enabled),
      }
      this.selectedGroupKey = `${record.zid}:${record.target_host_group_id}`
      this.scenarioVisible = true
    },
    closeScenario() { this.scenarioVisible = false },
    selectGroup(key) {
      const group = this.resources.host_groups.find(item => this.groupKey(item) === key)
      if (!group) return
      const changedInstance = Number(this.scenarioForm.zid) !== Number(group.zid)
      this.scenarioForm.zid = Number(group.zid)
      this.scenarioForm.target_host_group_id = String(group.host_group_id)
      if (changedInstance) this.scenarioForm.template_id = undefined
    },
    validateScenario() {
      if (!this.scenarioForm.name || this.scenarioForm.name.length < 2) return '场景名称至少 2 个字'
      if (!this.scenarioForm.business_system || this.scenarioForm.business_system.length < 2) return '业务系统至少 2 个字'
      if (!this.scenarioForm.asset_type_code || !this.scenarioForm.zid || !this.scenarioForm.target_host_group_id || !this.scenarioForm.template_id) return '请完整选择资产类型、主机组和模板'
      return ''
    },
    async saveScenario() {
      const warning = this.validateScenario()
      if (warning) { this.$message.warning(warning); return }
      this.saving = true
      try {
        if (this.editingScenario) this.unwrap(await updateConfigurationScenario(this.editingScenario.id, this.scenarioForm))
        else this.unwrap(await createConfigurationScenario(this.scenarioForm))
        this.$message.success(this.editingScenario ? '场景已更新，关联资产已重新排队' : '场景已创建')
        this.scenarioVisible = false
        await this.loadAll()
      } catch (error) { this.$message.error(error.message || '场景保存失败')
      } finally { this.saving = false }
    },
    async removeScenario(record) {
      try {
        this.unwrap(await deleteConfigurationScenario(record.id))
        this.$message.success('场景已删除')
        await this.loadAll()
      } catch (error) { this.$message.error(error.message || '场景删除失败') }
    },
    openApply() {
      this.applyForm = {host_key: '', hostid: '', zid: 0, scenario_id: undefined}
      this.applyVisible = true
    },
    closeApply() { this.applyVisible = false },
    selectApplyHost(key) {
      const host = this.hosts.find(item => this.hostKey(item) === key)
      this.applyForm.hostid = host ? String(host.hostid) : ''
      this.applyForm.zid = host ? Number(host.zid) : 0
      this.applyForm.scenario_id = undefined
    },
    async applyScenario() {
      if (!this.applyForm.hostid || !this.applyForm.scenario_id) { this.$message.warning('请选择资产和配置场景'); return }
      this.applying = true
      try {
        this.unwrap(await applyConfigurationScenario(this.applyForm.hostid, {zid: this.applyForm.zid, scenario_id: this.applyForm.scenario_id}))
        this.$message.success('已加入配置消费队列，60 秒内完成同步')
        this.applyVisible = false
        await this.loadTasks(true)
      } catch (error) { this.$message.error(error.message || '应用场景失败')
      } finally { this.applying = false }
    },
    async retry(record) {
      try {
        this.unwrap(await retryConfigurationTask(record.id))
        this.$message.success('已重新加入队列')
        await this.loadTasks(true)
      } catch (error) { this.$message.error(error.message || '重新排队失败') }
    },
  },
}
</script>

<style lang="less" scoped>
.config-consumption { padding: 0 4px; }
.config-consumption__header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.config-consumption__header h2 { margin: 0 0 6px; font-size: 24px; }
.config-consumption__header p, .muted { color: rgba(0, 0, 0, .45); }
.header-action { margin-left: 8px; }
.section-alert { margin-bottom: 16px; }
.section-card { background: #fff; border: 1px solid #edf0f5; border-radius: 8px; margin-bottom: 16px; padding: 18px 20px 4px; }
.section-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.section-title strong { font-size: 16px; margin-right: 12px; }
.section-title span { color: rgba(0, 0, 0, .45); }
@media (max-width: 900px) {
  .config-consumption__header { display: block; }
  .config-consumption__header > div:last-child { margin-top: 12px; }
}
</style>
