import {loadRoutes, loadGuards, setAppOptions} from '@/utils/routerUtil'
import {checkAuthorization, loadInterceptors} from '@/utils/request'
import guards from '@/router/guards'
import interceptors from '@/utils/axios-interceptors'
import {getPermissionContext, getRoutesConfig, logout} from '@/services/user'
import VueRouter from 'vue-router'
import {businessPayload, normalizePermissionContext} from '@/utils/permission-policy'

function clearCachedAccess(store) {
  store.commit('account/setPermissions', [])
  store.commit('account/setRoles', [])
  store.commit('account/setRoutesConfig', [])
}

async function refreshAccessContext(store) {
  const permissionResponse = await getPermissionContext()
  const permissionBusiness = businessPayload(permissionResponse)
  if (!permissionBusiness || Number(permissionBusiness.code) !== 200) {
    throw new Error(permissionBusiness && permissionBusiness.message ? permissionBusiness.message : '加载权限失败')
  }
  const context = normalizePermissionContext(permissionResponse)

  const routesResponse = await getRoutesConfig()
  const routesBusiness = businessPayload(routesResponse)
  if (!routesBusiness || Number(routesBusiness.code) !== 200) {
    throw new Error(routesBusiness && routesBusiness.message ? routesBusiness.message : '加载菜单失败')
  }

  const routesConfig = Array.isArray(routesBusiness.data) ? routesBusiness.data : []
  store.commit('account/setRoles', context.roles)
  store.commit('account/setPermissions', context.permissions)
  return routesConfig
}

/**
 * 启动引导方法
 * 应用启动时需要执行的操作放在这里
 * @param router 应用的路由实例
 * @param store 应用的 vuex.store 实例
 * @param i18n 应用的 vue-i18n 实例
 * @param i18n 应用的 message 实例
 */
async function bootstrap({router, store, i18n, message}) {
  // 设置应用配置
  setAppOptions({router, store, i18n})
  // 加载 axios 拦截器
  loadInterceptors(interceptors, {router, store, i18n, message})
  // 已登录会话必须以服务端当前租户权限和菜单为准。版本更新后不能继续
  // 使用 localStorage 中的旧路由，否则新增菜单会长期不可见，直达路径也会 404。
  let routesConfig = []
  let loginRequired = false
  if (checkAuthorization()) {
    try {
      routesConfig = await refreshAccessContext(store)
    } catch (error) {
      logout()
      store.commit('account/setUser', null)
      store.commit('account/setTenants', [])
      store.commit('account/setCurrentTenant', null)
      clearCachedAccess(store)
      loginRequired = true
      message.warning('权限与导航刷新失败，请重新登录')
    }
  } else {
    clearCachedAccess(store)
  }
  loadRoutes(routesConfig)
  // 加载路由守卫
  loadGuards(guards, {router, store, i18n, message})
  if (loginRequired && router.currentRoute.path !== '/login') {
    try {
      await router.replace('/login')
    } catch (error) {
      if (!VueRouter.isNavigationFailure(error)) throw error
    }
  }
}

export {clearCachedAccess, refreshAccessContext}
export default bootstrap
