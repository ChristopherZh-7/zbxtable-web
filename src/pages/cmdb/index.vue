<template>
  <page-layout :noTitle="true">
    <div class="cmdb-center">
      <header class="smartops-page-heading cmdb-heading">
        <div>
          <p class="cmdb-kicker">CONFIGURATION RECORDS</p>
          <h1>CMDB 配置中心</h1>
          <p>iTop 保存唯一配置真源，SmartOps 提供按租户受控的资产维护入口与关系视图。</p>
        </div>
        <div class="heading-actions">
          <a-button :loading="loading" icon="reload" @click="refreshAll">刷新</a-button>
          <a-button v-if="platformAdmin" icon="setting" @click="openMapping">配置组织映射</a-button>
          <a-button v-if="canCreate && sourceReady" type="primary" icon="plus" @click="openCreateAsset">新增资产</a-button>
        </div>
      </header>

      <section class="source-strip" aria-label="CMDB 数据源状态">
        <div class="source-identity">
          <span class="source-strip__eyebrow">SOURCE OF TRUTH</span>
          <strong>iTop CMDB</strong>
        </div>
        <div class="source-field">
          <span>连接状态</span>
          <a-badge :status="sourceReady ? 'success' : overview.state === 'unconfigured' ? 'warning' : overview.state === 'error' ? 'error' : 'processing'" :text="sourceStateLabel" />
        </div>
        <div class="source-field">
          <span>当前 Organization</span>
          <strong>{{ organizationName }}</strong>
        </div>
        <div class="source-field">
          <span>数据边界</span>
          <strong>受控写入 · 租户隔离</strong>
        </div>
        <div class="source-total">
          <span>配置项</span>
          <strong>{{ overview.total || 0 }}</strong>
        </div>
      </section>

      <section v-if="!loading && overview.state === 'unconfigured'" class="cmdb-empty smartops-data-panel">
        <div class="empty-symbol"><a-icon type="disconnect" /></div>
        <h2>当前租户尚未关联 iTop Organization</h2>
        <p>建立映射后，本页只会维护该 Organization 下的配置项，不会展示或修改其他客户数据。</p>
        <a-button v-if="platformAdmin" type="primary" icon="link" @click="openMapping">立即配置映射</a-button>
        <a-alert v-else type="info" show-icon message="请联系平台管理员完成 CMDB 组织映射。" />
      </section>

      <section v-else-if="!loading && overview.state === 'error'" class="cmdb-empty cmdb-error smartops-data-panel">
        <div class="empty-symbol"><a-icon type="warning" /></div>
        <h2>CMDB 数据读取失败</h2>
        <p>{{ overview.message || '暂时无法读取 iTop CMDB，请稍后重试。' }}</p>
        <a-button type="primary" icon="reload" @click="refreshAll">重新读取</a-button>
      </section>

      <template v-else>
        <section class="cmdb-toolbar smartops-filter-panel">
          <a-input-search
            v-model.trim="filters.search"
            allow-clear
            placeholder="搜索名称、IP、序列号或资产编号"
            class="search-control"
            @search="applyFilters"
          />
          <a-select v-model="filters.class" allow-clear placeholder="全部类型" class="filter-control" @change="applyFilters">
            <a-select-option v-for="option in classOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </a-select-option>
          </a-select>
          <a-select v-model="filters.status" allow-clear placeholder="全部状态" class="filter-control" @change="applyFilters">
            <a-select-option value="production">生产</a-select-option>
            <a-select-option value="active">启用</a-select-option>
            <a-select-option value="implementation">实施中</a-select-option>
            <a-select-option value="inactive">停用</a-select-option>
            <a-select-option value="obsolete">已淘汰</a-select-option>
          </a-select>
          <div class="toolbar-summary">当前结果 <strong>{{ assetPage.total }}</strong> 项</div>
        </section>

        <div class="cmdb-workbench">
          <section class="asset-ledger smartops-data-panel">
            <div class="panel-heading">
              <div>
                <span class="smartops-section-label">资产台账</span>
                <small>点击一行查看配置详情</small>
              </div>
              <div class="class-counts">
                <span v-for="option in activeCounts" :key="option.value">{{ option.label }} <b>{{ option.count }}</b></span>
              </div>
            </div>
            <a-table
              :loading="assetsLoading"
              :columns="columns"
              :data-source="assets"
              :row-key="assetKey"
              :pagination="false"
              :custom-row="assetRow"
              :row-class-name="assetRowClass"
              :scroll="{x: 695}"
              size="middle"
            >
              <template slot="asset" slot-scope="record">
                <div class="asset-name-cell">
                  <span class="asset-icon"><a-icon :type="classMeta(record.class).icon" /></span>
                  <span><strong>{{ record.name }}</strong><code>{{ assetKey(record) }}</code></span>
                </div>
              </template>
              <template slot="class" slot-scope="record">
                <a-tag :color="classMeta(record.class).color">{{ classMeta(record.class).label }}</a-tag>
              </template>
              <template slot="status" slot-scope="record">
                <a-badge :status="statusMeta(record.status).status" :text="statusMeta(record.status).label" />
              </template>
              <template slot="management" slot-scope="record">
                <span class="mono-value">{{ record.managementip || record.serialnumber || record.asset_number || '—' }}</span>
              </template>
            </a-table>
            <footer class="ledger-footer">
              <span>数据来自 {{ organizationName }}</span>
              <a-pagination
                :current="assetPage.page"
                :page-size="assetPage.page_size"
                :total="assetPage.total"
                :show-less-items="true"
                @change="changePage"
              />
            </footer>
          </section>

          <aside class="asset-inspector smartops-data-panel" aria-label="CMDB 资产详情">
            <div v-if="!selectedAsset" class="inspector-placeholder">
              <a-icon type="select" />
              <strong>选择一条配置项</strong>
              <span>详情和关系会在这里展开</span>
            </div>
            <a-spin v-else :spinning="detailLoading">
              <div class="inspector-head">
                <div class="inspector-icon"><a-icon :type="classMeta(selectedAsset.class).icon" /></div>
                <div class="inspector-identity">
                  <a-tag :color="classMeta(selectedAsset.class).color">{{ classMeta(selectedAsset.class).label }}</a-tag>
                  <h2>{{ selectedAsset.name }}</h2>
                  <code>{{ assetKey(selectedAsset) }}</code>
                </div>
              </div>

              <div v-if="canUpdate || canOperate" class="inspector-actions">
                <a-button v-if="canUpdate && !selectedLifecycle.retired" icon="edit" @click="openEditAsset">编辑资产</a-button>
                <a-button
                  v-if="canOperate"
                  :loading="lifecycleSaving"
                  :type="selectedLifecycle.retired ? 'primary' : 'danger'"
                  :icon="selectedLifecycle.retired ? 'check-circle' : 'stop'"
                  @click="confirmLifecycleTransition"
                >{{ selectedLifecycle.label }}</a-button>
              </div>

              <div class="inspector-section">
                <div class="inspector-title"><span>配置属性</span><small>DETAIL</small></div>
                <dl class="detail-grid">
                  <div v-for="row in selectedDetailRows" :key="row.key" :class="{'detail-wide': row.key === 'description'}">
                    <dt>{{ row.label }}</dt>
                    <dd :class="{'mono-value': ['managementip', 'serialnumber', 'asset_number'].includes(row.key)}">{{ row.value }}</dd>
                  </div>
                </dl>
                <a-empty v-if="!selectedDetailRows.length" :image-style="{height: '42px'}" description="暂无扩展属性" />
              </div>

              <div class="inspector-section relation-section">
                <div class="inspector-title"><span>配置关系</span><small>DEPTH 1</small></div>
                <div class="configuration-spine">
                  <div class="relation-lane">
                    <span class="lane-label">上游依赖</span>
                    <div v-for="node in relationView.upstream" :key="assetKey(node)" class="relation-node">
                      <a-icon :type="classMeta(node.class).icon" />
                      <span><strong>{{ node.name }}</strong><small>{{ classMeta(node.class).label }}</small></span>
                    </div>
                    <span v-if="!relationView.upstream.length" class="relation-empty">无上游配置项</span>
                  </div>
                  <div class="spine-connector"><span></span></div>
                  <div class="origin-node">
                    <span class="origin-mark"><a-icon :type="classMeta(selectedAsset.class).icon" /></span>
                    <span><strong>{{ selectedAsset.name }}</strong><small>当前配置项</small></span>
                  </div>
                  <div class="spine-connector"><span></span></div>
                  <div class="relation-lane">
                    <span class="lane-label">下游支撑</span>
                    <div v-for="node in relationView.downstream" :key="assetKey(node)" class="relation-node">
                      <a-icon :type="classMeta(node.class).icon" />
                      <span><strong>{{ node.name }}</strong><small>{{ classMeta(node.class).label }}</small></span>
                    </div>
                    <span v-if="!relationView.downstream.length" class="relation-empty">无下游配置项</span>
                  </div>
                </div>
              </div>
            </a-spin>
          </aside>
        </div>
      </template>
    </div>

    <a-modal
      :visible="assetFormVisible"
      :title="assetEditing ? '编辑 CMDB 资产' : '新增 CMDB 资产'"
      :confirm-loading="assetSaving"
      :mask-closable="false"
      :destroy-on-close="true"
      width="760px"
      :ok-text="assetEditing ? '保存修改' : '新增资产'"
      @ok="saveAsset"
      @cancel="closeAssetForm"
    >
      <div class="asset-form-context">
        <span class="asset-form-context__mark"><a-icon type="database" /></span>
        <div>
          <strong>直接写入 {{ organizationName }}</strong>
          <p>资产类型和所属 Organization 创建后不可变；退役会保留记录，不会删除历史。</p>
        </div>
      </div>
      <a-alert v-if="assetFormError" type="error" show-icon :message="assetFormError" class="asset-form-error" />
      <a-form-model layout="vertical" class="asset-form">
        <div class="asset-form-grid">
          <a-form-model-item label="资产类型" required class="asset-form-wide">
            <a-select v-model="assetFormClass" :disabled="assetEditing" placeholder="选择资产类型" @change="changeAssetClass">
              <a-select-option v-for="option in classOptions" :key="option.value" :value="option.value">{{ option.label }}</a-select-option>
            </a-select>
          </a-form-model-item>
          <a-form-model-item
            v-for="field in assetFormFields"
            :key="field.key"
            :label="field.label"
            :required="field.required"
            :class="{'asset-form-wide': field.wide}"
          >
            <a-textarea v-if="field.kind === 'text'" v-model="assetForm[field.key]" :rows="3" :max-length="4000" placeholder="记录用途、责任边界或维护说明" />
            <a-select v-else-if="field.kind === 'status'" v-model="assetForm[field.key]">
              <a-select-option v-for="option in assetStatusOptions" :key="option.value" :value="option.value">{{ option.label }}</a-select-option>
            </a-select>
            <a-select v-else-if="field.kind === 'criticality'" v-model="assetForm[field.key]" allow-clear placeholder="未设置">
              <a-select-option value="high">高</a-select-option>
              <a-select-option value="medium">中</a-select-option>
              <a-select-option value="low">低</a-select-option>
            </a-select>
            <a-date-picker v-else-if="field.kind === 'date'" v-model="assetForm[field.key]" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%" />
            <a-select v-else-if="field.kind === 'location'" v-model="assetForm[field.key]" allow-clear show-search option-filter-prop="children" placeholder="未设置">
              <a-select-option v-for="option in cmdbReferences.locations" :key="option.id" :value="option.id">{{ option.name }}</a-select-option>
            </a-select>
            <a-select v-else-if="field.kind === 'networkType'" v-model="assetForm[field.key]" show-search option-filter-prop="children" placeholder="选择网络设备类型">
              <a-select-option v-for="option in cmdbReferences.network_device_types" :key="option.id" :value="option.id">{{ option.name }}</a-select-option>
            </a-select>
            <a-input v-else v-model="assetForm[field.key]" :placeholder="field.kind === 'ip' ? '例如 10.0.0.10' : `填写${field.label}`" :max-length="255" />
          </a-form-model-item>
        </div>
      </a-form-model>
    </a-modal>

    <a-modal
      :visible="mappingVisible"
      title="配置租户 CMDB 组织映射"
      :confirm-loading="mappingSaving"
      :mask-closable="false"
      width="620px"
      ok-text="保存映射"
      @ok="saveMapping"
      @cancel="closeMapping"
    >
      <a-alert
        type="warning"
        show-icon
        message="一个 iTop Organization 只能绑定一个 SmartOps 租户；映射会作为服务端数据边界。"
        class="mapping-alert"
      />
      <a-spin :spinning="mappingLoading">
        <a-form-model layout="vertical">
          <a-form-model-item label="SmartOps 租户" required>
            <a-select v-model="mappingForm.tenant_id" show-search option-filter-prop="children" placeholder="选择租户" @change="syncMappingSelection">
              <a-select-option v-for="tenant in mappingTenants" :key="tenant.id" :value="tenant.id">{{ tenant.name }}（{{ tenant.code }}）</a-select-option>
            </a-select>
          </a-form-model-item>
          <a-form-model-item label="iTop Organization" required>
            <a-select v-model="mappingForm.itop_organization_id" show-search option-filter-prop="children" placeholder="选择数据组织">
              <a-select-option v-for="organization in mappingOrganizations" :key="organization.id" :value="organization.id" :disabled="organizationAssignedElsewhere(organization.id)">
                {{ organization.name }}<template v-if="organization.code"> · {{ organization.code }}</template>
              </a-select-option>
            </a-select>
          </a-form-model-item>
        </a-form-model>
      </a-spin>
    </a-modal>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import {listTenants} from '@/services/tenant'
import {
  activateCMDBAsset,
  createCMDBAsset,
  getCMDBAsset,
  getCMDBOverview,
  getCMDBReferences,
  getCMDBRelations,
  listCMDBAssets,
  listCMDBMappings,
  listCMDBOrganizations,
  retireCMDBAsset,
  updateCMDBAsset,
  upsertCMDBMapping,
} from '@/services/cmdb'
import {
  CLASS_META,
  assetKey,
  buildAssetFields,
  classMeta,
  createAssetForm,
  detailRows,
  editableFields,
  isPlatformAdmin,
  lifecycleMeta,
  mappingForTenant,
  relationBuckets,
  statusOptions,
  statusMeta,
  validateAssetForm,
} from './cmdb-model'

const {canPerform} = require('@/utils/permission-policy')

const emptyAssetPage = () => ({items: [], total: 0, page: 1, page_size: 30, counts: {}})

export default {
  name: 'CMDBCenter',
  components: {PageLayout},
  data() {
    return {
      loading: false,
      assetsLoading: false,
      detailLoading: false,
      overview: {state: 'loading', message: '', total: 0, counts: {}},
      assets: [],
      assetPage: emptyAssetPage(),
      filters: {search: '', class: undefined, status: undefined},
      selectedAsset: null,
      selectedDetail: null,
      relations: {nodes: [], edges: [], depth: 1},
      detailSequence: 0,
      assetFormVisible: false,
      assetEditing: false,
      assetSaving: false,
      lifecycleSaving: false,
      assetFormClass: 'Server',
      assetForm: createAssetForm('Server'),
      assetFormRevision: '',
      assetFormError: '',
      cmdbReferences: {locations: [], network_device_types: []},
      referencesLoaded: false,
      mappingVisible: false,
      mappingLoading: false,
      mappingSaving: false,
      mappingTenants: [],
      mappingOrganizations: [],
      mappings: [],
      mappingForm: {tenant_id: undefined, itop_organization_id: undefined},
      columns: [
        {title: '配置项', key: 'asset', scopedSlots: {customRender: 'asset'}, width: 240},
        {title: '类型', key: 'class', scopedSlots: {customRender: 'class'}, width: 105},
        {title: '状态', key: 'status', scopedSlots: {customRender: 'status'}, width: 105},
        {title: 'IP / 资产标识', key: 'management', scopedSlots: {customRender: 'management'}, width: 135},
        {title: '位置', dataIndex: 'location_name', width: 110},
      ],
    }
  },
  computed: {
    user() { return this.$store.getters['account/user'] || {} },
    permissions() { return this.$store.getters['account/permissions'] || [] },
    currentTenant() { return this.$store.getters['account/currentTenant'] || {} },
    platformAdmin() { return isPlatformAdmin(this.user) },
    canCreate() { return canPerform(this.permissions, 'tenant.cmdb', 'create') },
    canUpdate() { return canPerform(this.permissions, 'tenant.cmdb', 'update') },
    canOperate() { return canPerform(this.permissions, 'tenant.cmdb', 'operate') },
    sourceReady() { return this.overview.state === 'ready' },
    sourceStateLabel() {
      if (this.loading || this.overview.state === 'loading') return '读取中'
      if (this.overview.state === 'ready') return '已连接'
      if (this.overview.state === 'unconfigured') return '待映射'
      return '异常'
    },
    organizationName() {
      if (this.overview.organization && this.overview.organization.name) return this.overview.organization.name
      if (this.overview.state === 'error') return '读取失败'
      if (this.overview.state === 'unconfigured') return '未配置'
      return '—'
    },
    classOptions() {
      return Object.keys(CLASS_META).map((value) => ({value, label: CLASS_META[value].label}))
    },
    activeCounts() {
      return this.classOptions
        .map((option) => ({...option, count: Number(this.assetPage.counts && this.assetPage.counts[option.value]) || 0}))
        .filter((option) => option.count > 0)
    },
    selectedDetailRows() { return detailRows(this.selectedDetail || this.selectedAsset) },
    relationView() { return relationBuckets(this.relations, this.selectedDetail || this.selectedAsset) },
    selectedLifecycle() { return lifecycleMeta(this.selectedDetail || this.selectedAsset) },
    assetFormFields() { return editableFields(this.assetFormClass) },
    assetStatusOptions() { return statusOptions(this.assetFormClass) },
  },
  created() {
    this.loadOverviewAndAssets()
  },
  methods: {
    assetKey,
    classMeta,
    statusMeta,
    unwrap(response) {
      const result = response && response.data
      if (!result || Number(result.code) !== 200) {
        const error = new Error(result && result.message || '请求失败')
        error.businessCode = Number(result && result.code) || 0
        throw error
      }
      return result.data
    },
    pageItems(response) {
      const data = this.unwrap(response)
      return data && Array.isArray(data.items) ? data.items : []
    },
    async loadOverviewAndAssets() {
      this.loading = true
      try {
        this.overview = this.unwrap(await getCMDBOverview()) || {state: 'error', total: 0, counts: {}}
        if (this.overview.state === 'ready') await this.loadAssets(1)
        else this.resetLedger()
      } catch (error) {
        this.overview = {state: 'error', message: error.message, total: 0, counts: {}}
        this.resetLedger()
        this.$message.error(error.message || 'CMDB 数据加载失败')
      } finally {
        this.loading = false
      }
    },
    async loadAssets(page) {
      this.assetsLoading = true
      try {
        const data = this.unwrap(await listCMDBAssets({
          search: this.filters.search || undefined,
          class: this.filters.class || undefined,
          status: this.filters.status || undefined,
          page: page || this.assetPage.page || 1,
          page_size: this.assetPage.page_size || 30,
        })) || emptyAssetPage()
        this.assetPage = {...emptyAssetPage(), ...data, counts: data.counts || {}}
        this.assets = Array.isArray(data.items) ? data.items : []
        const retained = this.selectedAsset && this.assets.find((asset) => assetKey(asset) === assetKey(this.selectedAsset))
        if (retained) await this.selectAsset(retained)
        else if (this.assets.length) await this.selectAsset(this.assets[0])
        else this.clearSelection()
      } catch (error) {
        this.resetLedger()
        this.$message.error(error.message || '资产台账加载失败')
      } finally {
        this.assetsLoading = false
      }
    },
    async selectAsset(asset) {
      if (!asset) return
      const sequence = ++this.detailSequence
      this.selectedAsset = asset
      this.detailLoading = true
      try {
        const [detailResponse, relationResponse] = await Promise.all([
          getCMDBAsset(asset.class, asset.id),
          getCMDBRelations(asset.class, asset.id),
        ])
        if (sequence !== this.detailSequence) return
        this.selectedDetail = this.unwrap(detailResponse) || asset
        this.relations = this.unwrap(relationResponse) || {nodes: [], edges: [], depth: 1}
      } catch (error) {
        if (sequence !== this.detailSequence) return
        this.selectedDetail = asset
        this.relations = {nodes: [], edges: [], depth: 1}
        this.$message.error(error.message || '资产详情加载失败')
      } finally {
        if (sequence === this.detailSequence) this.detailLoading = false
      }
    },
    assetRow(record) {
      return {on: {click: () => this.selectAsset(record)}}
    },
    assetRowClass(record) {
      return this.selectedAsset && assetKey(record) === assetKey(this.selectedAsset) ? 'cmdb-row-selected' : ''
    },
    applyFilters() { this.loadAssets(1) },
    changePage(page) { this.loadAssets(page) },
    refreshAll() { this.loadOverviewAndAssets() },
    resetLedger() {
      this.assets = []
      this.assetPage = emptyAssetPage()
      this.clearSelection()
    },
    clearSelection() {
      this.detailSequence += 1
      this.selectedAsset = null
      this.selectedDetail = null
      this.relations = {nodes: [], edges: [], depth: 1}
      this.detailLoading = false
    },
    async ensureCMDBReferences() {
      if (this.referencesLoaded) return
      const data = this.unwrap(await getCMDBReferences()) || {}
      this.cmdbReferences = {
        locations: Array.isArray(data.locations) ? data.locations : [],
        network_device_types: Array.isArray(data.network_device_types) ? data.network_device_types : [],
      }
      this.referencesLoaded = true
    },
    async openCreateAsset() {
      if (!this.canCreate || !this.sourceReady) return
      try {
        await this.ensureCMDBReferences()
        this.assetEditing = false
        this.assetFormClass = this.filters.class && CLASS_META[this.filters.class] ? this.filters.class : 'Server'
        this.assetForm = createAssetForm(this.assetFormClass)
        this.assetFormRevision = ''
        this.assetFormError = ''
        this.assetFormVisible = true
      } catch (error) {
        this.$message.error(error.message || 'CMDB 参考数据加载失败')
      }
    },
    async openEditAsset() {
      if (!this.canUpdate || this.selectedLifecycle.retired || !this.selectedAsset) return
      try {
        await this.ensureCMDBReferences()
        let asset = this.selectedDetail
        if (!asset || !asset.revision) asset = this.unwrap(await getCMDBAsset(this.selectedAsset.class, this.selectedAsset.id))
        if (!asset || !asset.revision) throw new Error('资产版本信息缺失，请刷新后重试')
        this.selectedDetail = asset
        this.assetEditing = true
        this.assetFormClass = asset.class
        this.assetForm = createAssetForm(asset.class, asset)
        this.assetFormRevision = asset.revision
        this.assetFormError = ''
        this.assetFormVisible = true
      } catch (error) {
        this.$message.error(error.message || '资产编辑数据加载失败')
      }
    },
    changeAssetClass(assetClass) {
      if (this.assetEditing) return
      this.assetForm = createAssetForm(assetClass)
      this.assetFormError = ''
    },
    closeAssetForm() {
      if (this.assetSaving) return
      this.assetFormVisible = false
      this.assetFormError = ''
    },
    async saveAsset() {
      const validation = validateAssetForm(this.assetFormClass, this.assetForm)
      if (validation) {
        this.assetFormError = validation
        return
      }
      this.assetSaving = true
      this.assetFormError = ''
      try {
        const fields = buildAssetFields(this.assetFormClass, this.assetForm, !this.assetEditing)
        const response = this.assetEditing
          ? await updateCMDBAsset(this.assetFormClass, this.selectedAsset.id, this.assetFormRevision, fields)
          : await createCMDBAsset(this.assetFormClass, fields)
        const asset = this.unwrap(response)
        this.assetFormVisible = false
        this.$message.success(this.assetEditing ? 'CMDB 资产已更新' : 'CMDB 资产已新增')
        this.selectedAsset = asset
        await this.loadOverviewAndAssets()
      } catch (error) {
        if (error.businessCode === 1000) {
          this.assetFormError = '资产已被其他操作更新，当前详情已刷新；请关闭表单后重新编辑。'
          if (this.selectedAsset) await this.selectAsset(this.selectedAsset)
        } else if (error.businessCode === 1013) {
          this.assetFormError = '同一 Organization 下已存在同类型同名资产。'
        } else {
          this.assetFormError = error.message || 'CMDB 资产保存失败'
        }
      } finally {
        this.assetSaving = false
      }
    },
    confirmLifecycleTransition() {
      if (!this.canOperate || !this.selectedAsset || !this.selectedDetail || !this.selectedDetail.revision) {
        this.$message.warning('资产版本信息尚未就绪，请刷新后重试')
        return
      }
      const transition = this.selectedLifecycle
      this.$confirm({
        title: transition.retired ? '重新启用这项资产？' : '退役这项资产？',
        content: transition.retired
          ? '资产会恢复为在用状态，并继续作为 iTop 配置真源中的有效记录。'
          : '资产会保留在台账和审计记录中，不会被删除。',
        okText: transition.label,
        okType: transition.retired ? 'primary' : 'danger',
        cancelText: '取消',
        onOk: () => this.runLifecycleTransition(transition),
      })
    },
    async runLifecycleTransition(transition) {
      this.lifecycleSaving = true
      try {
        const operation = transition.retired ? activateCMDBAsset : retireCMDBAsset
        this.unwrap(await operation(this.selectedDetail.class, this.selectedDetail.id, this.selectedDetail.revision))
        this.$message.success(transition.retired ? 'CMDB 资产已重新启用' : 'CMDB 资产已退役并保留记录')
        await this.loadOverviewAndAssets()
      } catch (error) {
        if (error.businessCode === 1000) {
          this.$message.warning('资产已被其他操作更新，已刷新当前详情，请确认后重试。')
          await this.selectAsset(this.selectedAsset)
        } else {
          this.$message.error(error.message || `${transition.label}失败`)
        }
      } finally {
        this.lifecycleSaving = false
      }
    },
    async openMapping() {
      if (!this.platformAdmin) return
      this.mappingVisible = true
      this.mappingLoading = true
      try {
        const [tenants, organizations, mappings] = await Promise.all([
          listTenants(), listCMDBOrganizations(), listCMDBMappings(),
        ])
        this.mappingTenants = this.pageItems(tenants)
        this.mappingOrganizations = this.pageItems(organizations)
        this.mappings = this.pageItems(mappings)
        const preferredTenant = Number(this.currentTenant.id) || (this.mappingTenants[0] && this.mappingTenants[0].id)
        this.mappingForm.tenant_id = preferredTenant
        this.syncMappingSelection(preferredTenant)
      } catch (error) {
        this.$message.error(error.message || '映射选项加载失败')
      } finally {
        this.mappingLoading = false
      }
    },
    closeMapping() {
      this.mappingVisible = false
      this.mappingForm = {tenant_id: undefined, itop_organization_id: undefined}
    },
    syncMappingSelection(tenantID) {
      const mapping = mappingForTenant(this.mappings, tenantID)
      this.mappingForm.itop_organization_id = mapping ? Number(mapping.itop_organization_id) : undefined
    },
    organizationAssignedElsewhere(organizationID) {
      return this.mappings.some((mapping) => Number(mapping.itop_organization_id) === Number(organizationID)
        && Number(mapping.tenant_id) !== Number(this.mappingForm.tenant_id))
    },
    async saveMapping() {
      if (!this.mappingForm.tenant_id || !this.mappingForm.itop_organization_id) {
        this.$message.warning('请完整选择租户和 iTop Organization')
        return
      }
      this.mappingSaving = true
      try {
        this.unwrap(await upsertCMDBMapping(this.mappingForm.tenant_id, this.mappingForm.itop_organization_id))
        this.$message.success('CMDB 组织映射已更新')
        this.referencesLoaded = false
        this.closeMapping()
        await this.loadOverviewAndAssets()
      } catch (error) {
        this.$message.error(error.message || '映射保存失败')
      } finally {
        this.mappingSaving = false
      }
    },
  },
}
</script>

<style lang="less" scoped>
.cmdb-center { min-width: 0; color: var(--smartops-ink); }
.cmdb-heading { align-items: center; }
.cmdb-kicker { margin: 0 0 4px !important; color: var(--smartops-signal-blue) !important; font-family: var(--smartops-font-mono); font-size: 10px !important; font-weight: 700; letter-spacing: .14em; }
.heading-actions { display: flex; flex-shrink: 0; gap: 8px; }

.source-strip { display: grid; grid-template-columns: 220px 150px minmax(210px, 1fr) minmax(240px, 1fr) 105px; min-height: 78px; margin-bottom: 12px; border: 1px solid #173b63; background: var(--smartops-command-navy); color: #fff; }
.source-identity, .source-field, .source-total { display: flex; justify-content: center; flex-direction: column; padding: 12px 18px; border-right: 1px solid rgba(255,255,255,.13); }
.source-identity strong { font-size: 17px; letter-spacing: .02em; }
.source-strip__eyebrow { margin-bottom: 3px; color: #82b5df; font-family: var(--smartops-font-mono); font-size: 9px; font-weight: 700; letter-spacing: .13em; }
.source-field > span, .source-total > span { margin-bottom: 5px; color: #9fb3c9; font-size: 11px; }
.source-field strong { overflow: hidden; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.source-strip /deep/ .ant-badge-status-text { color: #fff; font-size: 13px; }
.source-total { align-items: flex-end; border-right: 0; }
.source-total strong { font-family: var(--smartops-font-mono); font-size: 25px; font-weight: 650; line-height: 1; }

.cmdb-empty { min-height: 430px; padding: 78px 24px; text-align: center; }
.empty-symbol { display: inline-flex; align-items: center; justify-content: center; width: 70px; height: 70px; margin-bottom: 20px; border: 1px solid #cbd8e6; background: #eef3f8; color: var(--smartops-signal-blue); font-size: 30px; }
.cmdb-empty h2 { margin: 0 0 9px; color: var(--smartops-command-navy); font-size: 20px; }
.cmdb-empty p { max-width: 620px; margin: 0 auto 22px; color: var(--smartops-muted); }
.cmdb-empty .ant-alert { max-width: 520px; margin: 20px auto 0; text-align: left; }
.cmdb-error .empty-symbol { border-color: #e6c4c4; background: #fff3f3; color: #bd3f3f; }

.cmdb-toolbar { display: flex; align-items: center; gap: 10px; padding-bottom: 14px; }
.search-control { width: 420px; max-width: 42vw; }
.filter-control { width: 150px; }
.toolbar-summary { margin-left: auto; color: var(--smartops-muted); font-size: 12px; white-space: nowrap; }
.toolbar-summary strong { margin: 0 3px; color: var(--smartops-command-navy); font-family: var(--smartops-font-mono); font-size: 16px; }

.cmdb-workbench { display: grid; align-items: start; grid-template-columns: minmax(0, 1fr) 390px; gap: 12px; }
.asset-ledger { min-width: 0; overflow: hidden; }
.panel-heading { display: flex; align-items: center; justify-content: space-between; min-height: 56px; padding: 11px 16px; border-bottom: 1px solid var(--smartops-line); }
.panel-heading > div:first-child { display: flex; align-items: center; gap: 12px; }
.panel-heading small { color: var(--smartops-muted); font-size: 11px; }
.class-counts { display: flex; overflow: hidden; gap: 12px; color: var(--smartops-muted); font-size: 11px; white-space: nowrap; }
.class-counts b { color: var(--smartops-command-navy); font-family: var(--smartops-font-mono); }
.asset-ledger /deep/ .ant-table-tbody > tr { cursor: pointer; }
.asset-ledger /deep/ .ant-table-tbody > tr.cmdb-row-selected > td { background: #e6f0f8 !important; }
.asset-ledger /deep/ .ant-table-tbody > tr.cmdb-row-selected > td:first-child { box-shadow: inset 3px 0 0 var(--smartops-signal-blue); }
.asset-name-cell { display: flex; align-items: center; gap: 10px; }
.asset-name-cell > span:last-child { display: flex; min-width: 0; flex-direction: column; }
.asset-name-cell strong { overflow: hidden; color: var(--smartops-command-navy); font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.asset-name-cell code { margin-top: 2px; color: #77879a; font-size: 10px; }
.asset-icon { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex: 0 0 32px; border: 1px solid #cfdae6; background: #f1f5f9; color: var(--smartops-signal-blue); }
.mono-value { font-family: var(--smartops-font-mono); font-size: 12px; font-variant-numeric: tabular-nums; }
.ledger-footer { display: flex; align-items: center; justify-content: space-between; min-height: 58px; padding: 10px 16px; border-top: 1px solid var(--smartops-line); color: var(--smartops-muted); font-size: 11px; }

.asset-inspector { position: sticky; top: 84px; max-height: calc(100vh - 112px); overflow: auto; }
.inspector-placeholder { display: flex; align-items: center; justify-content: center; min-height: 480px; flex-direction: column; color: var(--smartops-muted); }
.inspector-placeholder .anticon { margin-bottom: 15px; color: #9eb0c3; font-size: 32px; }
.inspector-placeholder strong { margin-bottom: 5px; color: var(--smartops-command-navy); }
.inspector-placeholder span { font-size: 12px; }
.inspector-head { display: flex; align-items: center; min-height: 120px; padding: 20px; border-bottom: 1px solid var(--smartops-line); background: #f7f9fc; gap: 14px; }
.inspector-icon { display: inline-flex; align-items: center; justify-content: center; width: 54px; height: 54px; flex: 0 0 54px; border: 1px solid #b8c9da; background: #fff; color: var(--smartops-signal-blue); font-size: 23px; }
.inspector-identity { min-width: 0; }
.inspector-head h2 { max-width: 250px; overflow: hidden; margin: 5px 0 2px; color: var(--smartops-command-navy); font-size: 18px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.inspector-head code { color: var(--smartops-muted); font-size: 10px; }
.inspector-actions { display: grid; padding: 12px 18px; border-bottom: 1px solid var(--smartops-line); background: #fff; grid-template-columns: 1fr 1fr; gap: 8px; }
.inspector-section { padding: 17px 18px; border-bottom: 1px solid var(--smartops-line); }
.inspector-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 13px; color: var(--smartops-command-navy); font-size: 13px; font-weight: 700; }
.inspector-title small { color: #8c9caf; font-family: var(--smartops-font-mono); font-size: 9px; letter-spacing: .1em; }
.detail-grid { display: grid; margin: 0; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
.detail-grid > div { min-width: 0; }
.detail-grid dt { margin-bottom: 3px; color: var(--smartops-muted); font-size: 10px; }
.detail-grid dd { overflow-wrap: anywhere; margin: 0; color: #243b55; font-size: 12px; line-height: 1.5; }
.detail-grid .detail-wide { grid-column: 1 / -1; }

.configuration-spine { position: relative; padding-left: 17px; }
.configuration-spine::before { position: absolute; top: 19px; bottom: 19px; left: 6px; width: 1px; background: #a9bbcd; content: ''; }
.relation-lane { position: relative; }
.lane-label { display: block; margin-bottom: 7px; color: var(--smartops-muted); font-size: 10px; font-weight: 650; letter-spacing: .04em; }
.relation-node, .origin-node { position: relative; display: flex; align-items: center; min-height: 45px; padding: 8px 10px; border: 1px solid #d6e0ea; background: #fff; gap: 9px; }
.relation-node + .relation-node { margin-top: 6px; }
.relation-node::before, .origin-node::before { position: absolute; top: 50%; left: -15px; width: 14px; height: 1px; background: #a9bbcd; content: ''; }
.relation-node .anticon { color: var(--smartops-signal-blue); }
.relation-node > span, .origin-node > span:last-child { display: flex; min-width: 0; flex-direction: column; }
.relation-node strong, .origin-node strong { overflow: hidden; color: #243b55; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.relation-node small, .origin-node small { color: var(--smartops-muted); font-size: 10px; }
.origin-node { border-color: #6d96bb; background: #edf4fa; }
.origin-mark { display: inline-flex; align-items: center; justify-content: center; width: 27px; height: 27px; flex: 0 0 27px; background: var(--smartops-signal-blue); color: #fff; }
.spine-connector { height: 20px; }
.spine-connector span { position: absolute; left: 2px; width: 9px; height: 9px; margin-top: 5px; border: 1px solid #8da5bc; border-radius: 50%; background: #fff; }
.relation-empty { display: block; padding: 8px 0; color: #9aa8b7; font-size: 11px; }
.asset-form-context { display: flex; align-items: center; margin: -4px 0 18px; padding: 13px 15px; border: 1px solid #b9cce0; background: #f0f5fa; gap: 12px; }
.asset-form-context__mark { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; flex: 0 0 36px; background: var(--smartops-command-navy); color: #fff; }
.asset-form-context strong { display: block; color: var(--smartops-command-navy); font-size: 13px; }
.asset-form-context p { margin: 3px 0 0; color: var(--smartops-muted); font-size: 11px; line-height: 1.5; }
.asset-form-error { margin-bottom: 16px; }
.asset-form-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 18px; }
.asset-form-wide { grid-column: 1 / -1; }
.asset-form /deep/ .ant-form-item { margin-bottom: 14px; }
.asset-form /deep/ .ant-form-item-label { padding-bottom: 4px; }
.mapping-alert { margin-bottom: 18px; }

@media (max-width: 1240px) {
  .source-strip { grid-template-columns: 190px 140px minmax(180px, 1fr) 105px; }
  .source-field:nth-child(4) { display: none; }
  .cmdb-workbench { grid-template-columns: minmax(0, 1fr) 350px; }
}
@media (max-width: 980px) {
  .cmdb-heading { align-items: flex-start; }
  .source-strip { grid-template-columns: 1fr 1fr; }
  .source-identity, .source-field, .source-total { min-height: 66px; border-bottom: 1px solid rgba(255,255,255,.13); }
  .source-total { align-items: flex-start; grid-column: span 2; }
  .source-field:nth-child(4) { display: flex; }
  .cmdb-toolbar { align-items: stretch; flex-wrap: wrap; }
  .search-control { width: 100%; max-width: none; }
  .toolbar-summary { display: flex; align-items: center; margin-left: 0; }
  .cmdb-workbench { grid-template-columns: 1fr; }
  .asset-inspector { position: static; max-height: none; }
}
@media (max-width: 640px) {
  .heading-actions { width: 100%; flex-wrap: wrap; }
  .source-strip { grid-template-columns: 1fr; }
  .source-total { grid-column: auto; }
  .source-field:nth-child(4) { display: none; }
  .filter-control { width: calc(50% - 5px); }
  .panel-heading { align-items: flex-start; flex-direction: column; gap: 8px; }
  .class-counts { max-width: 100%; flex-wrap: wrap; }
  .ledger-footer { align-items: flex-start; flex-direction: column; gap: 10px; }
  .asset-form-grid { grid-template-columns: 1fr; }
  .asset-form-wide { grid-column: auto; }
}
</style>
