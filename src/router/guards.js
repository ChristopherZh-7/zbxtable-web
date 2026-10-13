import {hasAuthority} from '@/utils/authority-utils'
import {loginIgnore} from '@/router/index'
import {checkAuthorization, getTenantContext} from '@/utils/request'
import {consumeLoginChunkRecovery} from '@/utils/chunkRecovery'
import {selectInitialTenant} from '@/pages/system/tenant-context'
import {getInstallStatus} from '@/services/install'
import NProgress from 'nprogress'

NProgress.configure({ showSpinner: false })

// 安装状态缓存
let installStatusChecked = false
let isInstalled = false
export const resetInstallStatusCache = () => {
  installStatusChecked = false
  isInstalled = false
}

/**
 * 安装状态检查守卫
 * @param to
 * @param from
 * @param next
 * @param options
 */
const installGuard = async (to, from, next, options) => {
  const {message} = options
  
  // 如果已经在安装页面，直接通过
  if (to.path === '/install') {
    next()
    return
  }

  // 如果已经检查过安装状态，使用缓存
  if (installStatusChecked) {
    if (!isInstalled) {
      next({path: '/install', replace: true})
      return
    }
    next()
    return
  }

  // 检查安装状态
  try {
    const res = await getInstallStatus()
    installStatusChecked = true
    // 兼容多种返回（历史 + 当前统一格式）：
    // 1) 旧：{ installed: true }
    // 2) 旧 axios-like：{ data: { installed: true } }
    // 3) 新统一：{ data: { code, message, data: { installed: true } } }
    // 4) 新统一 axios-like：{ data: { code, message, data: { installed: true } } }（由全局 request.js 返回）
    const biz = (res && res.data) ? res.data : res
    const installed =
      (biz && biz.data && typeof biz.data.installed !== 'undefined' ? biz.data.installed : undefined) ??
      (biz && typeof biz.installed !== 'undefined' ? biz.installed : undefined)
    
    // 只有明确返回 installed 为 false 时才跳转到安装页面
    if (installed === false) {
      isInstalled = false
      next({path: '/install', replace: true})
    } else if (installed === true) {
      isInstalled = true
      next()
    } else {
      // 如果无法获取到 installed 字段，说明接口返回格式异常，显示错误并停留在当前页
      console.error('无法获取安装状态，接口返回数据格式异常:', res)
      message.error('无法获取系统安装状态，请检查后台服务')
      installStatusChecked = false // 重置状态，允许下次重试
      next(false) // 取消导航
    }
  } catch (error) {
    // 如果接口出错（如500错误），不应该跳转到安装页面，而是显示错误信息
    console.error('检查安装状态失败:', error)
    message.error('后台服务异常，请检查服务是否正常运行')
    installStatusChecked = false // 重置状态，允许下次重试
    next(false) // 取消导航，停留在当前页
  }
}

/**
 * 进度条开始
 * @param to
 * @param form
 * @param next
 */
const progressStart = (to, from, next) => {
  // start progress bar
  if (!NProgress.isStarted()) {
    NProgress.start()
  }
  next()
}

/**
 * 登录守卫
 * @param to
 * @param form
 * @param next
 * @param options
 */
const loginGuard = (to, from, next, options) => {
  const {message} = options
  if (!loginIgnore.includes(to) && !checkAuthorization()) {
    message.warning('登录已失效，请重新登录')
    next({path: '/login'})
  } else {
    if (to.path === '/login' && checkAuthorization() && consumeLoginChunkRecovery(options.router)) {
      const {store, router} = options
      const account = store.state.account
      // These arrays are committed only after bootstrap refreshes server access.
      if (Array.isArray(account.permissions) && Array.isArray(account.roles) && Array.isArray(account.routesConfig)) {
        const user = store.getters['account/user']
        const tenants = store.getters['account/tenants'] || []
        const tenant = selectInitialTenant(tenants, getTenantContext(), Boolean(user && user.role !== 'admin'))
        const path = tenant ? '/dashboard/workplace' : user && user.role === 'admin' && tenants.length === 0 ? '/system/tenants' : '/tenant-select'
        const route = router.resolve(path).route
        if (route.matched.length > 0 && hasAuthority(route, account.permissions, account.roles)) {
          next({path, replace: true})
          return
        }
      }
    }
    next()
  }
}

/**
 * 权限守卫
 * @param to
 * @param form
 * @param next
 * @param options
 */
const authorityGuard = (to, from, next, options) => {
  const {store, message} = options
  const permissions = store.getters['account/permissions']
  const roles = store.getters['account/roles']
  if (!hasAuthority(to, permissions, roles)) {
    message.warning(`对不起，您无权访问页面: ${to.fullPath}，请联系管理员`)
    next({path: '/403'})
    // NProgress.done()
  } else {
    next()
  }
}

/**
 * 混合导航模式下一级菜单跳转重定向
 * @param to
 * @param from
 * @param next
 * @param options
 * @returns {*}
 */
const redirectGuard = (to, from, next, options) => {
  const {store} = options
  const getFirstChild = (routes) => {
    if (!routes || routes.length === 0) return undefined
    const route = routes[0]
    if (!route) return undefined
    if (!route.children || route.children.length === 0) {
      return route
    }
    return getFirstChild(route.children)
  }
  if (store.state.setting.layout === 'mix') {
    const firstMenu = store.getters['setting/firstMenu']
    if (firstMenu && firstMenu.find(item => item.fullPath === to.fullPath)) {
      store.commit('setting/setActivatedFirst', to.fullPath)
      const subMenu = store.getters['setting/subMenu']
      if (subMenu && subMenu.length > 0) {
        const redirect = getFirstChild(subMenu)
        if (redirect && redirect.fullPath) {
          return next({path: redirect.fullPath})
        }
      }
    }
  }
  next()
}

/**
 * 进度条结束
 * @param to
 * @param form
 * @param options
 */
const progressDone = () => {
  // finish progress bar
  NProgress.done()
}

export default {
  beforeEach: [progressStart, installGuard, loginGuard, authorityGuard, redirectGuard],
  afterEach: [progressDone]
}
