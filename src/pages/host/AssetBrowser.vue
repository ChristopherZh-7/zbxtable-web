<template>
  <page-layout :noTitle="true">
    <div class="smartops-page-heading asset-heading">
      <div>
        <p class="asset-kicker">统一台账</p>
        <h1>资产管理</h1>
        <p>查看全部监控设备，或按已有分类浏览；资产档案在资产配置中心维护。</p>
      </div>
      <div class="smartops-heading-metric">监控设备总数<strong>{{ totalAssets }}</strong></div>
    </div>
    <div class="asset-browser" :style="themeVars">
      <a-layout class="asset-browser__layout">

        <!-- ── 左侧树形导航 ── -->
        <a-layout-sider :width="248" theme="light" class="asset-browser__sider">
          <!-- 搜索框 -->
          <div class="sider-search">
            <a-input
              v-model="searchText"
              placeholder="搜索设备类型"
              size="small"
              allow-clear
            >
              <a-icon slot="prefix" type="search" style="color:#bbb;" />
            </a-input>
          </div>

          <div class="all-devices-nav">
            <a-button
              block
              icon="database"
              :type="selectedType && selectedType.typeCode === allDeviceType ? 'primary' : 'default'"
              :aria-pressed="Boolean(selectedType && selectedType.typeCode === allDeviceType)"
              @click="selectAllDevices"
            >全部监控设备</a-button>
          </div>

          <a-spin :spinning="treeLoading" size="small">
            <!-- 空状态 -->
            <a-empty
              v-if="!treeLoading && !treeData.length"
              :image-style="{ height: '60px' }"
              description="暂无设备分组"
              style="padding: 32px 0;"
            />

            <!-- 树形菜单 -->
            <a-tree
              v-else
              :expanded-keys="expandedKeys"
              :selected-keys="selectedKeys"
              :show-line="false"
              class="asset-tree"
              @expand="onExpand"
              @select="onSelect"
            >
              <template v-for="group in filteredTreeData">
                <a-tree-node
                  :key="'group_' + group.key"
                  :selectable="false"
                  class="tree-group-node"
                >
                  <!-- 分组标题 slot -->
                  <template slot="title">
                    <span class="tree-group-title">
                      <a-icon :type="group.icon || 'appstore'" class="tree-group-icon" :style="{ color: $themeColor }" />
                      <span class="tree-group-name">{{ group.name }}</span>
                      <a-badge
                        :count="group.total"
                        :overflow-count="9999"
                        :number-style="{ backgroundColor: $themeColor, fontSize: '11px', lineHeight: '16px', height: '16px', minWidth: '22px', padding: '0 5px' }"
                      />
                    </span>
                  </template>

                  <!-- 设备类型叶节点 -->
                  <a-tree-node
                    v-for="type in group.children"
                    :key="type.key"
                    :is-leaf="true"
                    class="tree-type-node"
                  >
                    <template slot="title">
                      <span class="tree-type-title">
                        <a-icon v-if="type.icon" :type="type.icon" class="tree-type-icon" />
                        <span class="tree-type-name">{{ type.name }}</span>
                        <span class="tree-type-count">{{ type.count != null ? type.count : '' }}</span>
                      </span>
                    </template>
                  </a-tree-node>
                </a-tree-node>
              </template>
            </a-tree>
          </a-spin>
        </a-layout-sider>

        <!-- ── 右侧内容区 ── -->
        <a-layout-content class="asset-browser__content">

          <!-- 未选择状态：展示各分组汇总卡片 -->
          <template v-if="!selectedType">
            <div class="overview-header">
              <a-icon type="appstore" :style="{ marginRight: '8px', color: $themeColor }" />
              <span>资产分类</span>
            </div>
            <a-row :gutter="[16, 16]" class="overview-cards">
              <a-col
                v-for="group in treeData"
                :key="group.key"
                :xs="24" :sm="12" :md="8" :lg="6"
              >
                <a-card
                  size="small"
                  class="overview-card"
                  @click="selectFirstTypeInGroup(group)"
                >
                  <div class="overview-card__body">
                    <a-icon :type="group.icon || 'appstore'" class="overview-card__icon" :style="{ color: $themeColor }" />
                    <div class="overview-card__info">
                      <div class="overview-card__name">{{ group.name }}</div>
                      <div class="overview-card__count" :style="{ color: $themeColor }">
                        <a-spin v-if="group.total == null" size="small" />
                        <template v-else>{{ group.total }} 台</template>
                      </div>
                    </div>
                  </div>
                  <div class="overview-card__types">
                    <a-tag
                      v-for="t in group.children.slice(0, 3)"
                      :key="t.key"
                      size="small"
                      style="margin:2px 4px 2px 0;cursor:pointer;"
                      @click.stop="selectType(t)"
                    >{{ t.name }}</a-tag>
                    <span v-if="group.children.length > 3" style="color:#aaa;font-size:12px;">
                      +{{ group.children.length - 3 }}
                    </span>
                  </div>
                </a-card>
              </a-col>
            </a-row>
          </template>

          <!-- 已选设备类型：面包屑 + 设备列表 -->
          <template v-else>
            <div class="content-header">
              <a-breadcrumb>
                <a-breadcrumb-item>
                  <a @click="selectedType = null" style="cursor:pointer;">资产管理</a>
                </a-breadcrumb-item>
                <a-breadcrumb-item>{{ selectedGroupName }}</a-breadcrumb-item>
                <a-breadcrumb-item>
                  <a-icon v-if="selectedType.icon" :type="selectedType.icon" style="margin-right:4px;" />
                  {{ selectedType.name }}
                </a-breadcrumb-item>
              </a-breadcrumb>
            </div>

            <!-- 嵌入式设备列表 -->
            <generic-device-list
              :key="selectedType.typeCode"
              :type-code="selectedType.typeCode"
              :embedded="true"
            />
          </template>
        </a-layout-content>

      </a-layout>
    </div>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import GenericDeviceList from './GenericDeviceList.vue'
import themeMixin from '@/mixins/themeMixin'
import { getAssetGroups, getAssetTypes, hostList } from '@/services/admin'
const {ALL_DEVICE_TYPE} = require('./all-monitoring-devices')

// 用 INDEX_INFO 获取设备数量
const INDEX_INFO = '/v1/index/baseinfo'
import { request, METHOD } from '@/utils/request'

export default {
  name: 'AssetBrowser',
  mixins: [themeMixin],
  components: { PageLayout, GenericDeviceList },
  data() {
    return {
      treeLoading: false,
      treeData: [],        // [{ key, name, icon, total, children:[{key,name,icon,count,typeCode}] }]
      expandedKeys: [],
      selectedKeys: [],
      selectedType: null,  // { typeCode, name, icon, groupName }
      selectedGroupName: '',
      searchText: '',
      hostCounts: {},      // typeCode → count
      allDeviceType: ALL_DEVICE_TYPE,
      totalHostCount: null,
    }
  },
  computed: {
    totalAssets() {
      return this.totalHostCount == null ? '—' : this.totalHostCount
    },
    // 注入主题色 CSS 变量，供 /deep/ 选择器（hover/选中态）使用
    themeVars() {
      return {
        '--theme-color': this.themeColor,
        '--theme-hover-bg': this.hexToRgba(this.themeColor, 0.08),
        '--theme-selected-bg': this.hexToRgba(this.themeColor, 0.16),
      }
    },
    filteredTreeData() {
      const q = this.searchText.trim().toLowerCase()
      if (!q) return this.treeData
      return this.treeData
        .map((g) => ({
          ...g,
          children: g.children.filter((t) => t.name.toLowerCase().includes(q)),
        }))
        .filter((g) => g.children.length > 0)
    },
  },
  created() {
    this.loadTreeData()
  },
  methods: {
    async loadTreeData() {
      this.treeLoading = true
      try {
        // 分组 + 类型均为本地 DB 查询（毫秒级），先用它们立即渲染树
        const [groupsRes, typesRes] = await Promise.all([
          getAssetGroups(),
          getAssetTypes(),
        ])
        const groups = (groupsRes.data && groupsRes.data.data) || []
        const types  = (typesRes.data  && typesRes.data.data)  || []

        // 构建 group → types 映射
        const groupMap = {}
        groups.forEach((g) => { groupMap[g.group_key] = { ...g, children: [] } })

        types.forEach((t) => {
          if (!t.menu_group || !groupMap[t.menu_group]) return
          groupMap[t.menu_group].children.push({
            key: t.type_code,
            name: t.name,
            icon: t.icon,
            count: null, // 数量稍后异步填充
            typeCode: t.type_code,
            typeId: t.id,
          })
        })

        // 排序（总数先为 null，待 counts 返回后再更新）
        this.treeData = Object.values(groupMap)
          .filter((g) => g.children.length > 0)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((g) => ({
            key: g.group_key,
            name: g.name,
            icon: g.icon,
            total: null,
            children: g.children,
          }))

        // 默认展开所有分组
        this.expandedKeys = this.treeData.map((g) => 'group_' + g.key)

        // 若从详情页返回并带 ?type=，自动选中对应设备类型
        this.applyTypeFromQuery()
      } catch (e) {
        this.$message.error('加载设备树失败')
      } finally {
        this.treeLoading = false
      }

      // 数量统计走 Zabbix（约 2s），后台异步加载，不阻塞树渲染
      this.loadHostCounts()
      this.loadTotalHostCount()
    },

    async loadTotalHostCount() {
      this.totalHostCount = null
      try {
        const response = await hostList({page: 1, limit: 1})
        const payload = response.data || {}
        if (payload.code === 200 && payload.data && Number.isFinite(Number(payload.data.total))) {
          this.totalHostCount = Math.max(0, Number(payload.data.total))
        }
      } catch (e) { /* 未获取真实总数时显示未知，不用已分类数量冒充全量 */ }
    },

    selectAllDevices() {
      this.selectedType = {key: ALL_DEVICE_TYPE, typeCode: ALL_DEVICE_TYPE, name: '全部监控设备', icon: 'database'}
      this.selectedGroupName = '监控设备'
      this.selectedKeys = []
    },

    // 根据路由 query.type 自动选中设备类型（详情页返回时定位）
    applyTypeFromQuery() {
      const code = this.$route.query.type
      if (!code) return
      if (code === ALL_DEVICE_TYPE) {
        this.selectAllDevices()
        return
      }
      for (const group of this.treeData) {
        const found = group.children.find((t) => t.typeCode === code)
        if (found) {
          this.selectedType = { ...found }
          this.selectedGroupName = group.name
          this.selectedKeys = [found.key]
          return
        }
      }
    },

    // 异步加载各类型主机数量并回填到树（不阻塞首屏）
    async loadHostCounts() {
      try {
        const countsRes = await request(INDEX_INFO, METHOD.GET)
        // baseinfo 用 SuccessWithMessage 返回：resp.data = {code,message,data: IndexInfo}
        const biz = (countsRes && countsRes.data) || {}
        const info = biz.data || {}
        this.hostCounts = info.host_counts || {}

        this.treeData = this.treeData.map((g) => {
          const children = g.children.map((t) => ({
            ...t,
            count: this.hostCounts[t.typeCode] != null ? this.hostCounts[t.typeCode] : 0,
          }))
          return {
            ...g,
            children,
            total: children.reduce((sum, t) => sum + (t.count || 0), 0),
          }
        })
      } catch (e) {
        /* 数量加载失败不影响树的使用 */
      }
    },

    onExpand(keys) {
      this.expandedKeys = keys
    },

    onSelect(keys) {
      if (!keys.length) return
      const key = keys[0]
      if (key.startsWith('group_')) return // 分组节点不可选

      // 找到对应的设备类型
      for (const group of this.treeData) {
        const found = group.children.find((t) => t.key === key)
        if (found) {
          this.selectedType = { ...found }
          this.selectedGroupName = group.name
          this.selectedKeys = [key]
          return
        }
      }
    },

    selectType(type) {
      for (const group of this.treeData) {
        const found = group.children.find((t) => t.key === type.key)
        if (found) {
          this.selectedType = { ...found }
          this.selectedGroupName = group.name
          this.selectedKeys = [type.key]
          // 确保对应分组展开
          const groupKey = 'group_' + group.key
          if (!this.expandedKeys.includes(groupKey)) {
            this.expandedKeys = [...this.expandedKeys, groupKey]
          }
          return
        }
      }
    },

    selectFirstTypeInGroup(group) {
      if (group.children.length) this.selectType(group.children[0])
    },
  },
}
</script>

<style lang="less" scoped>
.all-devices-nav {
  padding: 10px 12px 2px;
}

.asset-heading {
  margin-bottom: 14px;
}

.asset-kicker {
  margin: 0 0 4px !important;
  color: #1b5a96 !important;
  font-size: 11px !important;
  font-weight: 700;
  letter-spacing: .24em;
}

.asset-browser {
  height: calc(100vh - 230px);
  min-height: 500px;

  &__layout {
    height: 100%;
    background: #fff;
    border: 1px solid #dce4ed;
    border-radius: 2px;
    overflow: hidden;
  }

  &__sider {
    border-right: 1px solid #dce4ed;
    overflow-y: auto;
    background: #f6f8fb;

    .sider-search {
      padding: 12px 12px 8px;
      background: #f6f8fb;
      border-bottom: 1px solid #dce4ed;
    }
  }

  &__content {
    padding: 16px;
    overflow-y: auto;
    background: #fff;
  }
}

// 分组节点
.tree-group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 650;
  color: #243a54;
}
.tree-group-icon {
  color: var(--theme-color, #1b5a96);
  font-size: 14px;
}
.tree-group-name {
  flex: 1;
}

// 类型叶节点
.tree-type-title {
  display: flex;
  align-items: center;
  gap: 5px;
}
.tree-type-icon {
  color: #888;
  font-size: 13px;
}
.tree-type-name {
  flex: 1;
  color: #43566d;
}
.tree-type-count {
  font-size: 11px;
  color: #8492a2;
  min-width: 24px;
  text-align: right;
}

// 树整体
.asset-tree {
  padding: 8px 4px;
  background: transparent;

  /deep/ .ant-tree-node-content-wrapper:hover {
    background: var(--theme-hover-bg, #edf4fb);
  }
  /deep/ .ant-tree-node-selected .ant-tree-node-content-wrapper {
    background: var(--theme-selected-bg, #dceaf6) !important;
    border-radius: 2px;
  }
  /deep/ .ant-tree-node-content-wrapper {
    border-radius: 2px;
    transition: background 0.15s;
  }
}

// 总览卡片
.overview-header {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #dce4ed;
  color: #0a1f44;
  font-size: 15px;
  font-weight: 650;
}
.overview-card {
  min-height: 140px;
  border-color: #dce4ed;
  border-radius: 2px;
  transition: border-color 0.16s;
  cursor: pointer;
  &:hover {
    border-color: #1b5a96;
    box-shadow: none;
    transform: none;
  }
  &__body {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }
  &__icon {
    font-size: 28px;
    color: var(--theme-color, #1b5a96);
  }
  &__name {
    font-size: 14px;
    font-weight: 650;
    color: #243a54;
  }
  &__count {
    font-size: 20px;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-weight: 650;
    color: var(--theme-color, #1b5a96);
  }
  &__types {
    border-top: 1px solid #e6ebf1;
    padding-top: 8px;
  }
}

.content-header {
  margin-bottom: 12px;
}
</style>
