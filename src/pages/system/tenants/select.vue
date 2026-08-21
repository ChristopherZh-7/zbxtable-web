<template>
  <div class="tenant-select-page">
    <a-card title="选择当前租户" class="tenant-select-card" :loading="loading">
      <a-alert type="info" show-icon message="业务数据始终以当前租户为边界；如有多个租户，必须明确选择。" />
      <a-select v-model="selectedID" size="large" placeholder="请选择租户" class="tenant-select-input">
        <a-select-option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
          {{ tenant.name }}（{{ tenant.code }}）
        </a-select-option>
      </a-select>
      <a-button type="primary" size="large" block :disabled="!selectedID" :loading="saving" @click="confirm">
        进入租户
      </a-button>
    </a-card>
  </div>
</template>

<script>
import { getCurrentTenant, listTenantContexts } from '@/services/tenant'
import { getTenantContext, removeTenantContext, setTenantContext } from '@/utils/request'
import { normalizeTenantItems } from '../tenant-context'

export default {
  name: 'TenantSelect',
  data: () => ({loading: false, saving: false, tenants: [], selectedID: undefined}),
  created() { this.load() },
  methods: {
    async load() {
      this.loading = true
      try {
        this.tenants = normalizeTenantItems(await listTenantContexts())
        this.$store.commit('account/setTenants', this.tenants)
      } catch (error) {
        this.$message.error('加载可用租户失败')
      } finally {
        this.loading = false
      }
    },
    async confirm() {
      const tenant = this.tenants.find((item) => Number(item.id) === Number(this.selectedID))
      if (!tenant) return
      const previous = getTenantContext()
      this.saving = true
      try {
        setTenantContext(tenant)
        const result = await getCurrentTenant()
        const business = result && result.data && result.data.code !== undefined ? result.data : result
        if (!business || Number(business.code) !== 200) throw new Error(business && business.message)
        this.$store.commit('account/setCurrentTenant', tenant)
        this.$router.replace('/dashboard/workplace')
      } catch (error) {
        if (previous) setTenantContext(previous)
        else removeTenantContext()
        this.$message.error(error.message || '切换租户失败')
      } finally {
        this.saving = false
      }
    },
  },
}
</script>

<style lang="less" scoped>
.tenant-select-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f0f2f5; }
.tenant-select-card { width: 480px; }
.tenant-select-input { width: 100%; margin: 24px 0; }
</style>
