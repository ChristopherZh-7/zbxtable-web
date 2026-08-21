<template>
  <page-layout :noTitle="true">
    <a-alert
      type="info"
      show-icon
      message="内置角色与权限边界"
      description="平台管理员管理全局账号和配置；租户管理员管理当前租户；只读用户只能查询当前租户且不能导出或修改。"
      class="role-alert"
    />

    <a-card title="添加已有普通账号" class="member-card">
      <a-form-model layout="inline" :model="draft">
        <a-form-model-item label="准确用户名" required>
          <a-input v-model.trim="draft.username" autocomplete="off" placeholder="不会提供全平台账号搜索" />
        </a-form-model-item>
        <a-form-model-item label="租户角色" required>
          <a-select v-model="draft.role" style="width: 150px">
            <a-select-option value="viewer">只读用户</a-select-option>
            <a-select-option value="tenant_admin">租户管理员</a-select-option>
          </a-select>
        </a-form-model-item>
        <a-form-model-item>
          <a-button v-auth="'create'" type="primary" :loading="saving" @click="addMember">添加成员</a-button>
        </a-form-model-item>
      </a-form-model>
    </a-card>

    <a-table :loading="loading" :columns="columns" :data-source="members" :row-key="record => record.id">
      <template slot="role" slot-scope="record">
        <a-select :value="record.role" style="width: 150px" @change="role => changeRole(record, role)">
          <a-select-option value="viewer">只读用户</a-select-option>
          <a-select-option value="tenant_admin">租户管理员</a-select-option>
        </a-select>
      </template>
      <template slot="status" slot-scope="record">
        <a-tag :color="Number(record.status) === 0 ? 'green' : 'red'">
          {{ Number(record.status) === 0 ? '已启用' : '已停用' }}
        </a-tag>
      </template>
      <template slot="operation" slot-scope="record">
        <a-popconfirm title="确定从当前租户移除此成员？" @confirm="removeMember(record)">
          <a-button v-auth="'delete'" type="link">移除</a-button>
        </a-popconfirm>
      </template>
    </a-table>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import {
  addCurrentTenantMember,
  deleteCurrentTenantMember,
  listCurrentTenantMembers,
  updateCurrentTenantMemberRole,
} from '@/services/tenant'
import { businessPayload } from '@/utils/permission-policy'

const responseItems = (response) => {
  const business = businessPayload(response)
  return business && business.data && Array.isArray(business.data.items) ? business.data.items : []
}

export default {
  name: 'TenantMembers',
  components: {PageLayout},
  data: () => ({
    loading: false,
    saving: false,
    members: [],
    draft: {username: '', role: 'viewer'},
    columns: [
      {title: '用户名', dataIndex: 'username'},
      {title: '租户角色', scopedSlots: {customRender: 'role'}, width: 190},
      {title: '账号状态', scopedSlots: {customRender: 'status'}, width: 120},
      {title: '加入时间', dataIndex: 'created_at'},
      {title: '操作', scopedSlots: {customRender: 'operation'}, width: 100},
    ],
  }),
  created() {
    this.reload()
  },
  methods: {
    async reload() {
      this.loading = true
      try {
        this.members = responseItems(await listCurrentTenantMembers())
      } catch (error) {
        this.$message.error(error.message || '加载租户成员失败')
      } finally {
        this.loading = false
      }
    },
    async addMember() {
      if (!this.draft.username) {
        this.$message.warning('请输入准确用户名')
        return
      }
      this.saving = true
      try {
        const result = businessPayload(await addCurrentTenantMember({...this.draft}))
        if (!result || Number(result.code) !== 200) throw new Error(result && result.message)
        this.$message.success('租户成员已添加')
        this.draft = {username: '', role: 'viewer'}
        await this.reload()
      } catch (error) {
        this.$message.error(error.message || '添加租户成员失败')
      } finally {
        this.saving = false
      }
    },
    async changeRole(record, role) {
      try {
        const result = businessPayload(await updateCurrentTenantMemberRole(record.id, role))
        if (!result || Number(result.code) !== 200) throw new Error(result && result.message)
        this.$message.success('租户成员角色已更新')
      } catch (error) {
        this.$message.error(error.message || '更新租户角色失败')
      } finally {
        await this.reload()
      }
    },
    async removeMember(record) {
      try {
        const result = businessPayload(await deleteCurrentTenantMember(record.id))
        if (!result || Number(result.code) !== 200) throw new Error(result && result.message)
        this.$message.success('租户成员已移除')
      } catch (error) {
        this.$message.error(error.message || '移除租户成员失败')
      } finally {
        await this.reload()
      }
    },
  },
}
</script>

<style lang="less" scoped>
.role-alert { margin-bottom: 16px; }
.member-card { margin-bottom: 16px; }
</style>
