<template>
  <div class="public-dashboard">
    <header class="public-dashboard__header">
      <div>
        <span class="public-dashboard__eyebrow">自定义展示场景</span>
        <h1>{{ dashboard ? dashboard.name : '正在加载场景…' }}</h1>
      </div>
      <div class="public-dashboard__status">
        <a-tag color="blue">只读分享</a-tag>
        <span>30 秒自动刷新</span>
        <span v-if="refreshedAt">最近刷新 {{ refreshedAt }}</span>
        <a-button :loading="loading" size="small" @click="load">立即刷新</a-button>
      </div>
    </header>

    <main ref="viewport" class="public-dashboard__viewport">
      <a-result
        v-if="error"
        status="404"
        title="场景不存在或分享已失效"
        sub-title="请向场景管理员获取新的分享链接。"
      />
      <div
        v-else-if="dashboard"
        class="public-dashboard__stage"
        :style="stageStyle"
      >
        <div ref="canvas" class="public-dashboard__canvas"></div>
      </div>
      <div v-else class="public-dashboard__loading"><a-spin size="large" tip="正在读取最近 24 小时数据…" /></div>
    </main>
  </div>
</template>

<script>
import axios from 'axios'
import * as echarts from 'echarts'
import {Graph} from '@antv/x6'
import {registerDashboardChartNode} from './dashboard-canvas'

const publicAxios = axios.create({timeout: 20000, withCredentials: false})
registerDashboardChartNode(Graph, echarts)

export default {
  name: 'PublicDashboardShare',
  data() {
    return {
      dashboard: null,
      graph: null,
      loading: false,
      error: false,
      scale: 1,
      refreshedAt: '',
      refreshTimer: null,
    }
  },
  computed: {
    token() {
      return String(this.$route.params.token || '')
    },
    stageStyle() {
      const width = this.dashboard && this.dashboard.canvas_width || 1600
      const height = this.dashboard && this.dashboard.canvas_height || 900
      return {
        width: `${width}px`,
        height: `${height}px`,
        transform: `scale(${this.scale})`,
      }
    },
  },
  mounted() {
    window.addEventListener('resize', this.resize)
    this.load()
    this.refreshTimer = window.setInterval(this.load, 30000)
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.resize)
    if (this.refreshTimer) window.clearInterval(this.refreshTimer)
    if (this.graph) this.graph.dispose()
  },
  methods: {
    load() {
      if (!this.token) {
        this.error = true
        return
      }
      this.loading = true
      return publicAxios.get(`/public/dashboard/${encodeURIComponent(this.token)}`).then((response) => {
        const result = response.data
        if (!result || result.code !== 200 || !result.data) throw new Error('场景不存在')
        this.error = false
        this.dashboard = result.data
        this.refreshedAt = new Date().toLocaleTimeString()
        this.$nextTick(() => {
          this.render()
          this.resize()
        })
      }).catch(() => {
        this.error = true
        this.dashboard = null
        if (this.graph) {
          this.graph.dispose()
          this.graph = null
        }
      }).finally(() => { this.loading = false })
    },
    render() {
      if (!this.$refs.canvas || !this.dashboard) return
      if (this.graph) this.graph.dispose()
      this.graph = new Graph({
        container: this.$refs.canvas,
        width: this.dashboard.canvas_width,
        height: this.dashboard.canvas_height,
        background: {color: '#f5f7fb'},
        interacting: false,
        panning: false,
        mousewheel: false,
      })
      this.graph.fromJSON({nodes: this.dashboard.nodes || [], edges: []})
    },
    resize() {
      if (!this.dashboard || !this.$refs.viewport) return
      const width = Math.max(1, this.$refs.viewport.clientWidth - 32)
      const height = Math.max(1, this.$refs.viewport.clientHeight - 32)
      this.scale = Math.min(width / this.dashboard.canvas_width, height / this.dashboard.canvas_height, 1)
    },
  },
}
</script>

<style lang="less">
html,
body,
#app,
.public-dashboard {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}
.public-dashboard {
  display: flex;
  flex-direction: column;
  color: #1f2d3d;
  background: #eef2f7;
}
.public-dashboard__header {
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 10px 24px;
  box-sizing: border-box;
  color: #fff;
  background: linear-gradient(125deg, #102a43, #1677ff);
  box-shadow: 0 3px 12px rgba(16, 42, 67, 0.25);
}
.public-dashboard__eyebrow {
  display: block;
  margin-bottom: 1px;
  font-size: 11px;
  letter-spacing: 0.18em;
  opacity: 0.72;
}
.public-dashboard__header h1 {
  margin: 0;
  color: #fff;
  font-size: 24px;
}
.public-dashboard__status {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  white-space: nowrap;
}
.public-dashboard__viewport {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  overflow: hidden;
  padding: 16px;
  box-sizing: border-box;
}
.public-dashboard__stage {
  flex: none;
  transform-origin: center center;
  background: #f5f7fb;
  box-shadow: 0 10px 36px rgba(31, 45, 61, 0.18);
}
.public-dashboard__canvas {
  width: 100%;
  height: 100%;
}
.public-dashboard__loading {
  display: flex;
  align-items: center;
  justify-content: center;
}
.dashboard-chart-node {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
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
