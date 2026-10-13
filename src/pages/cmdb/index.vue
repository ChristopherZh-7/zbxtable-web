<template>
  <page-layout :noTitle="true">
    <div class="cmdb-center">
      <header class="smartops-page-heading cmdb-heading">
        <div>
          <p class="cmdb-kicker">资产配置管理</p>
          <h1>资产配置中心</h1>
        </div>
        <div class="heading-actions">
          <a-button :loading="loading" icon="reload" @click="refreshAll">刷新</a-button>
          <a-button v-if="platformAdmin" data-testid="cmdb-mapping-open" icon="setting" @click="openMapping">配置组织映射</a-button>
          <a-button v-if="sourceReady" data-testid="cmdb-admission-open" icon="radar-chart" @click="openAdmissions">发现候选入库</a-button>
          <a-button v-if="canCreate && writeContextReady" type="primary" icon="plus" @click="openCreateAsset">新增资产</a-button>
        </div>
      </header>

      <section class="source-strip" aria-label="CMDB 数据源状态">
        <div class="source-identity">
          <span class="source-strip__eyebrow">配置数据来源</span>
          <strong>配置管理中心</strong>
        </div>
        <div class="source-field">
          <span>连接状态</span>
          <a-badge :status="sourceReady ? 'success' : overview.state === 'unconfigured' ? 'warning' : overview.state === 'error' ? 'error' : 'processing'" :text="sourceStateLabel" />
        </div>
        <div class="source-field">
          <span>当前配置组织</span>
          <strong>{{ organizationName }}</strong>
          <details v-if="organizationIdentity" class="technical-details"><summary>组织技术详情</summary><small>{{ organizationIdentity }}</small></details>
        </div>
        <div class="source-total">
          <span>配置项</span>
          <strong>{{ overview.total || 0 }}</strong>
        </div>
      </section>

      <section v-if="!loading && overview.state === 'unconfigured'" class="cmdb-empty smartops-data-panel">
        <div class="empty-symbol"><a-icon type="disconnect" /></div>
        <h2>当前租户尚未关联配置组织</h2>
        <p>建立映射后，本页只会维护该配置组织下的配置项，不会展示或修改其他客户数据。</p>
        <a-button v-if="platformAdmin" type="primary" icon="link" @click="openMapping">立即配置映射</a-button>
        <a-alert v-else type="info" show-icon message="请联系平台管理员完成 CMDB 组织映射。" />
      </section>

      <section v-else-if="!loading && overview.state === 'error'" class="cmdb-empty cmdb-error smartops-data-panel">
        <div class="empty-symbol"><a-icon type="warning" /></div>
        <h2>CMDB 数据读取失败</h2>
        <p>{{ overview.message || '暂时无法读取配置管理中心，请稍后重试。' }}</p>
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
                  <span><strong>{{ record.name }}</strong><code>{{ classMeta(record.class).label }} #{{ record.id }}</code></span>
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
                  <code>{{ classMeta(selectedAsset.class).label }} #{{ selectedAsset.id }}</code>
                </div>
              </div>

              <div v-if="writeContextReady && (canUpdate || canOperate)" class="inspector-actions">
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
                <div class="inspector-title"><span>配置属性</span><small>详细信息</small></div>
                <dl class="detail-grid">
                  <div v-for="row in selectedDetailRows" :key="row.key" :class="{'detail-wide': row.key === 'description'}">
                    <dt>{{ row.label }}</dt>
                    <dd :class="{'mono-value': ['managementip', 'serialnumber', 'asset_number'].includes(row.key)}">{{ row.value }}</dd>
                  </div>
                </dl>
                <a-empty v-if="!selectedDetailRows.length" :image-style="{height: '42px'}" description="暂无扩展属性" />
              </div>

              <div class="inspector-section monitoring-section">
                <div class="inspector-title"><span>监控状态</span><small>资产 ↔ 监控</small></div>
                <a-spin :spinning="monitoringLoading">
                  <div v-if="monitoringError" class="monitoring-error">
                    <a-alert type="error" show-icon :message="monitoringError" />
                    <a-button size="small" icon="reload" @click="reloadMonitoring">重新对账</a-button>
                  </div>
                  <template v-else>
                    <div class="monitoring-dimensions" aria-label="监控状态维度">
                      <article data-testid="cmdb-binding-reconciliation">
                        <span>绑定对账</span>
                        <a-badge :status="monitoringMeta.status" :text="monitoringMeta.label" />
                        <small>{{ monitoringReconciliation.summary }}</small>
                      </article>
                      <article data-testid="cmdb-monitoring-configuration">
                        <span>配置状态</span>
                        <a-badge :status="monitoringConfigurationBadge.status" :text="monitoringConfigurationBadge.label" />
                        <small>{{ monitoringConfigurationSummary }}</small>
                      </article>
                      <article data-testid="cmdb-collection-health" :data-health-state="collectionHealth.state">
                        <span>采集健康</span>
                        <a-badge :status="collectionHealthBadge.status" :text="collectionHealthBadge.label" />
                        <small>{{ collectionHealth.summary }}</small>
                      </article>
                    </div>

                    <div v-if="monitoringBound" class="monitoring-bridge" :data-tone="monitoringMeta.tone">
                      <div class="bridge-node bridge-node--cmdb">
                        <span>资产期望</span>
                        <strong>{{ monitoringHostStatusLabel(monitoringReconciliation.expected_host_status) }}</strong>
                        <small>{{ selectedLifecycle.retired ? '资产已退役' : '资产在用' }}</small>
                      </div>
                      <div class="bridge-link" aria-hidden="true"><span></span></div>
                      <div class="bridge-node bridge-node--zabbix">
                        <span>监控实际</span>
                        <strong>{{ monitoringHostStatusLabel(monitoringReconciliation.actual_host_status) }}</strong>
                        <small>{{ monitoring.host ? monitoring.host.address || (monitoring.binding && monitoring.binding.origin === 'smartops_created' && monitoring.host.interface_count === 0 ? '无独立接口，采集目标由策略确定' : '未采集地址') : '无法读取主机' }}</small>
                      </div>
                    </div>

                    <div v-if="monitoring.host" class="monitoring-host">
                      <span class="monitoring-host__icon"><a-icon type="monitor" /></span>
                      <span>
                        <strong>{{ monitoring.host.host_name }}</strong>
                        <small>{{ monitoring.host.instance_name }} · 监控主机 {{ monitoring.host.host_id }}</small>
                      </span>
                    </div>
                    <div v-else-if="monitoringBound" class="monitoring-host monitoring-host--stale">
                      <span class="monitoring-host__icon"><a-icon type="disconnect" /></span>
                      <span>
                        <strong>已保存的监控身份不可用</strong>
                        <small>监控源编号 {{ monitoring.binding.zid }} · 监控主机 {{ monitoring.binding.host_id }}</small>
                      </span>
                    </div>
                    <div v-else class="monitoring-unbound">
                      <a-icon type="link" />
                      <span><strong>尚未关联监控主机</strong><small>从当前租户主机组中人工确认对应主机。</small></span>
                    </div>

                    <div v-if="monitoringIssueLabels.length" class="monitoring-issues">
                      <a-tag v-for="issue in monitoringIssueLabels" :key="issue">{{ issue }}</a-tag>
                    </div>

                    <div v-if="monitoringEvidenceReasons.length" class="monitoring-issues monitoring-evidence-reasons">
                      <a-tag v-for="reason in monitoringEvidenceReasons" :key="reason">{{ reason }}</a-tag>
                    </div>

                    <dl class="monitoring-evidence">
                      <div><dt>已启用 / 可用项</dt><dd>{{ collectionHealth.enabled_item_count }} / {{ collectionHealth.supported_item_count }}</dd></div>
                      <div><dt>新鲜 / 陈旧值</dt><dd>{{ collectionHealth.fresh_item_count }} / {{ collectionHealth.stale_item_count }}</dd></div>
                      <div><dt>最近监控值</dt><dd>{{ collectionLastValueLabel }}</dd></div>
                    </dl>

                    <div v-if="canOperate && writeContextReady" class="monitoring-actions">
                      <a-button size="small" icon="link" @click="openMonitoringBinding">{{ monitoringBound ? '更换绑定' : '关联监控主机' }}</a-button>
                      <a-button
                        v-if="monitoringReconciliation.can_repair"
                        size="small"
                        type="primary"
                        icon="tool"
                        :loading="monitoringRepairing"
                        @click="confirmMonitoringRepair"
                      >按 CMDB 状态修复监控</a-button>
                      <a-button v-if="monitoringBound" size="small" type="link" icon="disconnect" @click="confirmMonitoringUnbind">解除关联</a-button>
                    </div>
                    <monitoring-provision
                      v-if="writeContextReady && !detailLoading && selectedAsset && selectedDetail && assetKey(selectedAsset) === assetKey(selectedDetail) && ['Server', 'VirtualMachine', 'NetworkDevice'].includes(selectedAsset.class)"
                      :key="`${cmdbContext.key}/${assetKey(selectedAsset)}`"
                      :asset="selectedDetail"
                      :context="cmdbContext"
                      :writable="canOperate && writeContextReady"
                      :bound="monitoringBound"
                      :retired="selectedLifecycle.retired"
                      :configured="monitoring.configuration && monitoring.configuration.state === 'ready'"
                      @changed="reloadMonitoring"
                      @context-stale="loadOverviewAndAssets"
                    />
                  </template>
                </a-spin>
              </div>

              <div class="inspector-section relation-section">
                <div class="inspector-title"><span>配置关系</span><small>直接关联</small></div>
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
      width="840px"
      :body-style="{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto', padding: '18px 24px 20px' }"
      :ok-text="assetEditing ? '保存修改' : '新增资产'"
      @ok="saveAsset"
      @cancel="closeAssetForm"
    >
      <div class="asset-form-context">
        <span class="asset-form-context__mark"><a-icon type="database" /></span>
        <div>
          <strong>直接写入 {{ organizationName }}</strong>
          <p>资产类型和所属配置组织创建后不可变；退役会保留记录，不会删除历史。</p>
        </div>
      </div>
      <a-alert v-if="assetFormError" type="error" show-icon :message="assetFormError" class="asset-form-error" />
      <a-form-model layout="vertical" class="asset-form">
        <section v-for="section in assetFormSections" :key="section.key" class="asset-form-section" :data-section="section.key">
          <header class="asset-form-section__heading">
            <span>{{ section.index }}</span>
            <strong>{{ section.title }}</strong>
            <small>{{ section.hint }}</small>
          </header>
          <div class="asset-form-grid">
            <a-form-model-item
              v-for="field in section.fields"
              :key="field.key"
              :label="field.label"
              :required="field.required || field.key === 'smartops_primary_owner_id' && assetForm.status === 'production'"
              :class="{'asset-form-wide': field.wide}"
            >
              <a-select v-if="field.kind === 'assetClass'" v-model="assetFormClass" :disabled="assetEditing" placeholder="选择资产类型" @change="changeAssetClass">
                <a-select-option v-for="option in classOptions" :key="option.value" :value="option.value">{{ option.label }}</a-select-option>
              </a-select>
              <a-textarea v-else-if="field.kind === 'text'" v-model="assetForm[field.key]" :rows="3" :max-length="4000" placeholder="记录用途、责任边界或维护说明" />
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
              <a-select v-else-if="field.kind === 'virtualHost'" v-model="assetForm[field.key]" show-search option-filter-prop="children" placeholder="选择当前组织的宿主机">
                <a-select-option v-for="option in cmdbReferences.virtual_hosts" :key="option.id" :value="option.id">{{ option.name }}</a-select-option>
              </a-select>
              <a-select v-else-if="field.kind === 'networkType'" v-model="assetForm[field.key]" show-search option-filter-prop="children" placeholder="选择网络设备类型">
                <a-select-option v-for="option in cmdbReferences.network_device_types" :key="option.id" :value="option.id">{{ option.name }}</a-select-option>
              </a-select>
              <a-select v-else-if="field.kind === 'team'" v-model="assetForm[field.key]" show-search option-filter-prop="children" placeholder="选择当前配置组织的运维团队">
                <a-select-option v-for="option in cmdbReferences.teams" :key="option.id" :value="option.id">{{ option.name }}</a-select-option>
              </a-select>
              <a-select v-else-if="field.kind === 'person'" v-model="assetForm[field.key]" allow-clear show-search option-filter-prop="children" placeholder="选择当前配置组织的人员">
                <a-select-option v-for="option in cmdbReferences.people" :key="option.id" :value="option.id">{{ option.name }}</a-select-option>
              </a-select>
              <a-input v-else v-model="assetForm[field.key]" :placeholder="field.kind === 'ip' ? '例如 10.0.0.10' : `填写${field.label}`" :max-length="255" />
            </a-form-model-item>
          </div>
        </section>
      </a-form-model>
    </a-modal>

    <a-drawer
      :visible="admissionVisible"
      title="发现候选入库"
      width="1080"
      :destroy-on-close="true"
      :mask-closable="!admissionSaving && !admissionRetrying"
      @close="closeAdmissions"
    >
      <div class="admission-workspace">
        <aside class="admission-queue">
          <div class="admission-queue__heading">
            <span class="smartops-section-label">已分类监控主机</span>
            <strong>当前租户发现候选</strong>
            <small>仅展示资源分类已有模板分类证据的监控主机</small>
          </div>
          <div class="admission-filters">
            <a-input-search
              v-model.trim="admissionSearch"
              allow-clear
              placeholder="搜索主机、IP、主机编号"
              @search="applyAdmissionFilters"
            />
            <a-select v-model="admissionStateFilter" allow-clear placeholder="全部阶段" @change="applyAdmissionFilters">
              <a-select-option value="ready">待人工审核</a-select-option>
              <a-select-option value="binding_pending">监控待关联</a-select-option>
              <a-select-option value="conflict">身份冲突</a-select-option>
              <a-select-option value="completed">建档并绑定完成</a-select-option>
            </a-select>
          </div>
          <a-alert v-if="admissionError" type="error" show-icon :message="admissionError" class="admission-error" />
          <a-spin :spinning="admissionLoading">
            <div class="admission-queue__summary">
              <span>{{ admissionPage.total }} 台候选主机</span>
              <a-button type="link" size="small" icon="reload" @click="refreshAdmissions">刷新证据</a-button>
            </div>
            <div v-if="admissionCandidates.length" class="admission-list">
              <button
                v-for="candidate in admissionCandidates"
                :key="admissionCandidateKey(candidate)"
                type="button"
                data-testid="cmdb-admission-candidate"
                class="admission-card"
                :class="{'admission-card--selected': admissionCandidateKey(candidate) === selectedAdmissionKey}"
                @click="selectAdmission(candidate)"
              >
                <span class="admission-card__top">
                  <strong>{{ candidate.host_name }}</strong>
                  <a-badge :status="admissionStateMeta(candidate).status" :text="admissionStateMeta(candidate).label" />
                </span>
                <code>{{ candidate.instance_name }} / 监控主机 {{ candidate.host_id }}</code>
                <span class="admission-card__facts">
                  <span>{{ candidate.address || '未采集 IP' }}</span>
                  <a-tag :color="classMeta(candidate.suggested_class).color">建议 {{ classMeta(candidate.suggested_class).label }}</a-tag>
                </span>
                <small>{{ admissionEvidenceLabel(candidate) }}</small>
              </button>
            </div>
            <a-empty v-else-if="!admissionLoading" :image-style="{height: '46px'}" description="当前条件下没有发现候选" />
            <div v-if="admissionPage.total > admissionPage.page_size" class="admission-pagination">
              <a-pagination
                data-testid="cmdb-admission-pagination"
                :current="admissionPage.page"
                :page-size="admissionPage.page_size"
                :total="admissionPage.total"
                :show-less-items="true"
                @change="changeAdmissionPage"
              />
            </div>
          </a-spin>
        </aside>

        <section class="admission-review">
          <div v-if="!selectedAdmission" class="admission-placeholder">
            <a-icon type="radar-chart" />
            <strong>选择一台候选主机</strong>
            <span>在这里核对发现证据、责任引用与入库阶段。</span>
          </div>
          <template v-else>
            <header class="admission-review__header">
              <div>
                <span class="smartops-section-label">资产入库确认</span>
                <h2>{{ selectedAdmission.host_name }}</h2>
                <p>{{ selectedAdmission.instance_name }} · 监控主机 {{ selectedAdmission.host_id }} · {{ selectedAdmission.address || '未采集 IP' }}</p>
              </div>
              <a-badge :status="selectedAdmissionMeta.status" :text="selectedAdmissionMeta.label" />
            </header>

            <div class="admission-stage-rail" aria-label="发现候选入库阶段">
              <div v-for="(stage, index) in admissionStages" :key="stage.label" class="admission-stage" :data-state="admissionStageState(index)">
                <span class="admission-stage__mark"><a-icon :type="admissionStageIcon(index)" /></span>
                <span><b>0{{ index + 1 }}</b><strong>{{ stage.label }}</strong><small>{{ stage.caption }}</small></span>
              </div>
            </div>

            <div class="admission-evidence">
              <div class="admission-evidence__facts">
                <span><small>主接口</small><strong>{{ selectedAdmission.interface_type || '未知' }} / {{ selectedAdmission.interface_port || '—' }}</strong></span>
                <span><small>可用性</small><strong>{{ selectedAdmission.availability || '未知' }}</strong></span>
                <span><small>监控侧资产信息</small><strong>{{ admissionInventorySummary }}</strong></span>
              </div>
              <div class="admission-classifications">
                <div v-for="item in selectedAdmission.classifications" :key="item.code">
                  <a-tag color="blue">{{ item.category }}</a-tag>
                  <span><strong>{{ item.product || item.template_name || '已分类' }}</strong><small>{{ item.evidence || item.template_name }}</small></span>
                </div>
              </div>
            </div>

            <a-alert
              v-if="selectedAdmission.state === 'ready' && !canCreate"
              type="info"
              show-icon
              message="当前角色可查看发现和入库状态，不能确认入库。"
              class="admission-policy-alert"
            />

            <div v-if="selectedAdmission.state === 'ready' && canCreate && writeContextReady" class="admission-form-panel">
              <div class="admission-section-title">
                <span><strong>人工确认资产与责任</strong><small>引用只来自当前配置组织</small></span>
                <a-tag color="blue">类型建议可修改</a-tag>
              </div>
              <a-alert v-if="admissionFormError" type="error" show-icon :message="admissionFormError" class="admission-form-error" />
              <a-form-model layout="vertical" class="asset-form">
                <div class="asset-form-grid">
                  <a-form-model-item label="资产类型" required class="asset-form-wide">
                    <a-select v-model="admissionFormClass" @change="changeAdmissionClass">
                      <a-select-option v-for="option in admissionClassOptions" :key="option.value" :value="option.value">{{ option.label }}</a-select-option>
                    </a-select>
                  </a-form-model-item>
                  <a-form-model-item
                    v-for="field in admissionFormFields"
                    :key="field.key"
                    :label="field.label"
                    :required="field.required || field.key === 'smartops_primary_owner_id' && admissionForm.status === 'production'"
                    :class="{'asset-form-wide': field.wide}"
                  >
                    <a-textarea v-if="field.kind === 'text'" v-model="admissionForm[field.key]" :rows="3" :max-length="4000" />
                    <a-select v-else-if="field.kind === 'status'" v-model="admissionForm[field.key]">
                      <a-select-option v-for="option in admissionStatusOptions" :key="option.value" :value="option.value">{{ option.label }}</a-select-option>
                    </a-select>
                    <a-select v-else-if="field.kind === 'criticality'" v-model="admissionForm[field.key]" allow-clear placeholder="未设置">
                      <a-select-option value="high">高</a-select-option><a-select-option value="medium">中</a-select-option><a-select-option value="low">低</a-select-option>
                    </a-select>
                    <a-date-picker v-else-if="field.kind === 'date'" v-model="admissionForm[field.key]" value-format="YYYY-MM-DD" style="width: 100%" />
                    <a-select v-else-if="field.kind === 'location'" v-model="admissionForm[field.key]" allow-clear show-search option-filter-prop="children" placeholder="未设置">
                      <a-select-option v-for="option in cmdbReferences.locations" :key="option.id" :value="option.id">{{ option.name }}</a-select-option>
                    </a-select>
                    <a-select v-else-if="field.kind === 'virtualHost'" v-model="admissionForm[field.key]" data-testid="cmdb-admission-virtual-host" show-search option-filter-prop="children" placeholder="选择当前组织的宿主机">
                      <a-select-option v-for="option in cmdbReferences.virtual_hosts" :key="option.id" :value="option.id">{{ option.name }}</a-select-option>
                    </a-select>
                    <a-select v-else-if="field.kind === 'networkType'" v-model="admissionForm[field.key]" show-search option-filter-prop="children" placeholder="选择网络设备类型">
                      <a-select-option v-for="option in cmdbReferences.network_device_types" :key="option.id" :value="option.id">{{ option.name }}</a-select-option>
                    </a-select>
                    <a-select v-else-if="field.kind === 'team'" v-model="admissionForm[field.key]" data-testid="cmdb-admission-team" show-search option-filter-prop="children" placeholder="必选：运维团队">
                      <a-select-option v-for="option in cmdbReferences.teams" :key="option.id" :value="option.id">{{ option.name }}</a-select-option>
                    </a-select>
                    <a-select v-else-if="field.kind === 'person'" v-model="admissionForm[field.key]" :data-testid="field.key === 'smartops_primary_owner_id' ? 'cmdb-admission-primary-owner' : 'cmdb-admission-backup-owner'" allow-clear show-search option-filter-prop="children" placeholder="选择负责人">
                      <a-select-option v-for="option in cmdbReferences.people" :key="option.id" :value="option.id">{{ option.name }}</a-select-option>
                    </a-select>
                    <a-input v-else v-model="admissionForm[field.key]" :max-length="255" />
                  </a-form-model-item>
                  <a-form-model-item label="所属应用（可选）" class="asset-form-wide">
                    <a-select v-model="admissionApplicationID" data-testid="cmdb-admission-application" allow-clear show-search option-filter-prop="children" placeholder="可选：写入配置管理中心标准应用关系">
                      <a-select-option v-for="option in cmdbReferences.applications" :key="option.id" :value="option.id">{{ option.name }}</a-select-option>
                    </a-select>
                  </a-form-model-item>
                </div>
              </a-form-model>
              <div class="admission-submit-row">
                <span><a-icon type="safety-certificate" /> 先完成资产建档，再建立监控关联；部分失败会保留配置项并显示可重试阶段。</span>
                <a-button data-testid="cmdb-admission-submit" type="primary" icon="check" :loading="admissionSaving" @click="saveAdmission">确认入库并关联</a-button>
              </div>
            </div>

            <div v-else-if="selectedAdmission.state === 'binding_pending'" class="admission-result admission-result--pending">
              <span class="admission-result__icon"><a-icon type="clock-circle" /></span>
              <div>
                <strong>配置管理中心已建档，监控待关联</strong>
                <p>{{ selectedAdmission.state_message }}</p>
                <small>{{ selectedAdmission.asset_key }} · {{ selectedAdmission.asset && selectedAdmission.asset.smartops_operations_team_name || '责任已保存' }}</small>
              </div>
              <a-button v-if="canOperate" data-testid="cmdb-admission-retry" type="primary" icon="sync" :loading="admissionRetrying" @click="retryAdmission">重试监控中心关联</a-button>
            </div>

            <div v-else-if="selectedAdmission.state === 'completed'" class="admission-result admission-result--completed">
              <span class="admission-result__icon"><a-icon type="check" /></span>
              <div><strong>责任建档并绑定完成</strong><p>{{ selectedAdmission.state_message }}</p><small>{{ selectedAdmission.asset_key }} · 采集健康需另行判定</small></div>
              <a-button icon="database" @click="showAdmissionAsset">查看 CMDB 资产</a-button>
            </div>

            <div v-else-if="selectedAdmission.state === 'conflict'" class="admission-result admission-result--conflict">
              <span class="admission-result__icon"><a-icon type="warning" /></span>
              <div><strong>需要人工处理身份冲突</strong><p>{{ selectedAdmission.state_message }}</p><small>不会覆盖现有配置项或监控中心绑定。</small></div>
            </div>
          </template>
        </section>
      </div>
    </a-drawer>

    <a-modal
      :visible="monitoringBindingVisible"
      :title="monitoringBound ? '更换监控主机' : '关联监控主机'"
      :confirm-loading="monitoringBindingSaving"
      :mask-closable="false"
      :destroy-on-close="true"
      width="760px"
      ok-text="确认关联"
      @ok="saveMonitoringBinding"
      @cancel="closeMonitoringBinding"
    >
      <div class="monitoring-modal-context">
        <span><a-icon type="safety-certificate" /></span>
        <div>
          <strong>只建立身份关联，不复制资产数据</strong>
          <p>候选仅来自当前租户的主机组；名称与 IP 匹配用于排序，最终仍需人工确认。</p>
        </div>
      </div>
      <a-input-search
        v-model.trim="monitoringCandidateSearch"
        allow-clear
        placeholder="搜索主机名称、IP、主机编号或监控源"
        :loading="monitoringCandidatesLoading"
        @search="loadMonitoringCandidates"
      />
      <a-alert v-if="monitoringCandidateError" type="error" show-icon :message="monitoringCandidateError" class="monitoring-candidate-error" />
      <a-spin :spinning="monitoringCandidatesLoading">
        <div class="monitoring-candidate-summary">
          <span>当前范围 {{ monitoringCandidatePage.total }} 台主机</span>
          <small v-if="monitoringCandidatePage.total > monitoringCandidatePage.limit">仅显示前 {{ monitoringCandidatePage.limit }} 项，请继续搜索</small>
        </div>
        <div v-if="monitoringCandidates.length" class="monitoring-candidate-list">
          <div
            v-for="candidate in monitoringCandidates"
            :key="monitoringCandidateKey(candidate)"
            class="monitoring-candidate"
            :class="{'monitoring-candidate--selected': monitoringCandidateKey(candidate) === selectedMonitoringCandidateKey, 'monitoring-candidate--disabled': !candidate.selectable}"
          >
            <a-radio
              :checked="monitoringCandidateKey(candidate) === selectedMonitoringCandidateKey"
              :disabled="!candidate.selectable"
              @change="selectMonitoringCandidate(candidate)"
            />
            <span class="monitoring-candidate__identity">
              <strong>{{ candidate.host_name }}</strong>
              <code>{{ candidate.instance_name }} / {{ candidate.host_id }}</code>
            </span>
            <span class="monitoring-candidate__address">{{ candidate.address || '未采集地址' }}</span>
            <span class="monitoring-candidate__match">
              <a-tag v-if="candidate.suggested" color="blue">推荐</a-tag>
              <small>{{ candidateMatchLabel(candidate) }}</small>
            </span>
            <span class="monitoring-candidate__state">
              <a-badge :status="candidate.enabled ? 'success' : 'default'" :text="candidate.enabled ? '启用' : '停用'" />
              <small v-if="!candidate.selectable">已绑定 {{ candidate.bound_asset_key }}</small>
              <small v-else-if="candidate.current">当前绑定</small>
            </span>
          </div>
        </div>
        <a-empty v-else-if="!monitoringCandidatesLoading" :image-style="{height: '48px'}" description="当前租户范围没有匹配主机" />
      </a-spin>
    </a-modal>

    <a-modal
      :visible="mappingVisible"
      title="配置组织关联管理"
      :mask-closable="false"
      :destroy-on-close="true"
      :footer="null"
      width="880px"
      :body-style="{ maxHeight: 'calc(100vh - 190px)', overflowY: 'auto', padding: '18px 22px 20px' }"
      @cancel="closeMapping"
    >
      <a-spin :spinning="mappingLoading">
        <a-alert
          v-if="mappingError"
          data-testid="cmdb-mapping-error"
          type="error"
          show-icon
          :message="mappingError"
          :description="mappingErrorDetail"
          class="mapping-inline-error"
        />
        <a-form-model layout="vertical" class="mapping-governance-form">
          <a-form-model-item label="智能运维管理系统租户" required>
            <a-select v-model="mappingForm.tenant_id" :disabled="mappingSaving || mappingPreviewLoading" show-search option-filter-prop="children" placeholder="选择租户" @change="syncMappingSelection">
              <a-select-option v-for="tenant in mappingTenants" :key="tenant.id" :value="tenant.id">{{ tenant.name }}（{{ tenant.code }}）</a-select-option>
            </a-select>
          </a-form-model-item>

          <section v-if="mappingForm.tenant_id && !selectedMapping" class="mapping-initial-state">
            <header><span>首次关联</span><strong>建立首次数据边界</strong><small>首次绑定后组织映射版本从 1 开始；之后只能通过显式切换变更。</small></header>
            <a-form-model-item label="配置组织" required>
              <a-select v-model="mappingForm.itop_organization_id" show-search option-filter-prop="children" placeholder="选择活动配置组织">
                <a-select-option v-for="organization in mappingOrganizations" :key="organization.id" :value="organization.id" :disabled="organizationAssignedElsewhere(organization.id) || !organizationSelectable(organization)">
                  {{ organization.name }}<template v-if="organization.code"> · {{ organization.code }}</template> · 组织编号 {{ organization.id }}
                </a-select-option>
              </a-select>
            </a-form-model-item>
          </section>

          <template v-else-if="mappingForm.tenant_id && selectedMapping">
            <section class="organization-boundary" aria-label="组织关联关系" data-testid="cmdb-mapping-boundary">
              <article class="boundary-node boundary-node--current" data-testid="cmdb-mapping-current">
                <span class="boundary-node__index">当前组织 · 已关联</span>
                <strong>{{ mappingCurrentOrganization.name || '未知组织' }}</strong>
                <code>{{ mappingCurrentOrganization.code || '未设编码' }} · 组织编号 {{ mappingCurrentOrganization.id || selectedMapping.itop_organization_id }}</code>
                <small>已锁定来源，不可在普通保存中改写</small>
              </article>
              <div class="boundary-transfer" aria-hidden="true">
                <span></span>
                <b>组织映射版本 {{ mappingCurrentGeneration }}</b>
                <small>先预览再确认</small>
              </div>
              <article class="boundary-node boundary-node--target">
                <span class="boundary-node__index">待切换组织</span>
                <a-select
                  v-model="mappingTransitionForm.target_organization_id"
                  data-testid="cmdb-mapping-target"
                  :disabled="mappingSaving || mappingPreviewLoading"
                  show-search
                  option-filter-prop="children"
                  placeholder="选择目标配置组织"
                  @change="resetMappingPreview"
                >
                  <a-select-option v-for="organization in mappingTargetOptions" :key="organization.id" :value="organization.id" :disabled="organizationAssignedElsewhere(organization.id) || !organizationSelectable(organization)">
                    {{ organization.name }}<template v-if="organization.code"> · {{ organization.code }}</template> · 组织编号 {{ organization.id }}
                  </a-select-option>
                </a-select>
                <small v-if="mappingTargetOrganization.id">{{ mappingTargetOrganization.code || '未设编码' }} · 组织编号 {{ mappingTargetOrganization.id }}</small>
                <small v-else>目标只能是未占用的活动配置组织</small>
              </article>
            </section>

            <div class="mapping-preview-action">
              <span><a-icon type="safety-certificate" /> 预览只计算边界变更，不会修改映射或外部数据。</span>
              <a-button data-testid="cmdb-mapping-preview" :loading="mappingPreviewLoading" :disabled="!mappingTransitionForm.target_organization_id || mappingSaving" icon="audit" @click="previewMappingTransition">预览切换影响</a-button>
            </div>

            <template v-if="mappingPreview">
              <section class="mapping-impact" data-testid="cmdb-mapping-impact">
                <header><span>变更影响清单</span><strong>受影响的关联记录</strong><small>以本次预览校验摘要为准</small></header>
                <div class="mapping-impact__grid">
                  <article v-for="item in mappingImpactRows" :key="item.key" :data-testid="`cmdb-mapping-impact-${item.key}`" :class="{'mapping-impact--warning': item.key === 'unresolved' && item.count}">
                    <span>{{ item.code }}</span><strong>{{ item.count }}</strong><small>{{ item.label }}</small>
                  </article>
                </div>
                <div class="mapping-impact__configuration-samples">
                  <article v-for="item in mappingConfigurationSampleRows" :key="item.key" :data-testid="`cmdb-mapping-impact-${item.key}-samples`">
                    <span>{{ item.code }} 示例记录</span>
                    <div v-if="item.samples.length">
                      <code v-for="sample in item.samples" :key="sample">{{ sample }}</code>
                    </div>
                    <small v-else>本次切换没有{{ item.label }}</small>
                  </article>
                </div>
                <footer><span>预览校验摘要</span><code>{{ mappingPreview.preview_digest }}</code></footer>
              </section>

              <a-alert
                type="warning"
                show-icon
                message="原资产与监控数据保留"
                description="切换只归档智能运维管理系统本地监控关联、负责人账号关联、监控场景与配置任务，以及遗留未完成关联活动行。配置项、运维团队、负责人、关系，以及监控主机、模板、指标历史都不会删除、迁移或自动恢复。"
                class="mapping-retention-alert"
              />

              <section class="mapping-execution">
                <header><span>确认变更</span><strong>执行已确认的组织切换</strong></header>
                <a-form-model-item label="精确确认短语" required>
                  <a-input v-model="mappingTransitionForm.confirmation" data-testid="cmdb-mapping-confirmation" :disabled="mappingSaving" :placeholder="mappingPreview.confirmation_phrase" autocomplete="off" />
                  <small class="mapping-field-help">请完整输入：<code>{{ mappingPreview.confirmation_phrase }}</code></small>
                </a-form-model-item>
                <a-form-model-item label="切换原因" required>
                  <a-textarea v-model="mappingTransitionForm.reason" data-testid="cmdb-mapping-reason" :disabled="mappingSaving" :rows="3" :max-length="500" placeholder="记录客户、变更单或数据边界调整原因（必填）" />
                </a-form-model-item>
              </section>
            </template>
          </template>
        </a-form-model>
      </a-spin>
      <footer class="mapping-actions">
        <a-button :disabled="mappingSaving || mappingPreviewLoading" @click="closeMapping">取消</a-button>
        <a-button
          v-if="mappingForm.tenant_id && !selectedMapping"
          data-testid="cmdb-mapping-initial-submit"
          type="primary"
          icon="link"
          :loading="mappingSaving"
          :disabled="!mappingForm.itop_organization_id"
          @click="saveMapping"
        >建立映射</a-button>
        <a-button
          v-else-if="selectedMapping && mappingPreview"
          data-testid="cmdb-mapping-transition-submit"
          type="danger"
          icon="swap"
          :loading="mappingSaving"
          :disabled="!mappingCanExecute"
          @click="executeMappingTransition"
        >确认切换配置组织</a-button>
      </footer>
    </a-modal>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import {listTenants} from '@/services/tenant'
import {
  activateCMDBAsset,
  admitCMDBCandidate,
  bindCMDBMonitoring,
  createCMDBAsset,
  executeCMDBMappingTransition,
  getCMDBAsset,
  getCMDBMonitoring,
  getCMDBOverview,
  getCMDBReferences,
  getCMDBRelations,
  listCMDBAssets,
  listCMDBAdmissions,
  listCMDBMappings,
  listCMDBMonitoringCandidates,
  listCMDBOrganizations,
  previewCMDBMappingTransition,
  repairCMDBMonitoring,
  retryCMDBAdmission,
  retireCMDBAsset,
  unbindCMDBMonitoring,
  updateCMDBAsset,
  upsertCMDBMapping,
} from '@/services/cmdb'
import {
  CLASS_META,
  admissionEvidenceLabel,
  admissionStateMeta,
  assetKey,
  buildAssetFields,
  candidateMatchLabel,
  classMeta,
  createAssetForm,
  createAdmissionForm,
  detailRows,
  editableFields,
  governanceTenantIsCurrent,
  isPlatformAdmin,
  lifecycleMeta,
  mappingFailureInvalidatesContext,
  mappingForTenant,
  mappingPreviewContextChanged,
  mappingTransitionReasonMessage,
  monitoringHostStatusLabel,
  monitoringStateMeta,
  normalizeCMDBContext,
  normalizeMappingTransitionPreview,
  relationBuckets,
  statusOptions,
  statusMeta,
  validateAssetForm,
} from './cmdb-model'
import {tenantContextChangingEvent} from '@/utils/request'
import MonitoringProvision from './MonitoringProvision.vue'

const {canPerform} = require('@/utils/permission-policy')
const monitoringHealthPolicy = require('@/utils/monitoring-health')
const {displaySystemText} = require('@/utils/presentation-copy')

const emptyAssetPage = () => ({items: [], total: 0, page: 1, page_size: 30, counts: {}})
const emptyAdmissionPage = () => ({items: [], total: 0, page: 1, page_size: 100, limit: 200})
const emptyMonitoring = () => ({
  binding: null,
  host: null,
  reconciliation: {
    state: 'unbound', label: '未关联', severity: 'default', summary: '尚未选择对应的监控主机。',
    issues: [], can_repair: false, expected_host_status: 'enabled', actual_host_status: '',
  },
  configuration: {
    state: 'unknown', label: '配置状态未知', severity: 'default', reasons: [],
    explicit_requirements: false, latest_success_task_id: 0,
  },
  collection_health: {
    state: 'unknown', label: '健康未知', severity: 'default',
    summary: '暂无服务端健康证据，不能判定采集健康。', reasons: [],
    enabled_item_count: 0, supported_item_count: 0, fresh_item_count: 0, stale_item_count: 0,
  },
})
const emptyReferences = () => ({locations: [], network_device_types: [], teams: [], people: [], applications: [], virtual_hosts: []})
const emptyMappingTransitionForm = () => ({target_organization_id: undefined, confirmation: '', reason: ''})

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = bytes[6] & 0x0f | 0x40
    bytes[8] = bytes[8] & 0x3f | 0x80
    const value = Array.from(bytes, item => item.toString(16).padStart(2, '0')).join('')
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
  }
  return ''
}

export default {
  name: 'CMDBCenter',
  components: {PageLayout, MonitoringProvision},
  data() {
    return {
      loading: false,
      assetsLoading: false,
      detailLoading: false,
      monitoringLoading: false,
      monitoringError: '',
      monitoring: emptyMonitoring(),
      monitoringBindingVisible: false,
      monitoringBindingSaving: false,
      monitoringRepairing: false,
      monitoringCandidatesLoading: false,
      monitoringCandidateSequence: 0,
      monitoringCandidateError: '',
      monitoringCandidateSearch: '',
      monitoringCandidates: [],
      monitoringCandidatePage: {total: 0, limit: 200},
      selectedMonitoringCandidate: null,
      admissionVisible: false,
      admissionLoading: false,
      admissionSaving: false,
      admissionRetrying: false,
      admissionError: '',
      admissionFormError: '',
      admissionSequence: 0,
      admissionSearch: '',
      admissionStateFilter: undefined,
      admissionCandidates: [],
      admissionPage: emptyAdmissionPage(),
      selectedAdmission: null,
      admissionFormClass: 'Server',
      admissionForm: createAssetForm('Server'),
      admissionApplicationID: undefined,
      admissionStages: [
        {label: '发现主机', caption: '监控中心模板证据'},
        {label: '责任确认', caption: '团队与主备负责人'},
        {label: '配置管理中心建档', caption: '配置项与应用关系'},
        {label: '监控中心关联', caption: '唯一监控主机身份'},
      ],
      overview: {state: 'loading', message: '', total: 0, counts: {}},
      overviewSequence: 0,
      assetSequence: 0,
      activeCMDBContextKey: '',
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
      cmdbReferences: emptyReferences(),
      referencesContextKey: '',
      referenceSequence: 0,
      mappingVisible: false,
      mappingLoading: false,
      mappingSaving: false,
      mappingPreviewLoading: false,
      mappingSequence: 0,
      mappingError: '',
      mappingErrorDetail: '',
      mappingPreview: null,
      mappingIdempotencyKey: '',
      mappingTenants: [],
      mappingOrganizations: [],
      mappings: [],
      mappingForm: {tenant_id: undefined, itop_organization_id: undefined},
      mappingTransitionForm: emptyMappingTransitionForm(),
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
    currentTenantID() { return Number(this.currentTenant.id) || 0 },
    platformAdmin() { return isPlatformAdmin(this.user) },
    canCreate() { return canPerform(this.permissions, 'tenant.cmdb', 'create') },
    canUpdate() { return canPerform(this.permissions, 'tenant.cmdb', 'update') },
    canOperate() { return canPerform(this.permissions, 'tenant.cmdb', 'operate') },
    sourceReady() { return this.overview.state === 'ready' },
    cmdbContext() { return normalizeCMDBContext(this.overview, this.currentTenantID) },
    writeContextReady() { return this.cmdbContext.ready && this.activeCMDBContextKey === this.cmdbContext.key },
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
    organizationIdentity() {
      if (!this.cmdbContext.organization_id) return ''
      const organization = this.overview.organization || {}
      const code = organization.code || organization.organization_code || '未设编码'
      return `${code} · 组织编号 ${this.cmdbContext.organization_id} · 组织映射版本 ${this.cmdbContext.generation || '—'}`
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
    monitoringReconciliation() {
      const value = this.monitoring && this.monitoring.reconciliation || emptyMonitoring().reconciliation
      return {...value, summary: displaySystemText(value.summary)}
    },
    monitoringMeta() { return monitoringStateMeta(this.monitoringReconciliation) },
    collectionHealth() {
      return monitoringHealthPolicy.normalizeMonitoringHealth(this.monitoring && this.monitoring.collection_health)
    },
    collectionHealthBadge() { return monitoringHealthPolicy.monitoringHealthMeta(this.collectionHealth) },
    monitoringConfiguration() {
      const value = this.monitoring && this.monitoring.configuration || this.collectionHealth.configuration
      return monitoringHealthPolicy.normalizeMonitoringConfiguration(value)
    },
    monitoringConfigurationBadge() {
      return monitoringHealthPolicy.monitoringConfigurationMeta(this.monitoringConfiguration)
    },
    monitoringConfigurationSummary() {
      if (this.monitoringConfiguration.state === 'ready') {
        const taskID = this.monitoringConfiguration.latest_success_task_id
        return taskID ? `配置任务 #${taskID} 已应用，仍需独立核对采集证据。` : '配置已应用，仍需独立核对采集证据。'
      }
      const reasons = (this.monitoringConfiguration.reasons || []).map(monitoringHealthPolicy.monitoringReasonLabel).filter(Boolean)
      return reasons[0] || '暂无足够证据确认监控配置已应用。'
    },
    monitoringEvidenceReasons() {
      const reasons = [
        ...monitoringHealthPolicy.monitoringReasonLabels(this.collectionHealth),
        ...(this.monitoringConfiguration.reasons || []).map(monitoringHealthPolicy.monitoringReasonLabel),
      ]
      return [...new Set(reasons.filter(Boolean))]
    },
    collectionLastValueLabel() {
      const value = this.collectionHealth.last_value_at
      if (!value) return this.collectionHealth.state === 'waiting_first_data' ? '等待首采' : '—'
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', {hour12: false})
    },
    monitoringBound() { return Boolean(this.monitoring && this.monitoring.binding) },
    monitoringIssueLabels() {
      const labels = {
        name_drift: '名称不一致',
        ip_drift: '管理 IP 不一致',
        active_ci_host_disabled: '在用资产 / 监控停用',
        retired_ci_host_enabled: '退役资产 / 监控启用',
        host_missing: '主机不存在',
        host_out_of_scope: '主机越出租户范围',
      }
      return (this.monitoringReconciliation.issues || []).map((issue) => labels[issue] || issue)
    },
    selectedMonitoringCandidateKey() { return this.monitoringCandidateKey(this.selectedMonitoringCandidate) },
    selectedAdmissionKey() { return this.admissionCandidateKey(this.selectedAdmission) },
    selectedAdmissionMeta() { return admissionStateMeta(this.selectedAdmission) },
    admissionClassOptions() {
      return ['Server', 'VirtualMachine', 'NetworkDevice'].map((value) => ({value, label: CLASS_META[value].label}))
    },
    admissionFormFields() { return editableFields(this.admissionFormClass) },
    admissionStatusOptions() { return statusOptions(this.admissionFormClass) },
    admissionInventorySummary() {
      const inventory = this.selectedAdmission && this.selectedAdmission.inventory || {}
      const values = [inventory.type, inventory.vendor, inventory.model, inventory.os, inventory.serial_no, inventory.location].filter(Boolean)
      return values.length ? values.join(' / ') : '未采集'
    },
    assetFormFields() { return editableFields(this.assetFormClass) },
    assetFormSections() {
      const fields = this.assetFormFields
      const baseKeys = ['name', 'status', 'business_criticity', 'move2production', 'description']
      const baseFields = fields.filter((field) => baseKeys.includes(field.key))
      const responsibilityFields = fields.filter((field) => field.kind === 'team' || field.kind === 'person')
      const technicalFields = fields.filter((field) => !baseKeys.includes(field.key) && field.kind !== 'team' && field.kind !== 'person')
      return [
        {
          key: 'identity', index: '01', title: '基本信息', hint: '类型、名称与生命周期',
          fields: [{key: '__asset_class', label: '资产类型', kind: 'assetClass', required: true}, ...baseFields],
        },
        {key: 'responsibility', index: '02', title: '责任归属', hint: '团队与主备负责人', fields: responsibilityFields},
        {key: 'technical', index: '03', title: '技术与采购', hint: '识别、位置与维保信息', fields: technicalFields},
      ].filter((section) => section.fields.length)
    },
    assetStatusOptions() { return statusOptions(this.assetFormClass) },
    selectedMapping() { return mappingForTenant(this.mappings, this.mappingForm.tenant_id) },
    mappingCurrentOrganization() {
      const preview = this.mappingPreview && this.mappingPreview.current_organization || {}
      const mapping = this.selectedMapping || {}
      const organizationID = Number(preview.id || mapping.itop_organization_id || mapping.organization_id) || 0
      const listed = this.mappingOrganizations.find(item => Number(item.id) === organizationID) || {}
      return {
        ...listed,
        ...mapping.organization,
        ...preview,
        id: organizationID,
        name: preview.name || mapping.itop_organization_name || mapping.organization_name || listed.name || '',
        code: preview.code || mapping.itop_organization_code || mapping.organization_code || listed.code || '',
      }
    },
    mappingTargetOptions() {
      const currentID = Number(this.mappingCurrentOrganization.id) || 0
      return this.mappingOrganizations.filter(item => Number(item.id) !== currentID)
    },
    mappingTargetOrganization() {
      const preview = this.mappingPreview && this.mappingPreview.target_organization || {}
      const targetID = Number(this.mappingTransitionForm.target_organization_id) || 0
      const listed = this.mappingOrganizations.find(item => Number(item.id) === targetID) || {}
      return {...listed, ...preview, id: Number(preview.id || targetID) || 0}
    },
    mappingCurrentGeneration() {
      return Number(this.mappingPreview && this.mappingPreview.generation || this.selectedMapping && this.selectedMapping.generation) || '—'
    },
    mappingImpactRows() {
      const impact = this.mappingPreview && this.mappingPreview.impact || {}
      return [
        {key: 'assets', code: 'CI', label: '资产与配置项', count: Number(impact.assets) || 0},
        {key: 'admissions', code: 'ADM', label: '发现 / 入库记录', count: Number(impact.admissions) || 0},
        {key: 'monitoring', code: 'MON', label: '本地监控关联', count: Number(impact.monitoring) || 0},
        {key: 'person', code: 'PER', label: '负责人账号关联', count: Number(impact.person) || 0},
        {key: 'configuration_scenarios', code: 'SCN', label: '配置策略配置场景', count: Number(impact.configuration_scenarios) || 0},
        {key: 'configuration_tasks', code: 'TSK', label: '配置策略配置任务', count: Number(impact.configuration_tasks) || 0},
        {key: 'monitoring_provisions', code: 'NEW', label: '监控对象创建任务', count: Number(impact.monitoring_provisions) || 0},
        {key: 'unresolved', code: 'ERR', label: '遗留未完成关联（待归档）', count: Number(impact.unresolved) || 0},
      ]
    },
    mappingConfigurationSampleRows() {
      const impact = this.mappingPreview && this.mappingPreview.impact || {}
      const samples = impact.samples && typeof impact.samples === 'object' ? impact.samples : {}
      const bounded = key => Array.isArray(samples[key])
        ? samples[key].filter(item => typeof item === 'string' && item).slice(0, 10)
        : []
      return [
        {key: 'configuration_scenarios', code: 'SCN', label: '受影响的配置场景', samples: bounded('configuration_scenarios')},
        {key: 'configuration_tasks', code: 'TSK', label: '受影响的配置任务', samples: bounded('configuration_tasks')},
        {key: 'monitoring_provisions', code: 'NEW', label: '受影响的监控创建任务', samples: bounded('monitoring_provisions')},
      ]
    },
    mappingCanExecute() {
      if (!this.mappingPreview || !this.mappingPreview.preview_digest || !this.mappingPreview.confirmation_phrase) return false
      return this.mappingTransitionForm.confirmation === this.mappingPreview.confirmation_phrase
        && Boolean(String(this.mappingTransitionForm.reason || '').trim())
        && Boolean(this.mappingIdempotencyKey)
    },
  },
  watch: {
    currentTenantID(next, previous) {
      if (previous && next !== previous) {
        this.invalidateCMDBContext('租户上下文已切换，旧 CMDB 表单已关闭。')
        this.loadOverviewAndAssets()
      }
    },
  },
  created() {
    if (typeof window !== 'undefined') window.addEventListener(tenantContextChangingEvent, this.handleTenantContextChanging)
    this.loadOverviewAndAssets()
  },
  beforeDestroy() {
    if (typeof window !== 'undefined') window.removeEventListener(tenantContextChangingEvent, this.handleTenantContextChanging)
  },
  methods: {
    admissionEvidenceLabel,
    admissionStateMeta,
    assetKey,
    candidateMatchLabel,
    classMeta,
    monitoringHostStatusLabel,
    statusMeta,
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
      const result = response && response.data
      if (!result || Number(result.code) !== 200) {
        const error = new Error(result && result.message || '请求失败')
        error.businessCode = Number(result && result.code) || 0
        error.businessData = result && result.data
        error.businessReason = result && result.data && result.data.reason
        throw error
      }
      return result.data
    },
    pageItems(response) {
      const data = this.unwrap(response)
      return data && Array.isArray(data.items) ? data.items : []
    },
    writeContext() {
      const context = this.cmdbContext
      if (!this.writeContextReady) {
        const error = new Error('配置组织 上下文未就绪，请刷新后重试。')
        error.businessReason = 'cmdb_context_mismatch'
        throw error
      }
      return {organization_id: context.organization_id, generation: context.generation, key: context.key}
    },
    contextIsCurrent(context) {
      return Boolean(context && context.key) && context.key === this.cmdbContext.key && context.key === this.activeCMDBContextKey
    },
    resetCMDBWorkspaces() {
      this.assetSequence += 1
      this.detailSequence += 1
      this.admissionSequence += 1
      this.monitoringCandidateSequence += 1
      this.referenceSequence += 1
      this.mappingSequence += 1
      this.assetFormVisible = false
      this.assetFormError = ''
      this.admissionVisible = false
      this.admissionError = ''
      this.admissionFormError = ''
      this.admissionCandidates = []
      this.admissionPage = emptyAdmissionPage()
      this.selectedAdmission = null
      this.monitoringBindingVisible = false
      this.monitoringCandidateError = ''
      this.monitoringCandidates = []
      this.selectedMonitoringCandidate = null
      this.cmdbReferences = emptyReferences()
      this.referencesContextKey = ''
      this.mappingVisible = false
      this.mappingPreview = null
      this.mappingIdempotencyKey = ''
      this.mappingForm = {tenant_id: undefined, itop_organization_id: undefined}
      this.mappingTransitionForm = emptyMappingTransitionForm()
      this.resetLedger()
    },
    invalidateCMDBContext(message) {
      this.overviewSequence += 1
      this.activeCMDBContextKey = ''
      this.overview = {state: 'loading', message: '', total: 0, counts: {}}
      this.resetCMDBWorkspaces()
      if (message) this.$message.warning(message)
    },
    handleTenantContextChanging(event) {
      const targetID = Number(event && event.detail && event.detail.tenant && event.detail.tenant.id) || 0
      if (!targetID || targetID !== this.currentTenantID) {
        this.invalidateCMDBContext('租户正在切换，已关闭旧 CMDB 写入表单。')
        return
      }
      // A failed tenant switch restores the previous tenant through the same pre-change event.
      // Reload on the next tick, after its localStorage header has also been restored.
      if (!this.activeCMDBContextKey) this.$nextTick(() => {
        if (!this.activeCMDBContextKey && targetID === this.currentTenantID) this.loadOverviewAndAssets()
      })
    },
    handleCMDBContextFailure(error, fallback) {
      const failure = this.cmdbFailure(error, fallback)
      if (['cmdb_context_mismatch', 'mapping_context_stale', 'mapping_generation_mismatch', 'mapping_transition_in_progress', 'mapping_preview_stale', 'preview_digest_mismatch'].includes(failure.reason)) {
        this.resetCMDBWorkspaces()
        this.activeCMDBContextKey = ''
        this.loadOverviewAndAssets()
      }
      return failure
    },
    async loadOverviewAndAssets() {
      const sequence = ++this.overviewSequence
      const tenantID = this.currentTenantID
      this.loading = true
      try {
        const overview = this.unwrap(await getCMDBOverview()) || {state: 'error', total: 0, counts: {}}
        if (sequence !== this.overviewSequence || tenantID !== this.currentTenantID) return
        const nextContext = normalizeCMDBContext(overview, tenantID)
        if (this.activeCMDBContextKey && nextContext.key && this.activeCMDBContextKey !== nextContext.key) this.resetCMDBWorkspaces()
        this.overview = overview
        this.activeCMDBContextKey = nextContext.key
        if (this.overview.state === 'ready') await this.loadAssets(1)
        else this.resetLedger()
      } catch (error) {
        if (sequence !== this.overviewSequence || tenantID !== this.currentTenantID) return
        this.overview = {state: 'error', message: error.message, total: 0, counts: {}}
        this.activeCMDBContextKey = ''
        this.resetLedger()
        this.$message.error(error.message || 'CMDB 数据加载失败')
      } finally {
        if (sequence === this.overviewSequence) this.loading = false
      }
    },
    async loadAssets(page) {
      const sequence = ++this.assetSequence
      const contextKey = this.activeCMDBContextKey
      this.assetsLoading = true
      try {
        const data = this.unwrap(await listCMDBAssets({
          search: this.filters.search || undefined,
          class: this.filters.class || undefined,
          status: this.filters.status || undefined,
          page: page || this.assetPage.page || 1,
          page_size: this.assetPage.page_size || 30,
        })) || emptyAssetPage()
        if (sequence !== this.assetSequence || contextKey !== this.activeCMDBContextKey) return
        this.assetPage = {...emptyAssetPage(), ...data, counts: data.counts || {}}
        this.assets = Array.isArray(data.items) ? data.items : []
        const retained = this.selectedAsset && this.assets.find((asset) => assetKey(asset) === assetKey(this.selectedAsset))
        if (retained) await this.selectAsset(retained)
        else if (this.assets.length) await this.selectAsset(this.assets[0])
        else this.clearSelection()
      } catch (error) {
        if (sequence !== this.assetSequence || contextKey !== this.activeCMDBContextKey) return
        this.resetLedger()
        this.$message.error(error.message || '资产台账加载失败')
      } finally {
        if (sequence === this.assetSequence) this.assetsLoading = false
      }
    },
    async selectAsset(asset) {
      if (!asset) return
      const sequence = ++this.detailSequence
      this.selectedAsset = asset
      this.detailLoading = true
      this.monitoring = emptyMonitoring()
      this.monitoringError = ''
      this.loadMonitoring(asset, sequence)
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
      this.monitoringLoading = false
      this.monitoringError = ''
      this.monitoring = emptyMonitoring()
      this.closeMonitoringBinding()
    },
    async loadMonitoring(asset, sequence) {
      this.monitoringLoading = true
      this.monitoringError = ''
      try {
        const data = this.unwrap(await getCMDBMonitoring(asset.class, asset.id))
        if (sequence !== this.detailSequence) return
        this.monitoring = data || emptyMonitoring()
      } catch (error) {
        if (sequence !== this.detailSequence) return
        this.monitoring = emptyMonitoring()
        this.monitoringError = error.message || '监控对账失败，请稍后重试。'
      } finally {
        if (sequence === this.detailSequence) this.monitoringLoading = false
      }
    },
    reloadMonitoring() {
      if (!this.selectedAsset) return
      this.loadMonitoring(this.selectedAsset, this.detailSequence)
    },
    monitoringCandidateKey(candidate) {
      if (!candidate || !candidate.host_id || !candidate.zid) return ''
      return `${candidate.zid}:${candidate.host_id}`
    },
    async openMonitoringBinding() {
      if (!this.canOperate || !this.selectedAsset) return
      this.monitoringBindingVisible = true
      this.monitoringCandidateSearch = ''
      this.monitoringCandidateError = ''
      this.selectedMonitoringCandidate = null
      await this.loadMonitoringCandidates()
      if (this.monitoringBound) {
        const currentKey = `${this.monitoring.binding.zid}:${this.monitoring.binding.host_id}`
        this.selectedMonitoringCandidate = this.monitoringCandidates.find((candidate) => this.monitoringCandidateKey(candidate) === currentKey) || null
      }
    },
    closeMonitoringBinding() {
      if (this.monitoringBindingSaving) return
      this.monitoringBindingVisible = false
      this.monitoringCandidateError = ''
      this.monitoringCandidateSearch = ''
      this.monitoringCandidates = []
      this.monitoringCandidatePage = {total: 0, limit: 200}
      this.selectedMonitoringCandidate = null
    },
    async loadMonitoringCandidates() {
      if (!this.selectedAsset) return
      const sequence = ++this.monitoringCandidateSequence
      const contextKey = this.activeCMDBContextKey
      this.monitoringCandidatesLoading = true
      this.monitoringCandidateError = ''
      try {
        const data = this.unwrap(await listCMDBMonitoringCandidates(this.selectedAsset.class, this.selectedAsset.id, {
          search: this.monitoringCandidateSearch || undefined,
        })) || {items: [], total: 0, limit: 200}
        if (sequence !== this.monitoringCandidateSequence || contextKey !== this.activeCMDBContextKey) return
        this.monitoringCandidates = Array.isArray(data.items) ? data.items : []
        this.monitoringCandidatePage = {total: Number(data.total) || 0, limit: Number(data.limit) || 200}
        if (this.selectedMonitoringCandidate) {
          const selectedKey = this.monitoringCandidateKey(this.selectedMonitoringCandidate)
          this.selectedMonitoringCandidate = this.monitoringCandidates.find((candidate) => this.monitoringCandidateKey(candidate) === selectedKey) || null
        }
      } catch (error) {
        if (sequence !== this.monitoringCandidateSequence || contextKey !== this.activeCMDBContextKey) return
        this.monitoringCandidates = []
        this.monitoringCandidatePage = {total: 0, limit: 200}
        this.monitoringCandidateError = error.message || '监控主机候选加载失败'
      } finally {
        if (sequence === this.monitoringCandidateSequence) this.monitoringCandidatesLoading = false
      }
    },
    selectMonitoringCandidate(candidate) {
      if (!candidate || !candidate.selectable) return
      this.selectedMonitoringCandidate = candidate
    },
    async saveMonitoringBinding() {
      if (!this.canOperate || !this.selectedAsset || !this.selectedMonitoringCandidate) {
        this.monitoringCandidateError = '请选择一台可关联的监控主机'
        return
      }
      this.monitoringBindingSaving = true
      this.monitoringCandidateError = ''
      try {
        const context = this.writeContext()
        const monitoring = this.unwrap(await bindCMDBMonitoring(
          this.selectedAsset.class,
          this.selectedAsset.id,
          this.selectedMonitoringCandidate.zid,
          this.selectedMonitoringCandidate.host_id,
          context,
        )) || emptyMonitoring()
        if (!this.contextIsCurrent(context)) return
        this.monitoring = monitoring
        this.monitoringError = ''
        this.monitoringBindingVisible = false
        this.$message.success('监控主机已关联')
      } catch (error) {
        const failure = this.handleCMDBContextFailure(error, '监控主机关联失败')
        this.monitoringCandidateError = error.businessCode === 1013
          ? '该监控主机已绑定其他 CMDB 资产，请选择其他主机。'
          : failure.message
      } finally {
        this.monitoringBindingSaving = false
      }
    },
    confirmMonitoringUnbind() {
      if (!this.canOperate || !this.selectedAsset || !this.monitoringBound) return
      this.$confirm({
        title: '解除这项监控关联？',
        content: '只删除智能运维管理系统中的身份关联，不会删除配置管理中心资产或监控主机。',
        okText: '解除关联',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => this.runMonitoringUnbind(),
      })
    },
    async runMonitoringUnbind() {
      try {
        const context = this.writeContext()
        const monitoring = this.unwrap(await unbindCMDBMonitoring(this.selectedAsset.class, this.selectedAsset.id, context)) || emptyMonitoring()
        if (!this.contextIsCurrent(context)) return
        this.monitoring = monitoring
        this.monitoringError = ''
        this.$message.success('监控中心监控关联已解除')
      } catch (error) {
        this.$message.error(this.handleCMDBContextFailure(error, '解除监控关联失败').message)
      }
    },
    confirmMonitoringRepair() {
      if (!this.canOperate || !this.selectedAsset || !this.monitoringReconciliation.can_repair) return
      const expected = monitoringHostStatusLabel(this.monitoringReconciliation.expected_host_status)
      this.$confirm({
        title: `将监控中心监控调整为“${expected}”？`,
        content: '本操作只修改监控主机的启停状态，不会覆盖双方名称、IP、接口、模板或资产属性。',
        okText: '按 CMDB 状态修复监控',
        cancelText: '取消',
        onOk: () => this.runMonitoringRepair(),
      })
    },
    async runMonitoringRepair() {
      this.monitoringRepairing = true
      try {
        const context = this.writeContext()
        const monitoring = this.unwrap(await repairCMDBMonitoring(this.selectedAsset.class, this.selectedAsset.id, context)) || emptyMonitoring()
        if (!this.contextIsCurrent(context)) return
        this.monitoring = monitoring
        this.monitoringError = ''
        this.$message.success('监控中心监控状态已按 CMDB 修复')
      } catch (error) {
        this.$message.error(this.handleCMDBContextFailure(error, '监控状态修复失败').message)
        if (this.selectedAsset) await this.loadMonitoring(this.selectedAsset, this.detailSequence)
      } finally {
        this.monitoringRepairing = false
      }
    },
    admissionCandidateKey(candidate) {
      if (!candidate || !candidate.zid || !candidate.host_id) return ''
      return `${candidate.zid}:${candidate.host_id}`
    },
    async openAdmissions() {
      if (!this.sourceReady) return
      this.admissionVisible = true
      this.admissionError = ''
      // Start the queue request before the potentially multi-page reference
      // aggregation. Any filter/page request made by the operator then owns a
      // newer sequence and cannot be overwritten by this initial page.
      const initialAdmissionLoad = this.loadAdmissions()
      if (this.canCreate) {
        try {
          await this.ensureCMDBReferences()
        } catch (error) {
          this.admissionError = error.message || '配置管理中心责任引用加载失败'
        }
      }
      await initialAdmissionLoad
    },
    closeAdmissions() {
      if (this.admissionSaving || this.admissionRetrying) return
      this.admissionVisible = false
      this.admissionFormError = ''
    },
    applyAdmissionFilters() {
      return this.loadAdmissions(1)
    },
    refreshAdmissions() {
      return this.loadAdmissions(this.admissionPage.page)
    },
    changeAdmissionPage(page) {
      return this.loadAdmissions(page)
    },
    async loadAdmissions(page) {
      const retainedKey = this.selectedAdmissionKey
      const requestedPage = Number(page) > 0 ? Math.floor(Number(page)) : Number(this.admissionPage.page) || 1
      const requestedPageSize = Number(this.admissionPage.page_size) || 100
      const sequence = ++this.admissionSequence
      const contextKey = this.activeCMDBContextKey
      this.admissionLoading = true
      this.admissionError = ''
      try {
        const data = this.unwrap(await listCMDBAdmissions({
          search: this.admissionSearch || undefined,
          state: this.admissionStateFilter || undefined,
          page: requestedPage,
          page_size: requestedPageSize,
        })) || emptyAdmissionPage()
        if (sequence !== this.admissionSequence || contextKey !== this.activeCMDBContextKey) return
        const total = Math.max(0, Number(data.total) || 0)
        const pageSize = Number(data.page_size) > 0 ? Math.floor(Number(data.page_size)) : requestedPageSize
        const responsePage = Number(data.page) > 0 ? Math.floor(Number(data.page)) : requestedPage
        const lastPage = Math.max(1, Math.ceil(total / pageSize))
        if (responsePage > lastPage) {
          await this.loadAdmissions(lastPage)
          return
        }
        this.admissionCandidates = Array.isArray(data.items) ? data.items : []
        this.admissionPage = {
          ...emptyAdmissionPage(),
          ...data,
          total,
          page: responsePage,
          page_size: pageSize,
          limit: Number(data.limit) > 0 ? Number(data.limit) : 200,
        }
        const selected = this.admissionCandidates.find((candidate) => this.admissionCandidateKey(candidate) === retainedKey)
          || this.admissionCandidates[0]
          || null
        this.selectAdmission(selected)
      } catch (error) {
        if (sequence !== this.admissionSequence || contextKey !== this.activeCMDBContextKey) return
        this.admissionError = error.message || '发现候选加载失败'
      } finally {
        if (sequence === this.admissionSequence) this.admissionLoading = false
      }
    },
    selectAdmission(candidate) {
      this.selectedAdmission = candidate || null
      this.admissionFormError = ''
      if (!candidate || candidate.state !== 'ready') {
        this.admissionFormClass = 'Server'
        this.admissionForm = createAssetForm('Server')
        this.admissionApplicationID = undefined
        return
      }
      const prepared = createAdmissionForm(candidate)
      this.admissionFormClass = prepared.class
      this.admissionForm = prepared.fields
      this.admissionApplicationID = prepared.application_id
    },
    changeAdmissionClass(assetClass) {
      const previous = {...this.admissionForm}
      const next = createAssetForm(assetClass)
      Object.keys(next).forEach((key) => {
        if (previous[key] !== undefined) next[key] = previous[key]
      })
      if (this.selectedAdmission) {
        next.name = previous.name || this.selectedAdmission.host_name || ''
        if (Object.prototype.hasOwnProperty.call(next, 'managementip')) next.managementip = previous.managementip || this.selectedAdmission.address || ''
      }
      this.admissionForm = next
      this.admissionFormError = ''
    },
    admissionStageState(index) {
      const state = this.selectedAdmission && this.selectedAdmission.state || 'ready'
      if (state === 'completed') return 'done'
      if (state === 'binding_pending') return index < 3 ? 'done' : 'current'
      if (state === 'conflict') return index < 2 ? 'done' : 'error'
      if (state === 'ready') return index === 0 ? 'done' : index === 1 ? 'current' : 'waiting'
      return index === 0 ? 'current' : 'waiting'
    },
    admissionStageIcon(index) {
      const state = this.admissionStageState(index)
      if (state === 'done') return 'check'
      if (state === 'error') return 'warning'
      if (state === 'current') return 'sync'
      return 'lock'
    },
    async saveAdmission() {
      if (!this.canCreate || !this.selectedAdmission || this.selectedAdmission.state !== 'ready') return
      const validation = validateAssetForm(this.admissionFormClass, this.admissionForm)
      if (validation) {
        this.admissionFormError = validation
        return
      }
      this.admissionSaving = true
      this.admissionFormError = ''
      const retainedKey = this.selectedAdmissionKey
      try {
        const context = this.writeContext()
        const result = this.unwrap(await admitCMDBCandidate({
          zid: Number(this.selectedAdmission.zid),
          host_id: String(this.selectedAdmission.host_id),
          class: this.admissionFormClass,
          fields: buildAssetFields(this.admissionFormClass, this.admissionForm, true),
          application_id: Number(this.admissionApplicationID) || 0,
        }, context)) || {}
        if (!this.contextIsCurrent(context)) return
        if (result.state === 'completed') this.$message.success(result.message || '发现候选已完成资产建档与监控绑定')
        else if (result.state === 'binding_pending') this.$message.warning(result.message || '配置管理中心已建档，监控中心关联待重试')
        else this.$message.warning(result.message || '入库结果需要人工处理')
        await this.loadOverviewAndAssets()
        await this.loadAdmissions()
        const retained = this.admissionCandidates.find((candidate) => this.admissionCandidateKey(candidate) === retainedKey)
        if (retained) this.selectAdmission(retained)
      } catch (error) {
        if (error.businessCode === 1013) this.admissionFormError = '同类型同名配置项或监控身份已存在，请核对现有资产。'
        else this.admissionFormError = this.handleCMDBContextFailure(error, '发现候选入库失败').message
      } finally {
        this.admissionSaving = false
      }
    },
    async retryAdmission() {
      if (!this.canOperate || !this.selectedAdmission || this.selectedAdmission.state !== 'binding_pending') return
      this.admissionRetrying = true
      const retainedKey = this.selectedAdmissionKey
      try {
        const context = this.writeContext()
        const result = this.unwrap(await retryCMDBAdmission(this.selectedAdmission.zid, this.selectedAdmission.host_id, context)) || {}
        if (!this.contextIsCurrent(context)) return
        if (result.state === 'completed') this.$message.success(result.message || '监控中心关联已补齐')
        else this.$message.warning(result.message || '监控中心关联仍待重试')
        await this.loadAdmissions()
        const retained = this.admissionCandidates.find((candidate) => this.admissionCandidateKey(candidate) === retainedKey)
        if (retained) this.selectAdmission(retained)
      } catch (error) {
        this.$message.error(this.handleCMDBContextFailure(error, '监控关联重试失败').message)
      } finally {
        this.admissionRetrying = false
      }
    },
    async showAdmissionAsset() {
      const asset = this.selectedAdmission && this.selectedAdmission.asset
      if (!asset || !asset.id || !asset.class) return
      this.admissionVisible = false
      await this.loadAssets(1)
      const target = this.assets.find((item) => assetKey(item) === assetKey(asset)) || asset
      await this.selectAsset(target)
    },
    async ensureCMDBReferences() {
      const contextKey = this.activeCMDBContextKey
      if (!contextKey) throw new Error('配置组织 上下文未就绪')
      if (this.referencesContextKey === contextKey) return
      const sequence = ++this.referenceSequence
      const data = this.unwrap(await getCMDBReferences()) || {}
      if (sequence !== this.referenceSequence || contextKey !== this.activeCMDBContextKey) throw new Error('配置组织 上下文已变化，请重新打开表单。')
      this.cmdbReferences = {
        locations: Array.isArray(data.locations) ? data.locations : [],
        network_device_types: Array.isArray(data.network_device_types) ? data.network_device_types : [],
        teams: Array.isArray(data.teams) ? data.teams : [],
        people: Array.isArray(data.people) ? data.people : [],
        applications: Array.isArray(data.applications) ? data.applications : [],
        virtual_hosts: Array.isArray(data.virtual_hosts) ? data.virtual_hosts : [],
      }
      this.referencesContextKey = contextKey
    },
    async openCreateAsset() {
      if (!this.canCreate || !this.writeContextReady) return
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
      if (!this.canUpdate || !this.writeContextReady || this.selectedLifecycle.retired || !this.selectedAsset) return
      const contextKey = this.activeCMDBContextKey
      try {
        await this.ensureCMDBReferences()
        let asset = this.selectedDetail
        if (!asset || !asset.revision) asset = this.unwrap(await getCMDBAsset(this.selectedAsset.class, this.selectedAsset.id))
        if (contextKey !== this.activeCMDBContextKey) return
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
        const context = this.writeContext()
        const fields = buildAssetFields(this.assetFormClass, this.assetForm, !this.assetEditing)
        const response = this.assetEditing
          ? await updateCMDBAsset(this.assetFormClass, this.selectedAsset.id, this.assetFormRevision, fields, context)
          : await createCMDBAsset(this.assetFormClass, fields, context)
        const asset = this.unwrap(response)
        if (!this.contextIsCurrent(context)) return
        this.assetFormVisible = false
        this.$message.success(this.assetEditing ? 'CMDB 资产已更新' : 'CMDB 资产已新增')
        this.selectedAsset = asset
        await this.loadOverviewAndAssets()
      } catch (error) {
        if (error.businessCode === 1000) {
          this.assetFormError = '资产已被其他操作更新，当前详情已刷新；请关闭表单后重新编辑。'
          if (this.selectedAsset) await this.selectAsset(this.selectedAsset)
        } else if (error.businessCode === 1013) {
          this.assetFormError = '同一配置组织下已存在同类型同名资产。'
        } else {
          this.assetFormError = this.handleCMDBContextFailure(error, 'CMDB 资产保存失败').message
        }
      } finally {
        this.assetSaving = false
      }
    },
    confirmLifecycleTransition() {
      if (!this.canOperate || !this.writeContextReady || !this.selectedAsset || !this.selectedDetail || !this.selectedDetail.revision) {
        this.$message.warning('资产版本信息尚未就绪，请刷新后重试')
        return
      }
      const transition = this.selectedLifecycle
      this.$confirm({
        title: transition.retired ? '重新启用这项资产？' : '退役这项资产？',
        content: transition.retired
          ? '资产会恢复为在用状态，并继续作为配置管理中心配置真源中的有效记录。'
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
        const context = this.writeContext()
        const operation = transition.retired ? activateCMDBAsset : retireCMDBAsset
        this.unwrap(await operation(this.selectedDetail.class, this.selectedDetail.id, this.selectedDetail.revision, context))
        if (!this.contextIsCurrent(context)) return
        this.$message.success(transition.retired ? 'CMDB 资产已重新启用' : 'CMDB 资产已退役并保留记录')
        await this.loadOverviewAndAssets()
      } catch (error) {
        if (error.businessCode === 1000) {
          this.$message.warning('资产已被其他操作更新，已刷新当前详情，请确认后重试。')
          await this.selectAsset(this.selectedAsset)
        } else {
          this.$message.error(this.handleCMDBContextFailure(error, `${transition.label}失败`).message)
        }
      } finally {
        this.lifecycleSaving = false
      }
    },
    async loadMappingGovernance(preferredTenantID) {
      const sequence = ++this.mappingSequence
      this.mappingVisible = true
      this.mappingLoading = true
      this.mappingSaving = false
      this.mappingPreviewLoading = false
      this.mappingError = ''
      this.mappingErrorDetail = ''
      this.mappingPreview = null
      this.mappingIdempotencyKey = ''
      this.mappingTransitionForm = emptyMappingTransitionForm()
      try {
        const preferredTenant = Number(preferredTenantID) || Number(this.currentTenant.id) || 0
        const [tenants, organizations, mappings] = await Promise.all([
          listTenants(), listCMDBOrganizations(), listCMDBMappings(preferredTenant),
        ])
        if (sequence !== this.mappingSequence || !this.mappingVisible) return false
        this.mappingTenants = this.pageItems(tenants)
        this.mappingOrganizations = this.pageItems(organizations)
        this.mappings = this.pageItems(mappings)
        const selectedTenant = this.mappingTenants.some(tenant => Number(tenant.id) === preferredTenant)
          ? preferredTenant
          : Number(this.mappingTenants[0] && this.mappingTenants[0].id) || undefined
        this.mappingForm.tenant_id = selectedTenant
        this.syncMappingSelection(selectedTenant, false)
        return true
      } catch (error) {
        if (sequence !== this.mappingSequence) return false
        const failure = this.cmdbFailure(error, '映射选项加载失败')
        this.mappingError = failure.message
        this.mappingErrorDetail = '未修改任何配置组织映射；请刷新后重试。'
        return false
      } finally {
        if (sequence === this.mappingSequence) this.mappingLoading = false
      }
    },
    async openMapping() {
      if (!this.platformAdmin) return
      await this.loadMappingGovernance(this.currentTenantID)
    },
    async recoverMappingGovernanceContext(tenantID, message) {
      const targetTenantID = Number(tenantID) || 0
      const affectsCurrentTenant = governanceTenantIsCurrent(targetTenantID, this.currentTenantID)
      if (affectsCurrentTenant) {
        this.invalidateCMDBContext('检测到当前租户的 配置组织 上下文已变化，旧表单已关闭。')
      }
      const overviewReload = affectsCurrentTenant ? this.loadOverviewAndAssets() : Promise.resolve()
      const [mappingLoaded] = await Promise.all([
        this.loadMappingGovernance(targetTenantID),
        overviewReload,
      ])
      if (!mappingLoaded || !this.mappingVisible || Number(this.mappingForm.tenant_id) !== targetTenantID) return
      this.mappingError = message || '映射上下文已变化，旧预览已失效。'
      this.mappingErrorDetail = affectsCurrentTenant
        ? '已关闭旧资产、关系、监控和入库表单，并重新加载当前租户的映射与 CMDB 数据。'
        : '已重新加载目标租户的映射数据；当前租户的 CMDB 工作区未受影响。'
    },
    closeMapping() {
      if (this.mappingSaving || this.mappingPreviewLoading) return
      this.mappingSequence += 1
      this.mappingVisible = false
      this.mappingForm = {tenant_id: undefined, itop_organization_id: undefined}
      this.mappingTransitionForm = emptyMappingTransitionForm()
      this.mappingPreview = null
      this.mappingIdempotencyKey = ''
      this.mappingError = ''
      this.mappingErrorDetail = ''
    },
    syncMappingSelection(tenantID, invalidateRequest = true) {
      this.mappingForm.tenant_id = Number(tenantID) || undefined
      this.mappingForm.itop_organization_id = undefined
      this.resetMappingPreview(invalidateRequest)
    },
    resetMappingPreview(invalidateRequest = true) {
      if (invalidateRequest) this.mappingSequence += 1
      this.mappingPreview = null
      this.mappingIdempotencyKey = ''
      this.mappingTransitionForm.confirmation = ''
      this.mappingTransitionForm.reason = ''
      this.mappingError = ''
      this.mappingErrorDetail = ''
    },
    organizationSelectable(organization) {
      const status = String(organization && (organization.status || organization.state) || '').toLowerCase()
      return !status || ['active', 'enabled', 'production', 'ready'].includes(status)
    },
    organizationAssignedElsewhere(organizationID) {
      return this.mappings.some((mapping) => Number(mapping.itop_organization_id) === Number(organizationID)
        && Number(mapping.tenant_id) !== Number(this.mappingForm.tenant_id))
    },
    async previewMappingTransition() {
      const mapping = this.selectedMapping
      const governanceTenantID = Number(this.mappingForm.tenant_id) || 0
      const targetID = Number(this.mappingTransitionForm.target_organization_id) || 0
      if (!mapping || !targetID || targetID === Number(this.mappingCurrentOrganization.id)) {
        this.mappingError = '请选择与当前来源不同的目标配置组织。'
        this.mappingErrorDetail = '预览未发起，当前映射保持不变。'
        return
      }
      const sequence = ++this.mappingSequence
      this.mappingPreviewLoading = true
      this.mappingError = ''
      this.mappingErrorDetail = ''
      this.mappingPreview = null
      this.mappingIdempotencyKey = ''
      try {
        const data = this.unwrap(await previewCMDBMappingTransition(this.mappingForm.tenant_id, {
          target_organization_id: targetID,
        }))
        if (sequence !== this.mappingSequence || targetID !== Number(this.mappingTransitionForm.target_organization_id)) return
        const preview = normalizeMappingTransitionPreview(data)
        if (!preview.preview_digest || !preview.confirmation_phrase || !preview.generation) throw new Error('预览结果缺少校验摘要、组织映射版本或确认短语')
        if (preview.state !== 'active' || preview.external_data_preserved !== true) throw new Error('预览未证明活动映射与外部数据保留边界')
        if (mappingPreviewContextChanged(mapping, preview)) {
          await this.recoverMappingGovernanceContext(governanceTenantID, '映射已在其他会话中变化，旧预览已失效。')
          return
        }
        if (Number(preview.target_organization.id) !== targetID) throw new Error('预览返回的目标配置组织与当前选择不一致')
        this.mappingPreview = preview
        this.mappingIdempotencyKey = newIdempotencyKey()
        if (!this.mappingIdempotencyKey) throw new Error('当前浏览器无法生成安全幂等键，请升级浏览器后重试')
      } catch (error) {
        if (sequence !== this.mappingSequence) return
        const failure = this.cmdbFailure(error, '切换影响预览失败')
        this.mappingError = failure.message
        this.mappingErrorDetail = '未修改映射或任何外部数据。请按提示调整目标，或刷新映射状态后重新预览。'
      } finally {
        if (sequence === this.mappingSequence) this.mappingPreviewLoading = false
      }
    },
    async saveMapping() {
      if (!this.mappingForm.tenant_id || !this.mappingForm.itop_organization_id || this.selectedMapping) {
        this.mappingError = this.selectedMapping ? '已绑定租户必须使用显式配置组织切换。' : '请完整选择租户和配置组织。'
        this.mappingErrorDetail = '普通映射保存只用于首次绑定，不会静默覆盖既有来源。'
        return
      }
      this.mappingSaving = true
      this.mappingError = ''
      this.mappingErrorDetail = ''
      try {
        this.unwrap(await upsertCMDBMapping(this.mappingForm.tenant_id, this.mappingForm.itop_organization_id))
        this.$message.success('配置组织 首次映射已建立')
        this.cmdbReferences = emptyReferences()
        this.referencesContextKey = ''
        this.mappingSaving = false
        this.closeMapping()
        await this.loadOverviewAndAssets()
      } catch (error) {
        const failure = this.cmdbFailure(error, '映射建立失败')
        this.mappingError = failure.message
        this.mappingErrorDetail = failure.reason === 'mapping_transition_required'
          ? '服务端检测到该租户已有来源。当前值未改写，请关闭后重新打开治理页。'
          : '映射和外部数据保持不变；请核对配置组织占用与状态。'
      } finally {
        this.mappingSaving = false
      }
    },
    async executeMappingTransition() {
      const mapping = this.selectedMapping
      const preview = this.mappingPreview
      const governanceTenantID = Number(this.mappingForm.tenant_id) || 0
      if (!mapping || !preview || !this.mappingCanExecute) {
        this.mappingError = '请先完成有效预览，精确输入确认短语并填写切换原因。'
        this.mappingErrorDetail = '当前映射未变更。'
        return
      }
      this.mappingSaving = true
      this.mappingError = ''
      this.mappingErrorDetail = ''
      try {
        const result = this.unwrap(await executeCMDBMappingTransition(this.mappingForm.tenant_id, {
          expected_organization_id: Number(preview.current_organization.id),
          target_organization_id: Number(preview.target_organization.id),
          expected_generation: Number(preview.generation),
          preview_digest: preview.preview_digest,
          confirmation: this.mappingTransitionForm.confirmation,
          reason: String(this.mappingTransitionForm.reason || '').trim(),
          idempotency_key: this.mappingIdempotencyKey,
        })) || {}
        if (result.external_data_preserved !== true || !result.mapping) throw new Error('切换结果未证明新映射与外部数据保留边界')
        this.$message.success(`配置组织切换已完成，归档监控关联 ${Number(result.archived_monitoring) || 0} 项、监控创建任务 ${Number(result.archived_monitoring_provisions) || 0} 项、负责人关联 ${Number(result.archived_person) || 0} 项、配置场景 ${Number(result.archived_configuration_scenarios) || 0} 项、配置任务 ${Number(result.archived_configuration_tasks) || 0} 项、遗留未完成关联 ${Number(result.archived_unresolved) || 0} 项；外部数据保留。`)
        this.cmdbReferences = emptyReferences()
        this.referencesContextKey = ''
        this.mappingSaving = false
        this.closeMapping()
        await this.loadOverviewAndAssets()
      } catch (error) {
        const failure = this.cmdbFailure(error, '配置组织切换失败')
        if (mappingFailureInvalidatesContext(failure.reason)) {
          await this.recoverMappingGovernanceContext(governanceTenantID, failure.message)
          return
        }
        this.mappingError = failure.message
        this.mappingErrorDetail = '切换事务未生效，既有映射和外部数据保持不变。'
        if (['mapping_context_stale', 'mapping_preview_stale', 'mapping_confirmation_invalid', 'mapping_idempotency_conflict'].includes(failure.reason)) {
          this.mappingPreview = null
          this.mappingIdempotencyKey = ''
          this.mappingTransitionForm.confirmation = ''
        }
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

.source-strip { display: grid; grid-template-columns: 220px 150px minmax(210px, 1fr) 105px; min-height: 78px; margin-bottom: 12px; border: 1px solid #173b63; background: var(--smartops-command-navy); color: #fff; }
.source-identity, .source-field, .source-total { display: flex; justify-content: center; flex-direction: column; padding: 12px 18px; border-right: 1px solid rgba(255,255,255,.13); }
.source-identity strong { font-size: 17px; letter-spacing: .02em; }
.source-strip__eyebrow { margin-bottom: 3px; color: #82b5df; font-family: var(--smartops-font-mono); font-size: 9px; font-weight: 700; letter-spacing: .13em; }
.source-field > span, .source-total > span { margin-bottom: 5px; color: #9fb3c9; font-size: 11px; }
.source-field strong { overflow: hidden; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.source-field small { overflow: hidden; margin-top: 2px; color: #83a6c2; font-family: var(--smartops-font-mono); font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
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
.detail-grid .detail-wide { grid-column-start: 1; grid-column-end: -1; }

.monitoring-section { background: #fbfcfe; }
.monitoring-dimensions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.monitoring-dimensions article { display: flex; min-width: 0; min-height: 96px; padding: 9px; border: 1px solid #d8e2ec; background: #fff; flex-direction: column; gap: 6px; }
.monitoring-dimensions article > span:first-child { color: var(--smartops-muted); font-family: var(--smartops-font-mono); font-size: 9px; letter-spacing: .06em; }
.monitoring-dimensions article small { color: #6e7f92; font-size: 9px; line-height: 1.5; }
.monitoring-bridge { display: grid; align-items: stretch; margin-top: 13px; grid-template-columns: minmax(0, 1fr) 30px minmax(0, 1fr); }
.bridge-node { min-width: 0; padding: 10px; border: 1px solid #ccd9e5; background: #fff; }
.bridge-node > span { display: block; color: var(--smartops-muted); font-family: var(--smartops-font-mono); font-size: 9px; letter-spacing: .07em; }
.bridge-node strong { display: block; margin: 4px 0 2px; color: var(--smartops-command-navy); font-size: 14px; }
.bridge-node small { display: block; overflow: hidden; color: #76879a; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.bridge-node--cmdb { border-left: 3px solid var(--smartops-signal-blue); }
.bridge-link { position: relative; display: flex; align-items: center; justify-content: center; }
.bridge-link::before { width: 100%; height: 1px; background: #90a7bc; content: ''; }
.bridge-link span { position: absolute; width: 9px; height: 9px; border: 2px solid #90a7bc; border-radius: 50%; background: #fbfcfe; }
.monitoring-bridge[data-tone='healthy'] .bridge-link::before { background: #51a37c; }
.monitoring-bridge[data-tone='healthy'] .bridge-link span { border-color: #51a37c; }
.monitoring-bridge[data-tone='warning'] .bridge-link::before { background: #d49a35; }
.monitoring-bridge[data-tone='warning'] .bridge-link span { border-color: #d49a35; }
.monitoring-bridge[data-tone='error'] .bridge-link::before { background: #c55b5b; }
.monitoring-bridge[data-tone='error'] .bridge-link span { border-color: #c55b5b; }
.monitoring-host, .monitoring-unbound { display: flex; align-items: center; margin-top: 11px; padding: 9px 10px; border: 1px solid #dae3ec; background: #fff; gap: 9px; }
.monitoring-host > span:last-child, .monitoring-unbound > span:last-child { display: flex; min-width: 0; flex-direction: column; }
.monitoring-host strong, .monitoring-unbound strong { overflow: hidden; color: #243b55; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.monitoring-host small, .monitoring-unbound small { color: var(--smartops-muted); font-size: 9px; line-height: 1.5; }
.monitoring-host__icon, .monitoring-unbound > .anticon { display: inline-flex; align-items: center; justify-content: center; width: 29px; height: 29px; flex: 0 0 29px; background: #eaf2f9; color: var(--smartops-signal-blue); }
.monitoring-host--stale { border-color: #e7c8c8; background: #fff8f8; }
.monitoring-host--stale .monitoring-host__icon { background: #fae8e8; color: #b94f4f; }
.monitoring-unbound { border-style: dashed; }
.monitoring-issues { display: flex; margin-top: 9px; flex-wrap: wrap; gap: 4px; }
.monitoring-issues .ant-tag { margin: 0; color: #765716; }
.monitoring-evidence-reasons .ant-tag { white-space: normal; }
.monitoring-evidence { display: grid; margin: 10px 0 0; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; background: #dfe7ef; }
.monitoring-evidence > div { min-width: 0; padding: 8px; background: #fff; }
.monitoring-evidence dt { color: var(--smartops-muted); font-size: 9px; }
.monitoring-evidence dd { overflow: hidden; margin: 3px 0 0; color: #243b55; font-family: var(--smartops-font-mono); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.monitoring-actions { display: flex; align-items: center; margin-top: 12px; flex-wrap: wrap; gap: 6px; }
.monitoring-actions .ant-btn { margin: 0; }
.monitoring-error .ant-btn { margin-top: 10px; }

@media (max-width: 1280px) {
  .monitoring-dimensions { grid-template-columns: 1fr; }
}

.monitoring-modal-context { display: flex; align-items: center; margin: -4px 0 16px; padding: 13px 15px; border: 1px solid #bfd0df; background: #f1f6fa; gap: 12px; }
.monitoring-modal-context > span { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; flex: 0 0 36px; background: var(--smartops-command-navy); color: #fff; }
.monitoring-modal-context strong { display: block; color: var(--smartops-command-navy); font-size: 13px; }
.monitoring-modal-context p { margin: 3px 0 0; color: var(--smartops-muted); font-size: 11px; line-height: 1.5; }
.monitoring-candidate-error { margin-top: 12px; }
.monitoring-candidate-summary { display: flex; justify-content: space-between; min-height: 38px; padding-top: 12px; color: var(--smartops-muted); font-size: 11px; }
.monitoring-candidate-list { max-height: 430px; overflow: auto; border-top: 1px solid var(--smartops-line); }
.monitoring-candidate { display: grid; align-items: center; min-height: 72px; padding: 10px 8px; border-bottom: 1px solid var(--smartops-line); grid-template-columns: 28px minmax(145px, 1.4fr) minmax(105px, .9fr) minmax(155px, 1.2fr) 90px; gap: 10px; }
.monitoring-candidate--selected { background: #eef5fb; box-shadow: inset 3px 0 0 var(--smartops-signal-blue); }
.monitoring-candidate--disabled { background: #fafafa; opacity: .68; }
.monitoring-candidate__identity, .monitoring-candidate__match, .monitoring-candidate__state { display: flex; min-width: 0; flex-direction: column; }
.monitoring-candidate__identity strong { overflow: hidden; color: var(--smartops-command-navy); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.monitoring-candidate__identity code, .monitoring-candidate__address { color: #728498; font-family: var(--smartops-font-mono); font-size: 10px; }
.monitoring-candidate__match { align-items: flex-start; gap: 3px; }
.monitoring-candidate__match .ant-tag { margin: 0; }
.monitoring-candidate__match small, .monitoring-candidate__state small { color: var(--smartops-muted); font-size: 9px; line-height: 1.45; }

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
.asset-form-context { display: flex; align-items: center; margin: 0 0 16px; padding: 12px 14px; border: 1px solid #b9cce0; background: #f0f5fa; gap: 12px; }
.asset-form-context__mark { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; flex: 0 0 36px; background: var(--smartops-command-navy); color: #fff; }
.asset-form-context strong { display: block; color: var(--smartops-command-navy); font-size: 13px; }
.asset-form-context p { margin: 3px 0 0; color: var(--smartops-muted); font-size: 11px; line-height: 1.5; }
.asset-form-error { margin-bottom: 16px; }
.asset-form-section { display: grid; padding: 17px 0 3px; border-top: 1px solid #d9e3ec; grid-template-columns: 118px minmax(0, 1fr); gap: 18px; }
.asset-form-section:first-child { padding-top: 0; border-top: 0; }
.asset-form-section__heading { display: flex; padding-top: 3px; flex-direction: column; }
.asset-form-section__heading > span { color: var(--smartops-signal-blue); font-family: var(--smartops-font-mono); font-size: 9px; font-weight: 700; letter-spacing: .12em; }
.asset-form-section__heading strong { margin-top: 4px; color: var(--smartops-command-navy); font-size: 13px; }
.asset-form-section__heading small { margin-top: 3px; color: var(--smartops-muted); font-size: 9px; line-height: 1.5; }
.asset-form-grid { display: grid; min-width: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 16px; }
.asset-form-wide { grid-column-start: 1; grid-column-end: -1; }
.asset-form /deep/ .ant-form-item { min-width: 0; margin-bottom: 13px; }
.asset-form /deep/ .ant-form-item-label { padding-bottom: 4px; }
.asset-form /deep/ .ant-select, .asset-form /deep/ .ant-calendar-picker { width: 100%; }

.admission-workspace { display: grid; min-height: calc(100vh - 108px); margin: -24px; grid-template-columns: 340px minmax(0, 1fr); background: #f3f6f9; }
.admission-queue { min-width: 0; padding: 20px 16px; border-right: 1px solid #cdd9e4; background: #fff; }
.admission-queue__heading { display: flex; flex-direction: column; gap: 4px; }
.admission-queue__heading strong { color: var(--smartops-command-navy); font-size: 16px; }
.admission-queue__heading small { color: var(--smartops-muted); font-size: 10px; line-height: 1.5; }
.admission-filters { display: grid; margin-top: 16px; grid-template-columns: minmax(0, 1fr) 116px; gap: 8px; }
.admission-error { margin-top: 12px; }
.admission-queue__summary { display: flex; align-items: center; justify-content: space-between; min-height: 46px; color: var(--smartops-muted); font-size: 11px; }
.admission-list { max-height: calc(100vh - 280px); overflow: auto; margin: 0 -6px; padding: 0 6px 20px; }
.admission-pagination { display: flex; justify-content: center; padding: 12px 0 2px; border-top: 1px solid #e1e8ef; }
.admission-card { display: flex; width: 100%; margin: 0 0 8px; padding: 12px; border: 1px solid #d7e1eb; border-radius: 0; background: #fff; color: inherit; text-align: left; cursor: pointer; flex-direction: column; gap: 6px; appearance: none; }
.admission-card:hover { border-color: #84a7c7; background: #f8fbfe; }
.admission-card--selected { border-color: var(--smartops-signal-blue); background: #eef5fb; box-shadow: inset 3px 0 0 var(--smartops-signal-blue); }
.admission-card__top, .admission-card__facts { display: flex; align-items: center; justify-content: space-between; min-width: 0; gap: 8px; }
.admission-card__top strong { overflow: hidden; color: var(--smartops-command-navy); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.admission-card code { color: #718397; font-size: 9px; }
.admission-card__facts > span { color: #41576d; font-family: var(--smartops-font-mono); font-size: 10px; }
.admission-card__facts .ant-tag { margin: 0; }
.admission-card > small { overflow: hidden; color: var(--smartops-muted); font-size: 9px; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }

.admission-review { min-width: 0; padding: 24px 26px 42px; }
.admission-placeholder { display: flex; align-items: center; justify-content: center; min-height: 500px; color: #8090a1; flex-direction: column; gap: 8px; }
.admission-placeholder .anticon { color: #94abc0; font-size: 36px; }
.admission-placeholder strong { color: #40566d; font-size: 15px; }
.admission-placeholder span { font-size: 11px; }
.admission-review__header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; gap: 16px; }
.admission-review__header h2 { margin: 5px 0 3px; color: var(--smartops-command-navy); font-size: 22px; }
.admission-review__header p { margin: 0; color: var(--smartops-muted); font-family: var(--smartops-font-mono); font-size: 10px; }
.admission-stage-rail { display: grid; margin-bottom: 14px; border: 1px solid #ccd9e5; background: #fff; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.admission-stage { position: relative; display: flex; align-items: center; min-height: 72px; padding: 11px 12px; border-right: 1px solid #dde5ec; gap: 9px; }
.admission-stage:last-child { border-right: 0; }
.admission-stage__mark { display: inline-flex; align-items: center; justify-content: center; width: 27px; height: 27px; flex: 0 0 27px; border: 1px solid #bccbd8; background: #f5f7f9; color: #8395a7; }
.admission-stage > span:last-child { display: flex; min-width: 0; flex-direction: column; }
.admission-stage b { color: #94a3b3; font-family: var(--smartops-font-mono); font-size: 8px; letter-spacing: .08em; }
.admission-stage strong { color: #334b63; font-size: 12px; }
.admission-stage small { overflow: hidden; color: #8190a0; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
.admission-stage[data-state='done'] .admission-stage__mark { border-color: #4e9d77; background: #e8f5ef; color: #2e805c; }
.admission-stage[data-state='current'] { background: #eef5fb; box-shadow: inset 0 -3px 0 var(--smartops-signal-blue); }
.admission-stage[data-state='current'] .admission-stage__mark { border-color: var(--smartops-signal-blue); background: var(--smartops-signal-blue); color: #fff; }
.admission-stage[data-state='error'] { background: #fff4f4; }
.admission-stage[data-state='error'] .admission-stage__mark { border-color: #c85d5d; background: #c85d5d; color: #fff; }
.admission-evidence { margin-bottom: 14px; padding: 14px 16px; border: 1px solid #d3dee8; background: #fff; }
.admission-evidence__facts { display: grid; padding-bottom: 12px; border-bottom: 1px solid #e1e8ef; grid-template-columns: 1fr 1fr 2fr; gap: 12px; }
.admission-evidence__facts > span { display: flex; min-width: 0; flex-direction: column; }
.admission-evidence__facts small { color: var(--smartops-muted); font-size: 9px; }
.admission-evidence__facts strong { overflow: hidden; margin-top: 3px; color: #30485f; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.admission-classifications { display: grid; padding-top: 10px; gap: 7px; }
.admission-classifications > div { display: flex; align-items: flex-start; gap: 7px; }
.admission-classifications .ant-tag { min-width: 70px; margin: 0; text-align: center; }
.admission-classifications span { display: flex; min-width: 0; flex-direction: column; }
.admission-classifications strong { color: #31485f; font-size: 11px; }
.admission-classifications small { color: var(--smartops-muted); font-size: 9px; line-height: 1.45; }
.admission-policy-alert { margin-top: 14px; }
.admission-form-panel { padding: 16px 18px; border: 1px solid #cbd8e4; background: #fff; }
.admission-section-title { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
.admission-section-title > span { display: flex; flex-direction: column; }
.admission-section-title strong { color: var(--smartops-command-navy); font-size: 14px; }
.admission-section-title small { margin-top: 2px; color: var(--smartops-muted); font-size: 9px; }
.admission-section-title .ant-tag { margin: 0; }
.admission-form-error { margin-bottom: 14px; }
.admission-submit-row { display: flex; align-items: center; justify-content: space-between; margin: 3px -18px -16px; padding: 12px 18px; border-top: 1px solid #dce4ec; background: #f7f9fb; gap: 14px; }
.admission-submit-row > span { max-width: 430px; color: var(--smartops-muted); font-size: 9px; line-height: 1.55; }
.admission-submit-row > span .anticon { color: var(--smartops-signal-blue); }
.admission-result { display: grid; align-items: center; padding: 18px; border: 1px solid #ccd8e4; background: #fff; grid-template-columns: 42px minmax(0, 1fr) auto; gap: 14px; }
.admission-result__icon { display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; background: #e9f1f8; color: var(--smartops-signal-blue); font-size: 18px; }
.admission-result strong { color: var(--smartops-command-navy); font-size: 14px; }
.admission-result p { margin: 3px 0; color: var(--smartops-muted); font-size: 10px; }
.admission-result small { color: #738599; font-family: var(--smartops-font-mono); font-size: 9px; }
.admission-result--pending { border-color: #ddc485; background: #fffaf0; }
.admission-result--pending .admission-result__icon { background: #f8e9bd; color: #966b13; }
.admission-result--completed { border-color: #9bc7b1; background: #f3fbf7; }
.admission-result--completed .admission-result__icon { background: #dcefe5; color: #287752; }
.admission-result--conflict { border-color: #dfabab; background: #fff7f7; }
.admission-result--conflict .admission-result__icon { background: #f7dddd; color: #aa3f3f; }
.mapping-inline-error { margin-bottom: 14px; }
.mapping-governance-form /deep/ .ant-form-item { margin-bottom: 14px; }
.mapping-initial-state { display: grid; padding: 16px 17px 4px; border: 1px solid #cbd9e4; border-left: 4px solid var(--smartops-signal-blue); background: #f7fafc; grid-template-columns: minmax(220px, .8fr) minmax(300px, 1.2fr); gap: 22px; }
.mapping-initial-state header { display: flex; flex-direction: column; }
.mapping-initial-state header > span, .mapping-impact header > span, .mapping-execution header > span { color: var(--smartops-signal-blue); font-family: var(--smartops-font-mono); font-size: 9px; font-weight: 800; letter-spacing: .12em; }
.mapping-initial-state header strong, .mapping-impact header strong, .mapping-execution header strong { margin-top: 4px; color: var(--smartops-command-navy); font-size: 14px; }
.mapping-initial-state header small, .mapping-impact header small { margin-top: 4px; color: var(--smartops-muted); font-size: 10px; line-height: 1.55; }
.organization-boundary { display: grid; align-items: stretch; padding: 16px; border: 1px solid #173b63; background: #0d2c43; grid-template-columns: minmax(0, 1fr) 140px minmax(0, 1fr); }
.boundary-node { display: flex; min-width: 0; min-height: 116px; padding: 14px 15px; border: 1px solid rgba(162, 195, 217, .27); background: rgba(255, 255, 255, .045); flex-direction: column; justify-content: center; }
.boundary-node--current { border-left: 3px solid #20a4d8; }
.boundary-node--target { border-left: 3px solid #d98622; }
.boundary-node__index { color: #71b9dd; font-family: var(--smartops-font-mono); font-size: 9px; font-weight: 800; letter-spacing: .12em; }
.boundary-node strong { overflow: hidden; margin: 7px 0 3px; color: #fff; font-size: 16px; text-overflow: ellipsis; white-space: nowrap; }
.boundary-node code, .boundary-node small { overflow: hidden; color: #a7c0d1; font-family: var(--smartops-font-mono); font-size: 9px; line-height: 1.55; text-overflow: ellipsis; white-space: nowrap; }
.boundary-node small:last-child { margin-top: 6px; color: #83a1b6; font-family: inherit; }
.boundary-node /deep/ .ant-select { width: 100%; margin: 8px 0 2px; }
.boundary-node /deep/ .ant-select-selection { border-color: #87a8bd; background: #f7fbfd; }
.boundary-transfer { position: relative; display: flex; align-items: center; justify-content: center; min-width: 0; color: #9fb9ca; flex-direction: column; }
.boundary-transfer::before { position: absolute; right: 0; left: 0; height: 1px; background: #54778f; content: ''; }
.boundary-transfer span { position: relative; z-index: 1; width: 13px; height: 13px; border: 3px solid #d98622; border-radius: 50%; background: #0d2c43; }
.boundary-transfer b, .boundary-transfer small { position: relative; z-index: 1; padding: 1px 5px; background: #0d2c43; font-family: var(--smartops-font-mono); }
.boundary-transfer b { margin-top: 8px; color: #f0c175; font-size: 10px; }
.boundary-transfer small { color: #7fa9c2; font-size: 8px; letter-spacing: .08em; }
.mapping-preview-action { display: flex; align-items: center; justify-content: space-between; padding: 11px 13px; border: 1px solid #d8e2e9; border-top: 0; background: #f7f9fb; gap: 14px; }
.mapping-preview-action > span { color: #61788a; font-size: 10px; line-height: 1.55; }
.mapping-preview-action .anticon { color: var(--smartops-signal-blue); }
.mapping-impact { margin-top: 14px; border: 1px solid #cad7e1; background: #fff; }
.mapping-impact > header { display: flex; padding: 12px 14px; border-bottom: 1px solid #dce4ea; background: #f7fafc; flex-direction: column; }
.mapping-impact__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.mapping-impact__grid article { display: grid; min-width: 0; padding: 12px 13px; border-right: 1px solid #e0e7ec; border-bottom: 1px solid #e0e7ec; grid-template-columns: 30px minmax(0, 1fr); grid-template-rows: auto auto; }
.mapping-impact__grid article:nth-child(4n) { border-right: 0; }
.mapping-impact__grid article:nth-last-child(-n+3) { border-bottom: 0; }
.mapping-impact__grid article > span { grid-row: span 2; align-self: center; color: #7e91a0; font-family: var(--smartops-font-mono); font-size: 9px; font-weight: 800; }
.mapping-impact__grid article strong { color: var(--smartops-command-navy); font-family: var(--smartops-font-mono); font-size: 22px; line-height: 1; }
.mapping-impact__grid article small { overflow: hidden; margin-top: 3px; color: var(--smartops-muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.mapping-impact__grid article.mapping-impact--warning { background: #fff8ec; }
.mapping-impact__grid article.mapping-impact--warning strong { color: #b66c12; }
.mapping-impact__configuration-samples { display: grid; border-top: 1px solid #e0e7ec; background: #f8fbfd; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.mapping-impact__configuration-samples article { min-width: 0; padding: 10px 13px; }
.mapping-impact__configuration-samples article + article { border-left: 1px solid #e0e7ec; }
.mapping-impact__configuration-samples article > span { display: block; margin-bottom: 5px; color: #6d8799; font-family: var(--smartops-font-mono); font-size: 8px; font-weight: 800; letter-spacing: .08em; }
.mapping-impact__configuration-samples article > div { display: flex; min-width: 0; flex-wrap: wrap; gap: 4px; }
.mapping-impact__configuration-samples code { overflow: hidden; max-width: 100%; padding: 2px 5px; border: 1px solid #cddbe5; background: #fff; color: #36566e; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.mapping-impact__configuration-samples small { color: #8797a3; font-size: 9px; }
.mapping-impact > footer { display: flex; align-items: center; padding: 7px 13px; border-top: 1px solid #e1e7ec; background: #fbfcfd; gap: 9px; }
.mapping-impact > footer span { color: #8294a3; font-family: var(--smartops-font-mono); font-size: 8px; font-weight: 800; }
.mapping-impact > footer code { overflow: hidden; color: #4f6577; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.mapping-retention-alert { margin-top: 12px; }
.mapping-execution { margin-top: 12px; padding: 15px 16px 3px; border: 1px solid #e0c18c; border-left: 4px solid #d98622; background: #fffbf3; }
.mapping-execution header { display: flex; margin-bottom: 12px; flex-direction: column; }
.mapping-field-help { display: block; margin-top: 5px; color: #7c6c50; font-size: 10px; }
.mapping-field-help code { color: #9b5f14; font-size: 10px; font-weight: 700; }
.mapping-actions { display: flex; justify-content: flex-end; margin: 18px -22px -20px; padding: 12px 22px; border-top: 1px solid #dce4ea; background: #f7f9fb; gap: 8px; }

@media (max-width: 1240px) {
  .source-strip { grid-template-columns: 190px 140px minmax(180px, 1fr) 105px; }
  .cmdb-workbench { grid-template-columns: minmax(0, 1fr) 350px; }
}
@media (max-width: 980px) {
  .cmdb-heading { align-items: flex-start; }
  .source-strip { grid-template-columns: 1fr 1fr; }
  .source-identity, .source-field, .source-total { min-height: 66px; border-bottom: 1px solid rgba(255,255,255,.13); }
  .source-total { align-items: flex-start; }
  .cmdb-toolbar { align-items: stretch; flex-wrap: wrap; }
  .search-control { width: 100%; max-width: none; }
  .toolbar-summary { display: flex; align-items: center; margin-left: 0; }
  .cmdb-workbench { grid-template-columns: 1fr; }
  .asset-inspector { position: static; max-height: none; }
  .admission-workspace { grid-template-columns: 285px minmax(0, 1fr); }
  .admission-stage-rail { grid-template-columns: 1fr 1fr; }
  .admission-stage:nth-child(2) { border-right: 0; }
  .admission-stage:nth-child(-n+2) { border-bottom: 1px solid #dde5ec; }
  .organization-boundary { grid-template-columns: 1fr; }
  .boundary-transfer { min-height: 70px; }
  .boundary-transfer::before { top: 0; bottom: 0; left: 50%; width: 1px; height: auto; }
  .mapping-impact__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mapping-impact__grid article:nth-child(4n) { border-right: 1px solid #e0e7ec; }
  .mapping-impact__grid article:nth-child(2n) { border-right: 0; }
  .mapping-impact__grid article:nth-last-child(-n+3) { border-bottom: 1px solid #e0e7ec; }
  .mapping-impact__grid article:last-child { border-bottom: 0; }
}
@media (max-width: 640px) {
  .heading-actions { width: 100%; flex-wrap: wrap; }
  .source-strip { grid-template-columns: 1fr; }
  .source-total { grid-column: auto; }
  .filter-control { width: calc(50% - 5px); }
  .panel-heading { align-items: flex-start; flex-direction: column; gap: 8px; }
  .class-counts { max-width: 100%; flex-wrap: wrap; }
  .ledger-footer { align-items: flex-start; flex-direction: column; gap: 10px; }
  .asset-form-section { display: block; }
  .asset-form-section__heading { margin-bottom: 10px; }
  .asset-form-grid { grid-template-columns: 1fr; }
  .asset-form-wide { grid-column-start: auto; grid-column-end: auto; }
  .monitoring-candidate { grid-template-columns: 26px minmax(0, 1fr); }
  .monitoring-candidate__address, .monitoring-candidate__match, .monitoring-candidate__state { grid-column: 2; }
  .admission-workspace { display: block; }
  .admission-queue { border-right: 0; border-bottom: 1px solid #cdd9e4; }
  .admission-list { max-height: 280px; }
  .admission-review { padding: 18px 14px 32px; }
  .admission-evidence__facts { grid-template-columns: 1fr; }
  .admission-submit-row, .admission-result { align-items: stretch; grid-template-columns: 1fr; flex-direction: column; }
  .mapping-initial-state { grid-template-columns: 1fr; gap: 10px; }
  .mapping-preview-action { align-items: stretch; flex-direction: column; }
  .mapping-impact__grid, .mapping-impact__configuration-samples { grid-template-columns: 1fr; }
  .mapping-impact__grid article, .mapping-impact__grid article:nth-child(4n), .mapping-impact__grid article:nth-child(2n) { border-right: 0; border-bottom: 1px solid #e0e7ec; }
  .mapping-impact__grid article:last-child { border-bottom: 0; }
  .mapping-impact__configuration-samples article + article { border-top: 1px solid #e0e7ec; border-left: 0; }
}

.technical-details { margin-top: 4px; font-size: 12px; line-height: 1.65; min-width: 0; }
.technical-details summary { cursor: pointer; color: inherit; font-family: inherit; font-weight: 400; }
.technical-details[open] { padding-bottom: 4px; }
.technical-details code, .technical-details small { display: block; overflow-wrap: anywhere; white-space: normal; }
</style>
