<template>
  <page-layout :noTitle="true">
    <div class="domain-page">
      <div class="heading">
        <div><h2>域名监控</h2><p>共 {{ rows.filter(r => !r.removed).length }} 个域名 · 连续两次失败触发告警，恢复后自动解除</p></div>
        <div><a-button :loading="loading" @click="load">刷新</a-button>
          <a-button v-auth="'create'" type="primary" @click="edit(null)">新增域名</a-button></div>
      </div>
      <a-alert v-if="error" :message="error" type="error" show-icon />
      <a-table :columns="columns" :data-source="rows" row-key="id" :loading="loading" :scroll="{x: 1250}" :pagination="{pageSize: 15}">
        <span slot="endpoint" slot-scope="r"><strong>{{ r.name }}</strong><br>{{ r.config.scheme }}://{{ r.domain }}:{{ r.config.port }}{{ r.config.path }}</span>
        <span slot="state" slot-scope="r"><a-tag :color="statusMeta(r.observation)[1]">{{ statusMeta(r.observation)[0] }}</a-tag><br>{{ r.sample ? reasonText(r.sample.reason) : '—' }}</span>
        <span slot="checks" slot-scope="r">{{ checkText(r, 'dns_ok') }} / {{ checkText(r, 'tcp_ok') }} / {{ checkText(r, 'tls_ok') }}</span>
        <span slot="metric" slot-scope="r">{{ r.sample && r.sample.status_code ? r.sample.status_code + ' / ' + r.sample.response_ms.toFixed(1) + ' ms' : '—' }}</span>
        <span slot="cert" slot-scope="r">{{ r.config.scheme === 'http' ? '不适用' : (r.sample && r.sample.tls_ok === 1 ? r.sample.cert_days.toFixed(1) + ' 天' : '—') }}</span>
        <span slot="time" slot-scope="r">{{ r.sample ? clock(r.sample.clock) : '—' }}<br>周期 {{ r.interval }} 秒</span>
        <span slot="action" slot-scope="r">
          <a-button type="link" size="small" @click="history(r)">历史</a-button>
          <a-button v-if="!r.removed" v-auth="'update'" type="link" size="small" @click="edit(r)">编辑</a-button>
          <a-button v-if="!r.removed" v-auth="'update'" type="link" size="small" :disabled="saving" @click="toggle(r)">{{ r.enabled ? '停用' : '启用' }}</a-button>
          <a-button v-if="r.state !== 'ready'" v-auth="'update'" type="link" size="small" :disabled="saving" @click="retry(r)">重试同步</a-button>
          <a-popconfirm v-if="!r.removed" title="移除后停止采集并保留历史；同名域名不能重新创建。确认移除？" @confirm="remove(r)">
            <a-button v-auth="'delete'" type="link" size="small" :disabled="saving">移除</a-button>
          </a-popconfirm>
        </span>
      </a-table>
      <p class="muted">仅监控部署准入清单内的域名与网段。检测时间取决于采集周期及连续失败次数，不能等同于告警传输时间。</p>
    </div>
    <a-modal :visible="visible" :title="editing ? '编辑域名' : '新增域名'" :confirm-loading="saving" width="720px" @ok="save" @cancel="visible = false">
      <a-form-model layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12"><a-form-model-item label="监控名称"><a-input v-model="form.name" aria-label="监控名称" :max-length="100" /></a-form-model-item></a-col>
          <a-col :span="12"><a-form-model-item label="完整域名"><a-input v-model="form.config.domain" aria-label="完整域名" :disabled="!!editing" placeholder="www.example.com" /></a-form-model-item></a-col>
        </a-row>
        <a-form-model-item label="当前租户监控分组">
          <a-select v-model="scopeKey" :disabled="!!editing" aria-label="监控分组" @change="selectScope">
            <a-select-option v-for="s in scopes" :key="s.zid + ':' + s.host_group_id" :value="s.zid + ':' + s.host_group_id">{{ s.host_group_name || s.host_group_id }}（实例 {{ s.zid }}）</a-select-option>
          </a-select>
        </a-form-model-item>
        <a-row :gutter="16">
          <a-col :span="8"><a-form-model-item label="协议"><a-select v-model="form.config.scheme" @change="form.config.port = form.config.scheme === 'https' ? 443 : 80"><a-select-option value="https">HTTPS</a-select-option><a-select-option value="http">HTTP</a-select-option></a-select></a-form-model-item></a-col>
          <a-col :span="8"><a-form-model-item label="端口"><a-input-number v-model="form.config.port" aria-label="端口" :min="1" :max="65535" /></a-form-model-item></a-col>
          <a-col :span="8"><a-form-model-item label="路径（不含查询参数）"><a-input v-model="form.config.path" aria-label="路径" /></a-form-model-item></a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8"><a-form-model-item label="采集周期（秒）"><a-input-number v-model="form.interval" aria-label="采集周期" :min="10" :max="3600" /></a-form-model-item></a-col>
          <a-col :span="8"><a-form-model-item label="整轮超时（秒）"><a-input-number v-model="form.config.timeout" aria-label="整轮超时" :min="1" :max="10" /></a-form-model-item></a-col>
          <a-col :span="8"><a-form-model-item label="慢响应阈值（毫秒）"><a-input-number v-model="form.config.slow_ms" aria-label="慢响应阈值" :min="1" :max="60000" /></a-form-model-item></a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12"><a-form-model-item label="期望状态码（逗号分隔）"><a-input v-model="codes" aria-label="期望状态码" /></a-form-model-item></a-col>
          <a-col :span="12"><a-form-model-item label="证书到期预警（天）"><a-input-number v-model="form.config.cert_days" :disabled="form.config.scheme === 'http'" :min="0" :max="365" /></a-form-model-item></a-col>
        </a-row>
        <a-form-model-item label="页面须包含的关键字（可选，最多检查1MB正文）"><a-input v-model="form.config.keyword" aria-label="页面关键字" :max-length="256" /></a-form-model-item>
        <a-form-model-item label="启用监控"><a-switch v-model="form.enabled" /></a-form-model-item>
      </a-form-model>
    </a-modal>
    <a-drawer :visible="drawer" :title="selected ? selected.domain + ' · 最近24小时采样' : '采样历史'" width="800" @close="closeHistory">
      <a-alert v-if="historyError" :message="historyError" type="error" />
      <a-spin :spinning="historyLoading"><div ref="chart" class="chart"></div>
        <a-table :columns="historyColumns" :data-source="samples" :row-key="(r, i) => r.clock + ':' + i" :pagination="{pageSize: 10}">
          <span slot="clock" slot-scope="r">{{ clock(r.clock) }}</span>
          <span slot="reason" slot-scope="r">{{ reasonText(r.reason) }}</span>
          <span slot="latency" slot-scope="r">{{ r.status_code > 0 ? r.response_ms.toFixed(1) : '—' }}</span>
        </a-table>
      </a-spin>
      <a-button @click="$router.push('/alarm/query')">查看集中告警</a-button>
    </a-drawer>
  </page-layout>
</template>
<script>
import PageLayout from '@/layouts/PageLayout'
import * as echarts from 'echarts'
import * as api from '@/services/domain-monitor'
import {defaultForm, writePayload, validateForm, statusMeta, reasonText, chartOption} from './view'
export default {
  name: 'DomainMonitoring', components: {PageLayout},
  data() {
    return {rows: [], scopes: [], loading: false, saving: false, error: '', visible: false, editing: null,
      form: defaultForm(), codes: '200', scopeKey: '', drawer: false, samples: [], selected: null, chart: null, historyLoading: false, historyError: '',
      columns: [
        {title: '域名端点', key: 'endpoint', scopedSlots: {customRender: 'endpoint'}, width: 240},
        {title: '状态', key: 'state', scopedSlots: {customRender: 'state'}, width: 135},
        {title: 'DNS / TCP / TLS', key: 'checks', scopedSlots: {customRender: 'checks'}, width: 150},
        {title: 'HTTP / 响应时间', key: 'metric', scopedSlots: {customRender: 'metric'}, width: 150},
        {title: '证书剩余', key: 'cert', scopedSlots: {customRender: 'cert'}, width: 100},
        {title: '最近采样', key: 'time', scopedSlots: {customRender: 'time'}, width: 180},
        {title: '操作', key: 'action', scopedSlots: {customRender: 'action'}, width: 270}
      ],
      historyColumns: [
        {title: '采样时间', key: 'clock', scopedSlots: {customRender: 'clock'}},
        {title: '检查结果', key: 'reason', scopedSlots: {customRender: 'reason'}},
        {title: '响应时间 ms', key: 'latency', scopedSlots: {customRender: 'latency'}}
      ]}
  },
  created() { this.load() },
  beforeDestroy() { if (this.chart) this.chart.dispose() },
  methods: {
    statusMeta, reasonText,
    clock(v) { return new Date(v * 1000).toLocaleString() },
    checkText(r, key) {
      if (key === 'tls_ok' && r.config.scheme === 'http') return '不适用'
      if (!r.sample) return '—'
      if ((key === 'tcp_ok' && (!r.sample.dns_ok || r.sample.reason === 'policy_denied')) || (key === 'tls_ok' && !r.sample.tcp_ok)) return '未执行'
      return r.sample[key] === 1 ? '通过' : '未通过'
    },
    unwrap(res) { if (!res.data || res.data.code !== 200) throw new Error(res.data && res.data.message || '请求失败'); return res.data.data },
    async load() {
      this.loading = true; this.error = ''
      try { const data = this.unwrap(await api.listDomains()); this.rows = data.items; this.scopes = data.scopes || [] }
      catch (e) { this.rows = []; this.error = e.message }
      finally { this.loading = false }
    },
    edit(row) {
      this.editing = row; this.form = row ? writePayload(row) : defaultForm()
      this.codes = this.form.config.codes.join(',')
      this.scopeKey = row ? row.zid + ':' + row.group_id : ''
      if (!row && this.scopes.length === 1) { this.scopeKey = this.scopes[0].zid + ':' + this.scopes[0].host_group_id; this.selectScope(this.scopeKey) }
      this.visible = true
    },
    selectScope(key) { const parts = key.split(':'); this.form.zid = Number(parts[0]); this.form.group_id = parts[1] },
    async mutate(work) {
      if (this.saving) return false
      this.saving = true
      try {
        const row = this.unwrap(await work())
        if (row.state !== 'ready') this.$message.warning('配置已保存，但监控同步未完成，请检查采集服务后重试')
        else this.$message.success('操作成功')
        await this.load(); return true
      } catch (e) { this.$message.error(e.message); return false }
      finally { this.saving = false }
    },
    async save() {
      const message = validateForm(this.form, this.codes)
      if (message) { this.$message.warning(message); return }
      this.form.config.codes = this.codes.split(',').map(Number)
      if (await this.mutate(() => api.saveDomain(this.editing && this.editing.id, writePayload(this.form)))) this.visible = false
    },
    toggle(row) { const body = writePayload(row); body.enabled = !row.enabled; return this.mutate(() => api.saveDomain(row.id, body)) },
    retry(row) { return this.mutate(() => api.syncDomain(row)) },
    remove(row) { return this.mutate(() => api.removeDomain(row)) },
    async history(row) {
      this.closeHistory(); this.selected = row; this.samples = []; this.historyError = ''; this.drawer = true; this.historyLoading = true
      try {
        const samples = this.unwrap(await api.domainHistory(row.id))
        if (!this.drawer || this.selected !== row) return
        this.samples = samples
        await this.$nextTick()
        if (this.$refs.chart) { this.chart = echarts.init(this.$refs.chart); this.chart.setOption(chartOption(samples)) }
      } catch (e) { this.historyError = e.message }
      finally { this.historyLoading = false }
    },
    closeHistory() { if (this.chart) this.chart.dispose(); this.chart = null; this.drawer = false; this.selected = null }
  }
}
</script>
<style scoped>
.domain-page {padding:24px;background:#fff;border-radius:8px}
.heading {display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:16px}
.heading h2 {margin-bottom:8px}.heading p,.muted {color:#6b7280}
.heading button {margin-left:8px}.chart {height:260px;margin:20px 0}
</style>
