<template>
  <page-layout :noTitle="true" class="smartops-workplace">
    <a-modal
      v-if="isPlatformAdministrator"
      :visible="topConfigModalVisible"
      :confirmLoading="topNumSaving"
      :title="topConfigTitle"
      :okText="$t('btn_ok')"
      :cancelText="$t('btn_cancel')"
      @ok="saveTopNum"
      @cancel="closeTopConfigModal"
    >
      <a-form :layout="'vertical'">
        <a-form-item :label="$t('top_settings_label_num')">
          <a-input-number v-model="topNumDraft" :min="1" :max="50" style="width: 100%;" />
        </a-form-item>
      </a-form>
    </a-modal>
    <!-- 未配置实例提示 -->
    <a-alert
      v-if="!hasZabbixInstance && (loading1 || loading2)"
      :message="$t('alert_no_instance_title')"
      type="warning"
      show-icon
      closable
      style="margin-bottom: 16px;"
    >
      <template slot="description">
        <div>
          <p style="margin-bottom: 8px;">{{ $t('alert_no_instance_desc') }}</p>
          <p style="margin-bottom: 12px;">{{ $t('alert_no_instance_action') }} <a @click="goToZabbixConfig" style="font-weight: 600; cursor: pointer; color: #1b5a96;">{{ $t('alert_no_instance_link') }}</a> {{ $t('alert_no_instance_action_end') }}</p>
        </div>
      </template>
    </a-alert>
    
    <home-layout ref="homeLayout" :errors="widgetErrors" @retry="retryWidget">
      <template #heading>
        <div>
          <p class="workplace-kicker">值守工作台</p>
          <h1>运维总览</h1>
          <p>集中查看当前告警、资产分布与重点资源运行情况。</p>
        </div>
      </template>
      <template #alerts>
        <a-card :title="$t('title_problems')" :headStyle="cardHeadStyle" size="small" :loading="!loading1">
          <div :class="['homeMain', 'beauty-scroll', { 'is-empty': !triggerList.length }]">
            <a-timeline>
              <a-timeline-item v-for="(v, i) in triggerList" :key="i">
                <a-tag v-if="v.severity == 1" color="#7499FF">{{ $t('severity_informational') }}</a-tag>
                <a-tag v-else-if="v.severity == 2" color="#FFC859">{{ $t('severity_warning') }}</a-tag>
                <a-tag v-else-if="v.severity == 3" color="#FFA059">{{ $t('severity_average') }}</a-tag>
                <a-tag v-else-if="v.severity == 4" color="#E97659">{{ $t('severity_high') }}</a-tag>
                <a-tag v-else-if="v.severity == 5" color="#f50000">{{ $t('severity_disaster') }}</a-tag>
                <a-tag v-else color="#97AAB3">{{ $t('severity_unknown') }}</a-tag>
                <a-tag v-if="v.instance_name" :color="theme.color" style="margin-left: 4px;">{{ v.instance_name }}</a-tag>
                <!-- <a-icon slot="dot" type="minus-circle" v-else-if="v.severity == 2" :style="{ fontSize: '16px', color: '#F56C6C' }" />
                <a-icon slot="dot" type="exclamation-circle" v-else :style="{ fontSize: '16px', color: '#E6A23C' }" /> -->
                {{v.lastchange | parsetime}} <b>{{v.name}}</b> <span :title="'原文：' + (v.lasteventname || '')">{{ alarmText(v.lasteventname) }}</span>
              </a-timeline-item>
            </a-timeline>
            <a-empty v-if="!triggerList.length" :description="$t('empty_unresolved_alerts')" />
          </div>
        </a-card>
      </template>
      <template #devices>
        <a-card :title="$t('title_hosttypecount')" :headStyle="cardHeadStyle" :bodyStyle="{minHeight: '194px', height: 'auto', padding: '14px'}" size="small" :loading="!loading2">
          <div class="device-stat-grid" :style="cssVars" role="list" aria-label="设备数量">
            <div
              class="device-stat-card"
              v-for="item in deviceStats"
              :key="item.type_code"
              role="listitem"
              :aria-label="`${item.name} ${item.count} 台`"
            >
              <span class="device-stat-icon" aria-hidden="true"><a-icon :type="item.icon" /></span>
              <div class="device-stat-content">
                <span class="device-name" :title="item.name">{{ item.name }}</span>
                <div class="device-stat-value">
                  <strong class="device-count">{{ item.count }}</strong>
                  <span class="device-stat-unit">台</span>
                </div>
              </div>
            </div>
          </div>
        </a-card>
      </template>
      <template #bandwidth>
        <a-card :headStyle="cardHeadStyle" :bodyStyle="{padding: '12px'}" size="small" :loading="!loading3">
          <template slot="title">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span>{{ $t('bandwidth') }}</span>
              <span style="font-size: 12px; font-weight: 400; color: rgba(0,0,0,0.45); white-space: nowrap;">{{ egressUpdateTime ? (egressUpdateTime) : '' }}</span>
            </div>
          </template>
          <egress-bandwidth :data="egressData" />
        </a-card>
      </template>
      <template #linux>
        <a-card :headStyle="cardHeadStyle" :bodyStyle="{ padding: 0 }" size="small" :loading="!loading6">
          <template slot="title">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span>{{ $t('linux_systems_title') }}</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                <a-radio-group size="small" :value="linSortBy" @change="onLinSortChange">
                  <a-radio-button value="CPU">{{ $t('sort_by_cpu') }}</a-radio-button>
                  <a-radio-button value="MEM">{{ $t('sort_by_mem') }}</a-radio-button>
                </a-radio-group>
                <a-tooltip :title="$t('top_settings')">
                  <a-button v-if="isPlatformAdministrator" size="small" icon="setting" @click="openTopConfigModal('VM_LIN')" />
                </a-tooltip>
              </div>
            </div>
          </template>
          <div class="homeTopList" :style="cssVars">
            <div class="topListHeader">
              <span class="col-name">{{ $t('column_hostname') }}</span>
              <template v-if="linSortBy === 'CPU'">
                <span class="col-metric">{{ $t('top_header_cpu') }}</span>
                <span class="col-metric">{{ $t('top_header_mem') }}</span>
              </template>
              <template v-else>
                <span class="col-metric">{{ $t('top_header_mem') }}</span>
                <span class="col-metric">{{ $t('top_header_cpu') }}</span>
              </template>
            </div>
            <div :class="['beauty-scroll', 'listBody', { 'is-empty': !linTop.length }]">
              <div class="topListItem" v-for="(v, i) in linTop" :key="'linTop-'+i">
                <div class="col-name" :title="hostTitle(v)">
                  <div class="rank-icon"><img :src="require('../../assets/img/top'+(i+1)+'.png')" v-if="i < 3" /><span v-else>{{i+1}}</span></div>
                  <div class="host-info">
                    <a-tag v-if="v.instance_name" :color="theme.color" class="instance-tag-small">{{v.instance_name}}</a-tag>
                    <span class="hostname">{{v.hostname}}</span>
                  </div>
                </div>
                <template v-if="linSortBy === 'CPU'">
                  <div class="col-metric">
                    <legent v-if="fmtPercent(v.cpu) !== '—'" :rate="v.cpu" :height="20"></legent>
                    <span class="metric-value">{{fmtPercent(v.cpu)}}</span>
                  </div>
                  <div class="col-metric">
                    <legent v-if="fmtPercent(v.mem) !== '—'" :rate="v.mem" :height="20"></legent>
                    <span class="metric-value">{{fmtPercent(v.mem)}}</span>
                  </div>
                </template>
                <template v-else>
                  <div class="col-metric">
                    <legent v-if="fmtPercent(v.mem) !== '—'" :rate="v.mem" :height="20"></legent>
                    <span class="metric-value">{{fmtPercent(v.mem)}}</span>
                  </div>
                  <div class="col-metric">
                    <legent v-if="fmtPercent(v.cpu) !== '—'" :rate="v.cpu" :height="20"></legent>
                    <span class="metric-value">{{fmtPercent(v.cpu)}}</span>
                  </div>
                </template>
              </div>
              <div v-if="!linTop.length" class="top-list-empty">{{ $t('empty_linux_top') }}</div>
              <div v-else class="topListItem empty" v-for="i in linTopNum-linTop.length" :key="'linTop-empty-'+i"></div>
            </div>
          </div>
        </a-card>
      </template>
      <template #windows>
        <a-card :headStyle="cardHeadStyle" :bodyStyle="{ padding: 0 }" size="small" :loading="!loading4">
          <template slot="title">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span>{{ $t('windows_systems_title') }}</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                <a-radio-group size="small" :value="winSortBy" @change="onWinSortChange">
                  <a-radio-button value="CPU">{{ $t('sort_by_cpu') }}</a-radio-button>
                  <a-radio-button value="MEM">{{ $t('sort_by_mem') }}</a-radio-button>
                </a-radio-group>
                <a-tooltip :title="$t('top_settings')">
                  <a-button v-if="isPlatformAdministrator" size="small" icon="setting" @click="openTopConfigModal('VM_WIN')" />
                </a-tooltip>
              </div>
            </div>
          </template>
          <div class="homeTopList" :style="cssVars">
            <div class="topListHeader">
              <span class="col-name">{{ $t('column_hostname') }}</span>
              <template v-if="winSortBy === 'CPU'">
                <span class="col-metric">{{ $t('top_header_cpu') }}</span>
                <span class="col-metric">{{ $t('top_header_mem') }}</span>
              </template>
              <template v-else>
                <span class="col-metric">{{ $t('top_header_mem') }}</span>
                <span class="col-metric">{{ $t('top_header_cpu') }}</span>
              </template>
            </div>
            <div :class="['beauty-scroll', 'listBody', { 'is-empty': !winTop.length }]">
              <div class="topListItem" v-for="(v, i) in winTop" :key="'winTop-'+i">
                <div class="col-name" :title="hostTitle(v)">
                  <div class="rank-icon"><img :src="require('../../assets/img/top'+(i+1)+'.png')" v-if="i < 3" /><span v-else>{{i+1}}</span></div>
                  <div class="host-info">
                    <a-tag v-if="v.instance_name" :color="theme.color" class="instance-tag-small">{{v.instance_name}}</a-tag>
                    <span class="hostname">{{v.hostname}}</span>
                  </div>
                </div>
                <template v-if="winSortBy === 'CPU'">
                  <div class="col-metric">
                    <legent v-if="fmtPercent(v.cpu) !== '—'" :rate="v.cpu" :height="20"></legent>
                    <span class="metric-value">{{fmtPercent(v.cpu)}}</span>
                  </div>
                  <div class="col-metric">
                    <legent v-if="fmtPercent(v.mem) !== '—'" :rate="v.mem" :height="20"></legent>
                    <span class="metric-value">{{fmtPercent(v.mem)}}</span>
                  </div>
                </template>
                <template v-else>
                  <div class="col-metric">
                    <legent v-if="fmtPercent(v.mem) !== '—'" :rate="v.mem" :height="20"></legent>
                    <span class="metric-value">{{fmtPercent(v.mem)}}</span>
                  </div>
                  <div class="col-metric">
                    <legent v-if="fmtPercent(v.cpu) !== '—'" :rate="v.cpu" :height="20"></legent>
                    <span class="metric-value">{{fmtPercent(v.cpu)}}</span>
                  </div>
                </template>
              </div>
              <div v-if="!winTop.length" class="top-list-empty">{{ $t('empty_windows_top') }}</div>
              <div v-else class="topListItem empty" v-for="i in winTopNum-winTop.length" :key="'winTop-empty-'+i"></div>
            </div>
          </div>
        </a-card>
      </template>
      <template #summary>
        <home-extras kind="summary" :head-style="cardHeadStyle" :info="info" :alerts="triggerList" :egress="egressData" :ready="widgetReady" :errors="loadErrors" />
      </template>
      <template #severity>
        <home-extras kind="severity" :head-style="cardHeadStyle" :info="info" :alerts="triggerList" :egress="egressData" :ready="widgetReady" :errors="loadErrors" />
      </template>
      <template #shortcuts>
        <home-extras kind="shortcuts" :head-style="cardHeadStyle" :info="info" :alerts="triggerList" :egress="egressData" :ready="widgetReady" :errors="loadErrors" />
      </template>
    </home-layout>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import HomeLayout from './home/HomeLayout'
import HomeExtras from './home/HomeExtras'
import {
  indexTrigger,
  indexInfo,
  indexRestop,
  indexEgress,
  configGetList,
  configUpdate
} from '@/services/admin'
import { message } from 'ant-design-vue'
import { parseTimeFun } from '@/utils/formatter'
import {formatAlarmMessage} from '@/utils/alarm-display'
import legent from '@/components/gcharts/legent'
import EgressBandwidth from '@/components/egress/EgressBandwidth'
import { mapGetters, mapState } from 'vuex'

export default {
  name: 'index',
  i18n: require('./i18n'),
  data() {
    return {
      loadErrors: {alerts: false, devices: false, bandwidth: false, linux: false, windows: false},
      triggerList: [],
      loading1: false,
      loading2: false,
      loading3: false,
      loading4: true,
      loading5: false,
      loading6: true,
      topConfigModalVisible: false,
      topConfigType: '', // 'VM_WIN' 或 'VM_LIN'
      topNumDraft: 10,
      topNumSaving: false,
      linTopNumConfigId: null,
      winTopNumConfigId: null,
      info: {
        net_count: 0,
        srv_count: 0,
        win_count: 0,
        lin_count: 0,
        total_count: 0,
        asset_type_counts: []
      },
      egressData: [], // 改为数组，支持多个出口
      egressUpdateTime: '', // 出口带宽采集时间
      refreshTimer: null, // 定时刷新
      linTop: [],
      winTop: [],
      winSortBy: 'CPU',
      linSortBy: 'CPU',
      linTopNum: 10,
      winTopNum: 10,
      hasZabbixInstance: null // 是否配置了 Zabbix 实例，初始为 null 表示未检测
    }
  },
  computed: {
    ...mapState('setting', ['theme']),
    ...mapGetters('account', {accountUser: 'user'}),
    isPlatformAdministrator() {
      const role = String(this.accountUser && this.accountUser.role || '').toLowerCase()
      return role === 'admin' || role === 'platform_admin'
    },
    widgetErrors() { return {...this.loadErrors, severity: this.loadErrors.alerts} },
    widgetReady() { return {alerts: this.loading1, devices: this.loading2, bandwidth: this.loading3} },
    cardHeadStyle() {
      // 使用主题颜色的浅色版本作为卡片标题背景
      return {
        background: this.hexToRgba(this.theme.color || '#1890ff', 0.08),
        color: this.theme.color || '#1890ff',
        fontWeight: 600
      }
    },
    cssVars() {
      return {
        '--primary-color': this.theme.color || '#1890ff',
        '--primary-bg': this.hexToRgba(this.theme.color || '#1890ff', 0.08),
        '--primary-bg-hover': this.hexToRgba(this.theme.color || '#1890ff', 0.12)
      }
    },
    topConfigTitle() {
      return this.topConfigType === 'VM_WIN' ? this.$t('top_settings_title_win') : this.$t('top_settings_title_lin')
    },
    deviceStats() {
      const counts = Array.isArray(this.info.asset_type_counts) ? this.info.asset_type_counts : []
      if (counts.length) {
        return counts.map(item => ({
          type_code: item.type_code,
          name: this.getPrimaryName(item.name || item.type_code),
          count: item.count || 0,
          icon: this.getDeviceIcon(item.type_code, item.name)
        }))
      }

      return [
        { type_code: 'HW_NET', name: this.$t('device_network_devices'), count: this.info.net_count || 0, icon: this.getDeviceIcon('HW_NET') },
        { type_code: 'HW_SRV', name: this.$t('device_server_devices'), count: this.info.srv_count || 0, icon: this.getDeviceIcon('HW_SRV') },
        { type_code: 'VM_WIN', name: this.$t('device_windows_hosts'), count: this.info.win_count || 0, icon: this.getDeviceIcon('VM_WIN') },
        { type_code: 'VM_LIN', name: this.$t('device_linux_hosts'), count: this.info.lin_count || 0, icon: this.getDeviceIcon('VM_LIN') }
      ]
    }
  },
  components: {
    PageLayout,
    HomeLayout,
    HomeExtras,
    legent,
    EgressBandwidth
  },
  created() {
    this.initTrigger()
    this.initInfo()
    this.initEgress()
    const configReady = this.isPlatformAdministrator ? this.initConfig() : Promise.resolve()
    configReady.then(() => {
      this.initTop()
    })
    // 每30秒刷新一次出口数据
    this.refreshTimer = setInterval(() => {
      this.initEgress()
    }, 30000)
  },
  beforeRouteLeave(to, from, next) {
    if (to.path === '/screen/dashboard' || !this.$refs.homeLayout) return next()
    this.$refs.homeLayout.confirmLeave(next)
  },
  beforeDestroy() {
    // 清除定时器
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
    }
  },
  methods: {
    retryWidget(type) {
      const actions = {alerts: 'initTrigger', severity: 'initTrigger', devices: 'initInfo', bandwidth: 'initEgress', linux: 'loadLinTop', windows: 'loadWinTop'}
      if (actions[type]) this[actions[type]]()
    },
    alarmText(value) { return formatAlarmMessage(value, this.$i18n.locale) },
    getDeviceIcon(typeCode, name) {
      const code = String(typeCode || '').toUpperCase()
      const label = String(name || '')
      const icons = {
        VM_LIN: 'code',
        VM_WIN: 'windows',
        HW_NET: 'deployment-unit',
        HW_SRV: 'hdd',
        HW_FIBER: 'branches',
        HW_STORAGE: 'database'
      }
      if (icons[code]) return icons[code]
      if (/Linux/i.test(label)) return 'code'
      if (/Windows/i.test(label)) return 'windows'
      if (/网络|交换|光纤/.test(label)) return 'deployment-unit'
      if (/存储|数据库/.test(label)) return 'database'
      if (/物理|服务/.test(label)) return 'hdd'
      return 'appstore'
    },
    getPrimaryName(name) {
      if (!name) return ''
      return String(name).replace(/\s*[（(][^（）()]*[）)]\s*$/u, '').trim()
    },
    goToZabbixConfig() {
      this.$router.push('/system/zabbix')
    },
    openTopConfigModal(type) {
      if (!this.isPlatformAdministrator) return
      this.topConfigType = type
      this.topNumDraft = type === 'VM_WIN' ? this.winTopNum : this.linTopNum
      this.topConfigModalVisible = true
    },
    closeTopConfigModal() {
      this.topConfigModalVisible = false
    },
    async saveTopNum() {
      if (!this.isPlatformAdministrator) return
      const n = parseInt(this.topNumDraft, 10)
      if (!Number.isFinite(n) || n <= 0 || n > 50) {
        message.error(this.$t('top_settings_msg_range'))
        return
      }

      const configId = this.topConfigType === 'VM_WIN' ? this.winTopNumConfigId : this.linTopNumConfigId
      if (!configId) {
        message.error(this.$t('top_settings_msg_not_found'))
        return
      }

      this.topNumSaving = true
      try {
        await configUpdate(configId, { config_value: String(n) })
        if (this.topConfigType === 'VM_WIN') {
          this.winTopNum = n
        } else {
          this.linTopNum = n
        }
        this.topConfigModalVisible = false
        this.initTop()
        message.success(this.$t('top_settings_msg_update_success'))
      } catch (e) {
        console.error('更新排行数量失败:', e)
        message.error(this.$t('top_settings_msg_update_failed'))
      } finally {
        this.topNumSaving = false
      }
    },
    hostTitle(v) {
      if (!v) return ''
      return v.hostname + (v.instance_name ? ' [' + v.instance_name + ']' : '')
    },
    displayScore(v) {
      return v ? (v.displayScore || 0) : 0
    },
    fmtPercent(v) {
      if (typeof v !== 'number' && typeof v !== 'string') return '—'
      if (typeof v === 'string' && !v.trim()) return '—'
      const number = Number(v)
      return Number.isFinite(number) && number >= 0 && number <= 100 ? number + '%' : '—'
    },
    onWinSortChange(e) {
      this.winSortBy = e.target.value
      this.loadWinTop()
    },
    onLinSortChange(e) {
      this.linSortBy = e.target.value
      this.loadLinTop()
    },
    loadWinTop() {
      return indexRestop({ host_type: 'VM_WIN', metrics_type: this.winSortBy, top_num: String(this.winTopNum) })
        .then((resp) => {
          const res = resp.data
          if (!res || (res.code !== 200 && res.code !== 0) || !Array.isArray(res.data)) throw new Error('排行数据暂不可用')
          this.loadErrors.windows = false
          const arr = (res && Array.isArray(res.data)) ? res.data : []
          this.winTop = arr.filter(Boolean).map(item => ({
            ...item,
            displayScore: item.score
          }))
        })
        .catch((err) => {
          this.loadErrors.windows = true
          console.error('获取 Windows 排行失败:', err)
          this.winTop = []
        })
    },
    loadLinTop() {
      return indexRestop({ host_type: 'VM_LIN', metrics_type: this.linSortBy, top_num: String(this.linTopNum) })
        .then((resp) => {
          const res = resp.data
          if (!res || (res.code !== 200 && res.code !== 0) || !Array.isArray(res.data)) throw new Error('排行数据暂不可用')
          this.loadErrors.linux = false
          const arr = (res && Array.isArray(res.data)) ? res.data : []
          this.linTop = arr.filter(Boolean).map(item => ({
            ...item,
            displayScore: item.score
          }))
        })
        .catch((err) => {
          this.loadErrors.linux = true
          console.error('获取 Linux 排行失败:', err)
          this.linTop = []
        })
    },
    initConfig() {
      return configGetList().then(resp => {
        const res = resp.data
        if (res.code === 200 && res.data && res.data.items) {
          const cfgLin = res.data.items.find(item => item.config_key === 'dash_top_lin_num')
          const cfgWin = res.data.items.find(item => item.config_key === 'dash_top_win_num')
          
          if (cfgLin) {
            this.linTopNumConfigId = cfgLin.id || cfgLin.config_id || null
            this.linTopNum = parseInt(cfgLin.config_value) || 10
            this.linTopNumDraft = this.linTopNum
          }
          if (cfgWin) {
            this.winTopNumConfigId = cfgWin.id || cfgWin.config_id || null
            this.winTopNum = parseInt(cfgWin.config_value) || 10
            this.winTopNumDraft = this.winTopNum
          }
        }
      }).catch(err => {
        console.error('获取配置失败:', err)
      })
    },
    hexToRgba(hex, alpha = 1) {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    },
    initTrigger() {
      return indexTrigger()
        .then((resp) => {
          let res = resp.data
          if (!res || (res.code !== 200 && res.code !== 0) || res.data == null) throw new Error('主页数据暂不可用')
          this.loadErrors.alerts = false
          // 添加空值保护
          this.triggerList = (res && res.data && res.data.items) ? res.data.items : []
          // 如果有数据或者明确返回成功，认为实例已配置
          if (res && (res.code === 200 || res.code === 0)) {
            if (this.hasZabbixInstance === null) {
              this.hasZabbixInstance = true
            }
          }
        })
        .catch((err) => {
          this.loadErrors.alerts = true
          console.error('获取告警信息失败:', err)
          // 任何错误都可能是未配置实例导致的
          this.hasZabbixInstance = false
          this.triggerList = []
        })
        .finally(() => {
          this.loading1 = true
        })
    },
    initInfo() {
      return indexInfo()
        .then((resp) => {
          let res = resp.data
          if (!res || (res.code !== 200 && res.code !== 0) || res.data == null) throw new Error('主页数据暂不可用')
          this.loadErrors.devices = false
          const data = (res && res.data) || {}
          // 确保数据有默认值
          this.info = {
            net_count: data.net_count || 0,
            srv_count: data.srv_count || 0,
            win_count: data.win_count || 0,
            lin_count: data.lin_count || 0,
            total_count: data.total_count || 0,
            asset_type_counts: Array.isArray(data.asset_type_counts) ? data.asset_type_counts : []
          }
          // 如果有数据或者明确返回成功，认为实例已配置
          if (res && (res.code === 200 || res.code === 0)) {
            if (this.hasZabbixInstance === null) {
              this.hasZabbixInstance = true
            }
          }
        })
        .catch((err) => {
          this.loadErrors.devices = true
          console.error('获取主机统计信息失败:', err)
          // 任何错误都可能是未配置实例导致的
          this.hasZabbixInstance = false
          // 保持默认值
          this.info = {
            net_count: 0,
            srv_count: 0,
            win_count: 0,
            lin_count: 0,
            total_count: 0,
            asset_type_counts: []
          }
        })
        .finally(() => {
          this.loading2 = true
        })
    },
    initEgress() {
      return indexEgress()
        .then((resp) => {
          let res = resp.data
          if (!res || (res.code !== 200 && res.code !== 0) || res.data == null) throw new Error('主页数据暂不可用')
          this.loadErrors.bandwidth = false
          this.egressUpdateTime = ''
          // 检查返回的数据格式
          if (res.data && Array.isArray(res.data)) {
            // 新格式：数组，确保每个项都有有效的值
            this.egressData = res.data.filter(Boolean).map(item => ({
              ...item,
              in_value: item?.in_value || 0,
              out_value: item?.out_value || 0
            }))
            
            // 从数据中提取最新的采集时间 (取最大的 timestamp)
            const timestamps = res.data.filter(Boolean).map(item => item?.timestamp).filter(t => t > 0)
            if (timestamps.length > 0) {
              const maxTimestamp = Math.max(...timestamps)
              // 接口返回的是秒级时间戳，需要乘以 1000
              const date = new Date(maxTimestamp * 1000)
              this.egressUpdateTime = parseTimeFun(date)
            }
          } else if (res.data && typeof res.data === 'object') {
            // 旧格式：对象，转换为数组格式（向后兼容）
            this.egressData = [
              {
                id: 1,
                name: res.data.name_one || '出口1',
                in_value: res.data.in_one || 0,
                out_value: res.data.out_one || 0
              },
              {
                id: 2,
                name: res.data.name_two || '出口2',
                in_value: res.data.in_two || 0,
                out_value: res.data.out_two || 0
              }
            ].filter(item => item.name && item.name !== '--')
          } else {
            this.egressData = []
          }
        })
        .catch((err) => {
          this.loadErrors.bandwidth = true
          this.egressUpdateTime = ''
          console.error('获取出口数据失败:', err)
          this.egressData = []
        })
        .finally(() => {
          this.loading3 = true
        })
    },
    initTop() {
      // A2：按当前选择的排序字段分别请求 Windows/Linux 的 TopN，后端返回已包含 cpu/mem 两项
      this.loadWinTop()
      this.loadLinTop()
    }
  },
  filters: {
    parsetime(v) {
      return parseTimeFun(v)
    },
    TrafficBytes(bytes, decimals = 2) {
      if (bytes === 0) return '0 Bytes'
      const k = 1000
      const dm = decimals < 0 ? 0 : decimals
      const sizes = [
        'Bytes',
        'KBps',
        'MBps',
        'GBps',
        'TBps',
        'PBps',
        'EBps',
        'ZBps',
        'YBps'
      ]
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + sizes[i]
    },
    kbFilters(v) {
      if (v && v > 0) {
        v = parseFloat(v)
        if (v <= 1024) {
          return v + 'B/s'
        }
        if (v > 1024 && (v * 8) / 1024 < 1024) {
          return ((v * 8) / 1024).toFixed(2) + 'Kb/s'
        }
        if ((v * 8) / 1024 > 1024 && (v * 8) / 1024 / 1024 < 1024) {
          return ((v * 8) / 1024 / 1024).toFixed(2) + 'Mb/s'
        }
        if ((v * 8) / 1024 / 1024 > 1024) {
          return ((v * 8) / 1024 / 1024 / 1024).toFixed(2) + 'Gb/s'
        }
      } else {
        return v
      }
    }
  }
}
</script>

<style lang="less">
.top-panels-row {
  margin-bottom: 20px;
}

.homeTopList {
  --top-row-height: 49px;
  width: 100%;
  padding: 10px 20px;
  .topListHeader {
    display: flex;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #f0f0f0;
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
    font-weight: 500;
    .col-name {
      flex: 0 0 35%;
      padding-left: 45px;
    }
    .col-metric {
      flex: 1;
      text-align: left;
      padding-left: 10px;
    }
  }
  .listBody {
    height: calc(var(--top-row-height) * 10);
    max-height: calc(var(--top-row-height) * 10);
    overflow-y: auto;
  }
  .listBody.is-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 116px;
    min-height: 116px;
    max-height: 116px;
  }
  .top-list-empty {
    color: #8290a0;
    font-size: 12px;
  }
  .topListItem {
    display: flex;
    align-items: center;
    min-height: var(--top-row-height);
    box-sizing: border-box;
    padding: 8px 0;
    border-bottom: 1px solid #f0f0f0;
    transition: all 0.3s;
    &:hover {
      background: var(--primary-bg);
    }
    &.empty {
      height: var(--top-row-height);
      min-height: var(--top-row-height);
      border-bottom: none;
    }
    .col-name {
      flex: 0 0 35%;
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      .rank-icon {
        flex: 0 0 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
        color: #999;
        img {
          width: 24px;
          height: auto;
        }
      }
      .host-info {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 6px;
        .hostname {
          font-size: 13px;
          color: #262626;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          min-width: 0;
        }
      }
    }
    .col-metric {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 10px;
      .metric-value {
        flex: 0 0 60px;
        font-size: 13px;
        font-weight: 500;
        color: var(--primary-color);
        text-align: right;
      }
      /deep/ .legent {
        flex: 1;
        min-width: 160px;
        display: block;
      }
    }
  }
}
.homeMain {
  min-height: 140px;
  max-height: 430px;
  height: auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px;
}
.homeMain.is-empty {
  min-height: 132px;
}
.homeMain /deep/ .ant-empty {
  margin: 34px 0;
}
.homeLegent1 {
  width: 100%;
  padding: 20px 30px 20px;
  border-bottom: 1px solid #ddd;
  overflow: hidden;
}
.homeLeItem1 {
  width: 100%;
  display: inline-flex;
  justify-content: space-between;
  align-items: center;
}
.homeLeLeft {
  flex: 0 0 40%;
  min-width: 0;
}
.homeLeLeft1 {
  width: 90%;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  img {
    width: 30px;
    height: auto;
    margin: 0 20px;
  }
  span {
    flex: 0 0 100px;
    border-left: 1px solid #ddd;
    font-size: 16px;
    line-height: 16px;
    font-weight: 500;
    color: var(--primary-color);
    text-align: center;
  }
}
.homeLeLeft2 {
  width: 90%;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  color: #354052;
  line-height: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.homeLeRight {
  flex: 0 0 60%;
  height: 38px;
  min-width: 0;
  overflow: hidden;
}
.homeLegent2 {
  width: 100%;
  padding: 20px 30px 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  overflow: hidden;
}
.homeLeItem {
  flex: 0 0 48%;
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin-bottom: 23px;
  height: 66px;
  min-width: 0;
}
.homeLeTop {
  width: 100%;
  display: inline-flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.homeLeTop1 {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid #ddd;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  img {
    width: 22px;
    height: auto;
  }
}
.homeLeTop2 {
  flex: 1;
  width: 0;
  font-size: 12px;
  font-weight: 500;
  color: #354052;
  line-height: 16px;
  margin: 0 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
}
.homeLeTop3 {
  font-size: 16px;
  line-height: 16px;
  font-weight: 500;
  color: var(--primary-color);
}
.homeLeBot {
  width: 100%;
  height: 20px;
  overflow: hidden;
}
.homeH2 {
  width: 100%;
  line-height: 60px;
  font-size: 28px;
  color: #000;
  font-weight: 600;
}
.homePies {
  width: 100%;
  height: 170px;
  display: flex;
  align-items: center;
}
.homePied {
  flex: 0 0 20%;
  width: 0;
  height: 170px;
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.homePie {
  width: 100%;
  height: 130px;
}
.homePieN {
  height: 40px;
  line-height: 16px;
  font-size: 12px;
  color: #000;
  text-align: center;
  width: 80%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.instance-tag {
  font-size: 10px;
  margin-top: 4px;
  height: 18px;
  line-height: 16px;
  padding: 0 6px;
}
.instance-tag-small {
  font-size: 10px;
  margin-top: 2px;
  height: 16px;
  line-height: 14px;
  padding: 0 4px;
}
.device-stat-grid {
  min-height: 166px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.device-stat-card {
  min-width: 0;
  min-height: 78px;
  padding: 12px 14px;
  border: 1px solid #d7e1ec;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fbfcfe;
  box-shadow: 0 1px 2px rgba(10, 31, 68, .05);
}
.device-stat-icon {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  border: 1px solid #cbd9e8;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #1b5a96;
  background: #edf4fa;
  font-size: 16px;
}
.device-stat-content {
  min-width: 0;
  flex: 1;
}
.device-name {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: #52677f;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  white-space: normal;
  overflow-wrap: anywhere;
}
.device-stat-value {
  display: flex;
  flex-wrap: wrap;
  min-width: 0;
  align-items: baseline;
  gap: 4px;
  margin-top: 5px;
  color: #0a1f44;
}
.device-count {
  min-width: 0;
  overflow-wrap: anywhere;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
  font-variant-numeric: tabular-nums;
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
}
.device-stat-unit {
  color: #6b7f95;
  font-size: 12px;
  font-weight: 500;
}

@media (max-width: 720px) {
  .device-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .device-stat-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 10px;
  }

  .device-stat-content {
    flex: none;
    width: 100%;
  }
}
</style>

<style lang="less" scoped>
.workplace-heading {
  margin-bottom: 14px;
}

.workplace-kicker {
  margin: 0 0 4px !important;
  color: #1b5a96 !important;
  font-size: 11px !important;
  font-weight: 700;
  letter-spacing: .24em;
}

.smartops-workplace /deep/ .ant-card {
  border-color: #dce4ed;
  border-radius: 2px;
  box-shadow: none;
}

.smartops-workplace /deep/ .ant-card-body {
  box-shadow: none !important;
}

.smartops-workplace /deep/ .ant-card-head {
  border-bottom-color: #dce4ed;
  background: #f8fafc !important;
}

.smartops-workplace /deep/ .ant-card-head-title {
  color: #0a1f44 !important;
}

</style>
