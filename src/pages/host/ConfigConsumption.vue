<template>
  <page-layout :noTitle="true">
    <div class="config-consumption">
      <header class="config-consumption__header">
        <div>
          <p class="page-kicker">监控配置管理</p>
          <h1>监控配置</h1>
        </div>
        <div class="heading-actions">
          <a-button :loading="loading" icon="reload" @click="refreshAll">刷新</a-button>
          <a-button
            v-if="scenarioScope === 'current' && canCreate && writeContextReady"
            data-testid="configuration-scenario-create"
            icon="plus"
            type="primary"
            @click="openCreate"
          >新建场景</a-button>
          <a-button
            v-if="scenarioScope === 'current' && canOperate && writeContextReady"
            data-testid="configuration-asset-apply"
            class="apply-action"
            icon="deployment-unit"
            @click="openApply"
          >应用到配置项</a-button>
        </div>
      </header>

      <section class="source-strip" aria-label="监控配置数据边界">
        <div class="source-identity">
          <span>配置数据来源</span>
          <strong>配置管理中心</strong>
        </div>
        <div class="source-field">
          <span>配置组织</span>
          <strong>{{ organizationName }}</strong>
          <details class="technical-details"><summary>查看组织编码</summary><small>{{ organizationCode }}</small></details>
        </div>
        <div class="source-field source-field--mono">
          <span>组织信息</span>
          <strong>组织编号 {{ cmdbContext.organization_id || '—' }}</strong>
          <small>组织映射版本 {{ cmdbContext.generation || '—' }}</small>
        </div>
        <div class="source-field">
          <span>映射状态</span>
          <a-badge :status="sourceBadge.status" :text="sourceBadge.label" />
          <small>{{ sourceBoundaryCopy }}</small>
        </div>
      </section>

      <section v-if="!loading && overview.state === 'unconfigured'" class="state-panel state-panel--warning">
        <a-icon type="disconnect" />
        <div><strong>当前租户尚未关联配置组织</strong><span>请联系平台管理员关联配置组织。</span></div>
      </section>
      <section v-else-if="!loading && overview.state === 'error'" class="state-panel state-panel--error">
        <a-icon type="warning" />
        <div><strong>CMDB 上下文读取失败</strong><span>{{ overview.message || '暂时无法读取配置管理中心映射，所有写入已关闭。' }}</span></div>
        <a-button icon="reload" @click="refreshAll">重试</a-button>
      </section>

      <template v-else-if="sourceReady">

        <section class="section-card">
          <div class="section-heading">
            <div>
              <p class="section-kicker">场景策略</p>
              <h2>场景策略</h2>
              <span>所属应用与配置项类型在创建后保持不变</span>
            </div>
            <a-radio-group v-model="scenarioScope" button-style="solid" size="small" @change="changeScenarioScope">
              <a-radio-button v-for="scope in scopes" :key="scope.value" :value="scope.value">{{ scope.label }}</a-radio-button>
            </a-radio-group>
          </div>
          <p v-if="scenarioScope !== 'current'" class="frozen-note">
            <a-icon type="lock" /> {{ scopeCaption(scenarioScope) }}，不提供编辑、删除或应用操作。
          </p>
          <a-table
            :columns="scenarioColumns"
            :data-source="scenarioPage.items"
            :loading="scenariosLoading"
            :pagination="false"
            :row-key="record => record.id"
            :scroll="{x: 1120}"
          >
            <template slot="scenarioIdentity" slot-scope="record">
              <div class="identity-cell">
                <strong>{{ record.name }}</strong>
                <code>#{{ record.id }} · v{{ record.version || '—' }}</code>
              </div>
            </template>
            <template slot="scenarioApplication" slot-scope="record">
              <div class="identity-cell">
                <strong>{{ scenarioApplicationName(record) }}</strong>
                <code>应用系统:{{ scenarioApplicationID(record) || '—' }}</code>
              </div>
            </template>
            <template slot="scenarioClass" slot-scope="record">
              <a-tag :color="classMeta(scenarioAssetClass(record)).color">{{ classMeta(scenarioAssetClass(record)).label }}</a-tag>
              <code class="inline-code">{{ scenarioAssetClass(record) || '—' }}</code>
            </template>
            <template slot="scenarioPolicy" slot-scope="record">
              <strong>{{ record.target_host_group || record.target_host_group_name || '—' }}</strong><br />
              <span class="muted">{{ record.template_name || `监控模板 ${record.template_id || '—'}` }} · 监控源编号 {{ record.zid || '—' }}</span>
              <small v-if="record.agentless_profile_id" class="inline-code" data-testid="configuration-agentless-snapshot">免代理采集 · {{ record.agentless_profile_id }}</small>
            </template>
            <template slot="scenarioContext" slot-scope="record">
              <code>组织编号 {{ record.organization_id || record.itop_organization_id || '—' }}</code><br />
              <code>组织映射版本 {{ record.mapping_generation || record.generation || '—' }}</code>
            </template>
            <template slot="scenarioState" slot-scope="record">
              <a-badge :status="record.enabled ? 'success' : 'default'" :text="record.enabled ? '已启用' : '已停用'" />
            </template>
            <template slot="scenarioOperation" slot-scope="record">
              <template v-if="scenarioScope === 'current' && writeContextReady">
                <a-button v-if="canUpdate" data-testid="configuration-scenario-edit" type="link" size="small" @click="openEdit(record)">编辑</a-button>
                <a-popconfirm v-if="canDelete" title="仅未被任务使用的场景可删除，确认继续？" @confirm="removeScenario(record)">
                  <a-button data-testid="configuration-scenario-delete" type="link" size="small">删除</a-button>
                </a-popconfirm>
                <span v-if="!canUpdate && !canDelete" class="readonly-label">只读</span>
              </template>
              <span v-else class="readonly-label"><a-icon type="lock" /> 只读</span>
            </template>
          </a-table>
          <footer class="table-footer">
            <span>{{ scopeCaption(scenarioScope) }} · {{ scenarioPage.total }} 条</span>
            <a-pagination
              data-testid="configuration-scenario-pagination"
              :current="scenarioPage.page"
              :page-size="scenarioPage.page_size"
              :total="scenarioPage.total"
              :show-less-items="true"
              @change="changeScenarioPage"
            />
          </footer>
        </section>

        <section class="section-card">
          <div class="section-heading">
            <div>
              <p class="section-kicker">配置执行记录</p>
              <h2>执行记录</h2>
              <span>保留本次任务的资产、监控主机和执行结果，便于核对与追溯</span>
            </div>
            <div class="task-heading-tools">
              <a-tag :color="activeTasks ? 'orange' : 'green'">{{ activeTasks ? `${activeTasks} 个处理中` : '当前无待处理' }}</a-tag>
              <a-radio-group v-model="taskScope" button-style="solid" size="small" @change="changeTaskScope">
                <a-radio-button v-for="scope in scopes" :key="scope.value" :value="scope.value">{{ scope.label }}</a-radio-button>
              </a-radio-group>
            </div>
          </div>
          <p v-if="taskScope !== 'current'" class="frozen-note">
            <a-icon type="lock" /> {{ scopeCaption(taskScope) }}，任务仅用于审计追溯，不会重新进入后台执行器。
          </p>
          <a-table
            :columns="taskColumns"
            :data-source="taskPage.items"
            :loading="tasksLoading"
            :pagination="false"
            :row-key="record => record.id"
            :scroll="{x: 1360}"
          >
            <template slot="taskCI" slot-scope="record">
              <div class="identity-cell">
                <strong>{{ taskCIIdentity(record).name }}</strong>
                <code>{{ classMeta(taskCIIdentity(record).class).label }} #{{ taskCIIdentity(record).id || '—' }}</code>
                <details class="technical-details"><summary>查看资产版本</summary><small>{{ taskCIIdentity(record).revision }}</small></details>
              </div>
            </template>
            <template slot="taskScenario" slot-scope="record">
              <div class="identity-cell">
                <strong>{{ record.scenario_name || record.scenario && record.scenario.name || '—' }}</strong>
                <code>#{{ record.scenario_id || '—' }} · v{{ record.scenario_version || record.scenario && record.scenario.version || '—' }}</code>
              </div>
            </template>
            <template slot="taskHost" slot-scope="record">
              <div class="identity-cell">
                <strong>{{ taskHostSnapshot(record).host_name }}</strong>
                <code>监控源编号 {{ taskHostSnapshot(record).zid || '—' }} · 监控主机 {{ taskHostSnapshot(record).host_id }}</code>
                <small>{{ taskHostSnapshot(record).instance_name }}</small>
              </div>
            </template>
            <template slot="taskStatus" slot-scope="record">
              <a-tag :color="statusMeta(record.status).color">{{ statusMeta(record.status).label }}</a-tag>
              <small v-if="record.retry_count !== undefined" class="retry-count">{{ record.retry_count || 0 }}/{{ record.max_retry || 3 }}</small>
            </template>
            <template slot="taskReason" slot-scope="record">
              <div v-if="record.error_reason || record.error_code || record.reason || record.error_message" class="reason-cell">
                <details class="technical-details"><summary>诊断代码</summary><code>{{ record.error_reason || record.error_code || record.reason || 'execution_failed' }}</code></details>
                <span>{{ taskFailureMessage(record) }}</span>
              </div>
              <span v-else class="muted">—</span>
            </template>
            <template slot="taskContext" slot-scope="record">
              <code>组织编号 {{ record.organization_id || record.itop_organization_id || '—' }}</code><br />
              <code>组织映射版本 {{ record.mapping_generation || record.generation || '—' }}</code><br />
              <small>任务版本 {{ record.version || '—' }}</small>
            </template>
            <template slot="taskTime" slot-scope="record">{{ formatTime(record.applied_at || record.updated_at || record.requested_at) }}</template>
            <template slot="taskOperation" slot-scope="record">
              <a-button
                v-if="taskScope === 'current' && canOperate && writeContextReady && retryableConfigurationTask(record)"
                data-testid="configuration-task-retry"
                type="link"
                size="small"
                @click="retry(record)"
              >重新入队</a-button>
              <span v-else class="readonly-label"><a-icon type="lock" /> 只读</span>
            </template>
          </a-table>
          <footer class="table-footer">
            <span>{{ scopeCaption(taskScope) }} · {{ taskPage.total }} 条</span>
            <a-pagination
              data-testid="configuration-task-pagination"
              :current="taskPage.page"
              :page-size="taskPage.page_size"
              :total="taskPage.total"
              :show-less-items="true"
              @change="changeTaskPage"
            />
          </footer>
        </section>
      </template>
    </div>

    <a-modal
      v-if="scenarioScope === 'current' && canCreate && writeContextReady"
      :visible="scenarioVisible"
      :title="editingScenario ? '编辑场景策略' : '新建场景策略'"
      :confirm-loading="saving"
      width="760px"
      @ok="saveScenario"
      @cancel="closeScenario"
    >
      <a-alert class="modal-alert" type="info" show-icon message="应用系统和配置项类型来自当前配置组织；创建后不可变更。" />
      <a-alert v-if="scenarioError" class="modal-alert" type="error" show-icon :message="scenarioError" />
      <a-form-model layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-model-item label="场景名称">
              <a-input v-model.trim="scenarioForm.name" placeholder="例如：交易系统 Linux 标准监控" />
            </a-form-model-item>
          </a-col>
          <a-col :span="12">
            <a-form-model-item label="应用系统">
              <a-select
                v-model="scenarioForm.application_id"
                :disabled="Boolean(editingScenario)"
                show-search
                option-filter-prop="children"
                placeholder="选择当前配置组织的活动应用"
              >
                <a-select-option v-for="item in applications" :key="Number(item.id)" :value="Number(item.id)">{{ item.name }}（应用系统:{{ item.id }}）</a-select-option>
              </a-select>
            </a-form-model-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-model-item label="配置项类型">
              <a-select v-model="scenarioForm.asset_class" :disabled="Boolean(editingScenario)" placeholder="选择配置项类型" @change="clearAgentlessSelection">
                <a-select-option v-for="item in assetClasses" :key="item.value" :value="item.value">{{ item.label }}（{{ item.value }}）</a-select-option>
              </a-select>
            </a-form-model-item>
          </a-col>
          <a-col :span="12">
            <a-form-model-item label="目标主机组（当前租户范围）">
              <a-select v-model="selectedGroupKey" show-search option-filter-prop="children" placeholder="选择主机组" @change="selectGroup">
                <a-select-option v-for="group in resources.host_groups" :key="groupKey(group)" :value="groupKey(group)">{{ group.host_group_name }}（{{ group.instance_name }}）</a-select-option>
              </a-select>
            </a-form-model-item>
          </a-col>
        </a-row>
        <a-form-model-item label="接入档案">
          <a-select
            v-model="scenarioForm.agentless_profile_id"
            data-testid="configuration-agentless-profile"
            :disabled="!scenarioForm.zid || !scenarioForm.asset_class"
            @change="selectAgentlessProfile"
          >
            <a-select-option value="">现有 Agent / 仅应用模板</a-select-option>
            <a-select-option v-for="profile in filteredAgentlessProfiles" :key="profile.id" :value="profile.id">
              {{ profile.name }} · {{ agentlessProtocolLabel(profile.protocol) }}
            </a-select-option>
            <a-select-option v-if="scenarioForm.agentless_profile_id && !selectedAgentlessProfile" :value="scenarioForm.agentless_profile_id" disabled>原档案已不可用，请重新选择</a-select-option>
          </a-select>
          <p class="muted">免代理采集档案由平台运维配置；目标来自配置项管理 IP，密钥不进入浏览器。</p>
          <p v-if="resources.agentless_state === 'unavailable'" class="muted">服务端接入档案读取失败；已有 Agent 场景不受影响。</p>
          <p v-else-if="!filteredAgentlessProfiles.length" class="muted">当前实例与配置项类型没有可用免代理采集档案。</p>
          <a-alert v-if="agentlessSelectionWarning" type="warning" show-icon :message="agentlessSelectionWarning" />
        </a-form-model-item>
        <a-form-model-item label="监控模板">
          <a-select v-model="scenarioForm.template_id" :disabled="!scenarioForm.zid || Boolean(scenarioForm.agentless_profile_id)" show-search option-filter-prop="children" placeholder="选择同一监控源的监控模板">
            <a-select-option v-for="item in filteredTemplates" :key="String(item.template_id)" :value="String(item.template_id)">{{ item.template_name }}</a-select-option>
          </a-select>
        </a-form-model-item>
        <a-form-model-item label="场景状态">
          <a-switch v-model="scenarioForm.enabled" checked-children="启用" un-checked-children="停用" />
        </a-form-model-item>
      </a-form-model>
    </a-modal>

    <a-modal
      v-if="scenarioScope === 'current' && canOperate && writeContextReady"
      :visible="applyVisible"
      :confirm-loading="applying"
      :ok-button-props="{props: {disabled: !applyReady}}"
      title="从配置项应用场景"
      width="1040px"
      ok-text="建立任务快照"
      @ok="applyScenario"
      @cancel="closeApply"
    >
      <a-alert v-if="applyError" class="modal-alert" type="error" show-icon :message="applyError" />
      <div class="apply-layout">
        <section class="apply-picker">
          <a-form-model layout="vertical">
            <a-form-model-item label="场景策略">
              <a-select v-model="applyForm.scenario_id" placeholder="先选择当前配置组织的启用场景" @change="selectApplyScenario">
                <a-select-option v-for="item in applicableScenarios" :key="item.id" :value="item.id">{{ item.name }} · {{ scenarioApplicationName(item) }} · {{ scenarioAssetClass(item) }}</a-select-option>
              </a-select>
            </a-form-model-item>
          </a-form-model>
          <a-input-search
            v-model.trim="assetSearch"
            :disabled="!selectedApplyScenario"
            allow-clear
            placeholder="搜索配置项名称、IP 或资产编号"
            @search="searchApplyAssets"
          />
          <a-table
            class="asset-picker-table"
            :columns="assetColumns"
            :custom-row="applyAssetRow"
            :data-source="applyAssetPage.items"
            :loading="assetsLoading"
            :pagination="false"
            :row-class-name="applyAssetRowClass"
            :row-key="assetKey"
            size="small"
          >
            <template slot="assetName" slot-scope="record">
              <div class="identity-cell">
                <strong>{{ record.name }}</strong>
                <code>{{ classMeta(record.class).label }} #{{ record.id }}</code>
              </div>
            </template>
            <template slot="assetRevision" slot-scope="record"><details class="technical-details"><summary>查看资产版本</summary><code>{{ record.revision || '详情加载后确认' }}</code></details></template>
          </a-table>
          <footer class="table-footer table-footer--compact">
            <span>{{ applyAssetPage.total }} 个配置项</span>
            <a-pagination
              data-testid="configuration-asset-pagination"
              :current="applyAssetPage.page"
              :page-size="applyAssetPage.page_size"
              :total="applyAssetPage.total"
              :show-less-items="true"
              size="small"
              @change="changeApplyAssetPage"
            />
          </footer>
        </section>

        <aside class="apply-inspector">
          <div v-if="!selectedApplyAsset" class="inspector-empty">
            <a-icon type="select" />
            <strong>选择一个配置项</strong>
            <span>将实时读取资产版本、应用系统关系和绑定主机。</span>
          </div>
          <a-spin v-else :spinning="assetDetailLoading">
            <div class="selected-identity">
              <a-tag :color="classMeta(selectedApplyAsset.class).color">{{ classMeta(selectedApplyAsset.class).label }}</a-tag>
              <h3>{{ selectedApplyAsset.name }}</h3>
              <details class="technical-details"><summary>查看资产版本</summary><code>{{ assetKey(selectedApplyAsset) }} · {{ selectedApplyAsset.revision || '—' }}</code></details>
            </div>
            <div class="selection-rail">
              <div>
                <span>配置项</span>
                <strong>{{ classMeta(selectedApplyAsset.class).label }} #{{ selectedApplyAsset.id }}</strong>
                <details class="technical-details"><summary>查看资产版本</summary><small>{{ selectedApplyAsset.revision || '—' }}</small></details>
              </div>
              <a-icon type="arrow-down" />
              <div>
                <span>应用系统</span>
                <strong>{{ selectedApplicationNames }}</strong>
                <small>{{ selectedApplicationIDs }}</small>
              </div>
              <a-icon type="arrow-down" />
              <div :class="{'selection-node--missing': !selectedMonitoring.bound}">
                <span>绑定主机</span>
                <strong>{{ selectedMonitoring.host_name || '未绑定' }}</strong>
                <small v-if="selectedMonitoring.bound">{{ selectedMonitoring.instance_name || `监控源编号 ${selectedMonitoring.zid}` }} · 监控主机 {{ selectedMonitoring.host_id }} · 关联编号 {{ selectedMonitoring.binding_id || '—' }} · {{ formatTime(selectedMonitoring.binding_updated_at) }}</small>
                <small v-else>请先在资产配置中心完成监控关联</small>
              </div>
            </div>
            <a-alert :type="applyEligibilityState.ready ? 'success' : 'warning'" show-icon :message="applyEligibilityState.message" />
          </a-spin>
        </aside>
      </div>
    </a-modal>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import {
  applyConfigurationScenario,
  configurationResources,
  configurationScenarioList,
  configurationTaskList,
  createConfigurationScenario,
  deleteConfigurationScenario,
  retryConfigurationTask,
  updateConfigurationScenario,
} from '@/services/admin'
import {getCMDBAsset, getCMDBMonitoring, getCMDBOverview, getCMDBRelations, listCMDBAssets} from '@/services/cmdb'
import {assetKey, classMeta, normalizeCMDBContext} from '@/pages/cmdb/cmdb-model'
import {tenantContextChangingEvent} from '@/utils/request'
import {
  CONFIGURATION_SCOPES,
  agentlessProfilesForScenario,
  agentlessSelectionPayload,
  agentlessProtocolLabel,
  applyEligibility,
  configurationContextKey,
  configurationFailureMessage,
  emptyConfigurationPage,
  monitoringIdentity,
  normalizeConfigurationPage,
  relationApplications,
  retryableConfigurationTask,
  scenarioApplicationID,
  scenarioApplicationName,
  scenarioAssetClass,
  taskCIIdentity,
  taskHostSnapshot,
} from './config-consumption-model'

const {canPerform} = require('@/utils/permission-policy')

const emptyScenario = () => ({
  name: '', application_id: undefined, asset_class: undefined, zid: 0,
  target_host_group_id: '', template_id: undefined, enabled: true,
  agentless_profile_id: '', expected_agentless_digest: '',
})
const emptyResources = () => ({host_groups: [], templates: [], applications: [], asset_classes: [], agentless_profiles: [], agentless_state: 'unconfigured'})
const emptyApplyForm = () => ({scenario_id: undefined})

export default {
  name: 'ConfigConsumption',
  components: {PageLayout},
  data() {
    return {
      loading: false,
      scenariosLoading: false,
      tasksLoading: false,
      assetsLoading: false,
      assetDetailLoading: false,
      saving: false,
      applying: false,
      overview: {state: 'loading', message: '', organization: null, mapping: null},
      activeCMDBContextKey: '',
      overviewSequence: 0,
      resourceSequence: 0,
      scenarioSequence: 0,
      taskSequence: 0,
      assetSequence: 0,
      assetDetailSequence: 0,
      resources: emptyResources(),
      scopes: CONFIGURATION_SCOPES,
      scenarioScope: 'current',
      taskScope: 'current',
      scenarioPage: emptyConfigurationPage('current', 20),
      taskPage: emptyConfigurationPage('current', 20),
      scenarioVisible: false,
      editingScenario: null,
      scenarioForm: emptyScenario(),
      selectedGroupKey: '',
      scenarioError: '',
      applyVisible: false,
      applyForm: emptyApplyForm(),
      applyAssetPage: emptyConfigurationPage('current', 10),
      assetSearch: '',
      selectedApplyAsset: null,
      selectedRelations: {nodes: [], edges: []},
      selectedApplications: [],
      selectedMonitoring: monitoringIdentity(),
      applyError: '',
      timer: null,
      scenarioColumns: [
        {title: '场景', key: 'scenarioIdentity', scopedSlots: {customRender: 'scenarioIdentity'}, width: 180},
        {title: '应用系统', key: 'scenarioApplication', scopedSlots: {customRender: 'scenarioApplication'}, width: 235},
        {title: '配置项类型', key: 'scenarioClass', scopedSlots: {customRender: 'scenarioClass'}, width: 170},
        {title: '监控中心策略', key: 'scenarioPolicy', scopedSlots: {customRender: 'scenarioPolicy'}, width: 250},
        {title: '配置组织上下文', key: 'scenarioContext', scopedSlots: {customRender: 'scenarioContext'}, width: 150},
        {title: '状态', key: 'scenarioState', scopedSlots: {customRender: 'scenarioState'}, width: 95},
        {title: '操作', key: 'scenarioOperation', scopedSlots: {customRender: 'scenarioOperation'}, width: 125},
      ],
      taskColumns: [
        {title: '配置项快照', key: 'taskCI', scopedSlots: {customRender: 'taskCI'}, width: 225},
        {title: '场景版本', key: 'taskScenario', scopedSlots: {customRender: 'taskScenario'}, width: 180},
        {title: '绑定主机快照', key: 'taskHost', scopedSlots: {customRender: 'taskHost'}, width: 235},
        {title: '状态', key: 'taskStatus', scopedSlots: {customRender: 'taskStatus'}, width: 125},
        {title: '原因 / 下一步', key: 'taskReason', scopedSlots: {customRender: 'taskReason'}, width: 310},
        {title: '配置组织上下文', key: 'taskContext', scopedSlots: {customRender: 'taskContext'}, width: 145},
        {title: '最近处理', key: 'taskTime', scopedSlots: {customRender: 'taskTime'}, width: 170},
        {title: '操作', key: 'taskOperation', scopedSlots: {customRender: 'taskOperation'}, width: 110},
      ],
      assetColumns: [
        {title: '配置项', key: 'assetName', scopedSlots: {customRender: 'assetName'}},
        {title: '资产版本', key: 'assetRevision', scopedSlots: {customRender: 'assetRevision'}, width: 120},
      ],
    }
  },
  computed: {
    permissions() { return this.$store.getters['account/permissions'] || [] },
    currentTenant() { return this.$store.getters['account/currentTenant'] || {} },
    currentTenantID() { return Number(this.currentTenant.id) || 0 },
    canCreate() { return canPerform(this.permissions, 'tenant.assets', 'create') },
    canUpdate() { return canPerform(this.permissions, 'tenant.assets', 'update') },
    canDelete() { return canPerform(this.permissions, 'tenant.assets', 'delete') },
    canOperate() { return canPerform(this.permissions, 'tenant.assets', 'operate') || this.canUpdate },
    sourceReady() { return this.overview.state === 'ready' },
    cmdbContext() { return normalizeCMDBContext(this.overview, this.currentTenantID) },
    writeContextReady() { return this.cmdbContext.ready && this.activeCMDBContextKey === this.cmdbContext.key },
    organizationName() {
      const organization = this.overview.organization || {}
      if (organization.name) return organization.name
      if (this.overview.state === 'unconfigured') return '未配置'
      if (this.overview.state === 'error') return '读取失败'
      return '—'
    },
    organizationCode() {
      const organization = this.overview.organization || {}
      return organization.code || organization.organization_code || '—'
    },
    sourceBadge() {
      if (this.loading || this.overview.state === 'loading') return {status: 'processing', label: '读取中'}
      if (this.writeContextReady) return {status: 'success', label: '已锁定'}
      if (this.overview.state === 'unconfigured') return {status: 'warning', label: '待映射'}
      return {status: 'error', label: '不可写'}
    },
    sourceBoundaryCopy() {
      return this.writeContextReady ? '租户 + 配置组织 + 组织映射版本' : '未建立可写上下文'
    },
    applications() {
      const source = this.resources || {}
      const items = source.applications || source.application_solutions || []
      return Array.isArray(items) ? items.filter(item => !item.status || ['active', 'production'].includes(String(item.status))) : []
    },
    assetClasses() {
      const source = this.resources || {}
      const items = source.asset_classes || source.classes || []
      if (!Array.isArray(items)) return []
      return items.map(item => {
        const value = typeof item === 'string' ? item : String(item.value || item.class || item.code || '')
        const label = typeof item === 'string' ? classMeta(item).label : String(item.label || item.name || classMeta(value).label)
        return {value, label}
      }).filter(item => item.value)
    },
    filteredTemplates() {
      return (this.resources.templates || []).filter(item => Number(item.zid) === Number(this.scenarioForm.zid))
    },
    filteredAgentlessProfiles() {
      return agentlessProfilesForScenario(this.resources, this.scenarioForm.zid, this.scenarioForm.asset_class)
    },
    selectedAgentlessProfile() {
      return this.filteredAgentlessProfiles.find(item => item.id === this.scenarioForm.agentless_profile_id) || null
    },
    agentlessSelectionWarning() {
      try { agentlessSelectionPayload(this.scenarioForm, this.resources); return '' }
      catch (error) { return error.message }
    },
    applicableScenarios() {
      return this.scenarioScope === 'current' ? this.scenarioPage.items.filter(item => item.enabled && !this.recordFrozen(item)) : []
    },
    selectedApplyScenario() {
      return this.applicableScenarios.find(item => Number(item.id) === Number(this.applyForm.scenario_id)) || null
    },
    activeTasks() {
      if (this.taskScope !== 'current') return 0
      return this.taskPage.items.filter(item => ['pending', 'running', 'claimed'].includes(String(item.status))).length
    },
    selectedApplicationNames() {
      return this.selectedApplications.length ? this.selectedApplications.map(item => item.name || `ApplicationSolution ${item.id}`).join(' · ') : '未找到直接应用关系'
    },
    selectedApplicationIDs() {
      return this.selectedApplications.length ? this.selectedApplications.map(item => `ApplicationSolution:${item.id}`).join(' · ') : '—'
    },
    applyEligibilityState() {
      return applyEligibility(this.selectedApplyAsset, this.selectedApplications, {
        binding: this.selectedMonitoring.binding,
        host: this.selectedMonitoring.host,
      }, this.selectedApplyScenario)
    },
    applyReady() { return this.writeContextReady && this.applyEligibilityState.ready && !this.assetDetailLoading },
  },
  watch: {
    currentTenantID(next, previous) {
      if (previous && next !== previous) {
        this.invalidateContext('租户上下文已切换，旧的监控配置表单已关闭。')
        this.refreshAll()
      }
    },
  },
  created() {
    if (typeof window !== 'undefined') window.addEventListener(tenantContextChangingEvent, this.handleTenantContextChanging)
    this.refreshAll()
    if (typeof window !== 'undefined') this.timer = window.setInterval(() => {
      this.pollContext()
      if (this.sourceReady && this.taskScope === 'current' && !this.applyVisible && !this.scenarioVisible) this.loadTasks(this.taskPage.page, true)
    }, 5000)
  },
  beforeDestroy() {
    if (typeof window !== 'undefined') window.removeEventListener(tenantContextChangingEvent, this.handleTenantContextChanging)
    if (this.timer && typeof window !== 'undefined') window.clearInterval(this.timer)
  },
  methods: {
    agentlessProtocolLabel,
    assetKey,
    classMeta,
    retryableConfigurationTask,
    scenarioApplicationID,
    scenarioApplicationName,
    scenarioAssetClass,
    taskCIIdentity,
    taskHostSnapshot,
    unwrap(response) {
      const result = response && response.data
      if (!result || Number(result.code) !== 200) {
        const error = new Error(result && result.message || '请求失败')
        error.businessCode = Number(result && result.code) || 0
        error.businessData = result && result.data
        error.businessReason = result && result.data && (result.data.reason || result.data.error_code)
        throw error
      }
      return result.data
    },
    failure(error, fallback) {
      const payload = error && error.data && typeof error.data === 'object' ? error.data : {}
      const data = error && error.businessData || payload.data || {}
      const reason = String(error && error.businessReason || data.reason || data.error_code || '')
      return {reason, message: configurationFailureMessage(reason, payload.message || error && error.message || fallback)}
    },
    handleContextFailure(error, fallback) {
      const failure = this.failure(error, fallback)
      if (['configuration_context_stale', 'cmdb_context_mismatch', 'mapping_context_stale', 'mapping_generation_mismatch', 'mapping_transition_in_progress'].includes(failure.reason)) {
        this.invalidateContext(failure.message)
        this.refreshAll()
      }
      return failure
    },
    configurationResponseIsCurrent(data) {
      const responseKey = configurationContextKey(data && data.context, this.currentTenantID)
      if (responseKey && responseKey === this.activeCMDBContextKey) return true
      this.invalidateContext('监控配置响应属于旧配置组织或组织映射版本，已丢弃并重新读取。')
      this.refreshAll()
      return false
    },
    overviewResponseIsCurrent(response) {
      const overview = this.unwrap(response) || {}
      const context = normalizeCMDBContext(overview, this.currentTenantID)
      if (context.ready && context.key === this.activeCMDBContextKey) return true
      this.invalidateContext('配置组织或组织映射版本已在其他会话中变化，旧表单已关闭。')
      this.refreshAll()
      return false
    },
    async pollContext() {
      const contextKey = this.activeCMDBContextKey
      const tenantID = this.currentTenantID
      if (!contextKey || !tenantID) return
      try {
        const overview = this.unwrap(await getCMDBOverview()) || {}
        if (contextKey !== this.activeCMDBContextKey || tenantID !== this.currentTenantID) return
        const context = normalizeCMDBContext(overview, tenantID)
        if (!context.ready || context.key !== contextKey) {
          this.invalidateContext('配置组织或组织映射版本已在其他会话中变化，旧表单已关闭。')
          this.refreshAll()
        }
      } catch {
        // A transient context probe must not erase an otherwise usable read-only ledger.
      }
    },
    writeContext() {
      if (!this.writeContextReady) throw new Error('配置组织 上下文未就绪，请刷新后重试。')
      return {organization_id: this.cmdbContext.organization_id, generation: this.cmdbContext.generation, key: this.cmdbContext.key}
    },
    contextIsCurrent(context) {
      return Boolean(context && context.key) && context.key === this.activeCMDBContextKey && context.key === this.cmdbContext.key
    },
    resetWorkspaces() {
      this.resourceSequence += 1
      this.scenarioSequence += 1
      this.taskSequence += 1
      this.assetSequence += 1
      this.assetDetailSequence += 1
      this.scenarioVisible = false
      this.editingScenario = null
      this.scenarioForm = emptyScenario()
      this.selectedGroupKey = ''
      this.scenarioError = ''
      this.applyVisible = false
      this.applyForm = emptyApplyForm()
      this.applyAssetPage = emptyConfigurationPage('current', 10)
      this.assetSearch = ''
      this.clearApplySelection()
      this.resources = emptyResources()
      this.scenarioPage = emptyConfigurationPage(this.scenarioScope, 20)
      this.taskPage = emptyConfigurationPage(this.taskScope, 20)
    },
    invalidateContext(message) {
      this.overviewSequence += 1
      this.activeCMDBContextKey = ''
      this.overview = {state: 'loading', message: '', organization: null, mapping: null}
      this.resetWorkspaces()
      if (message) this.$message.warning(message)
    },
    handleTenantContextChanging(event) {
      const targetID = Number(event && event.detail && event.detail.tenant && event.detail.tenant.id) || 0
      if (!targetID || targetID !== this.currentTenantID) {
        this.invalidateContext('租户正在切换，已关闭旧配置组织下的写入表单。')
        return
      }
      if (!this.activeCMDBContextKey) this.$nextTick(() => {
        if (!this.activeCMDBContextKey && targetID === this.currentTenantID) this.refreshAll()
      })
    },
    async refreshAll() {
      const sequence = ++this.overviewSequence
      const tenantID = this.currentTenantID
      this.loading = true
      try {
        const overview = this.unwrap(await getCMDBOverview()) || {state: 'error'}
        if (sequence !== this.overviewSequence || tenantID !== this.currentTenantID) return
        const nextContext = normalizeCMDBContext(overview, tenantID)
        if (this.activeCMDBContextKey && nextContext.key && this.activeCMDBContextKey !== nextContext.key) this.resetWorkspaces()
        this.overview = overview
        this.activeCMDBContextKey = nextContext.key
        if (overview.state === 'ready') {
          await Promise.all([
            this.loadResources(),
            this.loadScenarios(this.scenarioPage.page || 1),
            this.loadTasks(this.taskPage.page || 1, true),
          ])
        } else {
          this.resetWorkspaces()
        }
      } catch (error) {
        if (sequence !== this.overviewSequence || tenantID !== this.currentTenantID) return
        this.overview = {state: 'error', message: error.message, organization: null, mapping: null}
        this.activeCMDBContextKey = ''
        this.resetWorkspaces()
        this.$message.error(error.message || '监控配置上下文加载失败')
      } finally {
        if (sequence === this.overviewSequence) this.loading = false
      }
    },
    async loadResources() {
      const sequence = ++this.resourceSequence
      const contextKey = this.activeCMDBContextKey
      try {
        const data = this.unwrap(await configurationResources()) || emptyResources()
        if (sequence !== this.resourceSequence || contextKey !== this.activeCMDBContextKey) return
        if (!this.configurationResponseIsCurrent(data)) return
        this.resources = {...emptyResources(), ...data}
      } catch (error) {
        if (sequence !== this.resourceSequence || contextKey !== this.activeCMDBContextKey) return
        this.$message.error(error.message || '场景权威资源加载失败')
      }
    },
    async loadScenarios(page) {
      const sequence = ++this.scenarioSequence
      const contextKey = this.activeCMDBContextKey
      const scope = this.scenarioScope
      this.scenariosLoading = true
      try {
        const data = this.unwrap(await configurationScenarioList({scope, page: page || 1, page_size: this.scenarioPage.page_size || 20}))
        if (sequence !== this.scenarioSequence || contextKey !== this.activeCMDBContextKey || scope !== this.scenarioScope) return
        if (!this.configurationResponseIsCurrent(data)) return
        this.scenarioPage = normalizeConfigurationPage(data, scope, 20)
      } catch (error) {
        if (sequence !== this.scenarioSequence || contextKey !== this.activeCMDBContextKey) return
        this.$message.error(error.message || '场景列表加载失败')
      } finally {
        if (sequence === this.scenarioSequence) this.scenariosLoading = false
      }
    },
    async loadTasks(page, silent) {
      const sequence = ++this.taskSequence
      const contextKey = this.activeCMDBContextKey
      const scope = this.taskScope
      if (!silent) this.tasksLoading = true
      try {
        const data = this.unwrap(await configurationTaskList({scope, page: page || 1, page_size: this.taskPage.page_size || 20}))
        if (sequence !== this.taskSequence || contextKey !== this.activeCMDBContextKey || scope !== this.taskScope) return
        if (!this.configurationResponseIsCurrent(data)) return
        this.taskPage = normalizeConfigurationPage(data, scope, 20)
      } catch (error) {
        if (sequence !== this.taskSequence || contextKey !== this.activeCMDBContextKey) return
        if (!silent) this.$message.error(error.message || '执行记录加载失败')
      } finally {
        if (sequence === this.taskSequence) this.tasksLoading = false
      }
    },
    changeScenarioScope() {
      this.closeScenario()
      this.closeApply()
      this.scenarioPage = emptyConfigurationPage(this.scenarioScope, 20)
      this.loadScenarios(1)
    },
    changeTaskScope() {
      this.taskPage = emptyConfigurationPage(this.taskScope, 20)
      this.loadTasks(1)
    },
    changeScenarioPage(page) { this.loadScenarios(page) },
    changeTaskPage(page) { this.loadTasks(page) },
    scopeCaption(value) {
      const scope = this.scopes.find(item => item.value === value)
      return scope ? scope.caption : value
    },
    recordFrozen(record) {
      const state = String(record && (record.record_state || record.context_state || record.scope || 'current'))
      return state === 'archive' || state === 'archived' || state === 'legacy' || state === 'legacy_frozen'
    },
    groupKey(group) { return `${group.zid}:${group.host_group_id}` },
    selectGroup(key) {
      const group = (this.resources.host_groups || []).find(item => this.groupKey(item) === key)
      if (!group) return
      const changedInstance = Number(this.scenarioForm.zid) !== Number(group.zid)
      this.scenarioForm.zid = Number(group.zid)
      this.scenarioForm.target_host_group_id = String(group.host_group_id)
      if (changedInstance) {
        this.scenarioForm.template_id = undefined
        this.clearAgentlessSelection()
      }
    },
    clearAgentlessSelection() {
      this.scenarioForm.agentless_profile_id = ''
      this.scenarioForm.expected_agentless_digest = ''
    },
    selectAgentlessProfile(id) {
      const profile = this.filteredAgentlessProfiles.find(item => item.id === id)
      this.scenarioForm.expected_agentless_digest = profile ? profile.digest : ''
      if (profile) this.scenarioForm.template_id = String(profile.template_id)
    },
    openCreate() {
      if (!this.canCreate || !this.writeContextReady || this.scenarioScope !== 'current') return
      this.editingScenario = null
      this.scenarioForm = emptyScenario()
      this.selectedGroupKey = ''
      this.scenarioError = ''
      this.scenarioVisible = true
    },
    openEdit(record) {
      if (!this.canUpdate || !this.writeContextReady || this.scenarioScope !== 'current' || this.recordFrozen(record)) return
      this.editingScenario = record
      this.scenarioForm = {
        name: String(record.name || ''),
        application_id: scenarioApplicationID(record) || undefined,
        asset_class: scenarioAssetClass(record) || undefined,
        zid: Number(record.zid) || 0,
        target_host_group_id: String(record.target_host_group_id || ''),
        template_id: record.template_id ? String(record.template_id) : undefined,
        enabled: Boolean(record.enabled),
        agentless_profile_id: String(record.agentless_profile_id || ''),
        expected_agentless_digest: String(record.agentless_profile_digest || ''),
      }
      this.selectedGroupKey = `${record.zid}:${record.target_host_group_id}`
      this.scenarioError = ''
      this.scenarioVisible = true
    },
    closeScenario() {
      this.scenarioVisible = false
      this.saving = false
      this.scenarioError = ''
    },
    validateScenario() {
      if (!String(this.scenarioForm.name || '').trim() || String(this.scenarioForm.name).trim().length < 2) return '场景名称至少 2 个字'
      if (!(Number(this.scenarioForm.application_id) > 0)) return '请选择应用系统'
      if (!this.scenarioForm.asset_class) return '请选择配置项类型'
      if (!this.scenarioForm.zid || !this.scenarioForm.target_host_group_id || !this.scenarioForm.template_id) return '请完整选择主机组和监控模板'
      if (this.agentlessSelectionWarning) return this.agentlessSelectionWarning
      return ''
    },
    scenarioPayload() {
      return {
        ...agentlessSelectionPayload(this.scenarioForm, this.resources),
        name: String(this.scenarioForm.name || '').trim(),
        application_id: Number(this.scenarioForm.application_id),
        asset_class: String(this.scenarioForm.asset_class),
        zid: Number(this.scenarioForm.zid),
        target_host_group_id: String(this.scenarioForm.target_host_group_id),
        template_id: String(this.scenarioForm.template_id),
        enabled: Boolean(this.scenarioForm.enabled),
      }
    },
    async saveScenario() {
      const warning = this.validateScenario()
      if (warning) { this.scenarioError = warning; return }
      const context = this.writeContext()
      this.saving = true
      this.scenarioError = ''
      try {
        const payload = this.scenarioPayload()
        if (this.editingScenario) {
          payload.expected_version = Number(this.editingScenario.version)
          this.unwrap(await updateConfigurationScenario(this.editingScenario.id, payload, context))
        } else {
          this.unwrap(await createConfigurationScenario(payload, context))
        }
        if (!this.contextIsCurrent(context)) return
        this.$message.success(this.editingScenario ? '场景已更新' : '场景已创建')
        this.closeScenario()
        await Promise.all([this.loadResources(), this.loadScenarios(1)])
      } catch (error) {
        if (!this.contextIsCurrent(context)) return
        const failure = this.handleContextFailure(error, '场景保存失败')
        this.scenarioError = failure.message
      } finally {
        this.saving = false
      }
    },
    async removeScenario(record) {
      if (!this.canDelete || !this.writeContextReady || this.recordFrozen(record)) return
      const context = this.writeContext()
      try {
        this.unwrap(await deleteConfigurationScenario(record.id, record.version, context))
        if (!this.contextIsCurrent(context)) return
        this.$message.success('场景已删除')
        await this.loadScenarios(this.scenarioPage.page)
      } catch (error) {
        if (!this.contextIsCurrent(context)) return
        const failure = this.handleContextFailure(error, '场景删除失败')
        this.$message.error(failure.message)
      }
    },
    openApply() {
      if (!this.canOperate || !this.writeContextReady || this.scenarioScope !== 'current') return
      this.applyForm = emptyApplyForm()
      this.applyAssetPage = emptyConfigurationPage('current', 10)
      this.assetSearch = ''
      this.applyError = ''
      this.clearApplySelection()
      this.applyVisible = true
    },
    closeApply() {
      this.applyVisible = false
      this.applying = false
      this.applyError = ''
      this.assetSequence += 1
      this.assetDetailSequence += 1
      this.clearApplySelection()
    },
    clearApplySelection() {
      this.selectedApplyAsset = null
      this.selectedRelations = {nodes: [], edges: []}
      this.selectedApplications = []
      this.selectedMonitoring = monitoringIdentity()
    },
    selectApplyScenario() {
      this.assetSearch = ''
      this.applyAssetPage = emptyConfigurationPage('current', 10)
      this.applyError = ''
      this.clearApplySelection()
      if (this.selectedApplyScenario) this.loadApplyAssets(1)
    },
    searchApplyAssets() { this.loadApplyAssets(1) },
    changeApplyAssetPage(page) { this.loadApplyAssets(page) },
    async loadApplyAssets(page) {
      const scenario = this.selectedApplyScenario
      if (!scenario) return
      const sequence = ++this.assetSequence
      const contextKey = this.activeCMDBContextKey
      this.assetsLoading = true
      try {
        const [assetResponse, overviewResponse] = await Promise.all([
          listCMDBAssets({
            class: scenarioAssetClass(scenario),
            search: this.assetSearch || undefined,
            page: page || 1,
            page_size: this.applyAssetPage.page_size || 10,
          }),
          getCMDBOverview(),
        ])
        if (sequence !== this.assetSequence || contextKey !== this.activeCMDBContextKey || Number(scenario.id) !== Number(this.applyForm.scenario_id)) return
        if (!this.overviewResponseIsCurrent(overviewResponse)) return
        const data = this.unwrap(assetResponse)
        this.applyAssetPage = normalizeConfigurationPage(data, 'current', 10)
        this.clearApplySelection()
      } catch (error) {
        if (sequence !== this.assetSequence || contextKey !== this.activeCMDBContextKey) return
        this.applyError = this.failure(error, '配置项列表加载失败').message
      } finally {
        if (sequence === this.assetSequence) this.assetsLoading = false
      }
    },
    applyAssetRow(record) {
      return {on: {click: () => this.selectApplyAsset(record)}}
    },
    applyAssetRowClass(record) {
      return this.selectedApplyAsset && assetKey(record) === assetKey(this.selectedApplyAsset) ? 'asset-row--selected' : 'asset-row'
    },
    async selectApplyAsset(asset) {
      if (!asset || !this.selectedApplyScenario) return
      const sequence = ++this.assetDetailSequence
      const contextKey = this.activeCMDBContextKey
      this.selectedApplyAsset = asset
      this.selectedApplications = []
      this.selectedMonitoring = monitoringIdentity()
      this.assetDetailLoading = true
      this.applyError = ''
      try {
        const [detailResponse, relationResponse, monitoringResponse, overviewResponse] = await Promise.all([
          getCMDBAsset(asset.class, asset.id),
          getCMDBRelations(asset.class, asset.id),
          getCMDBMonitoring(asset.class, asset.id),
          getCMDBOverview(),
        ])
        if (sequence !== this.assetDetailSequence || contextKey !== this.activeCMDBContextKey) return
        if (!this.overviewResponseIsCurrent(overviewResponse)) return
        const detail = this.unwrap(detailResponse) || asset
        const relations = this.unwrap(relationResponse) || {nodes: [], edges: []}
        const monitoring = this.unwrap(monitoringResponse) || {}
        this.selectedApplyAsset = detail
        this.selectedRelations = relations
        this.selectedApplications = relationApplications(relations, detail)
        this.selectedMonitoring = monitoringIdentity(monitoring)
      } catch (error) {
        if (sequence !== this.assetDetailSequence || contextKey !== this.activeCMDBContextKey) return
        this.selectedApplications = []
        this.selectedMonitoring = monitoringIdentity()
        this.applyError = this.failure(error, '配置项身份、关系或监控关联读取失败').message
      } finally {
        if (sequence === this.assetDetailSequence) this.assetDetailLoading = false
      }
    },
    async applyScenario() {
      if (!this.applyReady) { this.applyError = this.applyEligibilityState.message; return }
      const context = this.writeContext()
      const scenario = this.selectedApplyScenario
      const asset = this.selectedApplyAsset
      this.applying = true
      this.applyError = ''
      try {
        this.unwrap(await applyConfigurationScenario(asset.class, asset.id, {
          scenario_id: Number(scenario.id),
          expected_scenario_version: Number(scenario.version),
          expected_revision: String(asset.revision),
        }, context))
        if (!this.contextIsCurrent(context)) return
        this.$message.success('已建立配置项 → 绑定主机不可变快照，任务已入队')
        this.closeApply()
        this.taskScope = 'current'
        await this.loadTasks(1, true)
      } catch (error) {
        if (!this.contextIsCurrent(context)) return
        const failure = this.handleContextFailure(error, '应用场景失败')
        this.applyError = failure.message
      } finally {
        this.applying = false
      }
    },
    taskFailureMessage(record) {
      return configurationFailureMessage(record && (record.error_reason || record.error_code || record.reason), record && record.error_message)
    },
    statusMeta(status) {
      return ({
        pending: {label: '等待执行', color: 'blue'},
        claimed: {label: '已领取', color: 'cyan'},
        running: {label: '执行中', color: 'orange'},
        success: {label: '配置已应用', color: 'green'},
        failed: {label: '失败', color: 'red'},
        blocked: {label: '已阻断', color: 'volcano'},
        archived: {label: '已归档', color: undefined},
        legacy_frozen: {label: '遗留冻结', color: 'gold'},
      })[status] || {label: status || '—', color: undefined}
    },
    formatTime(value) { return value ? new Date(value).toLocaleString('zh-CN', {hour12: false}) : '—' },
    async retry(record) {
      if (!this.canOperate || !this.writeContextReady || this.taskScope !== 'current' || !retryableConfigurationTask(record)) return
      const context = this.writeContext()
      try {
        this.unwrap(await retryConfigurationTask(record.id, record.version, context))
        if (!this.contextIsCurrent(context)) return
        this.$message.success('任务已重新入队')
        await this.loadTasks(this.taskPage.page, true)
      } catch (error) {
        if (!this.contextIsCurrent(context)) return
        const failure = this.handleContextFailure(error, '任务重试失败')
        this.$message.error(failure.message)
      }
    },
  },
}
</script>

<style lang="less" scoped>
.config-consumption { padding: 0 4px 32px; color: #172f4d; }
.config-consumption__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 18px; }
.config-consumption__header h1 { margin: 1px 0 6px; color: #12263f; font-size: 28px; font-weight: 650; letter-spacing: -.4px; }
.config-consumption__header > div:first-child > p:last-child { max-width: 760px; margin: 0; color: #5c7188; }
.page-kicker, .section-kicker { margin: 0; color: #159cab; font-size: 11px; font-weight: 700; letter-spacing: 1.7px; }
.heading-actions { display: flex; flex-shrink: 0; gap: 8px; }
.apply-action { border-color: #159cab; color: #0c7e8a; }
.source-strip { display: grid; grid-template-columns: 1.2fr 1.45fr 1fr 1.45fr; overflow: hidden; margin-bottom: 14px; border: 1px solid #cfdae4; border-radius: 8px; background: #fff; box-shadow: 0 5px 18px rgba(18, 38, 63, .05); }
.source-strip > div { min-width: 0; padding: 15px 18px; border-left: 1px solid #e4ebf0; }
.source-strip > div:first-child { border-left: 0; }
.source-identity { background: #12263f; color: #fff; }
.source-identity span, .source-field > span { display: block; margin-bottom: 4px; color: #7f96aa; font-size: 10px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; }
.source-identity span { color: #69d5de; }
.source-identity strong, .source-field strong { display: block; overflow: hidden; font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }
.source-identity small, .source-field small { display: block; margin-top: 3px; color: #8ca0b3; font-size: 11px; }
.source-identity small { color: #aebdcb; }
.source-field--mono strong, .source-field--mono small, code { font-family: SFMono-Regular, Consolas, 'Liberation Mono', monospace; }
.state-panel { display: flex; align-items: center; gap: 14px; margin: 20px 0; padding: 22px; border: 1px solid; border-radius: 8px; }
.state-panel > .anticon { font-size: 24px; }
.state-panel div { display: flex; flex: 1; flex-direction: column; }
.state-panel span { margin-top: 3px; color: #5c7188; }
.state-panel--warning { border-color: #efd7aa; background: #fffaf0; }
.state-panel--error { border-color: #efc2c0; background: #fff6f5; }
.modal-alert { margin-bottom: 16px; }
.section-card { margin-bottom: 16px; padding: 20px 20px 0; border: 1px solid #dce5ec; border-radius: 8px; background: #fff; box-shadow: 0 4px 16px rgba(18, 38, 63, .045); }
.section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 16px; }
.section-heading h2 { margin: 1px 0 2px; color: #17314e; font-size: 18px; }
.section-heading > div:first-child > span { color: #6a7e91; }
.task-heading-tools { display: flex; align-items: center; gap: 10px; }
.frozen-note { margin: 0 0 14px; padding: 9px 12px; border-left: 3px solid #d99a2b; color: #795d28; background: #fff9ed; }
.identity-cell { display: flex; min-width: 0; flex-direction: column; }
.identity-cell strong { overflow: hidden; color: #1c3854; text-overflow: ellipsis; white-space: nowrap; }
.identity-cell code, .identity-cell small, .reason-cell span, .retry-count { margin-top: 2px; color: #718598; font-size: 11px; }
.inline-code { display: block; margin-top: 4px; color: #6b7f91; font-size: 11px; }
.muted { color: #728598; }
.readonly-label { color: #8a9aa8; font-size: 12px; }
.reason-cell { display: flex; flex-direction: column; }
.reason-cell code { color: #a05d22; font-size: 10px; font-weight: 700; }
.reason-cell span { color: #5c7188; white-space: normal; }
.table-footer { display: flex; align-items: center; justify-content: space-between; min-height: 58px; color: #6f8395; }
.table-footer--compact { min-height: 48px; }
.apply-layout { display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(330px, .92fr); gap: 18px; }
.apply-picker, .apply-inspector { min-width: 0; }
.asset-picker-table { margin-top: 12px; border: 1px solid #e0e7ed; }
.asset-picker-table /deep/ .asset-row { cursor: pointer; }
.asset-picker-table /deep/ .asset-row:hover td { background: #f2f8fa; }
.asset-picker-table /deep/ .asset-row--selected td { background: #e8f6f7 !important; }
.apply-inspector { min-height: 390px; padding: 16px; border: 1px solid #d8e2e9; border-radius: 7px; background: #f7fafc; }
.inspector-empty { display: flex; min-height: 350px; align-items: center; justify-content: center; flex-direction: column; color: #7d91a2; text-align: center; }
.inspector-empty .anticon { margin-bottom: 12px; color: #159cab; font-size: 30px; }
.inspector-empty strong { color: #314f69; }
.inspector-empty span { max-width: 290px; margin-top: 5px; }
.selected-identity { padding-bottom: 13px; border-bottom: 1px solid #dde6ec; }
.selected-identity h3 { margin: 7px 0 2px; color: #17314e; }
.selected-identity code { color: #647b90; font-size: 11px; }
.selection-rail { display: flex; align-items: stretch; flex-direction: column; margin: 14px 0; }
.selection-rail > div { padding: 11px 13px; border-left: 3px solid #159cab; background: #fff; box-shadow: 0 2px 7px rgba(18, 38, 63, .045); }
.selection-rail > div:nth-of-type(2) { border-left-color: #51718e; }
.selection-rail > div:nth-of-type(3) { border-left-color: #d99a2b; }
.selection-rail > .anticon { align-self: center; margin: 5px 0; color: #7b90a2; }
.selection-rail span, .selection-rail small { display: block; color: #7a8fa1; font-size: 10px; }
.selection-rail strong { display: block; margin: 2px 0; color: #213f59; }
.selection-node--missing { border-left-color: #d99a2b !important; background: #fffaf0 !important; }
@media (max-width: 980px) {
  .config-consumption__header, .section-heading { flex-direction: column; }
  .source-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .source-strip > div:nth-child(3) { border-left: 0; border-top: 1px solid #e4ebf0; }
  .source-strip > div:nth-child(4) { border-top: 1px solid #e4ebf0; }
  .apply-layout { grid-template-columns: 1fr; }
}

.technical-details { margin-top: 4px; font-size: 12px; line-height: 1.65; min-width: 0; }
.technical-details summary { cursor: pointer; color: inherit; font-family: inherit; font-weight: 400; }
.technical-details[open] { padding-bottom: 4px; }
.technical-details code, .technical-details small { display: block; overflow-wrap: anywhere; white-space: normal; }
</style>
