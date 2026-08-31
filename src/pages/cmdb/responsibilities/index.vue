<template>
  <page-layout :noTitle="true">
    <div class="responsibility-directory" data-testid="cmdb-responsibility-page">
      <header class="smartops-page-heading responsibility-heading">
        <div>
          <p class="responsibility-kicker">RESPONSIBILITY DIRECTORY</p>
          <h1>CMDB 基础资料</h1>
          <p>维护当前 iTop Organization 的运维团队与负责人，再供资产建档和发现入库统一选用。</p>
        </div>
        <div class="heading-actions">
          <span class="context-chip"><i />{{ currentTenant.name || '当前租户' }}</span>
          <a-tag v-if="!canUpdate" color="blue">只读视图</a-tag>
          <a-button icon="reload" :loading="loading" @click="reload">刷新</a-button>
          <a-button v-if="canCreate && directory.state === 'ready'" data-testid="responsibility-create-team" icon="team" @click="openCreate('team')">新增团队</a-button>
          <a-button v-if="canCreate && directory.state === 'ready'" data-testid="responsibility-create-person" type="primary" icon="user-add" @click="openCreate('person')">录入负责人</a-button>
        </div>
      </header>

      <section class="identity-spine" data-testid="identity-boundary">
        <div class="identity-node">
          <span class="identity-index">01</span>
          <div><small>SMARTOPS USER</small><strong>平台账号</strong><p>只管登录与账号启停</p></div>
        </div>
        <span class="identity-arrow">→</span>
        <div class="identity-node">
          <span class="identity-index">02</span>
          <div><small>TENANT MEMBER</small><strong>租户成员</strong><p>只管角色与数据范围</p></div>
        </div>
        <span class="identity-arrow">→</span>
        <div class="identity-node identity-node--truth">
          <span class="identity-index">03</span>
          <div><small>ITOP CONTACT</small><strong>Team / Person</strong><p>保存真实运维责任</p></div>
        </div>
        <div class="identity-rule"><a-icon type="safety-certificate" /><span>关联只表示身份对应，<strong>不会授予或改变任何平台权限</strong></span></div>
      </section>

      <a-spin :spinning="loading">
        <section v-if="directory.state === 'error'" class="directory-empty directory-empty--error smartops-data-panel" data-testid="responsibility-load-error">
          <div class="empty-symbol">ERR</div>
          <h2>CMDB 基础资料读取失败</h2>
          <p>{{ directory.message || 'iTop 或 SmartOps 接口暂时不可用，请稍后重试。' }}</p>
          <a-button type="primary" icon="reload" @click="reload">重新读取</a-button>
        </section>

        <section v-else-if="directory.state === 'unconfigured'" class="directory-empty smartops-data-panel">
          <div class="empty-symbol">ORG</div>
          <h2>当前租户尚未关联 iTop Organization</h2>
          <p>先由平台管理员在 CMDB 配置中心建立组织映射，再在这里维护责任基础资料。</p>
          <a-button type="primary" @click="goToAssets">前往 CMDB 配置中心</a-button>
        </section>

        <template v-else>
          <section class="directory-summary">
            <article><span>ORGANIZATION</span><strong>{{ organizationName }}</strong><small>iTop 责任真源</small></article>
            <article><span>ACTIVE TEAMS</span><strong>{{ summary.activeTeams }}</strong><small>共 {{ directory.teams.length }} 个团队</small></article>
            <article><span>ACTIVE PEOPLE</span><strong>{{ summary.activePeople }}</strong><small>共 {{ directory.people.length }} 位负责人</small></article>
            <article :class="{'summary-warning': summary.accountWarnings}"><span>ACCOUNT LINKS</span><strong>{{ summary.linkedAccounts }}</strong><small>{{ summary.accountWarnings ? `${summary.accountWarnings} 项需重新关联` : '身份关联正常' }}</small></article>
          </section>

          <section class="directory-ledger smartops-data-panel">
            <div class="ledger-toolbar">
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
              :locale="{emptyText: '暂无匹配的运维团队'}"
            >
              <template slot="identity" slot-scope="record">
                <div class="contact-identity"><span class="contact-mark contact-mark--team">T</span><div><strong>{{ record.display_name }}</strong><small>Team #{{ record.id }} · {{ record.function || '未设置职能' }}</small></div></div>
              </template>
              <template slot="status" slot-scope="record"><a-tag :color="statusMeta(record.status).color">{{ statusMeta(record.status).label }}</a-tag></template>
              <template slot="members" slot-scope="record">
                <div class="member-stack" v-if="memberNames(record).length"><a-tag v-for="name in memberNames(record).slice(0, 3)" :key="name">{{ name }}</a-tag><small v-if="memberNames(record).length > 3">+{{ memberNames(record).length - 3 }}</small></div>
                <span v-else class="muted-value">暂无成员</span>
              </template>
              <template slot="impact" slot-scope="record"><div class="impact-cell" :class="{'impact-cell--used': record.impact.total}"><strong>{{ record.impact.total }}</strong><span>{{ impactText(record) }}</span></div></template>
              <template slot="contact" slot-scope="record"><div class="contact-lines"><span>{{ record.email || '未填邮箱' }}</span><small>{{ record.phone || '未填电话' }}</small></div></template>
              <template slot="operation" slot-scope="record">
                <div v-if="canUpdate" class="row-actions">
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
              :locale="{emptyText: '暂无匹配的负责人'}"
            >
              <template slot="identity" slot-scope="record">
                <div class="contact-identity"><span class="contact-mark">{{ initials(record) }}</span><div><strong>{{ record.display_name }}</strong><small>Person #{{ record.id }} · {{ record.employee_number || '无工号' }}</small></div></div>
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
                <div v-if="canUpdate" class="row-actions">
                  <a-button type="link" @click="openEdit('person', record)">编辑 / 关联</a-button>
                  <a-button v-if="canOperate" type="link" :class="record.status === 'active' ? 'danger-link' : ''" @click="requestTransition('person', record)">{{ record.status === 'active' ? '停用' : '重新启用' }}</a-button>
                </div>
                <span v-else class="muted-value">只读</span>
              </template>
            </a-table>
          </section>
        </template>
      </a-spin>

      <a-modal
        v-model="editorVisible"
        :title="editorTitle"
        :width="editorType === 'person' ? 720 : 620"
        :confirm-loading="saving"
        :ok-text="editingRecord ? '保存变更' : '确认录入'"
        cancel-text="取消"
        @ok="saveRecord"
      >
        <div class="editor-boundary"><a-icon type="info-circle" /><span v-if="editorType === 'person'">Person 保存责任信息；可选账号关联仅用于身份对应，不会改变租户角色。</span><span v-else>Team 保存在 iTop；成员归属通过负责人资料维护。</span></div>
        <a-form-model :model="editorForm" layout="vertical" class="editor-form">
          <div class="form-grid">
            <a-form-model-item :label="editorType === 'team' ? '团队名称' : '姓 / 姓名主体'" required><a-input v-model.trim="editorForm.name" :max-length="255" /></a-form-model-item>
            <a-form-model-item v-if="editorType === 'person'" label="名 / 英文名" required><a-input v-model.trim="editorForm.first_name" :max-length="255" placeholder="iTop 必填，将与前一字段组合展示" /></a-form-model-item>
            <a-form-model-item label="职能 / 岗位"><a-input v-model.trim="editorForm.function" :max-length="255" placeholder="例：数据库运维" /></a-form-model-item>
            <a-form-model-item v-if="editorType === 'person'" label="工号 / 外部编号"><a-input v-model.trim="editorForm.employee_number" :max-length="255" /></a-form-model-item>
            <a-form-model-item label="邮箱"><a-input v-model.trim="editorForm.email" :max-length="255" /></a-form-model-item>
            <a-form-model-item label="电话"><a-input v-model.trim="editorForm.phone" :max-length="32" /></a-form-model-item>
            <a-form-model-item v-if="editorType === 'person'" label="手机"><a-input v-model.trim="editorForm.mobile_phone" :max-length="32" /></a-form-model-item>
            <a-form-model-item label="iTop 通知标记"><a-radio-group v-model="editorForm.notify"><a-radio value="yes">允许通知</a-radio><a-radio value="no">不通知</a-radio></a-radio-group></a-form-model-item>
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

      <a-modal v-model="impactVisible" title="停用前需先完成责任重新分配" :footer="null" :width="620">
        <div v-if="impactTarget" class="impact-dialog">
          <div class="impact-number">{{ impactTarget.impact.total }}</div>
          <div><h3>{{ impactTarget.display_name }} 仍被资产引用</h3><p>{{ deactivateText(impactTarget) }}</p></div>
        </div>
        <div v-if="impactTarget && impactTarget.impact.sample_assets.length" class="impact-assets">
          <div v-for="asset in impactTarget.impact.sample_assets" :key="`${asset.key}-${asset.role}`"><span>{{ asset.name }}</span><small>{{ asset.class }} · {{ impactRoleLabel(asset.role) }}</small></div>
        </div>
        <div class="impact-footer"><a-button @click="impactVisible = false">稍后处理</a-button><a-button type="primary" @click="goToAssets">去 CMDB 配置中心重新分配</a-button></div>
      </a-modal>
    </div>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import {
  createCMDBPerson,
  createCMDBTeam,
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
import {businessPayload, canPerform} from '@/utils/permission-policy'

const emptyDirectory = (state = 'unconfigured', message = '') => ({state, message, organization: null, teams: [], people: []})
const sortedIDs = values => (values || []).map(Number).filter(Boolean).sort((a, b) => a - b)
const sameIDs = (left, right) => JSON.stringify(sortedIDs(left)) === JSON.stringify(sortedIDs(right))

export default {
  name: 'CMDBResponsibilities',
  components: {PageLayout},
  data: () => ({
    loading: false,
    saving: false,
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
      {title: 'CI 引用', scopedSlots: {customRender: 'impact'}, width: 175},
      {title: '联系方式', scopedSlots: {customRender: 'contact'}},
      {title: '操作', scopedSlots: {customRender: 'operation'}, width: 150},
    ],
    personColumns: [
      {title: '负责人', scopedSlots: {customRender: 'identity'}, width: 230},
      {title: '状态', scopedSlots: {customRender: 'status'}, width: 86},
      {title: '团队归属', scopedSlots: {customRender: 'teams'}, width: 200},
      {title: '平台账号关联', scopedSlots: {customRender: 'account'}, width: 210},
      {title: 'CI 责任', scopedSlots: {customRender: 'impact'}, width: 175},
      {title: '操作', scopedSlots: {customRender: 'operation'}, width: 165},
    ],
  }),
  computed: {
    permissions() { return this.$store.getters['account/permissions'] || [] },
    currentTenant() { return this.$store.getters['account/currentTenant'] || {} },
    canCreate() { return canPerform(this.permissions, 'tenant.cmdb.responsibility', 'create') },
    canUpdate() { return canPerform(this.permissions, 'tenant.cmdb.responsibility', 'update') },
    canOperate() { return canPerform(this.permissions, 'tenant.cmdb.responsibility', 'operate') },
    organizationName() { return this.directory.organization && this.directory.organization.name || '未配置' },
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
  created() {
    this.reload()
  },
  methods: {
    unwrap(response) {
      const business = businessPayload(response)
      if (!business || Number(business.code) !== 200) {
        const error = new Error(business && business.message || '请求失败')
        error.businessData = business && business.data
        throw error
      }
      return business.data
    },
    async reload() {
      this.loading = true
      try {
        this.directory = normalizeDirectory(this.unwrap(await getCMDBResponsibilities()))
        if (this.canUpdate && this.directory.state === 'ready') {
          const data = this.unwrap(await listCMDBResponsibilityAccountOptions())
          this.accountOptions = data && Array.isArray(data.items) ? data.items : []
        } else {
          this.accountOptions = []
        }
      } catch (error) {
        this.directory = emptyDirectory('error', error.message || 'iTop 或 SmartOps 接口暂时不可用')
        this.accountOptions = []
        this.$message.error(error.message || '加载 CMDB 基础资料失败')
      } finally {
        this.loading = false
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
      this.editorType = type
      this.editingRecord = null
      this.editorForm = createResponsibilityForm(type)
      this.editorVisible = true
    },
    openEdit(type, record) {
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
        if (this.editorType === 'team') {
          if (this.editingRecord) this.unwrap(await updateCMDBTeam(this.editingRecord.id, this.editingRecord.revision, fields))
          else this.unwrap(await createCMDBTeam(fields))
        } else {
          await this.savePerson(fields)
        }
        this.$message.success(this.editingRecord ? '基础资料已更新' : '基础资料已录入')
        this.editorVisible = false
        await this.reload()
      } catch (error) {
        this.$message.error(error.message || '保存 CMDB 基础资料失败')
        await this.reload()
      } finally {
        this.saving = false
      }
    },
    async savePerson(fields) {
      let person
      if (this.editingRecord) person = this.unwrap(await updateCMDBPerson(this.editingRecord.id, this.editingRecord.revision, fields))
      else person = this.unwrap(await createCMDBPerson(fields))

      const oldTeams = this.editingRecord ? this.editingRecord.team_ids : []
      const teamChanged = !sameIDs(oldTeams, this.editorForm.team_ids)
      if (teamChanged) {
        try {
          person = this.unwrap(await updateCMDBPersonTeams(person.id, person.revision, this.editorForm.team_ids))
        } catch (error) {
          throw new Error(`负责人资料已保存，但团队归属未完成：${error.message}`)
        }
      }
      const oldUserID = this.editingRecord && this.editingRecord.account ? Number(this.editingRecord.account.user_id) : 0
      const nextUserID = Number(this.editorForm.user_id) || 0
      if (oldUserID !== nextUserID) {
        try {
          this.unwrap(await setCMDBPersonAccount(person.id, nextUserID))
        } catch (error) {
          throw new Error(`负责人与团队资料已保存，但账号关联未完成：${error.message}`)
        }
      }
      return person
    },
    requestTransition(type, record) {
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
        if (type === 'team') this.unwrap(await transitionCMDBTeam(record.id, record.revision, activate))
        else this.unwrap(await transitionCMDBPerson(record.id, record.revision, activate))
        this.$message.success(activate ? '已重新启用' : '已安全停用')
      } catch (error) {
        if (error.businessData && Number(error.businessData.total) > 0) {
          this.impactTarget = {...record, impact: error.businessData}
          this.impactVisible = true
        } else {
          this.$message.error(error.message || '状态变更失败')
        }
      } finally {
        await this.reload()
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
.responsibility-directory { min-width: 0; color: var(--smartops-ink); }
.responsibility-heading { align-items: center; }
.responsibility-kicker { margin: 0 0 4px !important; color: var(--smartops-signal-blue) !important; font-family: var(--smartops-font-mono); font-size: 10px !important; font-weight: 800; letter-spacing: .15em; }
.heading-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.context-chip { display: inline-flex; align-items: center; gap: 7px; min-height: 32px; padding: 0 11px; border: 1px solid #cfdae4; border-radius: 3px; background: #fff; color: #38516a; font-size: 12px; font-weight: 600; }
.context-chip i { width: 7px; height: 7px; border-radius: 50%; background: var(--smartops-success); box-shadow: 0 0 0 3px rgba(39, 155, 109, .13); }
.identity-spine { position: relative; display: grid; grid-template-columns: 1fr 34px 1fr 34px 1fr; align-items: stretch; gap: 0; margin-bottom: 14px; padding: 14px 16px 44px; border: 1px solid #163e5c; border-radius: 4px; background: #0d2c43; color: #fff; overflow: hidden; box-shadow: 0 8px 22px rgba(12, 42, 64, .08); }
.identity-spine::before { position: absolute; top: 0; bottom: 0; left: 0; width: 4px; background: #20a4d8; content: ''; }
.identity-node { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 9px 11px; border: 1px solid rgba(176, 211, 232, .16); background: rgba(255, 255, 255, .035); }
.identity-node--truth { border-color: rgba(72, 198, 147, .45); background: rgba(38, 159, 111, .1); }
.identity-index { flex: 0 0 auto; color: #6db9df; font-family: var(--smartops-font-mono); font-size: 11px; }
.identity-node small { display: block; margin-bottom: 3px; color: #7eb8d6; font-family: var(--smartops-font-mono); font-size: 9px; letter-spacing: .12em; }
.identity-node strong { display: block; font-size: 14px; letter-spacing: .01em; }
.identity-node p { margin: 2px 0 0; color: #b6cbd9; font-size: 11px; }
.identity-arrow { display: flex; align-items: center; justify-content: center; color: #54add5; font-size: 18px; }
.identity-rule { position: absolute; right: 16px; bottom: 10px; left: 16px; display: flex; align-items: center; gap: 8px; color: #a9c4d6; font-size: 11px; }
.identity-rule .anticon { color: #48c693; }
.identity-rule strong { color: #dff7ee; font-weight: 600; }
.directory-empty { min-height: 390px; padding: 72px 24px; text-align: center; }
.directory-empty .empty-symbol { display: inline-flex; align-items: center; justify-content: center; width: 58px; height: 58px; margin-bottom: 18px; border: 1px solid #b9cfdd; border-radius: 50%; background: #edf6fa; color: #28799f; font-family: var(--smartops-font-mono); font-size: 12px; font-weight: 800; }
.directory-empty--error .empty-symbol { border-color: #e6b8b1; background: #fff1ef; color: #b84231; }
.directory-empty h2 { margin: 0 0 8px; color: var(--smartops-command-navy); font-size: 20px; }
.directory-empty p { max-width: 620px; margin: 0 auto 20px; color: var(--smartops-muted); }
.directory-summary { display: grid; grid-template-columns: minmax(220px, 1.45fr) repeat(3, minmax(150px, 1fr)); gap: 10px; margin-bottom: 12px; }
.directory-summary article { min-width: 0; padding: 14px 16px; border: 1px solid #d9e2e9; border-top: 3px solid #9ab2c3; border-radius: 3px; background: #fff; box-shadow: 0 3px 10px rgba(20, 55, 78, .035); }
.directory-summary article:first-child { border-top-color: var(--smartops-signal-blue); }
.directory-summary article.summary-warning { border-top-color: #d9962e; }
.directory-summary span { display: block; color: #75899a; font-family: var(--smartops-font-mono); font-size: 9px; font-weight: 800; letter-spacing: .1em; }
.directory-summary strong { display: block; margin: 5px 0 2px; overflow: hidden; color: #12324a; font-size: 22px; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.directory-summary article:first-child strong { font-size: 16px; line-height: 27px; }
.directory-summary small { color: #718496; font-size: 11px; }
.directory-ledger { overflow: hidden; }
.ledger-toolbar { display: flex; align-items: center; gap: 10px; padding: 13px 14px; border-bottom: 1px solid #e1e8ee; background: #f7fafc; }
.ledger-toolbar /deep/ .ant-radio-button-wrapper b { margin-left: 6px; font-family: var(--smartops-font-mono); font-size: 10px; }
.toolbar-spacer { flex: 1; }
.ledger-toolbar .ant-input-search { width: 360px; max-width: 34vw; }
.status-filter { width: 128px; }
.directory-ledger /deep/ .ant-table-thead > tr > th { background: #f2f6f8; color: #526a7b; font-size: 11px; font-weight: 700; letter-spacing: .03em; }
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
.editor-boundary { display: flex; gap: 8px; margin-bottom: 14px; padding: 10px 12px; border-left: 3px solid #2788b6; background: #edf6fa; color: #48677a; font-size: 12px; line-height: 1.6; }
.editor-boundary .anticon { margin-top: 3px; color: #2788b6; }
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
@media (max-width: 1180px) {
  .directory-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .identity-spine { grid-template-columns: 1fr 24px 1fr 24px 1fr; }
  .identity-node { padding: 9px 7px; }
}
@media (max-width: 820px) {
  .responsibility-heading { align-items: flex-start; }
  .heading-actions { justify-content: flex-start; }
  .identity-spine { grid-template-columns: 1fr; padding-bottom: 58px; }
  .identity-arrow { height: 24px; transform: rotate(90deg); }
  .directory-summary { grid-template-columns: 1fr; }
  .ledger-toolbar { align-items: stretch; flex-wrap: wrap; }
  .toolbar-spacer { display: none; }
  .ledger-toolbar .ant-input-search { width: 100%; }
  .form-grid { grid-template-columns: 1fr; }
}
</style>
