<template>
  <page-layout :noTitle="true">
    <div class="custom-dashboard-designer">
      <div class="custom-dashboard-designer__header">
        <div class="custom-dashboard-designer__identity">
          <h2>{{ dashboardId ? (isReadonly ? `查看${resourceLabel}` : `编辑${resourceLabel}`) : `新建${resourceLabel}` }}</h2>
          <a-input v-model.trim="form.name" :disabled="isReadonly" :placeholder="`${resourceLabel}名称`" style="width: 260px" />
          <a-select v-model="form.visibility" :disabled="isReadonly" style="width: 140px">
            <a-select-option value="personal">仅自己可见</a-select-option>
            <a-select-option value="tenant">租户可见</a-select-option>
          </a-select>
          <a-tag color="blue">{{ nodes.length }} 个组件</a-tag>
        </div>
        <div>
          <a-button :loading="refreshing" @click="refreshAll"><a-icon type="sync" /> 刷新数据</a-button>
          <a-button
            v-if="dashboardId && !isReadonly"
            :loading="shareLoading"
            style="margin-left: 8px"
            @click="generateShare"
          >
            <a-icon type="share-alt" /> {{ dashboard && dashboard.share_enabled ? '重新生成分享' : '生成分享' }}
          </a-button>
          <a-popconfirm
            v-if="dashboardId && !isReadonly && dashboard && dashboard.share_enabled"
            title="撤销后当前分享链接将立即失效，确认撤销？"
            @confirm="revokeShare"
          >
            <a-button :loading="shareRevoking" style="margin-left: 8px"><a-icon type="stop" /> 撤销分享</a-button>
          </a-popconfirm>
          <a-button v-if="!isReadonly" type="primary" :loading="saving" style="margin-left: 8px" @click="save">
            <a-icon type="save" /> 保存仪表盘
          </a-button>
          <a-button style="margin-left: 8px" @click="back">返回列表</a-button>
        </div>
      </div>

      <a-alert
        v-if="isReadonly"
        message="当前为只读查看模式，可刷新图表数据，但不能改变布局、数据源或可见范围。"
        type="info"
        show-icon
        style="margin: 0 16px 12px"
      />

      <div v-if="!isReadonly" class="custom-dashboard-designer__palette">
        <strong>展示组件</strong>
        <span class="palette-hint">拖入画布，或单击快速添加</span>
        <div
          v-for="item in chartTypes"
          :key="item.value"
          class="dashboard-chart-tool"
          role="button"
          :aria-label="`添加${item.label}`"
          @click="addChart(item.value)"
        >
          <span
            class="dashboard-chart-tool__drag"
            :aria-label="`拖拽${item.label}`"
            @mousedown.stop="startDrag(item.value, $event)"
            @click.stop
          >
            <a-icon :type="item.icon" />
          </span>
          <span>{{ item.label }}</span>
        </div>
      </div>

      <div class="custom-dashboard-designer__body">
        <div class="custom-dashboard-designer__canvas-wrap">
          <div ref="canvas" class="custom-dashboard-designer__canvas"></div>
        </div>

        <aside v-if="!isReadonly" class="custom-dashboard-designer__editor">
          <template v-if="selectedNode">
            <h3>组件配置</h3>
            <a-form-model layout="vertical">
              <a-form-model-item label="组件类型">
                <a-select v-model="editor.chart_type" @change="applyEditor">
                  <a-select-option v-for="item in chartTypes" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
                </a-select>
              </a-form-model-item>
              <a-form-model-item label="组件标题">
                <a-input v-model.trim="editor.title" placeholder="组件标题" @change="applyEditor" />
              </a-form-model-item>
              <a-form-model-item label="主机">
                <a-select
                  v-model="selectedHostKey"
                  show-search
                  option-filter-prop="children"
                  placeholder="选择当前租户主机"
                  @change="selectHost"
                >
                  <a-select-option v-for="host in hosts" :key="hostKey(host)" :value="hostKey(host)">
                    {{ host.name }}（{{ host.instance_name }}）
                  </a-select-option>
                </a-select>
              </a-form-model-item>
              <a-form-model-item label="数值监控项">
                <a-select
                  v-model="editor.data_source.itemid"
                  show-search
                  option-filter-prop="children"
                  :loading="itemsLoading"
                  :disabled="!selectedHostKey"
                  placeholder="选择监控项"
                  @change="selectItem"
                >
                  <a-select-option v-for="item in numericItems" :key="item.itemid" :value="item.itemid">
                    {{ item.name }}{{ item.units ? `（${item.units}）` : '' }}
                  </a-select-option>
                </a-select>
              </a-form-model-item>
              <div class="dashboard-style-grid">
                <a-form-model-item label="前景色">
                  <input v-model="editor.style.color" type="color" aria-label="组件前景色" @input="applyEditor">
                </a-form-model-item>
                <a-form-model-item label="背景色">
                  <input v-model="editor.style.background" type="color" aria-label="组件背景色" @input="applyEditor">
                </a-form-model-item>
              </div>
              <a-form-model-item label="数值小数位">
                <a-select v-model="editor.style.precision" @change="applyEditor">
                  <a-select-option v-for="precision in [0, 1, 2, 3, 4]" :key="precision" :value="precision">
                    {{ precision }} 位
                  </a-select-option>
                </a-select>
              </a-form-model-item>
            </a-form-model>
            <a-button type="danger" ghost block @click="removeSelected"><a-icon type="delete" /> 删除组件</a-button>
          </template>
          <a-empty v-else description="选择画布中的组件后配置数据源" />
        </aside>
      </div>

      <a-modal v-model="shareVisible" title="只读分享链接" :footer="null" width="640px">
        <a-alert
          message="此链接无需登录，仅展示当前场景和最近 24 小时数据。重新生成后旧链接立即失效。"
          type="warning"
          show-icon
          style="margin-bottom: 16px"
        />
        <a-input :value="shareUrl" readonly aria-label="只读分享链接">
          <a-button slot="addonAfter" @click="openShare">打开投屏页</a-button>
        </a-input>
      </a-modal>
    </div>
  </page-layout>
</template>

<script>
import moment from 'moment'
import * as echarts from 'echarts'
import {Addon, Graph} from '@antv/x6'
import PageLayout from '@/layouts/PageLayout'
import {
  createDashboard,
  dashboardDetail,
  hostList,
  hostMockd,
  itemList,
  generateDashboardShare,
  revokeDashboardShare,
  updateDashboard,
} from '@/services/admin'
import {
  CHART_TYPES,
  defaultNodeData,
  normalizeDashboardNodes,
  registerDashboardChartNode,
  validateDashboardNodes,
} from './dashboard-canvas'

registerDashboardChartNode(Graph, echarts)

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export default {
  name: 'CustomDashboardDesigner',
  components: {PageLayout},
  data() {
    return {
      dashboardId: '',
      dashboard: null,
      graph: null,
      chartTypes: CHART_TYPES,
      form: {name: '', visibility: 'personal', canvasWidth: 1600, canvasHeight: 900},
      nodes: [],
      selectedNode: null,
      editor: defaultNodeData('line'),
      selectedHostKey: '',
      hosts: [],
      numericItems: [],
      itemsLoading: false,
      saving: false,
      refreshing: false,
      shareLoading: false,
      shareRevoking: false,
      shareVisible: false,
      shareUrl: '',
      loadingDashboard: false,
      addIndex: 0,
    }
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
    listPath() {
      return this.visualizationMode ? '/topology/custom-screens' : '/dashboard/custom-dashboards'
    },
    isReadonly() {
      return this.$route.query.readonly === '1' || Boolean(this.dashboardId && !this.$can('tenant.dashboard', 'update'))
    },
  },
  created() {
    this.dashboardId = this.$route.query.id || ''
    if (!this.dashboardId && !this.$can('tenant.dashboard', 'create')) {
      this.$router.replace('/dashboard/custom-dashboards')
    }
  },
  mounted() {
    this.initGraph()
    if (!this.isReadonly) this.loadHosts()
    if (this.dashboardId) this.loadDashboard()
  },
  beforeDestroy() {
    if (this.graph) this.graph.dispose()
  },
  methods: {
    initGraph() {
      this.graph = new Graph({
        container: this.$refs.canvas,
        width: '100%',
        height: 720,
        background: {color: '#f5f7fb'},
        grid: {visible: true, size: 10},
        panning: true,
        mousewheel: {enabled: true, modifiers: ['ctrl', 'meta']},
        resizing: {enabled: !this.isReadonly, minWidth: 240, minHeight: 160},
        selecting: {enabled: !this.isReadonly, showNodeSelectionBox: true},
        interacting: !this.isReadonly,
      })
      this.graph.on('node:click', ({node}) => {
        if (!this.isReadonly) this.selectNode(node)
      })
      this.graph.on('node:added', ({node}) => {
        this.syncNodes()
        if (!this.loadingDashboard && !this.isReadonly) this.selectNode(node)
      })
      this.graph.on('node:removed', () => this.syncNodes())
      this.graph.on('node:change:position', () => this.syncNodes())
      this.graph.on('node:change:size', () => this.syncNodes())
      this.graph.on('blank:click', () => {
        this.selectedNode = null
        this.selectedHostKey = ''
      })
    },
    syncNodes() {
      this.nodes = this.graph ? this.graph.getNodes() : []
    },
    nodeConfig(chartType, position) {
      return {
        shape: 'dashboard-chart',
        x: position.x,
        y: position.y,
        width: 360,
        height: 240,
        data: defaultNodeData(chartType),
      }
    },
    nextPosition() {
      const index = this.addIndex++
      return {x: 30 + (index % 3) * 390, y: 30 + Math.floor(index / 3) * 270}
    },
    addChart(chartType) {
      if (this.isReadonly) return
      this.graph.addNode(this.nodeConfig(chartType, this.nextPosition()))
    },
    startDrag(chartType, event) {
      if (this.isReadonly) return
      const node = this.graph.createNode(this.nodeConfig(chartType, {x: 0, y: 0}))
      const dnd = new Addon.Dnd({target: this.graph})
      dnd.start(node, event)
    },
    selectNode(node) {
      this.selectedNode = node
      this.editor = clone(node.getData() || defaultNodeData('line'))
      if (!this.editor.data_source) this.editor.data_source = defaultNodeData('line').data_source
      if (!this.editor.style) this.editor.style = defaultNodeData('line').style
      const source = this.editor.data_source
      this.selectedHostKey = source.zid && source.hostid ? `${source.zid}:${source.hostid}` : ''
      this.numericItems = []
      if (this.selectedHostKey) this.loadItems(source.zid, source.hostid)
    },
    applyEditor() {
      if (!this.selectedNode) return
      this.selectedNode.setData(clone(this.editor))
    },
    hostKey(host) {
      return `${host.zid}:${host.hostid}`
    },
    loadHosts() {
      hostList({page: 1, limit: 200}).then((response) => {
        const result = response.data
        if (result.code !== 200) throw new Error(result.message || '主机加载失败')
        this.hosts = result.data.items || []
      }).catch((error) => this.$message.error(error.message || '主机加载失败'))
    },
    selectHost(key) {
      const host = this.hosts.find(candidate => this.hostKey(candidate) === key)
      if (!host) return
      this.editor.data_source = {
        zid: Number(host.zid),
        hostid: String(host.hostid),
        host_name: host.name || host.host,
        itemid: '', item_name: '', history: '', units: '',
      }
      this.applyEditor()
      this.loadItems(host.zid, host.hostid)
    },
    loadItems(zid, hostid) {
      this.itemsLoading = true
      itemList({zid, hostid}).then((response) => {
        const result = response.data
        if (result.code !== 200) throw new Error(result.message || '监控项加载失败')
        this.numericItems = (result.data.items || []).filter(item => ['0', '3'].includes(String(item.value_type)))
      }).catch((error) => this.$message.error(error.message || '监控项加载失败'))
        .finally(() => { this.itemsLoading = false })
    },
    selectItem(itemid) {
      const item = this.numericItems.find(candidate => String(candidate.itemid) === String(itemid))
      if (!item) return
      this.editor.data_source = {
        ...this.editor.data_source,
        itemid: String(item.itemid),
        item_name: item.name,
        history: String(item.value_type),
        units: item.units || '',
      }
      if (!this.editor.title || CHART_TYPES.some(chart => chart.label === this.editor.title)) this.editor.title = item.name
      this.applyEditor()
      this.refreshNode(this.selectedNode)
    },
    removeSelected() {
      if (!this.selectedNode) return
      this.graph.removeNode(this.selectedNode)
      this.selectedNode = null
      this.selectedHostKey = ''
    },
    generateShare() {
      if (!this.dashboardId) return
      this.shareLoading = true
      generateDashboardShare(this.dashboardId).then((response) => {
        const result = response.data
        if (result.code !== 200 || !result.data || !result.data.token) throw new Error(result.message || '分享链接生成失败')
        this.dashboard = {...this.dashboard, share_enabled: true, shared_at: result.data.shared_at}
        this.shareUrl = `${window.location.origin}${window.location.pathname}#/share/dashboard/${result.data.token}`
        this.shareVisible = true
        this.$message.success('新的只读分享链接已生成')
      }).catch((error) => this.$message.error(error.message || '分享链接生成失败'))
        .finally(() => { this.shareLoading = false })
    },
    revokeShare() {
      this.shareRevoking = true
      revokeDashboardShare(this.dashboardId).then((response) => {
        const result = response.data
        if (result.code !== 200) throw new Error(result.message || '撤销分享失败')
        this.dashboard = {...this.dashboard, share_enabled: false, shared_at: null}
        this.shareVisible = false
        this.shareUrl = ''
        this.$message.success('分享链接已撤销')
      }).catch((error) => this.$message.error(error.message || '撤销分享失败'))
        .finally(() => { this.shareRevoking = false })
    },
    openShare() {
      if (this.shareUrl) window.open(this.shareUrl, '_blank', 'noopener')
    },
    loadDashboard() {
      this.loadingDashboard = true
      dashboardDetail(this.dashboardId).then((response) => {
        const result = response.data
        if (result.code !== 200) throw new Error(result.message || '仪表盘加载失败')
        this.dashboard = result.data
        this.form = {
          name: this.dashboard.name,
          visibility: this.dashboard.visibility,
          canvasWidth: this.dashboard.canvas_width || 1600,
          canvasHeight: this.dashboard.canvas_height || 900,
        }
        const nodes = Array.isArray(this.dashboard.nodes) ? this.dashboard.nodes : JSON.parse(this.dashboard.nodes || '[]')
        this.graph.fromJSON({nodes, edges: []})
        this.syncNodes()
        this.graph.zoomToFit({padding: 30, maxScale: 1})
        return this.refreshAll()
      }).catch((error) => this.$message.error(error.message || '仪表盘加载失败'))
        .finally(() => { this.loadingDashboard = false })
    },
    refreshNode(node) {
      if (!node) return Promise.resolve()
      const data = clone(node.getData() || {})
      const source = data.data_source || {}
      if (!source.itemid || !['0', '3'].includes(String(source.history))) return Promise.resolve()
      const period = [moment().subtract(24, 'hours').format('YYYY-MM-DD HH:mm:ss'), moment().format('YYYY-MM-DD HH:mm:ss')]
      return hostMockd({history: source.history, itemids: source.itemid, period}).then((response) => {
        const result = response.data
        if (result.code !== 200) throw new Error(result.message || '历史数据加载失败')
        data.series = (result.data.items || []).map(item => ({clock: item.clock, value: Number(item.value)}))
        node.setData(data)
      })
    },
    refreshAll() {
      if (!this.graph) return Promise.resolve()
      this.refreshing = true
      return Promise.all(this.graph.getNodes().map(node => this.refreshNode(node))).catch((error) => {
        this.$message.error(error.message || '部分图表刷新失败')
      }).finally(() => { this.refreshing = false })
    },
    save() {
      if (!this.form.name || this.form.name.length < 2) {
        this.$message.warning('请输入至少 2 个字符的仪表盘名称')
        return
      }
      const error = validateDashboardNodes(this.graph.getNodes())
      if (error) {
        this.$message.warning(error)
        return
      }
      const payload = {
        name: this.form.name,
        visibility: this.form.visibility,
        nodes: normalizeDashboardNodes(this.graph.getNodes()),
        canvas_width: this.form.canvasWidth,
        canvas_height: this.form.canvasHeight,
      }
      this.saving = true
      const request = this.dashboardId ? updateDashboard(this.dashboardId, payload) : createDashboard(payload)
      request.then((response) => {
        const result = response.data
        if (result.code !== 200) throw new Error(result.message || '保存失败')
        this.dashboard = result.data
        this.dashboardId = String(result.data.id)
        this.$router.replace({path: this.designerPath, query: {id: this.dashboardId}})
        this.$message.success(`${this.resourceLabel}保存成功`)
      }).catch((error) => this.$message.error(error.message || `${this.resourceLabel}保存失败`))
        .finally(() => { this.saving = false })
    },
    back() {
      this.$router.push(this.listPath)
    },
  },
}
</script>

<style lang="less">
.custom-dashboard-designer {
  background: #fff;
}
.custom-dashboard-designer__header {
  min-height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid #e8e8e8;
}
.custom-dashboard-designer__identity {
  display: flex;
  align-items: center;
  gap: 10px;
}
.custom-dashboard-designer__identity h2 {
  margin: 0 10px 0 0;
  white-space: nowrap;
}
.custom-dashboard-designer__palette {
  min-height: 70px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid #e8e8e8;
}
.palette-hint {
  color: #8c8c8c;
  margin-right: 8px;
}
.dashboard-chart-tool {
  width: 92px;
  height: 46px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  cursor: pointer;
  background: #fafafa;
  user-select: none;
}
.dashboard-chart-tool__drag {
  display: inline-flex;
  padding: 7px;
  margin: -7px;
  cursor: grab;
}
.dashboard-chart-tool:hover {
  color: #1890ff;
  border-color: #1890ff;
  background: #e6f7ff;
}
.custom-dashboard-designer__body {
  display: flex;
  min-height: 720px;
}
.custom-dashboard-designer__canvas-wrap {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.custom-dashboard-designer__canvas {
  width: 100%;
  height: 720px;
}
.custom-dashboard-designer__editor {
  width: 320px;
  padding: 18px;
  border-left: 1px solid #e8e8e8;
  background: #fff;
}
.custom-dashboard-designer__editor h3 {
  margin-bottom: 16px;
}
.dashboard-style-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.dashboard-style-grid input[type='color'] {
  width: 100%;
  height: 34px;
  padding: 2px 4px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
}
.dashboard-chart-node {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid #dfe5ef;
  border-radius: 8px;
  box-shadow: 0 3px 12px rgba(31, 45, 61, 0.12);
  overflow: hidden;
}
.dashboard-chart-node__header {
  height: 48px;
  box-sizing: border-box;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-bottom: 2px solid var(--dashboard-accent, #1677ff);
}
.dashboard-chart-node__header strong,
.dashboard-chart-node__header span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dashboard-chart-node__header span {
  color: #8c8c8c;
  font-size: 11px;
}
.dashboard-chart-node__plot {
  width: 100%;
  height: calc(100% - 48px);
  overflow: auto;
}
.dashboard-data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.dashboard-data-table th,
.dashboard-data-table td {
  padding: 7px 10px;
  border-bottom: 1px solid #edf0f5;
  text-align: left;
}
.dashboard-data-table th {
  color: var(--dashboard-accent, #1677ff);
}
.dashboard-mini-topology {
  min-width: 320px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  box-sizing: border-box;
}
.dashboard-mini-topology__node {
  min-width: 90px;
  max-width: 130px;
  padding: 12px;
  border: 2px solid var(--dashboard-accent, #1677ff);
  border-radius: 8px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dashboard-mini-topology__node--metric {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dashboard-mini-topology__node--metric strong {
  color: var(--dashboard-accent, #1677ff);
  font-size: 18px;
}
.dashboard-mini-topology__edge {
  color: #8c8c8c;
  white-space: nowrap;
}
</style>
