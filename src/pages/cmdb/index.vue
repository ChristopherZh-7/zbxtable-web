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
          <a-button v-if="sourceReady" data-testid="cmdb-admission-open" icon="radar-chart" @click="openAdmissions">发现候选入库</a-button>
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

              <div class="inspector-section monitoring-section">
                <div class="inspector-title"><span>监控闭环</span><small>CMDB ↔ ZABBIX</small></div>
                <a-spin :spinning="monitoringLoading">
                  <div v-if="monitoringError" class="monitoring-error">
                    <a-alert type="error" show-icon :message="monitoringError" />
                    <a-button size="small" icon="reload" @click="reloadMonitoring">重新对账</a-button>
                  </div>
                  <template v-else>
                    <div class="monitoring-status-line">
                      <a-badge :status="monitoringMeta.status" :text="monitoringMeta.label" />
                      <span>{{ monitoringReconciliation.summary }}</span>
                    </div>

                    <div v-if="monitoringBound" class="monitoring-bridge" :data-tone="monitoringMeta.tone">
                      <div class="bridge-node bridge-node--cmdb">
                        <span>iTop 期望</span>
                        <strong>{{ monitoringHostStatusLabel(monitoringReconciliation.expected_host_status) }}</strong>
                        <small>{{ selectedLifecycle.retired ? '资产已退役' : '资产在用' }}</small>
                      </div>
                      <div class="bridge-link" aria-hidden="true"><span></span></div>
                      <div class="bridge-node bridge-node--zabbix">
                        <span>Zabbix 实际</span>
                        <strong>{{ monitoringHostStatusLabel(monitoringReconciliation.actual_host_status) }}</strong>
                        <small>{{ monitoring.host ? monitoring.host.address || '未采集地址' : '无法读取主机' }}</small>
                      </div>
                    </div>

                    <div v-if="monitoring.host" class="monitoring-host">
                      <span class="monitoring-host__icon"><a-icon type="monitor" /></span>
                      <span>
                        <strong>{{ monitoring.host.host_name }}</strong>
                        <small>{{ monitoring.host.instance_name }} · Host {{ monitoring.host.host_id }}</small>
                      </span>
                    </div>
                    <div v-else-if="monitoringBound" class="monitoring-host monitoring-host--stale">
                      <span class="monitoring-host__icon"><a-icon type="disconnect" /></span>
                      <span>
                        <strong>已保存的监控身份不可用</strong>
                        <small>ZID {{ monitoring.binding.zid }} · Host {{ monitoring.binding.host_id }}</small>
                      </span>
                    </div>
                    <div v-else class="monitoring-unbound">
                      <a-icon type="link" />
                      <span><strong>尚未关联监控主机</strong><small>从当前租户 Host Group 中人工确认对应主机。</small></span>
                    </div>

                    <div v-if="monitoringIssueLabels.length" class="monitoring-issues">
                      <a-tag v-for="issue in monitoringIssueLabels" :key="issue">{{ issue }}</a-tag>
                    </div>

                    <div v-if="canOperate" class="monitoring-actions">
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
                  </template>
                </a-spin>
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
          <p>资产类型和所属 Organization 创建后不可变；退役会保留记录，不会删除历史。</p>
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
              <a-select v-else-if="field.kind === 'networkType'" v-model="assetForm[field.key]" show-search option-filter-prop="children" placeholder="选择网络设备类型">
                <a-select-option v-for="option in cmdbReferences.network_device_types" :key="option.id" :value="option.id">{{ option.name }}</a-select-option>
              </a-select>
              <a-select v-else-if="field.kind === 'team'" v-model="assetForm[field.key]" show-search option-filter-prop="children" placeholder="选择当前 Organization 的运维团队">
                <a-select-option v-for="option in cmdbReferences.teams" :key="option.id" :value="option.id">{{ option.name }}</a-select-option>
              </a-select>
              <a-select v-else-if="field.kind === 'person'" v-model="assetForm[field.key]" allow-clear show-search option-filter-prop="children" placeholder="选择当前 Organization 的人员">
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
            <span class="smartops-section-label">ZABBIX CLASSIFIED HOSTS</span>
            <strong>当前租户发现候选</strong>
            <small>仅展示 F26 已有模板分类证据的 Host</small>
          </div>
          <div class="admission-filters">
            <a-input-search
              v-model.trim="admissionSearch"
              allow-clear
              placeholder="搜索主机、IP、Host ID"
              :loading="admissionLoading"
              @search="loadAdmissions"
            />
            <a-select v-model="admissionStateFilter" allow-clear placeholder="全部阶段" @change="loadAdmissions">
              <a-select-option value="ready">待人工审核</a-select-option>
              <a-select-option value="binding_pending">监控待关联</a-select-option>
              <a-select-option value="conflict">身份冲突</a-select-option>
              <a-select-option value="completed">闭环完成</a-select-option>
            </a-select>
          </div>
          <a-alert v-if="admissionError" type="error" show-icon :message="admissionError" class="admission-error" />
          <a-spin :spinning="admissionLoading">
            <div class="admission-queue__summary">
              <span>{{ admissionPage.total }} 台候选主机</span>
              <a-button type="link" size="small" icon="reload" @click="loadAdmissions">刷新证据</a-button>
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
                <code>{{ candidate.instance_name }} / Host {{ candidate.host_id }}</code>
                <span class="admission-card__facts">
                  <span>{{ candidate.address || '未采集 IP' }}</span>
                  <a-tag :color="classMeta(candidate.suggested_class).color">建议 {{ classMeta(candidate.suggested_class).label }}</a-tag>
                </span>
                <small>{{ admissionEvidenceLabel(candidate) }}</small>
              </button>
            </div>
            <a-empty v-else-if="!admissionLoading" :image-style="{height: '46px'}" description="当前条件下没有发现候选" />
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
                <span class="smartops-section-label">GOVERNED ADMISSION</span>
                <h2>{{ selectedAdmission.host_name }}</h2>
                <p>{{ selectedAdmission.instance_name }} · Host {{ selectedAdmission.host_id }} · {{ selectedAdmission.address || '未采集 IP' }}</p>
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
                <span><small>Inventory</small><strong>{{ admissionInventorySummary }}</strong></span>
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

            <div v-if="selectedAdmission.state === 'ready' && canCreate" class="admission-form-panel">
              <div class="admission-section-title">
                <span><strong>人工确认资产与责任</strong><small>引用只来自当前 iTop Organization</small></span>
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
                    <a-select v-model="admissionApplicationID" data-testid="cmdb-admission-application" allow-clear show-search option-filter-prop="children" placeholder="可选：写入 iTop 标准应用关系">
                      <a-select-option v-for="option in cmdbReferences.applications" :key="option.id" :value="option.id">{{ option.name }}</a-select-option>
                    </a-select>
                  </a-form-model-item>
                </div>
              </a-form-model>
              <div class="admission-submit-row">
                <span><a-icon type="safety-certificate" /> 先写 iTop，再建立 F49 监控关联；部分失败会保留 CI 并显示可重试阶段。</span>
                <a-button data-testid="cmdb-admission-submit" type="primary" icon="check" :loading="admissionSaving" @click="saveAdmission">确认入库并关联</a-button>
              </div>
            </div>

            <div v-else-if="selectedAdmission.state === 'binding_pending'" class="admission-result admission-result--pending">
              <span class="admission-result__icon"><a-icon type="clock-circle" /></span>
              <div>
                <strong>iTop 已建档，监控待关联</strong>
                <p>{{ selectedAdmission.state_message }}</p>
                <small>{{ selectedAdmission.asset_key }} · {{ selectedAdmission.asset && selectedAdmission.asset.smartops_operations_team_name || '责任已保存' }}</small>
              </div>
              <a-button v-if="canOperate" data-testid="cmdb-admission-retry" type="primary" icon="sync" :loading="admissionRetrying" @click="retryAdmission">重试 Zabbix 关联</a-button>
            </div>

            <div v-else-if="selectedAdmission.state === 'completed'" class="admission-result admission-result--completed">
              <span class="admission-result__icon"><a-icon type="check" /></span>
              <div><strong>责任与监控已闭环</strong><p>{{ selectedAdmission.state_message }}</p><small>{{ selectedAdmission.asset_key }}</small></div>
              <a-button icon="database" @click="showAdmissionAsset">查看 CMDB 资产</a-button>
            </div>

            <div v-else-if="selectedAdmission.state === 'conflict'" class="admission-result admission-result--conflict">
              <span class="admission-result__icon"><a-icon type="warning" /></span>
              <div><strong>需要人工处理身份冲突</strong><p>{{ selectedAdmission.state_message }}</p><small>不会覆盖现有 CI 或 Zabbix 绑定。</small></div>
            </div>
          </template>
        </section>
      </div>
    </a-drawer>

    <a-modal
      :visible="monitoringBindingVisible"
      :title="monitoringBound ? '更换 Zabbix 监控主机' : '关联 Zabbix 监控主机'"
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
          <p>候选仅来自当前租户的 Host Group；名称与 IP 匹配用于排序，最终仍需人工确认。</p>
        </div>
      </div>
      <a-input-search
        v-model.trim="monitoringCandidateSearch"
        allow-clear
        placeholder="搜索主机名称、IP、Host ID 或 Zabbix 实例"
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
  admitCMDBCandidate,
  bindCMDBMonitoring,
  createCMDBAsset,
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
  isPlatformAdmin,
  lifecycleMeta,
  mappingForTenant,
  monitoringHostStatusLabel,
  monitoringStateMeta,
  relationBuckets,
  statusOptions,
  statusMeta,
  validateAssetForm,
} from './cmdb-model'

const {canPerform} = require('@/utils/permission-policy')

const emptyAssetPage = () => ({items: [], total: 0, page: 1, page_size: 30, counts: {}})
const emptyAdmissionPage = () => ({items: [], total: 0, limit: 200})
const emptyMonitoring = () => ({
  binding: null,
  host: null,
  reconciliation: {
    state: 'unbound', label: '未关联', severity: 'default', summary: '尚未选择对应的 Zabbix 监控主机。',
    issues: [], can_repair: false, expected_host_status: 'enabled', actual_host_status: '',
  },
})

export default {
  name: 'CMDBCenter',
  components: {PageLayout},
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
      admissionSearch: '',
      admissionStateFilter: undefined,
      admissionCandidates: [],
      admissionPage: emptyAdmissionPage(),
      selectedAdmission: null,
      admissionFormClass: 'Server',
      admissionForm: createAssetForm('Server'),
      admissionApplicationID: undefined,
      admissionStages: [
        {label: '发现主机', caption: 'Zabbix 模板证据'},
        {label: '责任确认', caption: '团队与主备负责人'},
        {label: 'iTop 建档', caption: 'CI 与应用关系'},
        {label: 'Zabbix 关联', caption: '唯一 Host 身份'},
      ],
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
      cmdbReferences: {locations: [], network_device_types: [], teams: [], people: [], applications: []},
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
    monitoringReconciliation() { return this.monitoring && this.monitoring.reconciliation || emptyMonitoring().reconciliation },
    monitoringMeta() { return monitoringStateMeta(this.monitoringReconciliation) },
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
  },
  created() {
    this.loadOverviewAndAssets()
  },
  methods: {
    admissionEvidenceLabel,
    admissionStateMeta,
    assetKey,
    candidateMatchLabel,
    classMeta,
    monitoringHostStatusLabel,
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
      this.monitoringCandidatesLoading = true
      this.monitoringCandidateError = ''
      try {
        const data = this.unwrap(await listCMDBMonitoringCandidates(this.selectedAsset.class, this.selectedAsset.id, {
          search: this.monitoringCandidateSearch || undefined,
        })) || {items: [], total: 0, limit: 200}
        this.monitoringCandidates = Array.isArray(data.items) ? data.items : []
        this.monitoringCandidatePage = {total: Number(data.total) || 0, limit: Number(data.limit) || 200}
        if (this.selectedMonitoringCandidate) {
          const selectedKey = this.monitoringCandidateKey(this.selectedMonitoringCandidate)
          this.selectedMonitoringCandidate = this.monitoringCandidates.find((candidate) => this.monitoringCandidateKey(candidate) === selectedKey) || null
        }
      } catch (error) {
        this.monitoringCandidates = []
        this.monitoringCandidatePage = {total: 0, limit: 200}
        this.monitoringCandidateError = error.message || '监控主机候选加载失败'
      } finally {
        this.monitoringCandidatesLoading = false
      }
    },
    selectMonitoringCandidate(candidate) {
      if (!candidate || !candidate.selectable) return
      this.selectedMonitoringCandidate = candidate
    },
    async saveMonitoringBinding() {
      if (!this.canOperate || !this.selectedAsset || !this.selectedMonitoringCandidate) {
        this.monitoringCandidateError = '请选择一台可关联的 Zabbix 主机'
        return
      }
      this.monitoringBindingSaving = true
      this.monitoringCandidateError = ''
      try {
        this.monitoring = this.unwrap(await bindCMDBMonitoring(
          this.selectedAsset.class,
          this.selectedAsset.id,
          this.selectedMonitoringCandidate.zid,
          this.selectedMonitoringCandidate.host_id,
        )) || emptyMonitoring()
        this.monitoringError = ''
        this.monitoringBindingVisible = false
        this.$message.success('Zabbix 监控主机已关联')
      } catch (error) {
        this.monitoringCandidateError = error.businessCode === 1013
          ? '该监控主机已绑定其他 CMDB 资产，请选择其他主机。'
          : error.message || '监控主机关联失败'
      } finally {
        this.monitoringBindingSaving = false
      }
    },
    confirmMonitoringUnbind() {
      if (!this.canOperate || !this.selectedAsset || !this.monitoringBound) return
      this.$confirm({
        title: '解除这项监控关联？',
        content: '只删除 SmartOps 中的身份关联，不会删除 iTop 资产或 Zabbix 主机。',
        okText: '解除关联',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => this.runMonitoringUnbind(),
      })
    },
    async runMonitoringUnbind() {
      try {
        this.monitoring = this.unwrap(await unbindCMDBMonitoring(this.selectedAsset.class, this.selectedAsset.id)) || emptyMonitoring()
        this.monitoringError = ''
        this.$message.success('Zabbix 监控关联已解除')
      } catch (error) {
        this.$message.error(error.message || '解除监控关联失败')
      }
    },
    confirmMonitoringRepair() {
      if (!this.canOperate || !this.selectedAsset || !this.monitoringReconciliation.can_repair) return
      const expected = monitoringHostStatusLabel(this.monitoringReconciliation.expected_host_status)
      this.$confirm({
        title: `将 Zabbix 监控调整为“${expected}”？`,
        content: '本操作只修改 Zabbix Host 的启停状态，不会覆盖双方名称、IP、接口、模板或资产属性。',
        okText: '按 CMDB 状态修复监控',
        cancelText: '取消',
        onOk: () => this.runMonitoringRepair(),
      })
    },
    async runMonitoringRepair() {
      this.monitoringRepairing = true
      try {
        this.monitoring = this.unwrap(await repairCMDBMonitoring(this.selectedAsset.class, this.selectedAsset.id)) || emptyMonitoring()
        this.monitoringError = ''
        this.$message.success('Zabbix 监控状态已按 CMDB 修复')
      } catch (error) {
        this.$message.error(error.message || '监控状态修复失败')
        await this.loadMonitoring(this.selectedAsset, this.detailSequence)
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
      if (this.canCreate) {
        try {
          await this.ensureCMDBReferences()
        } catch (error) {
          this.admissionError = error.message || 'iTop 责任引用加载失败'
        }
      }
      await this.loadAdmissions()
    },
    closeAdmissions() {
      if (this.admissionSaving || this.admissionRetrying) return
      this.admissionVisible = false
      this.admissionFormError = ''
    },
    async loadAdmissions() {
      const retainedKey = this.selectedAdmissionKey
      this.admissionLoading = true
      this.admissionError = ''
      try {
        const data = this.unwrap(await listCMDBAdmissions({
          search: this.admissionSearch || undefined,
          state: this.admissionStateFilter || undefined,
        })) || emptyAdmissionPage()
        this.admissionCandidates = Array.isArray(data.items) ? data.items : []
        this.admissionPage = {...emptyAdmissionPage(), ...data}
        const selected = this.admissionCandidates.find((candidate) => this.admissionCandidateKey(candidate) === retainedKey)
          || this.admissionCandidates[0]
          || null
        this.selectAdmission(selected)
      } catch (error) {
        this.admissionCandidates = []
        this.admissionPage = emptyAdmissionPage()
        this.selectedAdmission = null
        this.admissionError = error.message || '发现候选加载失败'
      } finally {
        this.admissionLoading = false
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
        const result = this.unwrap(await admitCMDBCandidate({
          zid: Number(this.selectedAdmission.zid),
          host_id: String(this.selectedAdmission.host_id),
          class: this.admissionFormClass,
          fields: buildAssetFields(this.admissionFormClass, this.admissionForm, true),
          application_id: Number(this.admissionApplicationID) || 0,
        })) || {}
        if (result.state === 'completed') this.$message.success(result.message || '发现候选已完成入库与监控关联')
        else if (result.state === 'binding_pending') this.$message.warning(result.message || 'iTop 已建档，Zabbix 关联待重试')
        else this.$message.warning(result.message || '入库结果需要人工处理')
        await this.loadOverviewAndAssets()
        await this.loadAdmissions()
        const retained = this.admissionCandidates.find((candidate) => this.admissionCandidateKey(candidate) === retainedKey)
        if (retained) this.selectAdmission(retained)
      } catch (error) {
        if (error.businessCode === 1013) this.admissionFormError = '同类型同名 CI 或监控身份已存在，请核对现有资产。'
        else this.admissionFormError = error.message || '发现候选入库失败'
      } finally {
        this.admissionSaving = false
      }
    },
    async retryAdmission() {
      if (!this.canOperate || !this.selectedAdmission || this.selectedAdmission.state !== 'binding_pending') return
      this.admissionRetrying = true
      const retainedKey = this.selectedAdmissionKey
      try {
        const result = this.unwrap(await retryCMDBAdmission(this.selectedAdmission.zid, this.selectedAdmission.host_id)) || {}
        if (result.state === 'completed') this.$message.success(result.message || 'Zabbix 关联已补齐')
        else this.$message.warning(result.message || 'Zabbix 关联仍待重试')
        await this.loadAdmissions()
        const retained = this.admissionCandidates.find((candidate) => this.admissionCandidateKey(candidate) === retainedKey)
        if (retained) this.selectAdmission(retained)
      } catch (error) {
        this.$message.error(error.message || '监控关联重试失败')
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
      if (this.referencesLoaded) return
      const data = this.unwrap(await getCMDBReferences()) || {}
      this.cmdbReferences = {
        locations: Array.isArray(data.locations) ? data.locations : [],
        network_device_types: Array.isArray(data.network_device_types) ? data.network_device_types : [],
        teams: Array.isArray(data.teams) ? data.teams : [],
        people: Array.isArray(data.people) ? data.people : [],
        applications: Array.isArray(data.applications) ? data.applications : [],
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
.detail-grid .detail-wide { grid-column-start: 1; grid-column-end: -1; }

.monitoring-section { background: #fbfcfe; }
.monitoring-status-line { display: flex; align-items: flex-start; flex-direction: column; gap: 6px; }
.monitoring-status-line > span:last-child { color: var(--smartops-muted); font-size: 11px; line-height: 1.55; }
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
.monitoring-actions { display: flex; align-items: center; margin-top: 12px; flex-wrap: wrap; gap: 6px; }
.monitoring-actions .ant-btn { margin: 0; }
.monitoring-error .ant-btn { margin-top: 10px; }

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
  .admission-workspace { grid-template-columns: 285px minmax(0, 1fr); }
  .admission-stage-rail { grid-template-columns: 1fr 1fr; }
  .admission-stage:nth-child(2) { border-right: 0; }
  .admission-stage:nth-child(-n+2) { border-bottom: 1px solid #dde5ec; }
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
}
</style>
