<template>
  <page-layout :noTitle="true">
    <div class="script-discovery">
      <div class="content-page-header">
        <div>
          <h2>扩展脚本发现</h2>
        </div>
        <a-button :loading="loading" @click="loadCandidates"><a-icon type="reload" /> 刷新结果</a-button>
      </div>

      <section class="section-card">
        <div class="section-title">
          <div><strong>发现候选</strong><span>候选仅供查看</span></div>
          <a-tag :color="readyCount ? 'green' : undefined">{{ readyCount }} 个待人工确认</a-tag>
        </div>
        <a-table :loading="loading" :columns="columns" :data-source="candidates" :row-key="rowKey" :pagination="{pageSize: 10}" :scroll="{x: 1380}">
          <span slot="asset" slot-scope="record">
            <strong>{{ record.host_name }}</strong><br />
            <span class="muted">{{ record.instance_name || `监控源编号 ${record.zid}` }} · {{ record.type_code }}</span>
          </span>
          <span slot="item" slot-scope="record">
            <strong>{{ record.item_name }}</strong><br />
            <span class="mono">{{ record.item_key }}</span>
          </span>
          <span slot="type" slot-scope="record"><a-tag color="blue">{{ record.item_type }}</a-tag></span>
          <span slot="collected" slot-scope="record">{{ formatTime(record.last_collected) }}</span>
          <span slot="fields" slot-scope="record">
            <template v-if="record.mappable_fields && record.mappable_fields.length">
              <a-tag v-for="field in record.mappable_fields" :key="field.key" color="cyan">{{ field.label }}：{{ displayValue(field.value) }}</a-tag>
            </template>
            <span v-else class="muted">无可核对候选字段</span>
          </span>
          <span slot="status" slot-scope="record">
            <a-badge :status="record.status === 'ready' ? 'success' : 'error'" :text="record.status === 'ready' ? '候选可核对' : '候选无效'" />
            <div v-if="record.error_message" class="error" :title="record.error_message">{{ record.error_message }}</div>
          </span>
        </a-table>
      </section>
    </div>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import {scriptDiscoveryList} from '@/services/admin'

export default {
  name: 'ScriptDiscovery',
  components: {PageLayout},
  data() {
    return {
      loading: false,
      candidates: [],
      columns: [
        {title: '资产 / 类型', key: 'asset', scopedSlots: {customRender: 'asset'}, width: 210},
        {title: '受信监控项', key: 'item', scopedSlots: {customRender: 'item'}, width: 310},
        {title: '采集方式', key: 'type', scopedSlots: {customRender: 'type'}, width: 200},
        {title: '最新采集', key: 'collected', scopedSlots: {customRender: 'collected'}, width: 180},
        {title: 'CMDB 候选字段（只读）', key: 'fields', scopedSlots: {customRender: 'fields'}, width: 340},
        {title: '校验状态', key: 'status', scopedSlots: {customRender: 'status'}, width: 210},
      ],
    }
  },
  computed: {
    readyCount() { return this.candidates.filter(item => item.status === 'ready').length },
  },
  created() { this.loadCandidates() },
  methods: {
    unwrap(response) {
      const result = response.data
      if (!result || result.code !== 200) throw new Error(result && result.message || '请求失败')
      return result.data
    },
    async loadCandidates() {
      this.loading = true
      try { this.candidates = this.unwrap(await scriptDiscoveryList()) || []
      } catch (error) { this.$message.error(error.message || '扩展脚本发现结果加载失败')
      } finally { this.loading = false }
    },
    rowKey(record) { return `${record.zid}:${record.item_id}` },
    formatTime(value) { return value ? new Date(value).toLocaleString('zh-CN', {hour12: false}) : '尚未采集' },
    displayValue(value) { return value === null || value === undefined || value === '' ? '空' : String(value) },
  },
}
</script>

<style scoped>
.script-discovery { padding: 0 4px; }
.content-page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.content-page-header h2 { margin: 0 0 6px; font-size: 24px; }
.content-page-header p, .muted { color: rgba(0, 0, 0, .45); }
.section-card { padding: 18px 20px; background: #fff; border: 1px solid #edf0f5; border-radius: 8px; }
.section-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.section-title strong { font-size: 16px; }
.section-title span { margin-left: 10px; color: rgba(0, 0, 0, .45); }
.mono { color: rgba(0, 0, 0, .45); font-family: SFMono-Regular, Consolas, monospace; font-size: 11px; }
.error { overflow: hidden; max-width: 200px; margin-top: 4px; color: #f5222d; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 900px) { .content-page-header, .section-title { display: block; } .content-page-header button, .section-title .ant-tag { margin-top: 12px; } }
</style>
