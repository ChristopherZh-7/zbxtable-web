<template>
  <div class="screen-root">
    <div class="screen-stage" :style="stageStyle">
      <session-overlay :visible="sessionExpired" :default-username="currentUser" @success="onSessionRestored" />
      <header-bar
        :interval="refreshInterval"
        :last-updated="lastUpdated"
        :viewport-label="viewportLabel"
        :can-manage-screens="$can('tenant.dashboard', 'read')"
        :can-create-screen="$can('tenant.dashboard', 'create')"
        @interval-change="onIntervalChange"
        @manage-screens="openScreenManagement"
        @create-screen="createCustomScreen"
      />
      <div class="screen-body">

      <!-- 行 1 左：主机类型分布 -->
      <operations-widget class="area-host-pie" type="ops-hosts" :title="$t('panel_host_type')" :payload="{info}" :status="dataStatus.info" />

      <!-- 行 1 中：KPI 卡 + 出入口流量 -->
      <div class="area-kpi" style="display:flex;flex-direction:column;gap:14px;min-height:0;">
        <operations-widget type="ops-kpi" :payload="{info, triggers: triggerList}" :status="dataStatus.info || dataStatus.alarms"
          style="flex:0 0 auto;height:42%;"
        />
        <operations-widget type="ops-egress" :title="$t('panel_egress')" :payload="{egress: egressData}" :status="dataStatus.egress" style="flex:1 1 auto;min-height:0;" />
      </div>

      <!-- 行 1 右：告警分级玫瑰图 -->
      <operations-widget class="area-severity" type="ops-severity" :title="$t('panel_severity')" :payload="{triggers: triggerList}" :status="dataStatus.alarms" />

      <!-- 行 3 左：Linux TOP（CPU/内存切换） -->
      <operations-widget class="area-cpu-top" type="ops-linux" :title="'Linux ' + (linMetric === 'cpu' ? 'CPU' : '内存') + ' 排行'" :metric="linMetric" :payload="{cpu: linCpuTop, mem: linMemTop}" :status="dataStatus[linMetric === 'cpu' ? 'linCpuTop' : 'linMemTop']" @metric-change="linMetric = $event" />

      <!-- 行 3 中：实时告警动态 -->
      <operations-widget class="area-alert" type="ops-alerts" :title="$t('panel_alert_list')" :payload="{triggers: triggerList}" :status="dataStatus.alarms" />

      <!-- 行 3 右：Windows TOP（CPU/内存切换） -->
      <operations-widget class="area-mem-top" type="ops-windows" :title="'Windows ' + (winMetric === 'cpu' ? 'CPU' : '内存') + ' 排行'" :metric="winMetric" :payload="{cpu: winCpuTop, mem: winMemTop}" :status="dataStatus[winMetric === 'cpu' ? 'winCpuTop' : 'winMemTop']" @metric-change="winMetric = $event" />

      </div>
    </div>
  </div>
</template>

<script>
import HeaderBar from './components/HeaderBar'
import OperationsWidget from './components/OperationsWidget'
import {operationsKpi} from './operations-model'
import SessionOverlay from './components/SessionOverlay'
import { startTokenRefresher } from '@/utils/tokenRefresher'
import { indexInfo, indexTrigger, indexRestop, indexEgress } from '@/services/admin'
import { parseTimeFun } from '@/utils/formatter'
import './style.less'

export default {
  name: 'ScreenDashboard',
  i18n: require('./i18n'),
  components: {
    HeaderBar, OperationsWidget, SessionOverlay
  },
  data() {
    return {
      dataStatus: {info:'loading', alarms:'loading', egress:'loading', linCpuTop:'loading', linMemTop:'loading', winCpuTop:'loading', winMemTop:'loading'},
      info: { net_count: 0, srv_count: 0, win_count: 0, lin_count: 0, total_count: 0, asset_type_counts: [] },
      triggerList: [],
      egressData: [],
      linCpuTop: [],
      linMemTop: [],
      winCpuTop: [],
      winMemTop: [],
      linMetric: 'cpu',
      winMetric: 'mem',
      lastUpdated: '',
      refreshInterval: 30,
      timers: [],
      sessionExpired: false,
      currentUser: '',
      viewportWidth: 1920,
      viewportHeight: 1080
    }
  },
  computed: {
    stageStyle() {
      const scale = Math.min(this.viewportWidth / 1920, this.viewportHeight / 1080)
      return { transform: `translate(-50%, -50%) scale(${scale})` }
    },
    viewportLabel() {
      return `${this.viewportWidth}×${this.viewportHeight}`
    },
    kpi() {
      return operationsKpi(this.info, this.triggerList)
    }
  },
  mounted() {
    this.syncViewport()
    window.addEventListener('resize', this.syncViewport)
    this._origLoginNoAuth = window.loginNoAuth
    window.loginNoAuth = () => {
      this.sessionExpired = true
      this.clearTimers()
    }
    this.fetchAll()
    this.startTimers()
  },
  beforeDestroy() {
    this.clearTimers()
    window.removeEventListener('resize', this.syncViewport)
    window.loginNoAuth = this._origLoginNoAuth
  },
  methods: {
    openScreenManagement() {
      this.$router.push('/topology/custom-screens')
    },
    createCustomScreen() {
      this.$router.push('/topology/custom-screen-designer')
    },
    syncViewport() {
      this.viewportWidth = Math.max(1, window.innerWidth || 1920)
      this.viewportHeight = Math.max(1, window.innerHeight || 1080)
    },
    startTimers() {
      this.clearTimers()
      const ms = this.refreshInterval * 1000
      this.timers.push(setInterval(this.fetchAll, ms))
      // 告警以 min(ms, 10s) 频率单独刷新，保持实时性
      const alarmMs = Math.min(ms, 10000)
      this.timers.push(setInterval(this.fetchAlarms, alarmMs))
    },
    clearTimers() {
      this.timers.forEach(t => clearInterval(t))
      this.timers = []
    },
    onIntervalChange(val) {
      this.refreshInterval = val
      this.fetchAll()
      this.startTimers()
    },
    async fetchAll() {
      await Promise.allSettled([
        this.fetchInfo(),
        this.fetchAlarms(),
        this.fetchEgress(),
        this.fetchTop()
      ])
      this.lastUpdated = parseTimeFun(new Date())
    },
    fetchInfo() {
      return indexInfo().then(resp => {
        if (!resp.data || resp.data.code !== 200) throw new Error('load failed')
        this.dataStatus.info = ''
        const d = (resp && resp.data && resp.data.data) || {}
        this.info = {
          net_count: d.net_count || 0,
          srv_count: d.srv_count || 0,
          win_count: d.win_count || 0,
          lin_count: d.lin_count || 0,
          total_count: d.total_count || 0,
          asset_type_counts: Array.isArray(d.asset_type_counts) ? d.asset_type_counts : []
        }
      }).catch(() => { this.dataStatus.info = 'error' })
    },
    fetchAlarms() {
      return indexTrigger().then(resp => {
        if (!resp.data || resp.data.code !== 200) throw new Error('load failed')
        this.dataStatus.alarms = ''
        const items = resp && resp.data && resp.data.data && resp.data.data.items
        this.triggerList = Array.isArray(items) ? items : []
      }).catch(() => { this.dataStatus.alarms = 'error' })
    },
    fetchEgress() {
      return indexEgress().then(resp => {
        if (!resp.data || resp.data.code !== 200) throw new Error('load failed')
        this.dataStatus.egress = ''
        const d = resp && resp.data && resp.data.data
        if (Array.isArray(d)) {
          this.egressData = d.filter(Boolean).map(item => ({
            ...item,
            in_value: (item && item.in_value) || 0,
            out_value: (item && item.out_value) || 0
          }))
        } else if (d && typeof d === 'object') {
          this.egressData = [
            { name: d.name_one || '出口1', in_value: d.in_one || 0, out_value: d.out_one || 0 },
            { name: d.name_two || '出口2', in_value: d.in_two || 0, out_value: d.out_two || 0 }
          ]
        } else {
          this.egressData = []
        }
      }).catch(() => { this.dataStatus.egress = 'error' })
    },
    onSessionRestored() {
      this.sessionExpired = false
      startTokenRefresher()
      this.fetchAll()
      this.startTimers()
    },
    fetchTop() {
      const parse = resp => {
        if (!resp.data || resp.data.code !== 200) throw new Error('load failed')
        const arr = resp && resp.data && resp.data.data
        return Array.isArray(arr) ? arr.filter(Boolean) : []
      }
      return Promise.allSettled([
        indexRestop({ host_type: 'VM_LIN', metrics_type: 'CPU', top_num: '10' })
          .then(r => { this.linCpuTop = parse(r); this.dataStatus.linCpuTop = '' }).catch(() => { this.dataStatus.linCpuTop = 'error' }),
        indexRestop({ host_type: 'VM_LIN', metrics_type: 'MEM', top_num: '10' })
          .then(r => { this.linMemTop = parse(r); this.dataStatus.linMemTop = '' }).catch(() => { this.dataStatus.linMemTop = 'error' }),
        indexRestop({ host_type: 'VM_WIN', metrics_type: 'CPU', top_num: '10' })
          .then(r => { this.winCpuTop = parse(r); this.dataStatus.winCpuTop = '' }).catch(() => { this.dataStatus.winCpuTop = 'error' }),
        indexRestop({ host_type: 'VM_WIN', metrics_type: 'MEM', top_num: '10' })
          .then(r => { this.winMemTop = parse(r); this.dataStatus.winMemTop = '' }).catch(() => { this.dataStatus.winMemTop = 'error' })
      ])
    }
  }
}
</script>
