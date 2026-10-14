<template>
  <page-layout :noTitle="true">
    <div class="resource-discovery smartops-management-page">
      <div class="content-page-header smartops-page-heading">
        <div>
          <h1>五类资源发现</h1>
          <p>按资源类型查看自动发现结果与监控状态。</p>
        </div>
        <a-button :loading="loading" @click="loadOverview"><a-icon type="reload" /> 刷新发现结果</a-button>
      </div>

      <a-row :gutter="16" class="profile-grid">
        <a-col v-for="profile in profiles" :key="profile.code" :xs="24" :sm="12" :lg="8" :xl="profile.code === 'middleware' ? 4 : 5">
          <a-card :class="['profile-card', {active: selectedCategory === profile.code}]" hoverable @click="selectCategory(profile.code)">
            <div class="profile-title"><a-icon :type="profileIcon(profile.code)" /><span>{{ profile.category }}</span></div>
            <div class="profile-count">{{ profile.count || 0 }}</div>
            <div class="profile-product">{{ profile.product }}</div>
            <div class="profile-signature" :title="profile.template_signatures.join(' / ')">{{ profile.template_signatures.join(' / ') }}</div>
          </a-card>
        </a-col>
      </a-row>

      <section class="smartops-content-panel">
        <div class="section-title smartops-panel-heading">
          <div><strong class="smartops-section-label">发现资源</strong><span>按模板证据自动归类</span></div>
          <div>
            <a-radio-group v-model="selectedCategory" button-style="solid" size="small">
              <a-radio-button value="">全部 {{ resources.length }}</a-radio-button>
              <a-radio-button v-for="profile in profiles" :key="profile.code" :value="profile.code">{{ profile.category }}</a-radio-button>
            </a-radio-group>
          </div>
        </div>

        <a-table :loading="loading" :columns="columns" :data-source="filteredResources" :row-key="rowKey" :pagination="{pageSize: 10}" :scroll="{x: 1550}">
          <span slot="resource" slot-scope="record">
            <strong>{{ record.host_name }}</strong><br />
            <span class="muted">{{ record.instance_name || `监控源编号 ${record.zid}` }} · 监控主机 {{ record.host_id }}</span>
          </span>
          <span slot="category" slot-scope="record">
            <a-tag :color="categoryColor(record.category_code)">{{ record.category }}</a-tag>
            <div class="product">{{ record.product }}</div>
          </span>
          <span slot="interface" slot-scope="record">
            <strong>{{ valueOrMissing(record.address) }}</strong><br />
            <span class="muted">{{ record.interface_type }}<template v-if="record.interface_port"> : {{ record.interface_port }}</template></span>
          </span>
          <span slot="availability" slot-scope="record"><a-badge :status="availabilityMeta(record.availability).status" :text="availabilityMeta(record.availability).label" /></span>
          <span slot="template" slot-scope="record"><a-tag color="blue">{{ record.template_name }}</a-tag><div class="evidence">{{ record.evidence }}</div></span>
          <span slot="inventory" slot-scope="record">
            <div><b>厂商/型号：</b>{{ inventoryPair(record.inventory.vendor, record.inventory.model) }}</div>
            <div><b>系统：</b>{{ valueOrMissing(record.inventory.os) }}</div>
            <div><b>序列号：</b>{{ valueOrMissing(record.inventory.serial_no) }}</div>
            <div><b>位置：</b>{{ valueOrMissing(record.inventory.location) }}</div>
          </span>
        </a-table>
      </section>

      <div class="smartops-panel-footer">已检查 {{ overview.source_host_count || 0 }} 台已纳管主机；{{ overview.unmatched_host_count || 0 }} 台未匹配资源模板。</div>
    </div>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import {resourceDiscoveryOverview} from '@/services/admin'

export default {
  name: 'ResourceDiscovery',
  components: {PageLayout},
  data() {
    return {
      loading: false,
      selectedCategory: '',
      overview: {profiles: [], resources: [], source_host_count: 0, unmatched_host_count: 0},
      columns: [
        {title: '资源 / 实例', key: 'resource', scopedSlots: {customRender: 'resource'}, width: 225},
        {title: '分类 / 代表产品', key: 'category', scopedSlots: {customRender: 'category'}, width: 160},
        {title: '主接口', key: 'interface', scopedSlots: {customRender: 'interface'}, width: 185},
        {title: '可用性', key: 'availability', scopedSlots: {customRender: 'availability'}, width: 105},
        {title: '模板证据', key: 'template', scopedSlots: {customRender: 'template'}, width: 315},
        {title: '已采集配置属性', key: 'inventory', scopedSlots: {customRender: 'inventory'}, width: 420},
      ],
    }
  },
  computed: {
    profiles() { return this.overview.profiles || [] },
    resources() { return this.overview.resources || [] },
    filteredResources() { return this.selectedCategory ? this.resources.filter(item => item.category_code === this.selectedCategory) : this.resources },
  },
  created() { this.loadOverview() },
  methods: {
    async loadOverview() {
      this.loading = true
      try {
        const response = await resourceDiscoveryOverview()
        const result = response.data
        if (!result || result.code !== 200) throw new Error(result && result.message || '请求失败')
        this.overview = result.data || {profiles: [], resources: [], source_host_count: 0, unmatched_host_count: 0}
      } catch (error) { this.$message.error(error.message || '资源发现数据加载失败')
      } finally { this.loading = false }
    },
    selectCategory(code) { this.selectedCategory = this.selectedCategory === code ? '' : code },
    rowKey(record) { return `${record.zid}:${record.host_id}:${record.category_code}` },
    valueOrMissing(value) { return value || '未采集' },
    inventoryPair(vendor, model) { return [vendor, model].filter(Boolean).join(' / ') || '未采集' },
    profileIcon(code) { return ({network: 'global', server: 'hdd', virtualization: 'cloud-server', database: 'database', middleware: 'api'})[code] || 'appstore' },
    categoryColor(code) { return ({network: 'cyan', server: 'blue', virtualization: 'purple', database: 'gold', middleware: 'magenta'})[code] || 'default' },
    availabilityMeta(value) { return ({available: {status: 'success', label: '可用'}, unavailable: {status: 'error', label: '不可用'}, unknown: {status: 'default', label: '未知'}})[value] || {status: 'default', label: '未知'} },
  },
}
</script>

<style scoped>

.profile-grid { margin-bottom: 18px; }
.profile-grid .ant-col { margin-bottom: 12px; }
.profile-card { height: 154px; border: 1px solid var(--smartops-line); }
.profile-card.active { border-color: var(--smartops-signal-blue); box-shadow: none; background: #edf2f7; }
.profile-title { color: rgba(0, 0, 0, .65); font-size: 15px; }
.profile-title span { margin-left: 8px; }
.profile-count { margin-top: 8px; color: #17233d; font-size: 30px; font-weight: 600; line-height: 36px; }
.profile-product { color: var(--smartops-signal-blue); font-weight: 500; }
.profile-signature { overflow: hidden; margin-top: 5px; color: rgba(0, 0, 0, .38); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.section-title > div:first-child > span { margin-left: 10px; color: var(--smartops-muted); font-size: 12px; }
.muted { color: var(--smartops-muted); }
.product { margin-top: 5px; font-size: 12px; }
.evidence { margin-top: 5px; color: rgba(0, 0, 0, .45); font-size: 12px; }
</style>
