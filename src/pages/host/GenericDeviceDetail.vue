<template>
  <page-layout :title="detail.name || '设备详情'" :custom-breadcrumb="breadcrumbItems" class="smartops-management-page">
    <a-button slot="action" icon="arrow-left" @click="goBack">返回</a-button>

    <div slot="headerContent" class="generic-detail">
      <a-spin :spinning="loading">

        <monitoring-health-card :health="(detail && detail.monitoring_health) || {}" />

        <!-- 基本信息卡片 -->
        <a-card title="基本信息" :body-style="{ padding: '12px' }" style="margin-bottom: 16px;">
          <a-descriptions bordered size="small" :column="{ xxl: 4, xl: 3, lg: 2, md: 2, sm: 1 }">
            <template v-for="field in visibleFields">
              <a-descriptions-item :key="field.key" :label="fieldLabel(field)">
                <!-- 历史自定义值永远按纯文本渲染，不能继承旧定义中的 link/render 行为。 -->
                <template v-if="field.custom">
                  <span>{{ displayFieldValue(fieldValue(detail, field.key)) }}</span>
                </template>
                <!-- progress -->
                <template v-else-if="field.render === 'progress'">
                  <span v-if="fieldValue(detail, field.key)">
                    <a-progress
                      :percent="parseFieldPercent(fieldValue(detail, field.key))"
                      size="small"
                      status="active"
                      style="width: 140px; display: inline-block; margin-right: 8px;"
                    />
                    {{ fmtPercent(fieldValue(detail, field.key)) }}
                  </span>
                  <span v-else>--</span>
                </template>
                <!-- status -->
                <template v-else-if="field.render === 'status'">
                  <a-tooltip>
                    <template slot="title">{{ detail.error }}</template>
                    <a-tag v-if="fieldValue(detail, field.key) == 1" color="#34af67">{{ interfaceAvailabilityLabel(fieldValue(detail, field.key)) }}</a-tag>
                    <a-tag v-else-if="fieldValue(detail, field.key) == 2" color="#DC143C">{{ interfaceAvailabilityLabel(fieldValue(detail, field.key)) }}</a-tag>
                    <a-tag v-else color="#808080">{{ interfaceAvailabilityLabel(fieldValue(detail, field.key)) }}</a-tag>
                  </a-tooltip>
                </template>
                <!-- ping -->
                <template v-else-if="field.render === 'ping'">
                  <a-tag v-if="detail[field.key] && detail[field.key].includes('Up')" color="#34af67">在线</a-tag>
                  <a-tag v-else-if="detail[field.key] && detail[field.key].includes('Down')" color="#DC143C">离线</a-tag>
                  <a-tag v-else color="#808080">未知</a-tag>
                  <span v-if="detail.ping_sec" style="font-size: 12px; color: #888; margin-left: 4px;">
                    {{ (detail.ping_sec || '').replace(/\s/g, '') }} / {{ (detail.ping_loss || '').replace(/\s/g, '') }}
                  </span>
                </template>
                <!-- tag -->
                <template v-else-if="field.render === 'tag'">
                  <a-tag :color="$themeColor">{{ fieldValue(detail, field.key) || '未知' }}</a-tag>
                </template>
                <!-- link -->
                <template v-else-if="field.render === 'link'">
                  <a
                    v-if="safeExternalLink(fieldValue(detail, field.key))"
                    :href="safeExternalLink(fieldValue(detail, field.key))"
                    target="_blank"
                    rel="noopener noreferrer"
                  >{{ fieldValue(detail, field.key) }}</a>
                  <span v-else>{{ fieldValue(detail, field.key) || '--' }}</span>
                </template>
                <!-- text / default -->
                <template v-else>
                  <!-- 维保到期：按距当前时间远近显示不同风格的 Tag -->
                  <template v-if="field.key === 'date_hw_expiry' && detail[field.key]">
                    <a-tooltip :title="expiryStatus(detail[field.key]).tip">
                      <a-tag :color="expiryStatus(detail[field.key]).color">
                        {{ detail[field.key] }}
                        <span style="margin-left: 4px;">{{ expiryStatus(detail[field.key]).text }}</span>
                      </a-tag>
                    </a-tooltip>
                  </template>
                  <span v-else>{{ fieldValue(detail, field.key) || '--' }}</span>
                </template>
              </a-descriptions-item>
            </template>
          </a-descriptions>
        </a-card>

        <!-- 监控图形 -->
        <a-card title="监控图形" :body-style="{ padding: '12px' }">
          <div style="margin-bottom: 12px;">
            <a-form-model layout="inline" :colon="false">
              <a-form-model-item label="时间范围">
                <a-range-picker
                  format="YYYY-MM-DD HH:mm:ss"
                  :show-time="{ format: 'HH:mm', defaultValue: [moment('00:00:00', 'HH:mm:ss'), moment('23:59:59', 'HH:mm:ss')] }"
                  v-model="timeValue"
                  @change="changeGraphTime"
                  :getCalendarContainer="triggerNode => triggerNode.parentNode || document.body"
                />
              </a-form-model-item>
              <a-form-model-item>
                <a-button type="primary" @click="fetchGraph">查询</a-button>
                <a-button style="margin-left: 8px;" @click="() => { resetGraphRange(); fetchGraph(); }">重置</a-button>
              </a-form-model-item>
            </a-form-model>
          </div>
          <a-spin :spinning="graphLoading">
            <div v-if="sortedPngData.length > 0" class="graph-container">
              <div v-for="item in sortedPngData" :key="item.name" class="graph-item">
                <h4>{{ item.name }}</h4>
                <img :src="`data:image/png;base64,${item.png}`" :alt="item.name" />
              </div>
            </div>
            <a-empty v-else-if="!graphLoading" description="暂无图表数据" />
          </a-spin>
        </a-card>

      </a-spin>
    </div>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import moment from 'moment'
import { hostDetail, hostGraph, getAssetTypes, getAssetTypeFields } from '@/services/admin'
import { parseTimeFun, expiryStatus } from '@/utils/formatter'
import themeMixin from '@/mixins/themeMixin'
import MonitoringHealthCard from '@/components/MonitoringHealthCard'
const monitoringHealthPolicy = require('@/utils/monitoring-health')
const {ALL_DEVICE_TYPE, allMonitoringDeviceFields} = require('./all-monitoring-devices')

export default {
  name: 'GenericDeviceDetail',
  mixins: [themeMixin],
  components: { PageLayout, MonitoringHealthCard },
  data() {
    return {
      moment,
      id: '',
      zid: '',
      typeCode: '',
      typeName: '',
      typeId: null,
      loading: false,
      detail: {},
      detailRequest: 0,
      graphRequest: 0,
      fieldConfigs: [],
      graphLoading: false,
      pngData: [],
      sortedPngData: [],
      timeValue: [],
      beginTime: '',
      endTime: '',
    }
  },
  computed: {
    breadcrumbItems() {
      return ['设备管理', '设备树', this.typeName || '设备详情']
    },
    visibleFields() {
      return this.fieldConfigs
        .filter((f) => f.visible)
        .sort((a, b) => a.order - b.order)
    },
  },
  watch: {
    $route(to, from) {
      if (to.query.id !== from.query.id || to.query.zid !== from.query.zid ||
          (to.query.typeCode || (to.meta && to.meta.type_code)) !== (from.query.typeCode || (from.meta && from.meta.type_code))) {
        this.loadRoute()
      }
    },
  },
  created() {
    this.loadRoute()
  },
  beforeDestroy() {
    this.detailRequest += 1
    this.graphRequest += 1
  },
  methods: {
    loadRoute() {
      this.id = this.$route.query.id || ''
      this.zid = this.$route.query.zid || ''
      this.typeCode = this.$route.query.typeCode || (this.$route.meta && this.$route.meta.type_code) || ''
      this.resetGraphRange()
      return this.init()
    },
    displayFieldValue(value) {
      return value === null || value === undefined || value === '' ? '--' : value
    },
    interfaceAvailabilityLabel(value) {
      return monitoringHealthPolicy.interfaceAvailabilityLabel(value)
    },
    safeExternalLink(value) {
      if (typeof value !== 'string' || !value.trim()) return ''
      try {
        const parsed = new URL(value)
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : ''
      } catch {
        return ''
      }
    },
    async init() {
      const request = ++this.detailRequest
      const {id, zid, typeCode} = this
      this.detail = {}
      this.fieldConfigs = []
      this.typeId = null
      this.typeName = ''
      this.sortedPngData = []
      this.graphRequest += 1
      this.graphLoading = false
      this.loading = !!id
      if (!id) return
      try {
        const typesRes = await getAssetTypes()
        if (request !== this.detailRequest) return
        const types = (typesRes.data && typesRes.data.data) || []
        const typeInfo = types.find((t) => t.type_code === typeCode)
        if (typeInfo) {
          this.typeName = typeInfo.name
          this.typeId = typeInfo.id
          const fieldsRes = await getAssetTypeFields(typeInfo.id)
          if (request !== this.detailRequest) return
          this.fieldConfigs = (fieldsRes.data && fieldsRes.data.data) || []
        } else if (typeCode === ALL_DEVICE_TYPE) {
          this.typeName = '全部设备'
          this.fieldConfigs = allMonitoringDeviceFields()
        }
        const detailRes = await hostDetail(id, zid)
        if (request !== this.detailRequest) return
        const biz = detailRes.data
        if (biz && biz.code === 200) {
          this.detail = biz.data || {}
          this.fetchGraph()
        } else {
          this.$message.error((biz && biz.message) || '加载设备信息失败')
        }
      } catch {
        if (request === this.detailRequest) this.$message.error('加载设备信息失败')
      } finally {
        if (request === this.detailRequest) this.loading = false
      }
    },

    fieldConfig(key) {
      return this.fieldConfigs.find((field) => field.key === key) || {}
    },
    fieldValue(record, key) {
      const field = this.fieldConfig(key)
      return field.custom ? ((record.custom_attributes || {})[key]) : record[key]
    },
    fieldLabel(field) {
      if (field.key === 'available') return '接口可用性'
      return field.custom ? `${field.label || field.key}（历史只读 · 非 CMDB）` : field.label
    },

    parseFieldPercent(val) {
      if (!val) return 0
      return parseFloat(String(val).split(' ')[0]) || 0
    },
    fmtPercent(val) {
      const n = parseFloat(String(val).split(' ')[0])
      return isNaN(n) ? '--' : n.toFixed(1) + '%'
    },
    // 维保到期状态（共享工具，详见 @/utils/formatter）
    expiryStatus(dateStr) {
      return expiryStatus(dateStr)
    },

    goBack() {
      const fromType = this.$route.query.fromType || this.typeCode
      if (this.$route.query.from === 'assets') {
        this.$router.push(fromType ? `/assets/tree?type=${fromType}` : '/assets/tree')
      } else {
        this.$router.back()
      }
    },

    resetGraphRange() {
      const ntime = new Date()
      const qtime = new Date(Date.now() - 2 * 60 * 60 * 1000)
      this.beginTime = parseTimeFun(qtime)
      this.endTime = parseTimeFun(ntime)
      this.timeValue = [moment(qtime), moment(ntime)]
    },
    changeGraphTime(e) {
      if (e && e.length) {
        this.beginTime = parseTimeFun(new Date(e[0]))
        this.endTime = parseTimeFun(new Date(e[1]))
      } else {
        this.beginTime = ''
        this.endTime = ''
      }
    },
    fetchGraph() {
      if (!this.id || !this.detail.hostid) return
      const request = ++this.graphRequest
      this.graphLoading = true
      return hostGraph(this.id, {start: this.beginTime, end: this.endTime, zid: this.zid})
        .then((resp) => {
          if (request !== this.graphRequest) return
          const res = resp.data
          if (res.code === 200) {
            const items = (res.data && res.data.items) || []
            this.sortedPngData = [...items].sort((a, b) => a.name.localeCompare(b.name))
          } else { this.sortedPngData = [] }
        })
        .catch(() => { if (request === this.graphRequest) this.sortedPngData = [] })
        .finally(() => { if (request === this.graphRequest) this.graphLoading = false })
    },
  },
}
</script>

<style lang="less" scoped>
.generic-detail {
  padding-bottom: 24px;
}
.graph-container {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.graph-item {
  text-align: center;
  flex: 1 1 480px;
  h4 {
    font-size: 14px;
    color: #333;
    margin-bottom: 6px;
  }
  img {
    max-width: 100%;
  }
}
</style>
