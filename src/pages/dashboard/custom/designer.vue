<template>
  <page-layout :noTitle="true" :class="{'custom-dashboard-presentation-page': presenting}">
    <div ref="designer" class="custom-dashboard-designer" :class="{'is-presenting': presenting, 'has-screen-heading': canvasHeading}">
      <div v-show="!presenting" class="custom-dashboard-designer__header">
        <div class="custom-dashboard-designer__identity">
          <h2>{{ dashboardId ? (isReadonly ? `查看${resourceLabel}` : `编辑${resourceLabel}`) : `新建${resourceLabel}` }}</h2>
          <a-input v-model.trim="form.name" :disabled="isReadonly" :placeholder="`${resourceLabel}名称`" class="designer-name" />
          <a-select v-model="form.visibility" :disabled="isReadonly" style="width: 140px">
            <a-select-option value="personal">仅自己可见</a-select-option>
            <a-select-option value="tenant">租户可见</a-select-option>
          </a-select>
        </div>
        <div class="custom-dashboard-designer__actions">
          <a-button :loading="refreshing" @click="refreshAll"><a-icon type="sync" /> 刷新数据</a-button>
          <a-button
            v-if="dashboardId && !isReadonly"
            :loading="shareLoading"
            @click="generateShare"
          >
            <a-icon type="share-alt" /> {{ dashboard && dashboard.share_enabled ? '重新生成分享' : '生成分享' }}
          </a-button>
          <a-popconfirm
            v-if="dashboardId && !isReadonly && dashboard && dashboard.share_enabled"
            title="撤销后当前分享链接将立即失效，确认撤销？"
            @confirm="revokeShare"
          >
            <a-button :loading="shareRevoking"><a-icon type="stop" /> 撤销分享</a-button>
          </a-popconfirm>
          <a-popconfirm
            v-if="!isReadonly && nodes.length"
            title="清空后当前未保存的组件会被移除，确认继续？"
            @confirm="clearCanvas"
          >
            <a-button class="clear-canvas-btn" icon="delete">清空画布</a-button>
          </a-popconfirm>
          <a-button icon="arrow-left" @click="back">返回列表</a-button>
          <a-button icon="play-circle" :disabled="!nodes.length" @click="startPresentation">展示{{ resourceLabel }}</a-button>
          <a-button v-if="!isReadonly" type="primary" :loading="saving" @click="save">
            <a-icon type="save" /> 保存{{ resourceLabel }}
          </a-button>
        </div>
      </div>
      <div v-show="!presenting" class="designer-context">
        <a-tag color="blue">{{ nodes.length }} 个组件</a-tag>
        <span class="designer-meta">画布 {{ form.canvasWidth }} × {{ form.canvasHeight }}</span>
        <span class="designer-layout-badge">{{ activePresetLabel }}</span>
        <span class="designer-flow-hint">保存后可从列表展示；编辑中的展示为当前草稿预览。</span>
      </div>

      <div v-if="presenting && !canvasHeading" class="presentation-toolbar">
        <strong>{{ form.name || resourceLabel + '预览' }}</strong>
        <a-button icon="fullscreen" @click="togglePresentationFullscreen">{{ presentationFullscreen ? '退出全屏' : '全屏显示' }}</a-button>
        <a-button icon="close" @click="exitPresentation">{{ presentationOnly ? '返回原页面' : '退出展示' }}</a-button>
      </div>

      <a-alert
        v-if="isReadonly && !presenting"
        message="当前为只读查看模式，可刷新图表数据，但不能改变布局、数据源或可见范围。"
        type="info"
        show-icon
        style="margin: 0 16px 12px"
      />

      <div v-if="!isReadonly" class="custom-dashboard-designer__palette">
        <div class="palette-heading">
        <strong>{{ visualizationMode ? '原版运维组件' : '展示组件' }}</strong>
        <span class="palette-hint">{{ visualizationMode ? '原版配套样式 · 拖入画布，或单击添加' : '拖入画布，或单击快速添加' }}</span>
        <a-button v-if="visualizationMode" type="link" size="small" @click="extraChartsExpanded = !extraChartsExpanded">{{ extraChartsExpanded ? '收起补充图表' : '更多同款图表' }}</a-button>
        </div>
        <div class="palette-grid">
        <div
          v-for="item in paletteTypes"
          :key="item.value"
          class="dashboard-chart-tool"
          role="button"
          tabindex="0"
          :aria-label="`添加${item.label}`"
          @click="addChart(item.value)"
          @keydown.enter.prevent="addChart(item.value)"
          @keydown.space.prevent="addChart(item.value)"
        >
          <span
            class="dashboard-chart-tool__drag"
            :aria-label="`拖拽${item.label}`"
            @mousedown.stop="startDrag(item.value, $event)"
            @click.stop
          >
            <a-icon :type="item.icon" />
          </span>
          <span class="dashboard-chart-tool__label">{{ item.label }}</span>
        </div>
        </div>
      </div>

      <details v-if="!isReadonly" class="custom-dashboard-designer__presets" @toggle="presetsExpanded = $event.target.open">
        <summary class="presets-heading">
          <strong>更换预置布局</strong>
          <span>{{ visualizationMode ? '运维模块自动读取当前租户数据；单指标组件需绑定监控项' : '先预览图表样式，再为组件绑定监控项' }}</span>
        </summary>
        <div v-if="presetsExpanded" class="preset-list">
          <div v-for="preset in presets" :key="preset.key" class="preset-card">
            <div class="preset-preview" :class="{'preset-preview--dark': visualizationMode}" :aria-label="preset.label + '布局预览'">
              <svg v-if="visualizationMode" :viewBox="'0 0 ' + preset.width + ' ' + preset.height" width="100%" height="100%" :aria-label="preset.label + '原版样式预览'">
                <foreignObject x="0" y="0" :width="preset.width" :height="preset.height">
                  <div xmlns="http://www.w3.org/1999/xhtml" class="screen-surface preset-screen-surface" :style="{width: preset.width + 'px', height: preset.height + 'px'}">
                    <div class="screen-header"><div class="header-title"><div class="title-main">{{ preset.key === 'operations-screen' ? '运维监控指挥中心' : preset.label }}</div><div class="title-sub">集中监控与运行态势</div></div></div>
                    <template v-for="node in preset.nodes">
                      <operations-widget v-if="isOperationsType(node.chart_type)" :key="node.title" :type="node.chart_type" :title="node.title"
                        :style="presetScreenNodeStyle(node)" />
                      <screen-panel v-else :key="node.title" :title="node.title" extra="监控指标" :style="presetScreenNodeStyle(node)">
                        <div class="preset-screen-graphic" v-html="previewGraphic(node.chart_type)"></div>
                      </screen-panel>
                    </template>
                  </div>
                </foreignObject>
              </svg>
              <template v-else>
              <span
                v-for="node in preset.nodes"
                :key="preset.key + '-' + node.title"
                class="preset-preview__node"
                :style="presetPreviewStyle(preset, node)"
                :title="node.title"
              ><span class="preset-preview__graphic" v-html="previewGraphic(node.chart_type)"></span></span>
              </template>
            </div>
            <div class="preset-card__body">
              <strong>{{ preset.label }}</strong>
              <span>{{ preset.description }}</span>
              <a-button size="small" @click="applyPreset(preset)">套用模板</a-button>
            </div>
          </div>
        </div>
      </details>

      <div class="custom-dashboard-designer__body">
        <div ref="canvasWrap" class="custom-dashboard-designer__canvas-wrap">
          <div v-show="!presenting" class="canvas-help">
            <strong>画布布局</strong>
            <span>{{ isReadonly ? '只读查看；拖动空白处平移画布。' : '点击组件或从配置区选择；拖动空白处平移画布。' }}</span>
            <div class="canvas-tools">
              <a-button size="small" aria-label="缩小画布" @click="changeZoom(-0.1)">−</a-button>
              <span>{{ Math.round(canvasZoom * 100) }}%</span>
              <a-button size="small" aria-label="放大画布" @click="changeZoom(0.1)">＋</a-button>
              <a-button size="small" @click="resetZoom">{{ isReadonly ? '100% 查看' : '100% 编辑' }}</a-button>
              <a-button size="small" @click="fitCanvas">查看全图</a-button>
            </div>
          </div>
          <div v-if="!isReadonly" class="layout-tools">
            <span class="selection-hint">已选 {{ selectionCount }} 项 <small>Ctrl / ⌘ 单击多选</small></span>
            <a-button size="small" @click="selectAllComponents">全选</a-button>
            <a-select placeholder="对齐方式" :value="undefined" :disabled="selectionCount < 2" style="width: 116px" @change="arrangeSelection">
              <a-select-option value="left">左对齐</a-select-option>
              <a-select-option value="center">水平居中</a-select-option>
              <a-select-option value="right">右对齐</a-select-option>
              <a-select-option value="top">顶端对齐</a-select-option>
              <a-select-option value="middle">垂直居中</a-select-option>
              <a-select-option value="bottom">底端对齐</a-select-option>
            </a-select>
            <label>间距 <a-input-number v-model="layoutGap" :min="0" :max="200" :precision="0" size="small" aria-label="组件间距（像素）" /> px</label>
            <a-button size="small" :disabled="selectionCount < 2" @click="arrangeSelection('horizontal-gap')">统一横向间距</a-button>
            <a-button size="small" :disabled="selectionCount < 2" @click="arrangeSelection('vertical-gap')">统一纵向间距</a-button>
            <span class="snap-hint"><a-icon type="border" /> 10 px 网格 · 自动对齐线</span>
          </div>
          <div class="canvas-stage">
            <div v-if="visualizationMode" class="screen-design-surface screen-surface" :style="screenSurfaceStyle"></div>
            <div v-if="canvasHeading" class="screen-design-heading" :style="screenHeadingStyle">
              <header-bar :title="form.name" :viewport-label="form.canvasWidth + '×' + form.canvasHeight">
                <template slot="left">
                  <button v-if="presenting" type="button" class="header-btn" @click="exitPresentation"><a-icon type="arrow-left" />{{ presentationOnly ? '返回原页面' : '退出展示' }}</button>
                  <span v-else class="screen-status">原版运维大屏</span>
                </template>
                <template slot="controls">
                  <span class="screen-status">30 秒自动刷新</span>
                  <button v-if="presenting" type="button" class="header-btn" @click="refreshAll"><a-icon type="sync" />刷新数据</button>
                  <button v-if="presenting" type="button" class="header-btn" @click="togglePresentationFullscreen"><a-icon type="fullscreen" />{{ presentationFullscreen ? '退出全屏' : '全屏显示' }}</button>
                </template>
              </header-bar>
            </div>
            <div ref="canvas" class="custom-dashboard-designer__canvas"></div>
          </div>
        </div>

        <aside v-if="!isReadonly" class="custom-dashboard-designer__editor">
          <label for="dashboard-component-picker">选择要编辑的组件</label>
          <a-select
            id="dashboard-component-picker"
            :value="selectedNode ? selectedNode.id : undefined"
            placeholder="选择组件"
            style="width: 100%; margin: 8px 0 16px"
            @change="selectComponent"
          >
            <a-select-option v-for="node in nodes" :key="node.id" :value="node.id">
              {{ node.getData().title || '未命名组件' }}
            </a-select-option>
          </a-select>
          <template v-if="selectedNode">
            <h3>组件配置</h3>
            <div class="selected-node-summary">
              <strong>当前选中：{{ editor.title || '未命名组件' }}</strong>
              <span>{{ editor.chart_type }} · 可拖拽画布或编辑下方坐标</span>
            </div>
            <a-form-model layout="vertical">
              <a-form-model-item label="组件类型">
                <a-select v-model="editor.chart_type" @change="applyEditor">
                  <a-select-option v-for="item in chartTypes" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
                </a-select>
              </a-form-model-item>
              <a-form-model-item label="组件标题">
                <a-input v-model.trim="editor.title" placeholder="组件标题" @change="applyEditor" />
              </a-form-model-item>
              <div class="dashboard-layout-grid dashboard-layout-grid--first">
                <a-form-model-item label="X 坐标">
                  <a-input-number v-model="layout.x" :min="0" :max="form.canvasWidth" @change="applyLayout" />
                </a-form-model-item>
                <a-form-model-item label="Y 坐标">
                  <a-input-number v-model="layout.y" :min="0" :max="form.canvasHeight" @change="applyLayout" />
                </a-form-model-item>
                <a-form-model-item label="宽度">
                  <a-input-number v-model="layout.width" :min="240" :max="Math.min(1600, form.canvasWidth)" @change="applyLayout" />
                </a-form-model-item>
                <a-form-model-item label="高度">
                  <a-input-number v-model="layout.height" :min="160" :max="Math.min(1200, form.canvasHeight)" @change="applyLayout" />
                </a-form-model-item>
              </div>
              <a-alert v-if="isOperationsType(editor.chart_type)" message="数据源：当前租户运维汇总（与运维大屏一致）" type="info" show-icon />
              <a-form-model-item v-if="isOperationsType(editor.chart_type) && ['ops-linux', 'ops-windows'].includes(editor.chart_type)" label="默认排行指标">
                <a-select v-model="editor.data_source.metric" @change="applyEditor"><a-select-option value="cpu">CPU</a-select-option><a-select-option value="mem">内存</a-select-option></a-select>
              </a-form-model-item>
              <template v-if="!isOperationsType(editor.chart_type)">
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
              </template>
            </a-form-model>
            <a-button type="danger" ghost block @click="removeSelected"><a-icon type="delete" /> 删除组件</a-button>
          </template>
          <a-empty v-else description="选择画布中的组件后配置数据源" />
        </aside>
      </div>

      <a-modal v-model="shareVisible" title="只读分享链接" :footer="null" width="640px">
        <a-alert
          message="此链接无需登录，会公开所选组件的当前租户汇总或最近 24 小时监控数据，请仅提供给可信接收者。重新生成后旧链接立即失效。"
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
  indexInfo, indexTrigger, indexRestop, indexEgress,
} from '@/services/admin'
import {
  CHART_TYPES,
  defaultNodeData,
  normalizeDashboardNodes,
  registerDashboardChartNode,
  validateDashboardNodes,
} from './dashboard-canvas'
import {DASHBOARD_PRESETS, SCREEN_PRESETS} from './designer-presets'
import {previewGraphic} from './component-preview'
import {OPERATIONS_TYPES, OPERATIONS_PRESET, isOperationsType} from '../../screen/operations-model'
import {renderOperationsNode} from './operations-renderer'
import OperationsWidget from '../../screen/components/OperationsWidget'
import HeaderBar from '../../screen/components/HeaderBar'
import ScreenPanel from '../../screen/components/ScreenPanel'
import {arrangeNodes, presentationTransform} from './designer-layout'
import {screenID, copyScreenDraft} from './screen-management'

registerDashboardChartNode(Graph, echarts)

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export default {
  name: 'CustomDashboardDesigner',
  components: {PageLayout, OperationsWidget, HeaderBar, ScreenPanel},
  props: {
    presentationOnly: {type: Boolean, default: false},
    screenId: {type: String, default: ''},
  },
  data() {
    return {
      dashboardId: '',
      dashboard: null,
      graph: null,
      activePresetKey: '',
      presetsExpanded: false,
      extraChartsExpanded: false,
      form: {name: '', visibility: 'personal', canvasWidth: 1600, canvasHeight: 900},
      nodes: [],
      selectedNode: null,
      editor: defaultNodeData('line'),
      layout: {x: 0, y: 0, width: 360, height: 240},
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
      canvasZoom: 1,
      canvasTranslation: {tx: 0, ty: 0},
      canvasViewMode: 'edit',
      selectionCount: 0,
      layoutGap: 16,
      presenting: this.presentationOnly,
      presentationFullscreen: false,
    }
  },
  computed: {
    chartTypes() { return this.visualizationMode ? [...OPERATIONS_TYPES, ...CHART_TYPES] : CHART_TYPES },
    paletteTypes() { return this.visualizationMode && !this.extraChartsExpanded ? OPERATIONS_TYPES : this.chartTypes },
    canvasHeading() { return this.visualizationMode && this.nodes.length > 0 && this.nodes.every(node => node.getPosition().y >= 80) },
    screenSurfaceStyle() {
      return {width: this.form.canvasWidth + 'px', height: this.form.canvasHeight + 'px',
        transform: `translate(${this.canvasTranslation.tx}px, ${this.canvasTranslation.ty}px) scale(${this.canvasZoom})`}
    },
    screenHeadingStyle() { return {...this.screenSurfaceStyle, height: '80px'} },
    presets() { return this.visualizationMode ? [OPERATIONS_PRESET, ...SCREEN_PRESETS] : DASHBOARD_PRESETS },
    visualizationMode() {
      return this.presentationOnly || this.$route.path.startsWith('/topology/custom-screen')
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
      return this.presenting || this.$route.query.readonly === '1' || this.presentationOnly || Boolean(this.dashboardId && !this.$can('tenant.dashboard', 'update'))
    },
    activePresetLabel() {
      const preset = this.presets.find(item => item.key === this.activePresetKey)
      return preset ? '当前布局：' + preset.label : '自由布局'
    },
  },
  watch: {
    '$route'(route) {
      if (!this.presentationOnly && this.graph && route.path === this.designerPath && this.designerSourceKey(route) !== this._designerSource) this.initializeDashboard()
    },
    isReadonly() {
      if (!this.graph) return
      const content = this.graph.toJSON()
      content.cells.forEach(cell => {
        if (cell.data) cell.data.preview_enabled = !this.isReadonly
      })
      this.graph.dispose()
      if (this._disposeRenderers) this._disposeRenderers()
      this.selectedNode = null
      this.selectedHostKey = ''
      this.initGraph()
      this.loadingDashboard = true
      this.graph.fromJSON(content)
      this.loadingDashboard = false
      this.syncNodes()
      this.fitCanvas()
      if (!this.isReadonly) this.loadHosts()
    },
  },
  created() {
    this.dashboardId = this.screenId || screenID(this.$route.query.id) || ''
    if (!this.dashboardId && !this.$can('tenant.dashboard', 'create')) {
      this.$router.replace(this.listPath)
    }
  },
  mounted() {
    this.initGraph()
    this._canvasObserver = new ResizeObserver(() => this.resizeCanvas())
    this._canvasObserver.observe(this.$refs.canvasWrap)
    window.addEventListener('resize', this.resizeCanvas)
    document.addEventListener('fullscreenchange', this.syncPresentationFullscreen)
    window.addEventListener('keydown', this.presentationKeydown)
    if (!this.isReadonly) this.loadHosts()
    this.initializeDashboard()
    this._operationsTimer = setInterval(() => {
        if (this.visualizationMode || this.nodes.some(node => isOperationsType(node.getData().chart_type))) this.refreshAll()
    }, 30000)
  },
  beforeDestroy() {
    this._dashboardRequest = (this._dashboardRequest || 0) + 1
    if (this._canvasObserver) this._canvasObserver.disconnect()
    window.removeEventListener('resize', this.resizeCanvas)
    document.removeEventListener('fullscreenchange', this.syncPresentationFullscreen)
    window.removeEventListener('keydown', this.presentationKeydown)
    if (this.graph) this.graph.dispose()
    if (this._disposeRenderers) this._disposeRenderers()
    clearInterval(this._operationsTimer)
  },
  methods: {
    previewGraphic,
    isOperationsType,
    designerSourceKey(route) {
      return JSON.stringify([route.path, route.query.id || '', route.query.copy_from || '', route.query.template || ''])
    },
    initializeDashboard() {
      this._designerSource = this.designerSourceKey(this.$route)
      this._dashboardRequest = (this._dashboardRequest || 0) + 1
      this.dashboardId = this.screenId || screenID(this.$route.query.id) || ''
      const copyID = !this.presentationOnly && screenID(this.$route.query.copy_from)
      if ((!this.dashboardId || copyID) && !this.$can('tenant.dashboard', 'create')) {
        this.$router.replace(this.listPath)
        return
      }
      if ((copyID && this.dashboardId) || (this.$route.query.copy_from && !copyID) || (this.$route.query.id && !this.dashboardId)) {
        this.$message.warning('无效的大屏编号')
        this.$router.replace(this.listPath)
        return
      }
      this.dashboard = null
      this.shareVisible = false
      this.shareUrl = ''
      this.loadingDashboard = false
      this.form = {name: '', visibility: 'personal', canvasWidth: 1600, canvasHeight: 900}
      this.activePresetKey = ''
      this.presenting = this.presentationOnly
      this.selectedNode = null
      this.selectedHostKey = ''
      this.graph.clearCells()
      if (copyID) return this.loadDashboard(copyID, true)
      if (this.dashboardId) return this.loadDashboard()
      if (this.visualizationMode && !this.isReadonly) {
        this.applyPreset(OPERATIONS_PRESET)
        if (this.$route.query.template === 'operations') this.form.name = '运维大屏 - 副本'
      }
    },
    selectAllComponents() {
      if (this.isReadonly) return
      this.graph.resetSelection(this.nodes)
    },
    arrangeSelection(action) {
      if (this.isReadonly) return
      const selected = this.graph.getSelectedCells().filter(cell => cell.isNode())
      try {
        const positions = arrangeNodes(selected.map(node => ({id: node.id, ...node.getPosition(), ...node.getSize()})), action, this.layoutGap,
          {width: this.form.canvasWidth, height: this.form.canvasHeight})
        positions.forEach(position => this.graph.getCellById(position.id).position(position.x, position.y))
        this.activePresetKey = ''
        this.syncNodes()
      } catch (error) { this.$message.warning(error.message) }
    },
    startPresentation() {
      if (!this.graph || !this.nodes.length) return
      this._editorView = {zoom: this.canvasZoom, translation: this.graph.translate(), mode: this.canvasViewMode, selectedID: this.selectedNode && this.selectedNode.id}
      this.presenting = true
      this.$nextTick(() => this.resizeCanvas())
    },
    async exitPresentation() {
      if (document.fullscreenElement === this.$refs.designer && document.exitFullscreen) {
        try { await document.exitFullscreen() } catch (_) { /* leave presentation even if fullscreen exit fails */ }
      }
      if (this.presentationOnly) {
        this.$emit('exit')
        return
      }
      this.presenting = false
      this.$nextTick(() => {
        this.resizeCanvas()
        const view = this._editorView
        if (view && this.graph) {
          this.canvasViewMode = view.mode
          this.graph.zoomTo(view.zoom)
          this.graph.translate(view.translation.tx, view.translation.ty)
          if (!this.isReadonly && view.selectedID) {
            this.selectedNode = this.nodes.find(node => node.id === view.selectedID) || null
            if (this.selectedNode) this.graph.resetSelection([this.selectedNode])
            this.syncNodes()
          }
        }
      })
    },
    async togglePresentationFullscreen() {
      try {
        if (document.fullscreenElement) await document.exitFullscreen()
        else if (this.$refs.designer.requestFullscreen) await this.$refs.designer.requestFullscreen()
        else this.$message.info('当前浏览器不支持全屏，已使用窗口展示')
      } catch (_) { this.$message.info('未进入浏览器全屏，可继续使用窗口展示') }
    },
    syncPresentationFullscreen() {
      this.presentationFullscreen = document.fullscreenElement === this.$refs.designer
      this.resizeCanvas()
    },
    presentationKeydown(event) {
      if (this.presenting && event.key === 'Escape' && !document.fullscreenElement) this.exitPresentation()
    },
    initGraph() {
      this._disposeRenderers = registerDashboardChartNode(Graph, echarts, node => renderOperationsNode(node, this))
      const canvasWidth = Math.max(this.$refs.canvas.clientWidth || 960, 320)
      const canvasHeight = Math.max(this.$refs.canvas.clientHeight || 720, 480)
      this.graph = new Graph({
        container: this.$refs.canvas,
        width: canvasWidth,
        height: canvasHeight,
        background: {color: this.visualizationMode ? 'transparent' : '#f5f7fb'},
        grid: {visible: !this.isReadonly, size: 10},
        snapline: {enabled: !this.isReadonly, tolerance: 8},
        panning: true,
        mousewheel: {enabled: true, modifiers: ['ctrl', 'meta']},
        resizing: {enabled: !this.isReadonly, minWidth: 240, minHeight: 160},
        selecting: {enabled: !this.isReadonly, multiple: true, multipleSelectionModifiers: ['ctrl', 'meta'], showNodeSelectionBox: true},
        interacting: !this.isReadonly,
      })
      this.graph.on('node:click', ({node, e}) => {
        if (!this.isReadonly && !(e && (e.ctrlKey || e.metaKey))) this.selectNode(node)
      })
      this.graph.on('selection:changed', () => {
        this.selectionCount = this.graph.getSelectedCells().filter(cell => cell.isNode()).length
      })
      this.graph.on('node:added', ({node}) => {
        this.syncNodes()
        if (!this.loadingDashboard && !this.isReadonly) this.selectNode(node)
        if (!this.loadingDashboard && isOperationsType(node.getData().chart_type)) this.$nextTick(() => this.refreshAll())
      })
      this.graph.on('node:removed', () => this.syncNodes())
      this.graph.on('node:change:position', () => this.syncNodes())
      this.graph.on('node:change:size', () => this.syncNodes())
      this.graph.on('node:change:data', () => this.syncNodes())
      this.graph.on('scale', ({sx}) => { this.canvasZoom = sx })
      this.graph.on('translate', ({tx, ty}) => { this.canvasTranslation = {tx, ty} })
      this.graph.on('blank:click', () => {
        this.selectedNode = null
        this.selectedHostKey = ''
      })
    },
    syncNodes() {
      this.nodes = this.graph ? this.graph.getNodes() : []
      if (this.selectedNode && this.nodes.includes(this.selectedNode)) {
        const {x, y} = this.selectedNode.getPosition()
        const {width, height} = this.selectedNode.getSize()
        this.layout = {x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height)}
      }
    },
    resizeCanvas() {
      if (this.graph && this.$refs.canvas) {
        if (this.presenting) {
          const width = this.$refs.canvasWrap.clientWidth, height = this.$refs.canvasWrap.clientHeight
          this.graph.resize(width, height)
          const view = presentationTransform({width: this.form.canvasWidth, height: this.form.canvasHeight}, {width, height},
            this.nodes.map(node => ({...node.getPosition(), ...node.getSize()})), this.canvasHeading ? 0 : 16)
          this.graph.zoomTo(view.scale)
          this.graph.translate(view.x, view.y)
          return
        }
        // X6 writes an inline canvas width; measure the flex parent, not that stale width.
        this.graph.resize(this.$refs.canvasWrap.clientWidth, Math.max(420, Math.min(window.innerHeight * 0.65, 720)))
        if (this.canvasViewMode === 'fit' && this.nodes.length) this.fitDesignCanvas()
        else if (this.selectedNode) this.graph.centerCell(this.selectedNode)
      }
    },
    changeZoom(delta) {
      this.canvasViewMode = 'edit'
      this.graph.zoomTo(Math.min(2, Math.max(0.25, this.canvasZoom + delta)))
    },
    resetZoom() {
      this.canvasViewMode = 'edit'
      this.graph.zoomTo(1)
      if (this.selectedNode) this.graph.centerCell(this.selectedNode)
      else this.graph.centerContent()
    },
    fitCanvas() {
      this.canvasViewMode = 'fit'
      this.resizeCanvas()
    },
    fitDesignCanvas() {
      if (!this.visualizationMode) return this.graph.zoomToFit({padding: 30, maxScale: 1})
      const view = presentationTransform({width: this.form.canvasWidth, height: this.form.canvasHeight},
        {width: this.$refs.canvas.clientWidth, height: this.$refs.canvas.clientHeight},
        this.nodes.map(node => ({...node.getPosition(), ...node.getSize()})), 24)
      this.graph.zoomTo(view.scale)
      this.graph.translate(view.x, view.y)
    },
    selectComponent(id) {
      const node = this.nodes.find(item => item.id === id)
      if (!node || this.isReadonly) return
      this.selectNode(node)
      this.resetZoom()
    },
    nodeConfig(chartType, position, size = null, title = '') {
      size = size || (isOperationsType(chartType) ? OPERATIONS_PRESET.nodes.find(node => node.chart_type === chartType).size : {width: 360, height: 240})
      const data = defaultNodeData(chartType)
      data.preview_enabled = !this.isReadonly
      if (this.visualizationMode) data.style = {...data.style, color: '#00e6ff', background: '#061226'}
      if (title) data.title = title
      if (isOperationsType(chartType)) {
        data.data_source = {kind: 'operations', metric: chartType === 'ops-windows' ? 'mem' : 'cpu'}
        data.loadState = 'loading'
      }
      return {
        shape: 'dashboard-chart',
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        data,
      }
    },
    nextPosition() {
      const index = this.addIndex++
      return {x: 30 + (index % 3) * 390, y: (this.visualizationMode ? 94 : 30) + Math.floor(index / 3) * 270}
    },
    addChart(chartType) {
      if (this.isReadonly) return
      this.activePresetKey = ''
      this.graph.addNode(this.nodeConfig(chartType, this.nextPosition()))
    },
    presetPreviewStyle(preset, node) {
      return {
        left: (node.position.x / preset.width * 100) + '%',
        top: (node.position.y / preset.height * 100) + '%',
        width: (node.size.width / preset.width * 100) + '%',
        height: (node.size.height / preset.height * 100) + '%',
      }
    },
    presetScreenNodeStyle(node) {
      return {position: 'absolute', left: node.position.x + 'px', top: node.position.y + 'px', width: node.size.width + 'px', height: node.size.height + 'px', boxSizing: 'border-box'}
    },
    applyPreset(preset) {
      if (this.isReadonly) return
      const apply = () => {
        this.activePresetKey = preset.key
        this.form.canvasWidth = preset.width
        this.form.canvasHeight = preset.height
        this.selectedNode = null
        this.graph.removeCells(this.graph.getCells())
        this.addIndex = preset.nodes.length
        this.loadingDashboard = true
        preset.nodes.forEach(node => this.graph.addNode(this.nodeConfig(node.chart_type, node.position, node.size, node.title)))
        this.loadingDashboard = false
        this.syncNodes()
        this.$nextTick(() => {
          this.resizeCanvas()
          this.selectNode(this.nodes[0])
          this.fitCanvas()
        })
        this.selectedHostKey = ''
        this.$message.success('已套用「' + preset.label + '」布局')
        this.refreshAll()
      }
      if (this.nodes.length) {
        this.$confirm({title: '套用模板会替换当前画布组件，是否继续？', onOk: apply})
      } else {
        apply()
      }
    },
    focusCanvas() {
      const canvasWrap = this.$refs.canvasWrap
      if (!canvasWrap) return
      let scrollHost = canvasWrap.parentElement
      while (scrollHost) {
        const overflowY = window.getComputedStyle(scrollHost).overflowY
        if (/(auto|scroll)/.test(overflowY) && scrollHost.scrollHeight > scrollHost.clientHeight) break
        scrollHost = scrollHost.parentElement
      }
      if (!scrollHost) {
        canvasWrap.scrollIntoView({block: 'start'})
        return
      }
      const hostRect = scrollHost.getBoundingClientRect()
      const canvasRect = canvasWrap.getBoundingClientRect()
      scrollHost.scrollTop += canvasRect.top - hostRect.top - 12
    },
    clearCanvas() {
      if (this.isReadonly) return
      this.graph.removeCells(this.graph.getCells())
      this.addIndex = 0
      this.activePresetKey = ''
      this.selectedNode = null
      this.selectedHostKey = ''
      this.syncNodes()
      this.$message.success('画布已清空')
    },
    startDrag(chartType, event) {
      if (this.isReadonly) return
      this.activePresetKey = ''
      const node = this.graph.createNode(this.nodeConfig(chartType, {x: 0, y: 0}))
      const dnd = new Addon.Dnd({target: this.graph})
      dnd.start(node, event)
    },
    selectNode(node) {
      this.selectedNode = node
      this.graph.resetSelection([node])
      this.editor = clone(node.getData() || defaultNodeData('line'))
      if (!this.editor.data_source) this.editor.data_source = defaultNodeData('line').data_source
      if (!this.editor.style) this.editor.style = defaultNodeData('line').style
      const source = this.editor.data_source
      this.selectedHostKey = source.zid && source.hostid ? `${source.zid}:${source.hostid}` : ''
      const position = node.getPosition()
      const size = node.getSize()
      this.layout = {x: Math.round(position.x), y: Math.round(position.y), width: Math.round(size.width), height: Math.round(size.height)}
      this.numericItems = []
      if (this.selectedHostKey) this.loadItems(source.zid, source.hostid)
      this.$nextTick(() => this.focusCanvas())
    },
    applyEditor() {
      if (!this.selectedNode || this.isReadonly) return
      const current = this.selectedNode.getData() || {}
      const sourceChanged = JSON.stringify(current.data_source) !== JSON.stringify(this.editor.data_source)
      const typeChanged = current.chart_type !== this.editor.chart_type
      if (typeChanged) this.editor.data_source = isOperationsType(this.editor.chart_type) ? {kind: 'operations', metric: 'cpu'} : defaultNodeData('line').data_source
      this.selectedNode.setData({...clone(this.editor), operations: typeChanged ? undefined : current.operations, series: sourceChanged ? [] : (current.series || []), loadState: sourceChanged ? '' : current.loadState}, {overwrite: true})
      if (typeChanged && isOperationsType(this.editor.chart_type)) this.refreshAll()
    },
    applyLayout() {
      if (!this.selectedNode || this.isReadonly) return
      const x = Math.max(0, Number(this.layout.x) || 0)
      const y = Math.max(0, Number(this.layout.y) || 0)
      const width = Math.min(1600, Math.max(240, Number(this.layout.width) || 360))
      const height = Math.min(1200, Math.max(160, Number(this.layout.height) || 240))
      this.selectedNode.position(x, y)
      this.selectedNode.resize(width, height)
      this.layout = {x, y, width, height}
      this.syncNodes()
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
      const request = this._itemsRequest = (this._itemsRequest || 0) + 1
      const node = this.selectedNode
      this.itemsLoading = true
      this.numericItems = []
      itemList({zid, hostid}).then((response) => {
        if (request !== this._itemsRequest || node !== this.selectedNode || this.selectedHostKey !== `${zid}:${hostid}`) return
        const result = response.data
        if (result.code !== 200) throw new Error(result.message || '监控项加载失败')
        this.numericItems = (result.data.items || []).filter(item => ['0', '3'].includes(String(item.value_type)))
      }).catch((error) => this.$message.error(error.message || '监控项加载失败'))
        .finally(() => { if (request === this._itemsRequest) this.itemsLoading = false })
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
      this.refreshNode(this.selectedNode).catch(error => this.$message.error(error.message || '数据加载失败'))
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
    loadDashboard(sourceID = this.dashboardId, asCopy = false) {
      const request = this._dashboardRequest = (this._dashboardRequest || 0) + 1
      this.loadingDashboard = true
      return dashboardDetail(sourceID).then((response) => {
        if (request !== this._dashboardRequest || !this.graph) return
        const result = response.data
        if (result.code !== 200) {
          const error = new Error(result.message || '大屏加载失败')
          error.code = result.code
          throw error
        }
        const source = result.data
        this.dashboard = asCopy ? null : source
        const copied = asCopy ? copyScreenDraft(source) : null
        this.form = copied ? copied.form : {
          name: source.name, visibility: source.visibility,
          canvasWidth: source.canvas_width || 1600, canvasHeight: source.canvas_height || 900,
        }
        const nodes = copied ? copied.nodes : clone(Array.isArray(source.nodes) ? source.nodes : JSON.parse(source.nodes || '[]'))
        nodes.forEach(node => {
          node.data = {...node.data, preview_enabled: !this.isReadonly}
        })
        this.graph.fromJSON({nodes, edges: []})
        this.syncNodes()
        this.fitCanvas()
        if (this.presentationOnly) this.$nextTick(() => this.resizeCanvas())
        else if (this.$route.query.present === '1') this.startPresentation()
        return this.refreshAll()
      }).catch((error) => {
        if (request !== this._dashboardRequest) return
        if (this.presentationOnly) this.$emit('unavailable', error)
        else this.$message.error(error.message || '大屏加载失败')
      }).finally(() => { if (request === this._dashboardRequest) this.loadingDashboard = false })
    },
    refreshNode(node) {
      if (!node) return Promise.resolve()
      const data = clone(node.getData() || {})
      const source = data.data_source || {}
      if (!source.itemid || !['0', '3'].includes(String(source.history))) return Promise.resolve()
      if (!this._refreshRequests) this._refreshRequests = new WeakMap()
      const request = (this._refreshRequests.get(node) || 0) + 1
      this._refreshRequests.set(node, request)
      const isCurrent = () => this.graph && this.graph.getNodes().includes(node) &&
        this._refreshRequests.get(node) === request &&
        JSON.stringify(node.getData().data_source) === JSON.stringify(source)
      node.setData({...node.getData(), loadState: 'loading'}, {overwrite: true})
      const period = [moment().subtract(24, 'hours').format('YYYY-MM-DD HH:mm:ss'), moment().format('YYYY-MM-DD HH:mm:ss')]
      return hostMockd({history: source.history, itemids: source.itemid, period}).then((response) => {
        if (!isCurrent()) return
        const result = response.data
        if (result.code !== 200) throw new Error(result.message || '历史数据加载失败')
        const series = (result.data.items || []).map(item => ({clock: item.clock, value: Number(item.value)}))
        node.setData({...node.getData(), series, loadState: ''}, {overwrite: true})
      }).catch(error => {
        if (!isCurrent()) return
        node.setData({...node.getData(), series: [], loadState: 'error'}, {overwrite: true})
        throw error
      })
    },
    refreshAll() {
      if (!this.graph) return Promise.resolve()
      this.refreshing = true
      return Promise.all([this.refreshOperations(), ...this.graph.getNodes().map(node => this.refreshNode(node))]).catch((error) => {
        this.$message.error(error.message || '部分图表刷新失败')
      }).finally(() => { this.refreshing = false })
    },
    async refreshOperations() {
      const nodes = this.graph.getNodes().filter(node => isOperationsType(node.getData().chart_type))
      if (!nodes.length) return
      const request = this._operationsRequest = (this._operationsRequest || 0) + 1
      const cache = new Map()
      const read = (key, fetcher) => {
        if (!cache.has(key)) cache.set(key, fetcher().then(response => {
          if (response.data.code !== 200) throw new Error('运维数据加载失败')
          return response.data.data
        }))
        return cache.get(key)
      }
      await Promise.all(nodes.map(async node => {
        const type = node.getData().chart_type
        if (!node.getData().operations) node.setData({...node.getData(), loadState: 'loading'}, {overwrite: true})
        const current = () => this.graph && this._operationsRequest === request && this.graph.getNodes().includes(node) && node.getData().chart_type === type
        try {
          const payload = {}
          if (['ops-hosts', 'ops-kpi'].includes(type)) payload.info = await read('info', indexInfo)
          if (['ops-kpi', 'ops-severity', 'ops-alerts'].includes(type)) {
            const result = await read('triggers', indexTrigger)
            payload.triggers = (result && result.items) || []
          }
          if (type === 'ops-egress') payload.egress = await read('egress', indexEgress) || []
          if (['ops-linux', 'ops-windows'].includes(type)) {
            const host_type = type === 'ops-linux' ? 'VM_LIN' : 'VM_WIN'
            const [cpu, mem] = await Promise.all(['CPU', 'MEM'].map(metrics_type => read(type + metrics_type, () => indexRestop({host_type, metrics_type, top_num: '10'}))))
            payload.cpu = cpu || []; payload.mem = mem || []
          }
          if (current()) node.setData({...node.getData(), operations: payload, loadState: ''}, {overwrite: true})
        } catch (_) {
          if (current()) node.setData({...node.getData(), operations: {}, loadState: 'error'}, {overwrite: true})
        }
      }))
    },
    save() {
      if (this.isReadonly || !this.$can('tenant.dashboard', this.dashboardId ? 'update' : 'create')) return
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
        if (String(this.$route.query.id || '') !== this.dashboardId) {
          const destination = {path: this.designerPath, query: {id: this.dashboardId}}
          this._designerSource = this.designerSourceKey(destination)
          this.$router.replace(destination)
        }
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
  min-width: 0;
  max-width: 100%;
}
.custom-dashboard-designer__header {
  min-height: 68px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
  padding: 16px;
  border-bottom: 1px solid #e8e8e8;
}
.custom-dashboard-designer__identity {
  display: flex;
  flex-wrap: wrap;
  min-width: 0;
  align-items: center;
  gap: 10px;
}
.custom-dashboard-designer__identity h2 {
  margin: 0 10px 0 0;
  white-space: nowrap;
  font-size: 18px;
  font-weight: 600;
}
.designer-name { width: 240px; max-width: 100%; }
.designer-context {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 10px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e6edf4;
}
.designer-context .ant-tag { margin: 0; }
.designer-layout-badge { padding: 2px 8px; color: #526b83; border-radius: 3px; background: #eaf0f6; font-size: 12px; }
.designer-flow-hint { margin-left: auto; color: #73869a; font-size: 12px; }
.custom-dashboard-designer__actions .ant-btn { height: 34px; margin: 0; border-radius: 4px; }
.custom-dashboard-designer__actions .clear-canvas-btn { color: #a45555; }
.palette-heading {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}
.palette-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 8px;
}
.custom-dashboard-designer__palette {
  padding: 14px 16px 16px;
  border-bottom: 1px solid #e8e8e8;
}
.palette-hint {
  color: #8290a0;
  font-size: 12px;
}
.dashboard-chart-tool {
  min-width: 0;
  height: 42px;
  padding: 0 12px;
  border: 1px solid #dce5ee;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  cursor: pointer;
  background: #fff;
  user-select: none;
}
.dashboard-chart-tool__drag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex: none;
  color: #47759f;
  background: #eef4fa;
  border-radius: 4px;
  cursor: grab;
}
.dashboard-chart-tool__label { white-space: nowrap; font-size: 13px; }
.dashboard-chart-tool:hover,
.dashboard-chart-tool:focus-visible {
  color: #1b5a96;
  border-color: #82a8cb;
  background: #f3f8fd;
  outline: none;
}
.designer-meta {
  color: #6b7f95;
  font-size: 12px;
  white-space: normal;
}
.custom-dashboard-designer__presets {
  padding: 12px 16px 14px;
  border-bottom: 1px solid #e8e8e8;
  background: #f8fafc;
}
.presets-heading {
  cursor: pointer;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 0;
}
.custom-dashboard-designer__presets[open] .presets-heading { margin-bottom: 12px; }
.presets-heading::before { content: '›'; color: #6b7f95; font-size: 18px; }
.custom-dashboard-designer__presets[open] .presets-heading::before { transform: rotate(90deg); }
.presets-heading span {
  color: #8290a0;
  font-size: 12px;
}
.preset-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.preset-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 12px;
  padding: 10px;
  border: 1px solid #dce4ed;
  border-radius: 6px;
  background: #fff;
}
.preset-preview {
  position: relative;
  flex: none;
  width: 100%;
  height: 126px;
  overflow: hidden;
  border: 1px solid #cbd9e8;
  background: linear-gradient(90deg, rgba(27, 90, 150, .06) 1px, transparent 1px), linear-gradient(rgba(27, 90, 150, .06) 1px, transparent 1px), #f5f8fb;
  background-size: 12px 12px;
}
.preset-preview--dark {
  background: #061226;
  border-color: #1c5269;
}
.preset-screen-surface { position: relative; pointer-events: none; }
.preset-screen-graphic { height: 100%; color: #00e6ff; }
.preset-preview__graphic {
  width: 100%;
  height: 100%;
}
.preset-preview__node {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid #6b9bc8;
  background: rgba(27, 90, 150, .12);
  color: #1b5a96;
  font-size: 8px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.preset-card__body {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.preset-card__body strong {
  color: #0a1f44;
}
.preset-card__body span {
  min-height: 32px;
  color: #758497;
  font-size: 11px;
  line-height: 1.45;
}
.selected-node-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
  padding: 10px;
  border-left: 3px solid #1b5a96;
  background: #f3f7fb;
}
.selected-node-summary span {
  color: #758497;
  font-size: 11px;
}
.dashboard-layout-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 10px;
}
.dashboard-layout-grid .ant-input-number {
  width: 100%;
}
.custom-dashboard-designer__body {
  display: flex;
  align-items: flex-start;
}
.custom-dashboard-designer__canvas-wrap {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  background: #f5f7fb;
}
.canvas-help {
  min-height: 38px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid #dbe4ee;
  background: #eef6ff;
  color: #31506e;
  font-size: 12px;
}
.canvas-help strong {
  color: #1b5a96;
  white-space: nowrap;
}
.layout-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid #dbe4ee;
  background: #fff;
  font-size: 12px;
}
.layout-tools .ant-select-selection--single { height: 28px; }
.layout-tools .ant-select-selection__rendered { line-height: 26px; }
.layout-tools .ant-input-number { width: 60px; margin: 0 4px; }
.selection-hint { color: #31506e; }
.selection-hint small, .snap-hint { color: #8290a0; margin-left: 4px; }
.custom-dashboard-designer .x6-widget-snapline { stroke: #4b9bd8; }
/* Elevate the page as well: PageLayout's content creates a z-index: 9
   stacking context below the workbench sidebar (z-index: 10). */
.custom-dashboard-presentation-page {
  position: relative;
  z-index: 1500;
}
.custom-dashboard-designer.is-presenting {
  position: fixed;
  inset: 0;
  z-index: 1500;
  width: 100vw;
  height: 100vh;
  background: #061226;
}
.presentation-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 20px;
  color: #d5e8fa;
  background: #0a1d34;
  border-bottom: 1px solid #203d59;
}
.presentation-toolbar strong { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.presentation-toolbar strong { text-align: center; color: #cfe8ff; font-size: 20px; letter-spacing: 3px; text-shadow: 0 0 12px rgba(0,230,255,.5); }
.presentation-toolbar .ant-btn { color: #d5e8fa; background: transparent; border-color: #42617d; }
.is-presenting .custom-dashboard-designer__body,
.is-presenting .custom-dashboard-designer__canvas-wrap,
.is-presenting .custom-dashboard-designer__canvas { height: calc(100vh - 56px); width: 100%; }
.is-presenting.has-screen-heading .custom-dashboard-designer__body,
.is-presenting.has-screen-heading .custom-dashboard-designer__canvas-wrap,
.is-presenting.has-screen-heading .custom-dashboard-designer__canvas { height: 100vh; }
.canvas-stage { position: relative; overflow: hidden; background: #02060d; }
.screen-design-surface, .screen-design-heading { position: absolute; left: 0; top: 0; transform-origin: 0 0; pointer-events: none; }
.screen-design-surface { z-index: 0; }
.screen-design-heading { z-index: 2; }
.screen-design-heading .header-title { min-width: 0; }
.screen-design-heading .title-main { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.is-presenting .screen-design-heading .header-btn { pointer-events: auto; }
.canvas-stage > .custom-dashboard-designer__canvas { position: relative; z-index: 1; }
.custom-dashboard-designer__canvas {
  width: 100%;
  height: clamp(420px, 65vh, 720px);
}
.custom-dashboard-designer__editor {
  width: 320px;
  flex: 0 0 320px;
  min-width: 0;
  box-sizing: border-box;
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
@media (max-width: 1100px) {
  .custom-dashboard-designer__editor {
    width: 280px;
    flex-basis: 280px;
  }
  .preset-list {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
}
@media (max-width: 760px) {
  .custom-dashboard-designer__body {
    flex-direction: column;
  }
  .custom-dashboard-designer__canvas-wrap,
  .custom-dashboard-designer__editor {
    width: 100%;
    flex: auto;
  }
  .custom-dashboard-designer__editor {
    border-left: 0;
    border-top: 1px solid #e8e8e8;
  }
  .designer-meta {
    display: none;
  }
  .custom-dashboard-designer__presets {
    overflow-x: auto;
  }
  .preset-list {
    display: flex;
    min-width: 720px;
  }
  .preset-card {
    flex: 0 0 224px;
    flex-direction: column;
  }
}
.custom-dashboard-designer__actions,
.canvas-tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.dashboard-chart-node__empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  box-sizing: border-box;
  color: #66788a;
  text-align: center;
  font-size: 14px;
}
.dashboard-chart-node__empty--preview {
  justify-content: flex-start;
  padding: 18px 20px 14px;
}
.dashboard-chart-node__preview {
  flex: 1;
  min-height: 0;
  width: 100%;
}
.dashboard-chart-node__empty--preview > strong {
  flex: none;
  font-size: 12px;
  font-weight: normal;
  letter-spacing: .04em;
}
.custom-dashboard-designer .x6-node-selected .dashboard-chart-node {
  outline: 2px solid #1677ff;
  outline-offset: -2px;
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
