<template>
  <div class="session-overlay" v-if="visible">
    <div class="session-box">
      <div class="session-icon">
        <a-icon type="lock" />
      </div>
      <div class="session-title">会话已过期</div>
      <div class="session-desc">登录凭证已失效，请重新输入密码以继续大屏展示</div>
      <a-form class="session-form" @submit.prevent="submit">
        <a-form-item>
          <a-input
            v-model="username"
            prefix="user"
            placeholder="用户名"
            :disabled="loading"
            class="session-input"
          />
        </a-form-item>
        <a-form-item>
          <a-input-password
            v-model="password"
            prefix="lock"
            placeholder="密码"
            :disabled="loading"
            class="session-input"
            @pressEnter="submit"
          />
        </a-form-item>
        <div class="session-error" v-if="error">{{ error }}</div>
        <a-button
          type="primary"
          block
          :loading="loading"
          class="session-btn"
          @click="submit"
        >
          重新登录并继续
        </a-button>
      </a-form>
    </div>
  </div>
</template>

<script>
import { login, getPermissionContext, getRoutesConfig } from '@/services/user'
import { listTenantContexts, getCurrentTenant } from '@/services/tenant'
import { setAuthorization, removeAuthorization, getTenantContext, setTenantContext } from '@/utils/request'
import { normalizeTenantItems } from '@/pages/system/tenant-context'
import { businessPayload, normalizePermissionContext, canPerform } from '@/utils/permission-policy'
import { loadRoutes } from '@/utils/routerUtil'

export default {
  name: 'SessionOverlay',
  props: {
    visible: { type: Boolean, default: false },
    defaultUsername: { type: String, default: '' }
  },
  data() {
    return {
      username: '',
      password: '',
      loading: false,
      error: '',
      restoreHint: null
    }
  },
  created() {
    // This component stays mounted before the parent's 401 overlay is shown.
    // Cached identity is a restoration hint only; the new token must revalidate it.
    const tenant = getTenantContext()
    const user = this.$store.getters['account/user']
    if (tenant && user && Number.isInteger(Number(tenant.id)) && Number(tenant.id) > 0 &&
        Number.isInteger(Number(user.id)) && Number(user.id) > 0 && typeof user.name === 'string' && user.name) {
      this.restoreHint = { tenantID: Number(tenant.id), userID: Number(user.id), username: user.name }
    }
  },
  watch: {
    visible(v) {
      if (v) {
        this.username = this.defaultUsername
        this.password = ''
        this.error = ''
      }
    }
  },
  methods: {
    resetAccountContext(user = null) {
      for (const [key, value] of Object.entries({
        setUser: user, setRoles: [], setPermissions: [], setTenants: [],
        setCurrentTenant: null, setRoutesConfig: []
      })) this.$store.commit(`account/${key}`, value)
    },
    async returnToLogin() {
      removeAuthorization()
      this.resetAccountContext()
      await this.$router.replace('/login')
    },
    async submit() {
      if (!this.username || !this.password) {
        this.error = '请输入用户名和密码'
        return
      }
      this.loading = true
      this.error = ''
      let authenticated = false
      try {
        const res = await login(this.username, this.password)
        const business = businessPayload(res)
        const token = business && business.data && business.data.token
        const user = business && business.data && business.data.user
        if (!business || Number(business.code) !== 200 || typeof token !== 'string' || !token.trim() ||
            !user || !Number.isInteger(Number(user.id)) || Number(user.id) < 1 || typeof user.name !== 'string' || !user.name) {
          throw new Error('Invalid login envelope')
        }
        authenticated = true
        const hint = this.restoreHint
        if (!hint || Number(user.id) !== hint.userID || user.name !== hint.username) {
          throw new Error('Original account cannot be restored')
        }
        setAuthorization({ token })
        this.resetAccountContext(user)
        const tenantResponse = await listTenantContexts()
        const tenantBusiness = businessPayload(tenantResponse)
        if (!tenantBusiness || Number(tenantBusiness.code) !== 200) throw new Error('Tenant list rejected')
        const tenants = normalizeTenantItems(tenantResponse)
        const tenant = tenants.find(item => Number(item.id) === hint.tenantID)
        if (!tenant) throw new Error('Original tenant is no longer accessible')
        this.$store.commit('account/setTenants', tenants)
        setTenantContext(tenant)
        const current = businessPayload(await getCurrentTenant())
        if (!current || Number(current.code) !== 200 || !current.data || !current.data.tenant ||
            Number(current.data.tenant.id) !== hint.tenantID || Number(current.data.tenant.status) !== 0) {
          throw new Error('Original tenant confirmation rejected')
        }
        const permissionResponse = await getPermissionContext()
        const permissionBusiness = businessPayload(permissionResponse)
        const access = normalizePermissionContext(permissionResponse)
        if (!permissionBusiness || Number(permissionBusiness.code) !== 200 || access.tenantID !== hint.tenantID ||
            !canPerform(access.permissions, 'tenant.dashboard', 'read')) {
          throw new Error('Original tenant dashboard permission rejected')
        }
        const routes = businessPayload(await getRoutesConfig())
        if (!routes || Number(routes.code) !== 200 || !Array.isArray(routes.data)) throw new Error('Fresh routes rejected')
        this.$store.commit('account/setCurrentTenant', current.data.tenant)
        this.$store.commit('account/setRoles', access.roles)
        this.$store.commit('account/setPermissions', access.permissions)
        loadRoutes(routes.data)
        this.$emit('success')
      } catch (e) {
        this.error = authenticated ? '无法恢复原租户，请重新登录并选择租户' : '登录失败，请检查用户名或密码'
        await this.returnToLogin()
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style lang="less" scoped>
.session-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(2, 6, 13, 0.82);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.session-box {
  width: 360px;
  background: linear-gradient(160deg, rgba(8, 22, 48, 0.98), rgba(4, 12, 28, 0.98));
  border: 1px solid rgba(0, 230, 255, 0.4);
  box-shadow: 0 0 40px rgba(0, 230, 255, 0.2), 0 0 80px rgba(0, 0, 0, 0.6);
  padding: 36px 32px 28px;
  text-align: center;
  position: relative;

  &::before, &::after {
    content: '';
    position: absolute;
    width: 14px;
    height: 14px;
    border-color: #00e6ff;
    border-style: solid;
    box-shadow: 0 0 8px rgba(0, 230, 255, 0.7);
  }
  &::before { top: -1px; left: -1px;  border-width: 2px 0 0 2px; }
  &::after  { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
}

.session-icon {
  font-size: 36px;
  color: #ffc859;
  margin-bottom: 12px;
  text-shadow: 0 0 16px rgba(255, 200, 89, 0.7);
}

.session-title {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 3px;
  margin-bottom: 8px;
}

.session-desc {
  font-size: 12px;
  color: rgba(207, 232, 255, 0.6);
  margin-bottom: 24px;
  line-height: 1.6;
}

.session-form {
  text-align: left;

  /deep/ .ant-input {
    background: rgba(0, 230, 255, 0.05);
    border-color: rgba(0, 230, 255, 0.25);
    color: #cfe8ff;

    &:focus {
      border-color: #00e6ff;
      box-shadow: 0 0 8px rgba(0, 230, 255, 0.3);
    }
  }

  /deep/ .ant-input-prefix {
    color: rgba(0, 230, 255, 0.6);
  }

  /deep/ .ant-form-item {
    margin-bottom: 12px;
  }
}

.session-error {
  font-size: 12px;
  color: #ff4d6d;
  margin-bottom: 10px;
  text-align: center;
}

.session-btn {
  background: linear-gradient(90deg, #00c6e0, #1f7bff);
  border: none;
  height: 38px;
  font-size: 14px;
  letter-spacing: 2px;
  font-weight: 600;
  box-shadow: 0 0 16px rgba(0, 230, 255, 0.4);
  margin-top: 4px;

  &:hover {
    box-shadow: 0 0 24px rgba(0, 230, 255, 0.6);
  }
}
</style>
