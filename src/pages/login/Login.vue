<template>
  <div class="login-container">
    <section class="smartops-login-story" aria-label="系统介绍">
      <div class="smartops-login-context">
        <span></span>
        {{ systemName }}
      </div>

      <div class="smartops-login-statement">
        <p class="smartops-login-kicker">运行脉络</p>
        <h1>让资产、告警与处置<br />沿一条线清晰呈现</h1>
        <p class="smartops-login-description">
          面向日常运维值守与管理决策，把分散状态收拢为可追踪、可核对的运行视图。
        </p>
      </div>

      <div class="smartops-login-rail" aria-label="核心能力">
        <div class="smartops-login-rail-item">
          <span class="rail-index">01</span>
          <span class="rail-node is-active"></span>
          <span>资产状态</span>
        </div>
        <div class="smartops-login-rail-item">
          <span class="rail-index">02</span>
          <span class="rail-node is-warning"></span>
          <span>告警影响</span>
        </div>
        <div class="smartops-login-rail-item">
          <span class="rail-index">03</span>
          <span class="rail-node"></span>
          <span>处置进度</span>
        </div>
      </div>
    </section>

    <main class="smartops-login-workbench">
      <div class="smartops-login-panel">
        <div class="smartops-login-brand">
          <img
            :src="logoUrl"
            class="smartops-login-brand-image"
            alt="奇安信 新一代网络安全领军者"
          />
        </div>

        <header class="smartops-login-heading">
          <p>安全登录</p>
          <h2>{{ systemName }}</h2>
          <span>{{ systemSubtitle }}</span>
        </header>

        <div class="form-section">
        <a-form @submit="onSubmit" :form="form">
          <a-alert 
            type="error" 
            :closable="true" 
            v-show="error" 
            :message="error" 
            showIcon 
            class="error-alert"
          />
          
          <a-form-item class="form-item">
            <a-input 
              autocomplete="autocomplete" 
              size="large" 
              :placeholder="$t('pleaseInputUsername')"
              v-decorator="['name', {rules: [{ required: true, message: $t('pleaseInputUsername'), whitespace: true}]}]"
              class="custom-input"
              aria-label="用户名"
            >
              <a-icon slot="prefix" type="user" class="input-icon" />
            </a-input>
          </a-form-item>
          
          <a-form-item class="form-item">
            <a-input 
              size="large" 
              autocomplete="autocomplete" 
              type="password" 
              :placeholder="$t('pleaseInputPassword')"
              v-decorator="['password', {rules: [{ required: true, message: $t('pleaseInputPassword'), whitespace: true}]}]"
              class="custom-input"
              aria-label="密码"
            >
              <a-icon slot="prefix" type="lock" class="input-icon" />
            </a-input>
          </a-form-item>

          <a-form-item class="submit-item">
            <a-button 
              :loading="logging" 
              size="large" 
              htmlType="submit" 
              type="primary"
              class="submit-button"
              block
            >
              <span v-if="!logging">{{$t('login')}}</span>
              <span v-else>{{$t('loggingIn')}}</span>
            </a-button>
          </a-form-item>
        </a-form>
        </div>

        <footer class="smartops-login-footer">
          <span class="smartops-login-security"><i></i>授权用户访问</span>
          <span>{{$t('copyright')}}</span>
        </footer>
      </div>
    </main>
  </div>
</template>

<script>
import { login, getPermissionContext, getRoutesConfig } from '@/services/user'
import { getPublicSystemInfo } from '@/services/admin'
import { setAuthorization } from '@/utils/request'
import { loadRoutes } from '@/utils/routerUtil'
import { mapMutations } from 'vuex'
import { startTokenRefresher } from '@/utils/tokenRefresher'
import { listTenantContexts } from '@/services/tenant'
import { getTenantContext, removeTenantContext, setTenantContext } from '@/utils/request'
import { normalizeTenantItems, selectInitialTenant } from '@/pages/system/tenant-context'
import { businessPayload, normalizePermissionContext } from '@/utils/permission-policy'
export default {
  name: 'Login',
  i18n: require('./i18n'),
  data() {
    return {
      logging: false,
      error: '',
      form: this.$form.createForm(this),
      systemName: '智能运维管理系统',
      systemSubtitle: this.$t('systemSubtitle'),
      logoUrl: require('@/assets/img/logo.png'),
      demoMode: false
    }
  },
  // computed: {
  //   systemName() {
  //     return this.$store.state.setting.systemName
  //   }
  // },

  mounted() {
    // 加载系统公开信息
    this.loadPublicSystemInfo()
    
    // 开发模式下自动填充账号密码
    if (process.env.NODE_ENV === 'development') {
      this.$nextTick(() => {
        this.form.setFieldsValue({
          name: 'admin',
          password: 'SmartOps-Local-Only!'
        })
      })
    }

  },
  methods: {
    ...mapMutations('account', ['setUser', 'setPermissions', 'setRoles', 'setTenants', 'setCurrentTenant']),
    async prepareTenantContext(user) {
      const response = await listTenantContexts()
      const tenants = normalizeTenantItems(response)
      this.setTenants(tenants)
      const selected = selectInitialTenant(tenants, getTenantContext(), Boolean(user && user.role !== 'admin'))
      if (selected) {
        setTenantContext(selected)
        this.setCurrentTenant(selected)
        return '/dashboard/workplace'
      }
      removeTenantContext()
      this.setCurrentTenant(null)
      return user && user.role === 'admin' && tenants.length === 0 ? '/system/tenants' : '/tenant-select'
    },
    async refreshAccessContext() {
      const permissionResponse = await getPermissionContext()
      const permissionBusiness = businessPayload(permissionResponse)
      if (!permissionBusiness || Number(permissionBusiness.code) !== 200) {
        throw new Error(permissionBusiness && permissionBusiness.message ? permissionBusiness.message : '加载权限失败')
      }
      const context = normalizePermissionContext(permissionResponse)
      this.setRoles(context.roles)
      this.setPermissions(context.permissions)

      const routesResponse = await getRoutesConfig()
      const routesBusiness = businessPayload(routesResponse)
      if (!routesBusiness || Number(routesBusiness.code) !== 200) {
        throw new Error(routesBusiness && routesBusiness.message ? routesBusiness.message : '加载菜单失败')
      }
      loadRoutes(Array.isArray(routesBusiness.data) ? routesBusiness.data : [])
    },
    async loadPublicSystemInfo() {
      try {
        const res = await getPublicSystemInfo()
        const infoRes = (res && res.data && typeof res.data.code !== 'undefined') ? res.data : res
        
        if (infoRes && infoRes.code === 200 && infoRes.data) {
          if (infoRes.data.system_name) {
            this.systemName = infoRes.data.system_name
            this.$store.commit('setting/setSystemName', infoRes.data.system_name)
          }
          if (infoRes.data.system_subtitle) {
            this.systemSubtitle = infoRes.data.system_subtitle
            this.$store.commit('setting/setSystemSubtitle', infoRes.data.system_subtitle)
          }
          if (infoRes.data.system_logo) {
            this.logoUrl = infoRes.data.system_logo
            this.$store.commit('setting/setSystemLogo', infoRes.data.system_logo)
          }
          // 识别演示模式并自动填充账号密码
          if (infoRes.data.demo_mode) {
            this.demoMode = true
            this.$store.commit('setting/setDemoMode', true)
            this.$nextTick(() => {
              this.form.setFieldsValue({
                name: 'admin',
                password: 'SmartOps-Local-Only!'
              })
            })
          } else {
            this.demoMode = false
            this.$store.commit('setting/setDemoMode', false)
          }
        }
      } catch (error) {
        console.warn('加载系统公开信息失败，使用默认配置:', error)
        // 加载失败不影响登录页面显示
      }
    },
    loadUserTheme(user) {
      try {
        // 从用户信息中读取主题配置
        if (user && user.theme) {
          let themeConfig
          // 如果是字符串，需要解析
          if (typeof user.theme === 'string') {
            themeConfig = JSON.parse(user.theme)
          } else {
            themeConfig = user.theme
          }
          
          const brandTheme = {
            ...(themeConfig.theme || {}),
            color: '#1b5a96',
            mode: 'dark',
            success: '#2f6f62',
            warning: '#c68a2b',
            error: '#c94b4b'
          }
          const brandConfig = {
            ...themeConfig,
            theme: brandTheme,
            hideSetting: true,
            pageWidth: 'fluid',
            animate: { ...(themeConfig.animate || {}), disabled: true }
          }

          // 仅保留布局习惯，品牌色与动效由系统统一管理
          localStorage.setItem(process.env.VUE_APP_SETTING_KEY, JSON.stringify(brandConfig))
          
          // 立即应用主题配置到 Vuex store
          if (brandConfig.theme) {
            this.$store.commit('setting/setTheme', brandConfig.theme)
            // 应用主题颜色
            const themeUtil = require('@/utils/themeUtil')
            themeUtil.changeThemeColor(brandConfig.theme.color, brandConfig.theme.mode)
          }
          
          // 应用动画配置
          if (brandConfig.animate) {
            this.$store.commit('setting/setAnimate', brandConfig.animate)
          }
          
          // 应用其他配置
          if (themeConfig.layout) {
            this.$store.commit('setting/setLayout', themeConfig.layout)
          }
          if (themeConfig.multiPage !== undefined) {
            this.$store.commit('setting/setMultiPage', themeConfig.multiPage)
          }
          if (themeConfig.weekMode !== undefined) {
            this.$store.commit('setting/setWeekMode', themeConfig.weekMode)
          }
          if (themeConfig.fixedHeader !== undefined) {
            this.$store.commit('setting/setFixedHeader', themeConfig.fixedHeader)
          }
          if (themeConfig.fixedSideBar !== undefined) {
            this.$store.commit('setting/setFixedSideBar', themeConfig.fixedSideBar)
          }
          this.$store.commit('setting/setHideSetting', true)
          this.$store.commit('setting/setPageWidth', 'fluid')
          
          console.log('用户布局偏好已加载，系统品牌样式保持统一')
        }
      } catch (error) {
        console.warn('加载用户主题配置失败，使用默认配置:', error)
        // 加载失败不影响登录流程
      }
    },
    async loadSystemConfig() {
      try {
        const { configGetList } = require('@/services/admin')
        const res = await configGetList()
        const configRes = (res && res.data && typeof res.data.code !== 'undefined') ? res.data : res
        
        if (configRes && configRes.code === 200 && configRes.data && configRes.data.items) {
          const configs = configRes.data.items
          const systemNameConfig = configs.find(item => item.config_key === 'system_name')
          const systemSubtitleConfig = configs.find(item => item.config_key === 'system_subtitle')
          const systemLogoConfig = configs.find(item => item.config_key === 'system_logo')
          
          if (systemNameConfig && systemNameConfig.config_value) {
            this.systemName = systemNameConfig.config_value
            this.$store.commit('setting/setSystemName', systemNameConfig.config_value)
          }
          if (systemSubtitleConfig && systemSubtitleConfig.config_value) {
            this.systemSubtitle = systemSubtitleConfig.config_value
            this.$store.commit('setting/setSystemSubtitle', systemSubtitleConfig.config_value)
          }
          
          if (systemLogoConfig && systemLogoConfig.config_value) {
            this.logoUrl = systemLogoConfig.config_value
            this.$store.commit('setting/setSystemLogo', systemLogoConfig.config_value)
          }
        }
      } catch (error) {
        console.warn('加载系统配置失败，使用默认配置:', error)
        // 加载失败不影响登录流程
      }
    },
    onSubmit(e) {
      e.preventDefault()
      this.form.validateFields((err) => {
        if (!err) {
          this.logging = true
          const name = this.form.getFieldValue('name')
          const password = this.form.getFieldValue('password')
          
          login(name, password)
            .then(this.afterLogin)
            .catch((error) => {
              this.logging = false
              // 兼容 axios error / 自定义 error 对象
              if (error && typeof error === 'object') {
                const msg =
                  error.message ||
                  (error.data && error.data.message) ||
                  (error.response && error.response.data && error.response.data.message)
                this.error = msg || '登录失败'
              } else {
                this.error = '登录失败'
              }
            })
        }
      })
    },
    async afterLogin(res) {
      this.logging = false
      // 兼容两种形态：
      // 1) 全局 request.js 返回 axios-like：{ data: { code, message, data } }
      // 2) 极端情况下直接返回业务对象：{ code, message, data }
      const loginRes =
        (res && res.data && typeof res.data.code !== 'undefined')
          ? res.data
          : res

      const code = loginRes && loginRes.code
      // 兼容历史 mock 返回 code = 0，以及当前后端返回 code = 200
      if (loginRes && (code === 200 || code === 0 || code === '200' || code === '0')) {
        const { user, roles, permissions } = (loginRes && loginRes.data) || {}
        // let premissions = [{ id: "queryForm", operation: ["add", "edit", 'delete'] }]
        // roles = [{ id: "admin", operation: ["add", "edit", "delete"] }],
        // user = {
        //   name: "admin",
        //   avatar:
        //     "https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png",
        //   address: "武汉",
        // };
        this.setUser(user)
        this.setPermissions(Array.isArray(permissions) ? permissions : [])
        this.setRoles(Array.isArray(roles) ? roles : [])
        setAuthorization({ token: loginRes && loginRes.data && loginRes.data.token })
        startTokenRefresher()

        // 加载用户主题配置
        this.loadUserTheme(user)
        
        try {
          const target = await this.prepareTenantContext(user)
          await this.refreshAccessContext()
          if (user && user.role === 'admin') this.loadSystemConfig()
          this.$router.push(target)
          this.$message.success(loginRes.message || this.$t('loginSuccess'), 1)
        } catch (error) {
          this.$router.push(user && user.role === 'admin' ? '/system/tenants' : '/tenant-select')
          this.$message.warning(error.message || '登录成功，但权限上下文加载失败')
        }
      } else {
        this.error = (loginRes && loginRes.message) ? loginRes.message : '登录失败'
      }
    }
  }
}
</script>

<style lang="less" scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%);
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

// 背景装饰
.background-decoration {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 0;

  .circle {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.03);
    animation: float 20s infinite ease-in-out;

    &.circle-1 {
      width: 500px;
      height: 500px;
      top: -250px;
      right: -100px;
      animation-delay: 0s;
      background: radial-gradient(circle, rgba(100, 200, 255, 0.1) 0%, transparent 70%);
    }

    &.circle-2 {
      width: 350px;
      height: 350px;
      bottom: -150px;
      left: -100px;
      animation-delay: 5s;
      background: radial-gradient(circle, rgba(150, 100, 255, 0.08) 0%, transparent 70%);
    }

    &.circle-3 {
      width: 250px;
      height: 250px;
      top: 50%;
      left: 10%;
      animation-delay: 10s;
      background: radial-gradient(circle, rgba(255, 150, 100, 0.06) 0%, transparent 70%);
    }
  }

  .grid-pattern {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
    background-size: 50px 50px;
    animation: gridMove 30s linear infinite;
  }
}

@keyframes float {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(30px, -30px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
}

@keyframes gridMove {
  0% {
    transform: translate(0, 0);
  }
  100% {
    transform: translate(50px, 50px);
  }
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

// 登录卡片
.login-card {
  position: relative;
  z-index: 1;
  width: 440px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 48px 40px;
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  animation: slideInUp 0.6s ease-out;

  @media screen and (max-width: 576px) {
    width: 90%;
    padding: 36px 24px;
    border-radius: 20px;
  }
}

// Logo区域
.logo-section {
  text-align: center;
  margin-bottom: 40px;
  animation: fadeIn 0.8s ease-out 0.2s both;

  .logo-wrapper {
    display: inline-block;
    margin-bottom: 24px;
    position: relative;

    &::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 120px;
      height: 120px;
      background: linear-gradient(135deg, #1b5a96 0%, #163a63 100%);
      border-radius: 50%;
      opacity: 0.1;
      animation: pulse 2s ease-in-out infinite;
    }

    .logo-image {
      width: 80px;
      height: 80px;
      object-fit: contain;
      position: relative;
      z-index: 1;
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.1));
      transition: transform 0.3s ease;

      &:hover {
        transform: scale(1.05) rotate(5deg);
      }
    }
  }

  .system-title {
    font-size: 32px;
    font-weight: 700;
    color: #1a1a2e;
    margin: 0 0 8px 0;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #1b5a96 0%, #163a63 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .system-subtitle {
    font-size: 14px;
    color: #6b7280;
    margin: 0;
    font-weight: 400;
    letter-spacing: 0.3px;
  }
}

@keyframes pulse {
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.1;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.1);
    opacity: 0.15;
  }
}

// 表单区域
.form-section {
  animation: fadeIn 0.8s ease-out 0.4s both;

  .error-alert {
    margin-bottom: 24px;
    border-radius: 12px;
    animation: shake 0.5s ease;
  }

  .form-item {
    margin-bottom: 20px;

    /deep/ .ant-form-item-control {
      line-height: 1;
    }
  }

  .custom-input {
    border-radius: 12px;
    border: 2px solid #e5e7eb;
    transition: all 0.3s ease;
    font-size: 15px;

    &:hover {
      border-color: #9ca3af;
    }

    &:focus,
    &.ant-input-focused {
      border-color: #1b5a96;
      box-shadow: 0 0 0 2px rgba(27, 90, 150, 0.12);
    }

    /deep/ input {
      font-size: 15px;
      
      &::placeholder {
        color: #9ca3af;
      }
    }

    .input-icon {
      color: #9ca3af;
      font-size: 16px;
    }
  }

  .submit-item {
    margin-bottom: 0;
    margin-top: 32px;
  }

  .submit-button {
    height: 48px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.5px;
    background: linear-gradient(135deg, #1b5a96 0%, #163a63 100%);
    border: none;
    box-shadow: 0 4px 15px rgba(27, 90, 150, 0.28);
    transition: all 0.3s ease;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(27, 90, 150, 0.32);
      background: linear-gradient(135deg, #1b5a96 0%, #163a63 100%);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }

    &:disabled {
      background: #d1d5db;
      box-shadow: none;
    }
  }
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-10px);
  }
  75% {
    transform: translateX(10px);
  }
}

// 页脚
.footer-section {
  margin-top: 32px;
  text-align: center;
  animation: fadeIn 0.8s ease-out 0.6s both;

  .footer-text {
    font-size: 13px;
    color: #9ca3af;
    margin: 0;
  }
}

// 响应式调整
@media screen and (max-width: 576px) {
  .logo-section {
    margin-bottom: 32px;

    .logo-wrapper .logo-image {
      width: 64px;
      height: 64px;
    }

    .system-title {
      font-size: 28px;
    }

    .system-subtitle {
      font-size: 13px;
    }
  }

  .form-section {
    .submit-item {
      margin-top: 24px;
    }

    .submit-button {
      height: 44px;
      font-size: 15px;
    }
  }

  .footer-section {
    margin-top: 24px;
  }
}
</style>

<style lang="less" scoped>
.login-container {
  display: grid;
  grid-template-columns: minmax(420px, 58%) minmax(400px, 42%);
  align-items: stretch;
  justify-content: stretch;
  min-height: 100vh;
  overflow: auto;
  background: #f3f6fa;
  color: #14243a;
  font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
}

.smartops-login-story {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100vh;
  padding: 48px 7vw 58px;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    #0a1f44;
  background-size: 48px 48px;
  color: #fff;
}

.smartops-login-story::after {
  position: absolute;
  right: -16vw;
  bottom: -35vh;
  width: 58vw;
  height: 58vw;
  border: 1px solid rgba(147, 190, 231, 0.16);
  border-radius: 50%;
  box-shadow:
    0 0 0 7vw rgba(27, 90, 150, 0.08),
    0 0 0 14vw rgba(27, 90, 150, 0.045);
  content: "";
}

.smartops-login-brand,
.smartops-login-context,
.smartops-login-statement,
.smartops-login-rail {
  position: relative;
  z-index: 1;
}

.smartops-login-brand {
  display: flex;
  align-items: center;
  width: 236px;
  height: 68px;
  margin-bottom: 34px;
}

.smartops-login-brand-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.smartops-login-context {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #82acd4;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.24em;
}

.smartops-login-context span {
  width: 30px;
  height: 2px;
  background: #1b5a96;
}

.smartops-login-statement {
  max-width: 640px;
  margin: 10vh 0 8vh;
}

.smartops-login-kicker {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 22px;
  color: #82acd4;
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.28em;
}

.smartops-login-kicker::before {
  width: 34px;
  height: 2px;
  background: #1b5a96;
  content: "";
}

.smartops-login-statement h1 {
  margin: 0;
  color: #fff;
  font-size: clamp(36px, 4.1vw, 62px);
  font-weight: 650;
  line-height: 1.28;
  letter-spacing: 0.04em;
}

.smartops-login-description {
  max-width: 540px;
  margin: 26px 0 0;
  color: #aebed0;
  font-size: 15px;
  line-height: 1.9;
}

.smartops-login-rail {
  display: grid;
  grid-template-columns: repeat(3, minmax(120px, 1fr));
  max-width: 620px;
  border-top: 1px solid rgba(255, 255, 255, 0.16);
}

.smartops-login-rail-item {
  position: relative;
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: center;
  gap: 10px;
  padding: 18px 18px 0 0;
  color: #d7e1ec;
  font-size: 13px;
}

.smartops-login-rail-item::before {
  position: absolute;
  top: -2px;
  left: 0;
  width: 34px;
  height: 3px;
  background: #1b5a96;
  content: "";
}

.rail-index {
  color: #6f8eaf;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 11px;
}

.rail-node {
  width: 7px;
  height: 7px;
  border: 1px solid #7591ae;
  background: transparent;
}

.rail-node.is-active {
  border-color: #4b8bc7;
  background: #4b8bc7;
}

.rail-node.is-warning {
  border-color: #c68a2b;
  background: #c68a2b;
}

.smartops-login-workbench {
  display: grid;
  min-height: 100vh;
  padding: 56px clamp(42px, 6vw, 92px);
  place-items: center;
  background: #fff;
}

.smartops-login-panel {
  width: 100%;
  max-width: 430px;
}

.smartops-login-heading {
  margin-bottom: 38px;
}

.smartops-login-heading p {
  margin: 0 0 12px;
  color: #1b5a96;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.22em;
}

.smartops-login-heading h2 {
  margin: 0 0 10px;
  color: #0a1f44;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.35;
}

.smartops-login-heading span {
  color: #68778a;
  font-size: 13px;
}

.form-section {
  width: 100%;
}

.form-section .form-item {
  margin-bottom: 20px;
}

.form-section /deep/ .custom-input.ant-input-affix-wrapper {
  height: 50px;
  border: 1px solid #cbd6e2;
  border-radius: 2px;
  background: #fff;
  box-shadow: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.form-section /deep/ .custom-input.ant-input-affix-wrapper:hover {
  border-color: #7890aa;
  box-shadow: none;
}

.form-section /deep/ .custom-input.ant-input-affix-wrapper:focus-within,
.form-section /deep/ .custom-input.ant-input-affix-wrapper-focused {
  border-color: #1b5a96;
  box-shadow: 0 0 0 2px rgba(27, 90, 150, 0.1);
}

.form-section /deep/ .custom-input.ant-input-affix-wrapper .ant-input,
.form-section /deep/ .custom-input.ant-input-affix-wrapper .ant-input:hover,
.form-section /deep/ .custom-input.ant-input-affix-wrapper .ant-input:focus {
  height: 48px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  outline: 0;
}

.form-section /deep/ .custom-input.ant-input-affix-wrapper .ant-input:-webkit-autofill {
  -webkit-text-fill-color: #14243a;
  transition: background-color 9999s ease-out;
}

.form-section .input-icon {
  color: #708399;
}

.form-section .submit-item {
  margin: 30px 0 0;
}

.form-section .submit-button {
  height: 50px;
  border-color: #1b5a96;
  border-radius: 2px;
  background: #1b5a96;
  box-shadow: none;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: 0.16em;
  transition: background-color 0.16s ease, border-color 0.16s ease;
}

.form-section .submit-button:hover,
.form-section .submit-button:focus {
  border-color: #163a63;
  background: #163a63;
  transform: none;
  box-shadow: none;
}

.error-alert {
  margin-bottom: 18px;
}

.smartops-login-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 48px;
  padding-top: 18px;
  border-top: 1px solid #d7e0e9;
  color: #8290a0;
  font-size: 11px;
}

.smartops-login-security {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #51667d;
}

.smartops-login-security i {
  width: 6px;
  height: 6px;
  background: #2f6f62;
}

@media screen and (max-width: 980px) {
  .login-container {
    grid-template-columns: 1fr;
  }

  .smartops-login-story {
    min-height: auto;
    padding: 28px 32px 36px;
  }

  .smartops-login-statement {
    margin: 52px 0 42px;
  }

  .smartops-login-statement h1 {
    font-size: clamp(30px, 7vw, 46px);
  }

  .smartops-login-description {
    margin-top: 18px;
  }

  .smartops-login-workbench {
    min-height: auto;
    padding: 54px 32px;
  }
}

@media screen and (max-width: 560px) {
  .smartops-login-story {
    padding: 22px 20px 28px;
  }

  .smartops-login-brand {
    width: 214px;
    height: 62px;
    margin-bottom: 28px;
  }

  .smartops-login-statement {
    margin: 42px 0 32px;
  }

  .smartops-login-statement h1 {
    font-size: 29px;
  }

  .smartops-login-description {
    font-size: 13px;
  }

  .smartops-login-rail {
    grid-template-columns: 1fr;
    gap: 12px;
    border-top: 0;
  }

  .smartops-login-rail-item {
    padding-top: 0;
  }

  .smartops-login-rail-item::before {
    display: none;
  }

  .smartops-login-workbench {
    padding: 46px 20px;
  }

  .smartops-login-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
