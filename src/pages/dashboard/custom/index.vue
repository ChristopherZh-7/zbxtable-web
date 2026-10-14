<template>
  <page-layout :noTitle="true">
    <a-alert v-if="!visualizationMode" type="info" show-icon style="margin-bottom: 16px" message="主页现在支持直接编辑">
      <template slot="description">
        <p>在主页点击“编辑主页”，即可添加组件、调整布局并保存。下方保留之前创建的独立仪表盘。</p>
        <a-button type="primary" size="small" @click="$router.push('/dashboard/workplace')">前往主页</a-button>
      </template>
    </a-alert>
    <template v-if="visualizationMode">
      <div class="screen-management-heading">
        <h2>大屏管理</h2>
        <span>顶部“进入大屏”打开默认屏；默认选择仅对你在本机的当前租户生效。</span>
      </div>
      <div class="builtin-screen">
        <div class="builtin-screen__icon"><a-icon type="dashboard" /></div>
        <div class="builtin-screen__description">
          <strong>运维大屏</strong><a-tag>内置模板</a-tag><a-tag v-if="!defaultScreenID" color="blue">默认</a-tag>
          <p>主机分布、资源排行与实时告警。可直接展示，也可复制后调整布局。</p>
        </div>
        <div class="screen-actions">
          <a-button icon="play-circle" @click="showBuiltin">展示</a-button>
          <a-button v-if="$can('tenant.dashboard', 'create')" icon="copy" @click="copyBuiltin">复制并编辑</a-button>
          <a-button :disabled="!defaultScreenID" @click="setDefault(null)">{{ defaultScreenID ? '设为默认' : '当前默认' }}</a-button>
        </div>
      </div>
    </template>
    <a-form-model layout="inline" class="dashboard-search">
      <a-form-model-item :label="`${resourceLabel}名称`">
        <a-input v-model.trim="name" allow-clear placeholder="输入名称" @pressEnter="load" />
      </a-form-model-item>
      <a-form-model-item>
        <a-button type="primary" @click="load">查询</a-button>
        <a-button style="margin-left: 8px" @click="reset">重置</a-button>
        <a-button v-auth="'create'" type="primary" style="margin-left: 8px" @click="createNew">
          <a-icon type="plus" /> 新建{{ resourceLabel }}
        </a-button>
      </a-form-model-item>
    </a-form-model>

    <a-table
      :loading="loading"
      :columns="tableColumns"
      :scroll="visualizationMode ? {x: 1060} : undefined"
      :data-source="items"
      :pagination="pagination"
      :row-key="record => record.id"
      @change="changePage"
    >
      <span slot="screenName" slot-scope="record">
        {{ record.name }} <a-tag v-if="defaultScreenID === String(record.id)" color="blue">默认</a-tag>
      </span>
      <span slot="visibility" slot-scope="record">
        <a-tag :color="record.visibility === 'tenant' ? 'blue' : 'purple'">
          {{ record.visibility === 'tenant' ? '租户可见' : '仅自己可见' }}
        </a-tag>
      </span>
      <span slot="chartCount" slot-scope="record">{{ chartCount(record) }}</span>
      <span slot="shareStatus" slot-scope="record">
        <a-tag :color="record.share_enabled ? 'green' : undefined">
          {{ record.share_enabled ? '已开启' : '未开启' }}
        </a-tag>
      </span>
      <span slot="updatedAt" slot-scope="record">{{ formatTime(record.updated_at) }}</span>
      <span slot="operation" slot-scope="record" class="screen-actions">
        <a-button type="link" size="small" @click="view(record)">{{ visualizationMode ? '展示' : '查看' }}</a-button>
        <a-button v-auth="'update'" type="link" size="small" @click="edit(record)">编辑</a-button>
        <a-button v-if="visualizationMode && $can('tenant.dashboard', 'create')" type="link" size="small" @click="copy(record)">复制</a-button>
        <a-button v-if="visualizationMode" type="link" size="small" :disabled="defaultScreenID === String(record.id)" @click="setDefault(record)">{{ defaultScreenID === String(record.id) ? '当前默认' : '设为默认' }}</a-button>
        <a-popconfirm :title="`确认删除该${resourceLabel}？`" @confirm="remove(record)">
          <a-button v-auth="'delete'" type="link" size="small">删除</a-button>
        </a-popconfirm>
      </span>
    </a-table>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import {dashboardList, deleteDashboard} from '@/services/admin'
import {defaultScreenKey, screenPreferenceStorage, readDefaultScreen, writeDefaultScreen, screenLocation} from './screen-management'

export default {
  name: 'CustomDashboards',
  components: {PageLayout},
  data() {
    return {
      name: '',
      loading: false,
      items: [],
      page: 1,
      pageSize: 10,
      defaultScreenID: null,
      pagination: {
        total: 0,
        current: 1,
        pageSize: 10,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: total => `共 ${total} 条`,
      },
      columns: [
        {title: '名称', dataIndex: 'name', key: 'name'},
        {title: '可见范围', key: 'visibility', scopedSlots: {customRender: 'visibility'}, width: 130},
        {title: '组件数', key: 'chartCount', scopedSlots: {customRender: 'chartCount'}, width: 90},
        {title: '分享', key: 'shareStatus', scopedSlots: {customRender: 'shareStatus'}, width: 100},
        {title: '更新时间', key: 'updatedAt', scopedSlots: {customRender: 'updatedAt'}, width: 180},
        {title: '操作', key: 'operation', scopedSlots: {customRender: 'operation'}, width: 220},
      ],
    }
  },
  created() {
    this.readPreference()
    this.load()
  },
  mounted() { window.addEventListener('storage', this.readPreference) },
  beforeDestroy() { window.removeEventListener('storage', this.readPreference) },
  activated() { this.readPreference() },
  computed: {
    tableColumns() {
      if (!this.visualizationMode) return this.columns
      return this.columns.map(column => column.key === 'name'
        ? {title: '名称', key: 'name', width: 230, scopedSlots: {customRender: 'screenName'}}
        : column.key === 'operation' ? {...column, width: 330, fixed: 'right'} : column)
    },
    visualizationMode() {
      return this.$route.path.startsWith('/topology/custom-screen')
    },
    resourceLabel() {
      return this.visualizationMode ? '大屏' : '仪表盘'
    },
    designerPath() {
      return this.visualizationMode ? '/topology/custom-screen-designer' : '/dashboard/custom-dashboard-designer'
    },
  },
  methods: {
    readPreference() {
      this.defaultScreenID = readDefaultScreen(screenPreferenceStorage(window), defaultScreenKey(this.$store))
    },
    setDefault(record) {
      if (!writeDefaultScreen(screenPreferenceStorage(window), defaultScreenKey(this.$store), record ? record.id : null)) {
        this.$message.warning('当前浏览器无法保存默认大屏，请检查存储设置')
        return
      }
      this.readPreference()
      this.$message.success(`已将“${record ? record.name : '运维大屏'}”设为默认`)
    },
    showBuiltin() { this.$router.push(screenLocation(null)) },
    copyBuiltin() {
      if (!this.$can('tenant.dashboard', 'create')) return
      this.$router.push({path: this.designerPath, query: {template: 'operations'}})
    },
    copy(record) {
      if (!this.$can('tenant.dashboard', 'create')) return
      this.$router.push({path: this.designerPath, query: {copy_from: record.id}})
    },
    load() {
      this.loading = true
      dashboardList({page: this.page, limit: this.pageSize, name: this.name}).then((response) => {
        const result = response.data
        if (result.code !== 200) throw new Error(result.message || '加载失败')
        this.items = result.data.items || []
        this.pagination = {...this.pagination, total: result.data.total || 0, current: this.page, pageSize: this.pageSize}
      }).catch((error) => {
        this.$message.error(error.message || '仪表盘加载失败')
      }).finally(() => { this.loading = false })
    },
    reset() {
      this.name = ''
      this.page = 1
      this.load()
    },
    changePage(page) {
      this.page = page.current
      this.pageSize = page.pageSize
      this.load()
    },
    chartCount(record) {
      return Array.isArray(record.nodes) ? record.nodes.length : 0
    },
    formatTime(value) {
      if (!value) return '--'
      return new Date(value).toLocaleString()
    },
    createNew() {
      this.$router.push(this.designerPath)
    },
    edit(record) {
      this.$router.push({path: this.designerPath, query: {id: record.id}})
    },
    view(record) {
      if (this.visualizationMode) this.$router.push(screenLocation(record.id))
      else this.$router.push({path: this.designerPath, query: {id: record.id, readonly: '1'}})
    },
    remove(record) {
      deleteDashboard(record.id).then((response) => {
        const result = response.data
        if (result.code !== 200) throw new Error(result.message || '删除失败')
        if (this.defaultScreenID === String(record.id)) {
          writeDefaultScreen(screenPreferenceStorage(window), defaultScreenKey(this.$store), null)
          this.readPreference()
        }
        this.$message.success(`${this.resourceLabel}已删除`)
        this.load()
      }).catch((error) => this.$message.error(error.message || '删除失败'))
    },
  },
}
</script>

<style lang="less" scoped>
.dashboard-search {
  margin-bottom: 16px;
}
.screen-management-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.screen-management-heading h2 { font-size: 20px; font-weight: 600; margin: 0; }
.screen-management-heading span { font-size: 12px; color: #65798e; }
.builtin-screen { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; padding: 20px; margin-bottom: 24px; border: 1px solid #dbe6ef; background: #f6f9fc; border-radius: 6px; }
.builtin-screen__icon { display: grid; place-items: center; width: 48px; height: 48px; color: #285e90; background: #e4eef7; border-radius: 6px; font-size: 24px; }
.builtin-screen__description { flex: 1; min-width: 260px; }
.builtin-screen__description strong { margin-right: 12px; font-size: 16px; }
.builtin-screen__description p { margin: 8px 0 0; color: #65798e; }
.screen-actions { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.builtin-screen .screen-actions { flex-wrap: wrap; }
</style>
