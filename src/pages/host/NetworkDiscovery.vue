<template>
  <page-layout :noTitle="true">
    <div class="network-discovery">
      <div class="content-page-header">
        <div>
          <h2>网络发现</h2>
        </div>
        <div>
          <a-button :loading="loading" @click="loadAll"><a-icon type="reload" /> 刷新结果</a-button>
          <a-button v-if="canManage" type="primary" class="header-action" @click="openCreate"><a-icon type="plus" /> 新建扫描规则</a-button>
        </div>
      </div>

      <section class="section-card">
        <div class="section-title">
          <div><strong>扫描规则</strong><span>监控中心每 1 分钟周期执行</span></div>
          <a-tag color="blue">{{ rules.length }} 条</a-tag>
        </div>
        <a-table :loading="loading" :columns="ruleColumns" :data-source="rules" :row-key="record => record.id" :pagination="false" :scroll="{x: 1050}">
          <span slot="ruleName" slot-scope="record"><strong>{{ record.name }}</strong><br /><span class="muted">{{ record.instance_name || `监控源编号 ${record.zid}` }}</span></span>
          <span slot="range" slot-scope="record"><code>{{ record.ip_range }}</code></span>
          <span slot="ports" slot-scope="record"><a-tag v-for="port in splitPorts(record.ports)" :key="port">{{ port }}</a-tag></span>
          <span slot="state" slot-scope="record">
            <a-badge :status="stateMeta(record.state).status" :text="stateMeta(record.state).label" />
            <div v-if="record.error_message" class="error-text" :title="record.error_message">{{ truncate(record.error_message, 38) }}</div>
          </span>
          <span slot="created" slot-scope="record">{{ formatTime(record.created_at) }}<br /><span class="muted">{{ record.created_by }}</span></span>
          <span slot="operation" slot-scope="record">
            <a-popconfirm v-if="canManage" title="将同步删除监控中心的发现规则，确认继续？" @confirm="removeRule(record)">
              <a-button type="link" size="small">删除</a-button>
            </a-popconfirm>
            <span v-else class="muted">只读</span>
          </span>
        </a-table>
      </section>

      <section class="section-card">
        <div class="section-title">
          <div><strong>发现结果</strong><span>只展示当前租户规则中状态为在线 的服务</span></div>
          <a-tag :color="results.length ? 'green' : 'default'">{{ results.length }} 台存活设备</a-tag>
        </div>
        <a-table :loading="loading" :columns="resultColumns" :data-source="results" :row-key="record => `${record.rule_id}:${record.ip}`" :pagination="{pageSize: 10}" :scroll="{x: 900}">
          <span slot="ip" slot-scope="record"><strong>{{ record.ip }}</strong><br /><span class="muted">{{ record.dns || '无 DNS' }}</span></span>
          <span slot="type" slot-scope="record"><a-tag :color="typeColor(record.device_type)">{{ record.device_type || '未知' }}</a-tag></span>
          <span slot="openPorts" slot-scope="record"><a-tag v-for="port in record.open_ports" :key="port" color="green">{{ port }}/TCP</a-tag></span>
          <span slot="lastSeen" slot-scope="record">{{ formatTime(record.last_seen_at) }}</span>
        </a-table>
      </section>
    </div>

    <a-modal :visible="createVisible" title="新建网络发现规则" :confirm-loading="saving" width="620px" ok-text="创建并启用" @ok="saveRule" @cancel="closeCreate">
      <a-form-model layout="vertical">
        <a-form-model-item label="规则名称"><a-input v-model.trim="form.name" maxlength="100" placeholder="例如：办公网 C 段基础发现" /></a-form-model-item>
        <a-form-model-item label="监控源">
          <a-select v-model="form.zid" placeholder="选择执行扫描的实例">
            <a-select-option v-for="item in resources" :key="item.zid" :value="item.zid">{{ item.name }}（{{ item.instance }}）</a-select-option>
          </a-select>
        </a-form-model-item>
        <a-form-model-item label="私有 IPv4 地址或 CIDR">
          <a-input v-model.trim="form.ip_range" placeholder="例如：192.168.10.0/24 或 10.0.0.8" />
          <span class="field-tip">仅支持 RFC1918；CIDR 只允许 /24–/30，不允许多网段。</span>
        </a-form-model-item>
        <a-form-model-item label="TCP 检查端口">
          <a-input v-model.trim="form.ports" placeholder="例如：22,80,443,3306" />
          <span class="field-tip">最多 20 个，逗号分隔；不允许 1-65535 这类范围。</span>
        </a-form-model-item>
      </a-form-model>
    </a-modal>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import {
  createNetworkDiscoveryRule, deleteNetworkDiscoveryRule, networkDiscoveryResources,
  networkDiscoveryResults, networkDiscoveryRules,
} from '@/services/admin'

const emptyForm = () => ({name: '', zid: undefined, ip_range: '', ports: '22,80,443,10050'})

export default {
  name: 'NetworkDiscovery',
  components: {PageLayout},
  data() {
    return {
      loading: false, saving: false, createVisible: false,
      rules: [], results: [], resources: [], form: emptyForm(),
      ruleColumns: [
        {title: '规则', key: 'ruleName', scopedSlots: {customRender: 'ruleName'}, width: 210},
        {title: 'IP 范围', key: 'range', scopedSlots: {customRender: 'range'}, width: 170},
        {title: 'TCP 检查端口', key: 'ports', scopedSlots: {customRender: 'ports'}, width: 270},
        {title: '执行状态', key: 'state', scopedSlots: {customRender: 'state'}, width: 180},
        {title: '创建信息', key: 'created', scopedSlots: {customRender: 'created'}, width: 190},
        {title: '操作', key: 'operation', scopedSlots: {customRender: 'operation'}, width: 90},
      ],
      resultColumns: [
        {title: 'IP / DNS', key: 'ip', scopedSlots: {customRender: 'ip'}, width: 200},
        {title: '设备类型', key: 'type', scopedSlots: {customRender: 'type'}, width: 130},
        {title: '开放端口', key: 'openPorts', scopedSlots: {customRender: 'openPorts'}},
        {title: '来源规则', dataIndex: 'rule_name', width: 180},
        {title: '最近发现', key: 'lastSeen', scopedSlots: {customRender: 'lastSeen'}, width: 190},
      ],
    }
  },
  computed: {
    canManage() { return this.$can('platform.assets', 'create') && this.$can('platform.assets', 'delete') },
  },
  created() { this.loadAll() },
  methods: {
    unwrap(response) {
      const result = response.data
      if (!result || result.code !== 200) throw new Error(result && result.message || '请求失败')
      return result.data
    },
    async loadAll() {
      this.loading = true
      try {
        const calls = [networkDiscoveryRules(), networkDiscoveryResults()]
        if (this.canManage) calls.push(networkDiscoveryResources())
        const values = await Promise.all(calls)
        this.rules = this.unwrap(values[0]) || []
        this.results = this.unwrap(values[1]) || []
        this.resources = this.canManage ? (this.unwrap(values[2]) || []) : []
      } catch (error) { this.$message.error(error.message || '网络发现数据加载失败')
      } finally { this.loading = false }
    },
    openCreate() { this.form = emptyForm(); this.createVisible = true },
    closeCreate() { this.createVisible = false; this.form = emptyForm() },
    async saveRule() {
      if (!this.form.name || !this.form.zid || !this.form.ip_range || !this.form.ports) return this.$message.warning('请完整填写规则信息')
      this.saving = true
      try {
        this.unwrap(await createNetworkDiscoveryRule(this.form))
        this.$message.success('发现规则已创建，请稍后刷新结果')
        this.closeCreate()
        await this.loadAll()
      } catch (error) { this.$message.error(error.message || '创建失败')
      } finally { this.saving = false }
    },
    async removeRule(record) {
      try {
        this.unwrap(await deleteNetworkDiscoveryRule(record.id))
        this.$message.success('发现规则已删除')
        await this.loadAll()
      } catch (error) { this.$message.error(error.message || '删除失败') }
    },
    splitPorts(value) { return String(value || '').split(',').filter(Boolean) },
    stateMeta(state) {
      return ({enabled: {label: '已启用', status: 'success'}, disabled: {label: '已停用', status: 'default'}, missing: {label: '已失效', status: 'warning'}, error: {label: '查询失败', status: 'error'}})[state] || {label: state || '未知', status: 'default'}
    },
    typeColor(type) { return ({'服务器': 'blue', '网络设备': 'cyan', '虚拟化': 'purple', '数据库': 'gold', '中间件': 'magenta'})[type] || 'default' },
    formatTime(value) { return value && !String(value).startsWith('0001-') ? new Date(value).toLocaleString('zh-CN', {hour12: false}) : '-' },
    truncate(value, length) { return value.length > length ? `${value.slice(0, length)}…` : value },
  },
}
</script>

<style scoped>
.network-discovery { padding: 0 4px; }
.content-page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.content-page-header h2 { margin: 0 0 6px; font-size: 24px; }
.content-page-header p, .muted, .field-tip { color: rgba(0, 0, 0, .45); }
.header-action { margin-left: 8px; }
.section-card { padding: 18px 20px; margin-bottom: 18px; background: #fff; border: 1px solid #edf0f5; border-radius: 8px; }
.section-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.section-title strong { font-size: 16px; }
.section-title span { margin-left: 10px; color: rgba(0, 0, 0, .45); }
.error-text { max-width: 160px; margin-top: 4px; color: #f5222d; font-size: 12px; }
.field-tip { display: block; margin-top: 4px; font-size: 12px; }
code { padding: 2px 5px; color: #1d39c4; background: #f0f5ff; border-radius: 3px; }
@media (max-width: 768px) { .content-page-header { display: block; } .content-page-header > div:last-child { margin-top: 12px; } }
</style>
