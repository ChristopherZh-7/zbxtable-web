<template>
  <page-layout :noTitle="true">
    <div class="responsibility-directory smartops-management-page" data-testid="cmdb-responsibility-page">
      <header class="smartops-page-heading responsibility-heading">
        <div>
          <h1>运维基础资料</h1>
          <p>维护当前配置组织的运维团队与负责人，再供资产建档和发现入库统一选用。</p>
        </div>
        <div class="smartops-heading-actions">
          <span class="context-chip"><i />{{ currentTenant.name || '当前租户' }}</span>
          <a-tag v-if="!canUpdate" color="blue">只读视图</a-tag>
          <a-button icon="reload" :loading="loading" @click="reload">刷新</a-button>
          <a-button v-if="canCreate && writeContextReady" data-testid="responsibility-create-team" icon="team" @click="openCreate('team')">新增团队</a-button>
          <a-button v-if="canCreate && writeContextReady" data-testid="responsibility-create-person" type="primary" icon="user-add" @click="openCreate('person')">录入负责人</a-button>
        </div>
      </header>

      <a-spin :spinning="loading">
        <section v-if="directory.state === 'error'" class="directory-empty smartops-empty smartops-empty--error smartops-data-panel" data-testid="responsibility-load-error">
          <div class="empty-symbol"><a-icon type="warning" /></div>
          <h2>运维基础资料读取失败</h2>
          <p>{{ directory.message || '配置管理中心或智能运维管理系统接口暂时不可用，请稍后重试。' }}</p>
          <a-button type="primary" icon="reload" @click="reload">重新读取</a-button>
        </section>

        <section v-else-if="directory.state === 'unconfigured'" class="directory-empty smartops-empty smartops-data-panel">
          <div class="empty-symbol"><a-icon type="disconnect" /></div>
          <h2>当前租户尚未关联配置组织</h2>
          <p>先由平台管理员在资产配置中心建立组织映射，再在这里维护责任基础资料。</p>
          <a-button type="primary" @click="goToAssets">前往资产配置中心</a-button>
        </section>

        <template v-else>
          <section class="smartops-context-grid" aria-label="运维基础资料概览">
            <article class="smartops-context-item"><span class="context-label">所属组织</span><strong class="context-value">{{ organizationName }}</strong><details class="technical-details"><summary>组织技术详情</summary><small>{{ organizationIdentity }}</small></details></article>
            <article class="smartops-context-item"><span class="context-label">启用团队</span><strong class="context-value context-value--number">{{ summary.activeTeams }}</strong><small class="context-meta">共 {{ directory.teams.length }} 个团队</small></article>
            <article class="smartops-context-item"><span class="context-label">启用负责人</span><strong class="context-value context-value--number">{{ summary.activePeople }}</strong><small class="context-meta">共 {{ directory.people.length }} 位负责人</small></article>
            <article class="smartops-context-item" :class="{'summary-warning': summary.accountWarnings}"><span class="context-label">账号关联</span><strong class="context-value context-value--number">{{ summary.linkedAccounts }}</strong><small class="context-meta">{{ summary.accountWarnings ? `${summary.accountWarnings} 项需重新关联` : '身份关联正常' }}</small></article>
          </section>

          <details class="responsibility-boundary">
            <summary>身份关联说明：关联账号不会改变平台权限</summary>
            <section class="identity-spine" data-testid="identity-boundary">
              <div class="identity-node">
                <span class="identity-index">01</span>
                <div><small>登录身份</small><strong>平台账号</strong><p>只管登录与账号启停</p></div>
              </div>
              <span class="identity-arrow">→</span>
              <div class="identity-node">
                <span class="identity-index">02</span>
                <div><small>授权范围</small><strong>租户成员</strong><p>只管角色与数据范围</p></div>
              </div>
              <span class="identity-arrow">→</span>
              <div class="identity-node identity-node--truth">
                <span class="identity-index">03</span>
                <div><small>责任信息</small><strong>团队与负责人</strong><p>保存真实运维责任</p></div>
              </div>
              <div class="identity-rule"><a-icon type="safety-certificate" /><span>关联只表示身份对应，<strong>不会授予或改变任何平台权限</strong></span></div>
            </section>
          </details>

          <section class="directory-ledger smartops-data-panel">
            <div class="ledger-toolbar smartops-panel-heading">
              <a-radio-group v-model="activeTab" button-style="solid">
                <a-radio-button data-testid="responsibility-tab-team" value="team">运维团队 <b>{{ directory.teams.length }}</b></a-radio-button>
                <a-radio-button data-testid="responsibility-tab-person" value="person">负责人 <b>{{ directory.people.length }}</b></a-radio-button>
              </a-radio-group>
              <div class="toolbar-spacer" />
              <a-input-search v-model.trim="search" allow-clear :placeholder="activeTab === 'team' ? '搜索团队、职能或联系方式' : '搜索姓名、工号、账号或联系方式'" />
              <a-select v-model="statusFilter" class="status-filter">
                <a-select-option value="">全部状态</a-select-option>
                <a-select-option value="active">启用</a-select-option>
                <a-select-option value="inactive">停用</a-select-option>
              </a-select>
            </div>

            <a-table
              v-if="activeTab === 'team'"
              data-testid="responsibility-team-table"
              :columns="teamColumns"
              :data-source="filteredTeams"
              :row-key="record => `team-${record.id}`"
              :pagination="{pageSize: 12, showSizeChanger: false}"
              :scroll="{x: 960}"
            >
              <template slot="identity" slot-scope="record">
                <div class="contact-identity"><span class="contact-mark contact-mark--team">团</span><div><strong>{{ record.display_name }}</strong><small>运维团队 #{{ record.id }} · {{ record.function || '未设置职能' }}</small></div></div>
              </template>
              <template slot="status" slot-scope="record"><a-tag :color="statusMeta(record.status).color">{{ statusMeta(record.status).label }}</a-tag></template>
              <template slot="members" slot-scope="record">
                <div class="member-stack" v-if="memberNames(record).length"><a-tag v-for="name in memberNames(record).slice(0, 3)" :key="name">{{ name }}</a-tag><small v-if="memberNames(record).length > 3">+{{ memberNames(record).length - 3 }}</small></div>
                <span v-else class="muted-value">暂无成员</span>
              </template>
              <template slot="impact" slot-scope="record"><div class="impact-cell" :class="{'impact-cell--used': record.impact.total}"><strong>{{ record.impact.total }}</strong><span>{{ impactText(record) }}</span></div></template>
              <template slot="contact" slot-scope="record"><div class="contact-lines"><span>{{ record.email || '未填邮箱' }}</span><small>{{ record.phone || '未填电话' }}</small></div></template>
              <template slot="operation" slot-scope="record">
                <div v-if="canUpdate && writeContextReady" class="row-actions">
                  <a-button type="link" @click="openEdit('team', record)">编辑</a-button>
                  <a-button v-if="canOperate" type="link" :class="record.status === 'active' ? 'danger-link' : ''" @click="requestTransition('team', record)">{{ record.status === 'active' ? '停用' : '重新启用' }}</a-button>
                </div>
                <span v-else class="muted-value">只读</span>
              </template>
            </a-table>

            <a-table
              v-else
              data-testid="responsibility-person-table"
              :columns="personColumns"
              :data-source="filteredPeople"
              :row-key="record => `person-${record.id}`"
              :pagination="{pageSize: 12, showSizeChanger: false}"
              :scroll="{x: 960}"
            >
              <template slot="identity" slot-scope="record">
                <div class="contact-identity"><span class="contact-mark">{{ initials(record) }}</span><div><strong>{{ record.display_name }}</strong><small>负责人 #{{ record.id }} · {{ record.employee_number || '无工号' }}</small></div></div>
              </template>
              <template slot="status" slot-scope="record"><a-tag :color="statusMeta(record.status).color">{{ statusMeta(record.status).label }}</a-tag></template>
              <template slot="teams" slot-scope="record">
                <div class="member-stack" v-if="teamNames(record).length"><a-tag v-for="name in teamNames(record).slice(0, 2)" :key="name" color="blue">{{ name }}</a-tag><small v-if="teamNames(record).length > 2">+{{ teamNames(record).length - 2 }}</small></div>
                <span v-else class="muted-value">未归属团队</span>
              </template>
              <template slot="account" slot-scope="record">
                <div class="account-link" :class="`account-link--${accountMeta(record.account).tone}`"><span class="account-dot" /><div><strong>{{ accountTitle(record.account) }}</strong><small>{{ accountMeta(record.account).label }}</small></div></div>
              </template>
              <template slot="impact" slot-scope="record"><div class="impact-cell" :class="{'impact-cell--used': record.impact.total}"><strong>{{ record.impact.total }}</strong><span>{{ impactText(record) }}</span></div></template>
              <template slot="operation" slot-scope="record">
                <div v-if="canUpdate && writeContextReady" class="row-actions">
                  <a-button type="link" @click="openEdit('person', record)">编辑 / 关联</a-button>
                  <a-button v-if="canOperate" type="link" :class="record.status === 'active' ? 'danger-link' : ''" @click="requestTransition('person', record)">{{ record.status === 'active' ? '停用' : '重新启用' }}</a-button>
                </div>
                <span v-else class="muted-value">只读</span>
              </template>
            </a-table>
          </section>
        </template>
      </a-spin>

      <a-modal wrap-class-name="smartops-management-dialog"
        v-model="editorVisible"
        :title="editorTitle"
        :width="editorType === 'person' ? 720 : 620"
        :confirm-loading="saving"
        :ok-text="editingRecord ? '保存变更' : '确认录入'"
        cancel-text="取消"
        @ok="saveRecord"
      >
        <div class="editor-boundary"><a-icon type="info-circle" /><span><strong>写入 {{ organizationName }}</strong>（{{ organizationIdentity }}）。<template v-if="editorType === 'person'">负责人账号关联只用于身份对应，不会改变租户角色。</template><template v-else>运维团队保存在配置管理中心，成员归属由负责人资料维护。</template></span></div>
        <a-form-model :model="editorForm" layout="vertical" class="editor-form">
          <div class="form-grid">
            <a-form-model-item :label="editorType === 'team' ? '团队名称' : '姓 / 姓名主体'" required><a-input v-model.trim="editorForm.name" :max-length="255" /></a-form-model-item>
            <a-form-model-item v-if="editorType === 'person'" label="名 / 英文名" required><a-input v-model.trim="editorForm.first_name" :max-length="255" placeholder="配置管理中心必填，将与前一字段组合展示" /></a-form-model-item>
            <a-form-model-item label="职能 / 岗位"><a-input v-model.trim="editorForm.function" :max-length="255" placeholder="例：数据库运维" /></a-form-model-item>
            <a-form-model-item v-if="editorType === 'person'" label="工号 / 外部编号"><a-input v-model.trim="editorForm.employee_number" :max-length="255" /></a-form-model-item>
            <a-form-model-item label="邮箱"><a-input v-model.trim="editorForm.email" :max-length="255" /></a-form-model-item>
            <a-form-model-item label="电话"><a-input v-model.trim="editorForm.phone" :max-length="32" /></a-form-model-item>
            <a-form-model-item v-if="editorType === 'person'" label="手机"><a-input v-model.trim="editorForm.mobile_phone" :max-length="32" /></a-form-model-item>
            <a-form-model-item label="配置管理中心通知标记"><a-radio-group v-model="editorForm.notify"><a-radio value="yes">允许通知</a-radio><a-radio value="no">不通知</a-radio></a-radio-group></a-form-model-item>
          </div>
          <template v-if="editorType === 'person'">
            <a-divider orientation="left">责任关系</a-divider>
            <div class="form-grid">
              <a-form-model-item label="所属运维团队">
                <a-select v-model="editorForm.team_ids" mode="multiple" show-search option-filter-prop="children" :disabled="editingRecord && editingRecord.status === 'inactive'" placeholder="可选多个启用团队">
                  <a-select-option v-for="team in activeTeams" :key="team.id" :value="team.id">{{ team.display_name }}</a-select-option>
                </a-select>
              </a-form-model-item>
              <a-form-model-item label="关联平台账号（可选）">
                <a-select v-model="editorForm.user_id" allow-clear show-search option-filter-prop="children" placeholder="外部人员可留空">
                  <a-select-option v-for="option in selectableAccountOptions" :key="option.user_id" :value="option.user_id">{{ option.username }} · {{ roleLabel(option.tenant_role) }}</a-select-option>
                </a-select>
                <small class="field-help">只显示当前租户已启用成员；关联不改变账号权限。</small>
              </a-form-model-item>
            </div>
          </template>
        </a-form-model>
      </a-modal>

      <a-modal wrap-class-name="smartops-management-dialog" v-model="impactVisible" title="停用前需先完成责任重新分配" :footer="null" :width="620">
        <div v-if="impactTarget" class="impact-dialog">
          <div class="impact-number">{{ impactTarget.impact.total }}</div>
          <div><h3>{{ impactTarget.display_name }} 仍被资产引用</h3><p>{{ deactivateText(impactTarget) }}</p></div>
        </div>
        <div v-if="impactTarget && impactTarget.impact.sample_assets.length" class="impact-assets">
          <div v-for="asset in impactTarget.impact.sample_assets" :key="`${asset.key}-${asset.role}`"><span>{{ asset.name }}</span><small>{{ asset.class }} · {{ impactRoleLabel(asset.role) }}</small></div>
        </div>
        <div class="impact-footer"><a-button @click="impactVisible = false">稍后处理</a-button><a-button type="primary" @click="goToAssets">去资产配置中心重新分配</a-button></div>
      </a-modal>
    </div>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import {
  createCMDBPerson,
  createCMDBTeam,
  getCMDBOverview,
  getCMDBResponsibilities,
  listCMDBResponsibilityAccountOptions,
  setCMDBPersonAccount,
  transitionCMDBPerson,
  transitionCMDBTeam,
  updateCMDBPerson,
  updateCMDBPersonTeams,
  updateCMDBTeam,
} from '@/services/cmdb'
import {
  accountStateMeta,
  buildResponsibilityFields,
  contactStatusMeta,
  createResponsibilityForm,
  deactivateImpactText,
  filterContacts,
  impactLabel,
  normalizeDirectory,
  validateResponsibilityForm,
} from './responsibility-model'
import {mappingTransitionReasonMessage, normalizeCMDBContext} from '../cmdb-model'
import {tenantContextChangingEvent} from '@/utils/request'
import {businessPayload, canPerform} from '@/utils/permission-policy'

const emptyDirectory = (state = 'unconfigured', message = '') => ({state, message, organization: null, mapping: null, teams: [], people: []})
const sortedIDs = values => (values || []).map(Number).filter(Boolean).sort((a, b) => a - b)
const sameIDs = (left, right) => JSON.stringify(sortedIDs(left)) === JSON.stringify(sortedIDs(right))

export default {
  name: 'CMDBResponsibilities',
  components: {PageLayout},
  data: () => ({
    loading: false,
    saving: false,
    loadSequence: 0,
    activeCMDBContextKey: '',
    activeTab: 'team',
    search: '',
    statusFilter: '',
    directory: emptyDirectory(),
    accountOptions: [],
    editorVisible: false,
    editorType: 'person',
    editingRecord: null,
    editorForm: createResponsibilityForm('person'),
    impactVisible: false,
    impactTarget: null,
    teamColumns: [
      {title: '团队', scopedSlots: {customRender: 'identity'}, width: 250},
      {title: '状态', scopedSlots: {customRender: 'status'}, width: 86},
      {title: '成员', scopedSlots: {customRender: 'members'}, width: 230},
      {title: '配置项引用', scopedSlots: {customRender: 'impact'}, width: 175},
      {title: '联系方式', scopedSlots: {customRender: 'contact'}},
      {title: '操作', scopedSlots: {customRender: 'operation'}, width: 150},
    ],
    personColumns: [
      {title: '负责人', scopedSlots: {customRender: 'identity'}, width: 230},
      {title: '状态', scopedSlots: {customRender: 'status'}, width: 86},
      {title: '团队归属', scopedSlots: {customRender: 'teams'}, width: 200},
      {title: '平台账号关联', scopedSlots: {customRender: 'account'}, width: 210},
      {title: '配置项责任', scopedSlots: {customRender: 'impact'}, width: 175},
      {title: '操作', scopedSlots: {customRender: 'operation'}, width: 165},
    ],
  }),
  computed: {
    permissions() { return this.$store.getters['account/permissions'] || [] },
    currentTenant() { return this.$store.getters['account/currentTenant'] || {} },
    currentTenantID() { return Number(this.currentTenant.id) || 0 },
    canCreate() { return canPerform(this.permissions, 'tenant.cmdb.responsibility', 'create') },
    canUpdate() { return canPerform(this.permissions, 'tenant.cmdb.responsibility', 'update') },
    canOperate() { return canPerform(this.permissions, 'tenant.cmdb.responsibility', 'operate') },
    cmdbContext() { return normalizeCMDBContext(this.directory, this.currentTenantID) },
    writeContextReady() { return this.cmdbContext.ready && this.activeCMDBContextKey === this.cmdbContext.key },
    organizationName() { return this.directory.organization && this.directory.organization.name || '未配置' },
    organizationIdentity() {
      if (!this.cmdbContext.organization_id) return '配置组织未就绪'
      const code = this.directory.organization && this.directory.organization.code || '未设编码'
      return `${code} · 组织编号 ${this.cmdbContext.organization_id} · 组织映射版本 ${this.cmdbContext.generation || '—'}`
    },
    filteredTeams() { return filterContacts(this.directory.teams, this.search, this.statusFilter) },
    filteredPeople() { return filterContacts(this.directory.people, this.search, this.statusFilter) },
    activeTeams() { return this.directory.teams.filter(team => team.status === 'active') },
    summary() {
      const activeTeams = this.directory.teams.filter(item => item.status === 'active').length
      const activePeople = this.directory.people.filter(item => item.status === 'active').length
      const linked = this.directory.people.filter(item => item.account)
      return {
        activeTeams,
        activePeople,
        linkedAccounts: linked.length,
        accountWarnings: linked.filter(item => item.account.state !== 'available').length,
      }
    },
    editorTitle() {
      const label = this.editorType === 'team' ? '运维团队' : '负责人'
      return `${this.editingRecord ? '编辑' : '新增'}${label}`
    },
    selectableAccountOptions() {
      const currentPersonID = this.editingRecord && this.editorType === 'person' ? this.editingRecord.id : 0
      const used = new Set(this.directory.people
        .filter(person => person.id !== currentPersonID && person.account)
        .map(person => Number(person.account.user_id)))
      return this.accountOptions.filter(option => !used.has(Number(option.user_id)))
    },
  },
  watch: {
    currentTenantID(next, previous) {
      if (previous && next !== previous) {
        this.invalidateCMDBContext('租户上下文已切换，旧运维基础资料表单已关闭。')
        this.reload()
      }
    },
  },
  created() {
    if (typeof window !== 'undefined') window.addEventListener(tenantContextChangingEvent, this.handleTenantContextChanging)
    this.reload()
  },
  beforeDestroy() {
    if (typeof window !== 'undefined') window.removeEventListener(tenantContextChangingEvent, this.handleTenantContextChanging)
  },
  methods: {
    cmdbFailure(error, fallback) {
      const business = error && error.data && typeof error.data === 'object' ? error.data : {}
      const data = error && error.businessData || business.data || {}
      const reason = String(error && error.businessReason || data && data.reason || '')
      return {
        reason,
        data,
        message: mappingTransitionReasonMessage(reason, business.message || error && error.message || fallback),
      }
    },
    unwrap(response) {
      const business = businessPayload(response)
      if (!business || Number(business.code) !== 200) {
        const error = new Error(business && business.message || '请求失败')
        error.businessData = business && business.data
        error.businessReason = business && business.data && business.data.reason
        throw error
      }
      return business.data
    },
    writeContext() {
      if (!this.writeContextReady) {
        const error = new Error('配置组织 上下文未就绪，请刷新后重试。')
        error.businessReason = 'cmdb_context_mismatch'
        throw error
      }
      return {organization_id: this.cmdbContext.organization_id, generation: this.cmdbContext.generation, key: this.cmdbContext.key}
    },
    contextIsCurrent(context) {
      return Boolean(context && context.key) && context.key === this.cmdbContext.key && context.key === this.activeCMDBContextKey
    },
    resetContextWorkspaces() {
      this.editorVisible = false
      this.editingRecord = null
      this.editorForm = createResponsibilityForm('person')
      this.impactVisible = false
      this.impactTarget = null
      this.accountOptions = []
    },
    invalidateCMDBContext(message) {
      this.loadSequence += 1
      this.activeCMDBContextKey = ''
      this.resetContextWorkspaces()
      this.directory = emptyDirectory()
      if (message) this.$message.warning(message)
    },
    handleTenantContextChanging(event) {
      const targetID = Number(event && event.detail && event.detail.tenant && event.detail.tenant.id) || 0
      if (!targetID || targetID !== this.currentTenantID) {
        this.invalidateCMDBContext('租户正在切换，已关闭旧运维基础资料表单。')
        return
      }
      if (!this.activeCMDBContextKey) this.$nextTick(() => {
        if (!this.activeCMDBContextKey && targetID === this.currentTenantID) this.reload()
      })
    },
    handleWriteFailure(error, fallback) {
      const failure = this.cmdbFailure(error, fallback)
      if (['cmdb_context_mismatch', 'mapping_context_stale', 'mapping_generation_mismatch', 'mapping_transition_in_progress'].includes(failure.reason)) {
        this.resetContextWorkspaces()
        this.activeCMDBContextKey = ''
        this.reload()
      }
      return failure
    },
    async reload() {
      const sequence = ++this.loadSequence
      const tenantID = this.currentTenantID
      this.loading = true
      try {
        const [directoryResponse, overviewResponse] = await Promise.all([getCMDBResponsibilities(), getCMDBOverview()])
        if (sequence !== this.loadSequence || tenantID !== this.currentTenantID) return
        const rawDirectory = this.unwrap(directoryResponse) || {}
        const overview = this.unwrap(overviewResponse) || {}
        const context = normalizeCMDBContext(overview, tenantID)
        if (rawDirectory.state === 'ready' && (!context.ready || Number(rawDirectory.organization && rawDirectory.organization.id) !== context.organization_id)) {
          throw new Error('运维基础资料与资产总览的配置组织上下文不一致')
        }
        if (this.activeCMDBContextKey && context.key && this.activeCMDBContextKey !== context.key) this.resetContextWorkspaces()
        this.directory = normalizeDirectory({...rawDirectory, mapping: overview.mapping || null})
        this.activeCMDBContextKey = context.key
        if (this.canUpdate && this.directory.state === 'ready' && context.ready) {
          const data = this.unwrap(await listCMDBResponsibilityAccountOptions())
          if (sequence !== this.loadSequence || context.key !== this.activeCMDBContextKey) return
          this.accountOptions = data && Array.isArray(data.items) ? data.items : []
        } else {
          this.accountOptions = []
        }
      } catch (error) {
        if (sequence !== this.loadSequence || tenantID !== this.currentTenantID) return
        this.directory = emptyDirectory('error', error.message || '配置管理中心或智能运维管理系统接口暂时不可用')
        this.activeCMDBContextKey = ''
        this.accountOptions = []
        this.$message.error(error.message || '加载运维基础资料失败')
      } finally {
        if (sequence === this.loadSequence) this.loading = false
      }
    },
    statusMeta(status) { return contactStatusMeta(status) },
    accountMeta(account) { return accountStateMeta(account) },
    impactText(record) { return impactLabel(record) },
    deactivateText(record) { return deactivateImpactText(record) },
    initials(record) {
      const value = String(record && record.display_name || '?').trim()
      return value.slice(0, 2).toUpperCase()
    },
    teamNames(person) {
      const ids = new Set(person.team_ids || [])
      return this.directory.teams.filter(team => ids.has(team.id)).map(team => team.display_name)
    },
    memberNames(team) {
      const ids = new Set(team.person_ids || [])
      return this.directory.people.filter(person => ids.has(person.id)).map(person => person.display_name)
    },
    accountTitle(account) {
      if (!account) return '未关联账号'
      return account.username || `账号 #${account.user_id}`
    },
    roleLabel(role) { return role === 'tenant_admin' ? '租户管理员' : '只读成员' },
    impactRoleLabel(role) {
      return {operations_team: '运维团队', primary_owner: '主负责人', backup_owner: '备份负责人'}[role] || '责任引用'
    },
    openCreate(type) {
      if (!this.canCreate || !this.writeContextReady) return
      this.editorType = type
      this.editingRecord = null
      this.editorForm = createResponsibilityForm(type)
      this.editorVisible = true
    },
    openEdit(type, record) {
      if (!this.canUpdate || !this.writeContextReady) return
      this.editorType = type
      this.editingRecord = record
      this.editorForm = createResponsibilityForm(type, record)
      this.editorVisible = true
    },
    async saveRecord() {
      const validation = validateResponsibilityForm(this.editorType, this.editorForm)
      if (validation) {
        this.$message.warning(validation)
        return
      }
      this.saving = true
      const fields = buildResponsibilityFields(this.editorType, this.editorForm)
      try {
        const context = this.writeContext()
        if (this.editorType === 'team') {
          if (this.editingRecord) this.unwrap(await updateCMDBTeam(this.editingRecord.id, this.editingRecord.revision, fields, context))
          else this.unwrap(await createCMDBTeam(fields, context))
        } else {
          await this.savePerson(fields, context)
        }
        if (!this.contextIsCurrent(context)) return
        this.$message.success(this.editingRecord ? '基础资料已更新' : '基础资料已录入')
        this.editorVisible = false
        await this.reload()
      } catch (error) {
        this.$message.error(this.handleWriteFailure(error, '保存运维基础资料失败').message)
        if (this.activeCMDBContextKey) await this.reload()
      } finally {
        this.saving = false
      }
    },
    async savePerson(fields, context) {
      let person
      if (this.editingRecord) person = this.unwrap(await updateCMDBPerson(this.editingRecord.id, this.editingRecord.revision, fields, context))
      else person = this.unwrap(await createCMDBPerson(fields, context))
      if (!this.contextIsCurrent(context)) throw Object.assign(new Error('配置组织 上下文已变化'), {businessReason: 'cmdb_context_mismatch'})

      const oldTeams = this.editingRecord ? this.editingRecord.team_ids : []
      const teamChanged = !sameIDs(oldTeams, this.editorForm.team_ids)
      if (teamChanged) {
        try {
          person = this.unwrap(await updateCMDBPersonTeams(person.id, person.revision, this.editorForm.team_ids, context))
          if (!this.contextIsCurrent(context)) throw Object.assign(new Error('配置组织 上下文已变化'), {businessReason: 'cmdb_context_mismatch'})
        } catch (error) {
          const failure = this.cmdbFailure(error, '团队归属未完成')
          throw Object.assign(new Error(`负责人资料已保存，但团队归属未完成：${failure.message}`), {businessReason: failure.reason, businessData: failure.data})
        }
      }
      const oldUserID = this.editingRecord && this.editingRecord.account ? Number(this.editingRecord.account.user_id) : 0
      const nextUserID = Number(this.editorForm.user_id) || 0
      if (oldUserID !== nextUserID) {
        try {
          this.unwrap(await setCMDBPersonAccount(person.id, nextUserID, context))
          if (!this.contextIsCurrent(context)) throw Object.assign(new Error('配置组织 上下文已变化'), {businessReason: 'cmdb_context_mismatch'})
        } catch (error) {
          const failure = this.cmdbFailure(error, '账号关联未完成')
          throw Object.assign(new Error(`负责人与团队资料已保存，但账号关联未完成：${failure.message}`), {businessReason: failure.reason, businessData: failure.data})
        }
      }
      return person
    },
    requestTransition(type, record) {
      if (!this.canOperate || !this.writeContextReady) return
      if (record.status === 'active' && Number(record.impact.total) > 0) {
        this.impactTarget = record
        this.impactVisible = true
        return
      }
      const activate = record.status !== 'active'
      this.$confirm({
        title: activate ? `重新启用“${record.display_name}”？` : `停用“${record.display_name}”？`,
        content: activate ? '重新启用后可再用于新的资产责任分配。' : '停用后不再出现在新分配选项中，不会删除历史。',
        okText: activate ? '确认启用' : '确认停用',
        okType: activate ? 'primary' : 'danger',
        onOk: () => this.performTransition(type, record, activate),
      })
    },
    async performTransition(type, record, activate) {
      try {
        const context = this.writeContext()
        if (type === 'team') this.unwrap(await transitionCMDBTeam(record.id, record.revision, activate, context))
        else this.unwrap(await transitionCMDBPerson(record.id, record.revision, activate, context))
        if (!this.contextIsCurrent(context)) return
        this.$message.success(activate ? '已重新启用' : '已安全停用')
      } catch (error) {
        const failure = this.handleWriteFailure(error, '状态变更失败')
        if (failure.data && Number(failure.data.total) > 0) {
          this.impactTarget = {...record, impact: failure.data}
          this.impactVisible = true
        } else {
          this.$message.error(failure.message)
        }
      } finally {
        if (this.activeCMDBContextKey) await this.reload()
      }
    },
    goToAssets() {
      this.impactVisible = false
      this.$router.push('/assets/cmdb')
    },
  },
}
</script>

<style lang="less" scoped>
.responsibility-directory { min-width: 0; }
.context-chip { display: inline-flex; align-items: center; gap: 7px; min-height: 32px; padding: 0 10px; border: 1px solid var(--smartops-line); border-radius: 2px; color: var(--smartops-muted); font-size: 12px; }
.context-chip i { width: 6px; height: 6px; border-radius: 50%; background: var(--smartops-success); }
.responsibility-boundary { margin-bottom: 16px; border: 1px solid var(--smartops-line); border-radius: 2px; background: #f3f6fa; }
.responsibility-boundary > summary { padding: 10px 16px; color: var(--smartops-muted); font-size: 12px; cursor: pointer; }
.identity-spine { display: grid; grid-template-columns: 1fr 24px 1fr 24px 1fr; align-items: center; padding: 4px 16px 12px; gap: 8px; }
.identity-node { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 12px; border: 1px solid var(--smartops-line); background: #fff; }
.identity-index { color: var(--smartops-signal-blue); font-family: var(--smartops-font-mono); font-size: 12px; }
.identity-node small, .identity-node p { color: var(--smartops-muted); font-size: 12px; }
.identity-node strong { display: block; margin: 4px 0; color: var(--smartops-command-navy); font-size: 14px; }
.identity-node p { margin: 0; }
.identity-arrow { text-align: center; color: var(--smartops-muted); }
.identity-rule { display: flex; align-items: center; grid-column: 1 / -1; gap: 8px; color: var(--smartops-muted); font-size: 12px; }
.identity-rule strong { color: var(--smartops-ink); font-weight: 600; }
.directory-ledger { min-width: 0; overflow: hidden; }
.ledger-toolbar /deep/ .ant-radio-button-wrapper b { margin-left: 6px; font-family: var(--smartops-font-mono); font-size: 12px; }
.toolbar-spacer { flex: 1; }
.ledger-toolbar .ant-input-search { width: 320px; max-width: 100%; }
.status-filter { width: 150px; }
.directory-ledger /deep/ .ant-table-tbody > tr > td { vertical-align: middle; }
.contact-identity { display: flex; align-items: center; gap: 10px; min-width: 0; }
.contact-mark { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 3px; background: #e4f2f8; color: #146e99; font-family: var(--smartops-font-mono); font-size: 10px; font-weight: 800; }
.contact-mark--team { background: #e8f5ef; color: #1e805b; font-size: 13px; }
.contact-identity div { min-width: 0; }
.contact-identity strong, .contact-lines span { display: block; overflow: hidden; color: #16374f; text-overflow: ellipsis; white-space: nowrap; }
.contact-identity small, .contact-lines small { display: block; margin-top: 2px; overflow: hidden; color: #8495a3; font-family: var(--smartops-font-mono); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.member-stack { display: flex; align-items: center; gap: 3px; min-width: 0; flex-wrap: wrap; }
.member-stack .ant-tag { max-width: 112px; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.member-stack small, .muted-value { color: #8a9aa6; font-size: 11px; }
.impact-cell { display: grid; grid-template-columns: 28px minmax(0, 1fr); align-items: center; gap: 7px; }
.impact-cell strong { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: #eef2f5; color: #6d7f8d; font-family: var(--smartops-font-mono); }
.impact-cell span { color: #7c8d99; font-size: 10px; line-height: 1.35; }
.impact-cell--used strong { background: #fff1db; color: #b26c13; }
.impact-cell--used span { color: #9a641e; }
.account-link { display: flex; align-items: center; gap: 8px; min-width: 0; }
.account-dot { flex: 0 0 auto; width: 7px; height: 7px; border-radius: 50%; background: #a7b2bb; }
.account-link--available .account-dot { background: #2ca874; box-shadow: 0 0 0 3px rgba(44, 168, 116, .12); }
.account-link--warning .account-dot { background: #d98726; box-shadow: 0 0 0 3px rgba(217, 135, 38, .12); }
.account-link div { min-width: 0; }
.account-link strong, .account-link small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-link strong { color: #24465d; font-size: 12px; }
.account-link small { color: #8797a3; font-size: 10px; }
.row-actions { display: flex; align-items: center; gap: 2px; white-space: nowrap; }
.row-actions .ant-btn { padding: 0 4px; font-size: 12px; }
.danger-link { color: #be4a4a; }
.editor-boundary { display: flex; gap: 8px; margin-bottom: 14px; padding: 10px 12px; border-left: 3px solid var(--smartops-signal-blue); background: #edf2f7; color: #48677a; font-size: 12px; line-height: 1.6; }
.editor-boundary .anticon { margin-top: 3px; color: var(--smartops-signal-blue); }
.editor-form /deep/ .ant-form-item { margin-bottom: 13px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 16px; }
.field-help { display: block; margin-top: 5px; color: #8495a3; font-size: 10px; line-height: 1.45; }
.impact-dialog { display: flex; align-items: center; gap: 16px; padding: 15px; border: 1px solid #edd2a8; background: #fff9ef; }
.impact-number { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 54px; height: 54px; border-radius: 50%; background: #d98622; color: #fff; font-family: var(--smartops-font-mono); font-size: 21px; font-weight: 800; }
.impact-dialog h3 { margin: 0 0 4px; color: #6f4312; }
.impact-dialog p { margin: 0; color: #8f622d; font-size: 12px; }
.impact-assets { margin-top: 12px; border: 1px solid #e1e7eb; }
.impact-assets > div { display: flex; justify-content: space-between; gap: 12px; padding: 8px 11px; border-bottom: 1px solid #edf1f3; }
.impact-assets > div:last-child { border-bottom: 0; }
.impact-assets span { color: #294b62; }
.impact-assets small { color: #8999a5; font-family: var(--smartops-font-mono); }
.impact-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
@media (max-width: 900px) {
  .toolbar-spacer { display: none; }
  .ledger-toolbar .ant-input-search { width: 100%; }
  .identity-spine { grid-template-columns: 1fr; }
  .identity-arrow { transform: rotate(90deg); }
  .form-grid { grid-template-columns: 1fr; }
}

.technical-details { margin-top: 4px; font-size: 12px; line-height: 1.65; min-width: 0; }
.technical-details summary { cursor: pointer; color: inherit; font-family: inherit; font-weight: 400; }
.technical-details[open] { padding-bottom: 4px; }
.technical-details code, .technical-details small { display: block; overflow-wrap: anywhere; white-space: normal; }
</style>
