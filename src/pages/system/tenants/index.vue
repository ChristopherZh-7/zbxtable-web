<template>
  <page-layout :noTitle="true">
    <div class="tenant-toolbar">
      <a-alert type="info" show-icon message="租户范围由服务端按 Zabbix 实例和稳定 Host Group ID 强制隔离。" />
      <a-button type="primary" icon="plus" @click="openCreate">新增租户</a-button>
    </div>

    <a-table :loading="loading" :columns="columns" :data-source="tenants" :row-key="record => record.id">
      <template slot="status" slot-scope="record">
        <a-switch
          :checked="Number(record.status) === 0"
          checked-children="启用"
          un-checked-children="停用"
          @change="checked => changeStatus(record, checked)"
        />
      </template>
      <template slot="members" slot-scope="record">
        <a-tag v-for="member in record.members || []" :key="member.user_id">
          {{ member.user && member.user.username ? member.user.username : member.user_id }}
        </a-tag>
      </template>
      <template slot="scopes" slot-scope="record">
        <a-tag v-for="scope in record.scopes || []" :key="`${scope.zid}:${scope.host_group_id}`" color="blue">
          {{ instanceName(scope.zid) }} / {{ scope.host_group_name || scope.host_group_id }}
        </a-tag>
      </template>
      <template slot="operation" slot-scope="record">
        <a-button type="link" @click="openEdit(record)">编辑</a-button>
      </template>
    </a-table>

    <a-modal
      :title="editingID ? '编辑租户' : '新增租户'"
      :visible="visible"
      :confirm-loading="saving"
      width="780px"
      @ok="save"
      @cancel="close"
    >
      <a-form-model :model="draft" :label-col="{span: 5}" :wrapper-col="{span: 18}">
        <a-form-model-item label="租户编码" required>
          <a-input v-model.trim="draft.code" :disabled="Boolean(editingID)" placeholder="例如 customer_a" />
          <div class="field-help">创建后不可修改。</div>
        </a-form-model-item>
        <a-form-model-item label="租户名称" required>
          <a-input v-model.trim="draft.name" placeholder="客户或业务组织名称" />
        </a-form-model-item>
        <a-form-model-item label="成员">
          <a-select v-model="draft.member_ids" mode="multiple" option-filter-prop="children" placeholder="可分配一个或多个现有用户">
            <a-select-option v-for="user in users" :key="user.id" :value="user.id">{{ user.username }}</a-select-option>
          </a-select>
        </a-form-model-item>
        <a-form-model-item label="资源范围">
          <div v-for="(scope, index) in draft.scopes" :key="index" class="scope-row">
            <a-select v-model="scope.zid" placeholder="Zabbix 实例" @change="value => changeScopeInstance(scope, value)">
              <a-select-option v-for="instance in instances" :key="instance.id" :value="instance.id">{{ instance.name }}</a-select-option>
            </a-select>
            <a-select
              v-model="scope.host_group_id"
              show-search
              option-filter-prop="children"
              placeholder="Host Group"
              @focus="loadGroups(scope.zid)"
              @change="value => changeScopeGroup(scope, value)"
            >
              <a-select-option v-for="group in groupsByZID[scope.zid] || []" :key="group.groupid" :value="group.groupid">{{ group.name }}</a-select-option>
            </a-select>
            <a-button type="link" icon="delete" @click="removeScope(index)">移除</a-button>
          </div>
          <a-button type="dashed" icon="plus" block @click="addScope">添加 Host Group 范围</a-button>
        </a-form-model-item>
      </a-form-model>
    </a-modal>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import { userList } from '@/services/admin'
import { listZabbixInstance } from '@/services/zabbix'
import {
  createTenant,
  listTenantResources,
  listTenants,
  updateTenant,
  updateTenantStatus,
} from '@/services/tenant'
import { buildTenantPayload, validateTenantDraft } from '../tenant-context'

const emptyDraft = () => ({code: '', name: '', member_ids: [], scopes: []})
const business = (response) => response && response.data && response.data.code !== undefined ? response.data : response
const items = (response) => {
  const value = business(response)
  if (value && Array.isArray(value.data)) return value.data
  return value && value.data && Array.isArray(value.data.items) ? value.data.items : []
}

export default {
  name: 'TenantManagement',
  components: {PageLayout},
  data() {
    return {
      loading: false,
      saving: false,
      visible: false,
      editingID: null,
      tenants: [],
      users: [],
      instances: [],
      groupsByZID: {},
      draft: emptyDraft(),
      columns: [
        {title: '编码', dataIndex: 'code'},
        {title: '名称', dataIndex: 'name'},
        {title: '成员', scopedSlots: {customRender: 'members'}},
        {title: '资源范围', scopedSlots: {customRender: 'scopes'}},
        {title: '状态', scopedSlots: {customRender: 'status'}, width: 110},
        {title: '操作', scopedSlots: {customRender: 'operation'}, width: 90},
      ],
    }
  },
  created() {
    this.reload()
    this.loadOptions()
  },
  methods: {
    async reload() {
      this.loading = true
      try {
        this.tenants = items(await listTenants())
      } catch (error) {
        this.$message.error('加载租户失败')
      } finally {
        this.loading = false
      }
    },
    async loadOptions() {
      try {
        const [users, instances] = await Promise.all([
          userList({page: 1, limit: 200}),
          listZabbixInstance(),
        ])
        this.users = items(users)
        this.instances = items(instances)
      } catch (error) {
        this.$message.error('加载用户或 Zabbix 实例失败')
      }
    },
    instanceName(zid) {
      const instance = this.instances.find((item) => Number(item.id) === Number(zid))
      return instance ? instance.name : `Zabbix #${zid}`
    },
    openCreate() {
      this.editingID = null
      this.draft = emptyDraft()
      this.visible = true
    },
    async openEdit(record) {
      this.editingID = record.id
      this.draft = {
        code: record.code,
        name: record.name,
        member_ids: (record.members || []).map((member) => member.user_id),
        scopes: (record.scopes || []).map((scope) => ({...scope})),
      }
      await Promise.all(this.draft.scopes.map((scope) => this.loadGroups(scope.zid)))
      this.visible = true
    },
    close() {
      this.visible = false
      this.editingID = null
      this.draft = emptyDraft()
    },
    addScope() {
      this.draft.scopes.push({zid: undefined, host_group_id: undefined, host_group_name: ''})
    },
    removeScope(index) {
      this.draft.scopes.splice(index, 1)
    },
    changeScopeInstance(scope, zid) {
      scope.zid = zid
      scope.host_group_id = undefined
      scope.host_group_name = ''
      this.loadGroups(zid)
    },
    changeScopeGroup(scope, groupID) {
      const group = (this.groupsByZID[scope.zid] || []).find((item) => item.groupid === groupID)
      scope.host_group_name = group ? group.name : ''
    },
    async loadGroups(zid) {
      if (!zid || this.groupsByZID[zid]) return
      try {
        const groups = items(await listTenantResources(zid))
        this.$set(this.groupsByZID, zid, groups)
      } catch (error) {
        this.$message.error('加载 Host Group 失败')
      }
    },
    async save() {
      const validation = validateTenantDraft(this.draft)
      if (validation) {
        this.$message.warning(validation)
        return
      }
      this.saving = true
      try {
        const payload = buildTenantPayload(this.draft, Boolean(this.editingID))
        const result = this.editingID
          ? await updateTenant(this.editingID, payload)
          : await createTenant(payload)
        const value = business(result)
        if (!value || Number(value.code) !== 200) throw new Error(value && value.message)
        this.$message.success(this.editingID ? '租户已更新' : '租户已创建')
        this.close()
        await this.reload()
      } catch (error) {
        this.$message.error(error.message || '保存租户失败')
      } finally {
        this.saving = false
      }
    },
    async changeStatus(record, enabled) {
      try {
        const result = business(await updateTenantStatus(record.id, enabled ? 0 : 1))
        if (!result || Number(result.code) !== 200) throw new Error(result && result.message)
        await this.reload()
      } catch (error) {
        this.$message.error(error.message || '更新状态失败')
        await this.reload()
      }
    },
  },
}
</script>

<style lang="less" scoped>
.tenant-toolbar { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.tenant-toolbar .ant-alert { flex: 1; }
.scope-row { display: grid; grid-template-columns: 190px 1fr 70px; gap: 8px; margin-bottom: 8px; }
.field-help { color: rgba(0, 0, 0, .45); font-size: 12px; }
</style>
