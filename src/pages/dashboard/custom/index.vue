<template>
  <page-layout :noTitle="true">
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

    <a-alert
      :message="`${resourceLabel}数据源由服务端按当前租户主机组重验；个人${resourceLabel}仅创建者可见。`"
      type="info"
      show-icon
      style="margin-bottom: 16px"
    />

    <a-table
      :loading="loading"
      :columns="columns"
      :data-source="items"
      :pagination="pagination"
      :row-key="record => record.id"
      @change="changePage"
    >
      <span slot="visibility" slot-scope="record">
        <a-tag :color="record.visibility === 'tenant' ? 'blue' : 'purple'">
          {{ record.visibility === 'tenant' ? '租户可见' : '仅自己可见' }}
        </a-tag>
      </span>
      <span slot="chartCount" slot-scope="record">{{ chartCount(record) }}</span>
      <span slot="shareStatus" slot-scope="record">
        <a-tag :color="record.share_enabled ? 'green' : 'default'">
          {{ record.share_enabled ? '已开启' : '未开启' }}
        </a-tag>
      </span>
      <span slot="updatedAt" slot-scope="record">{{ formatTime(record.updated_at) }}</span>
      <span slot="operation" slot-scope="record">
        <a-button type="link" size="small" @click="view(record)">查看</a-button>
        <a-button v-auth="'update'" type="link" size="small" @click="edit(record)">编辑</a-button>
        <a-popconfirm title="确认删除该仪表盘？" @confirm="remove(record)">
          <a-button v-auth="'delete'" type="link" size="small">删除</a-button>
        </a-popconfirm>
      </span>
    </a-table>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import {dashboardList, deleteDashboard} from '@/services/admin'

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
    this.load()
  },
  computed: {
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
      this.$router.push({path: this.designerPath, query: {id: record.id, readonly: '1'}})
    },
    remove(record) {
      deleteDashboard(record.id).then((response) => {
        const result = response.data
        if (result.code !== 200) throw new Error(result.message || '删除失败')
        this.$message.success('仪表盘已删除')
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
</style>
