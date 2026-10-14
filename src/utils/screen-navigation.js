const SCREEN_PATH = '/screen/dashboard'
const FALLBACK_PATH = '/dashboard/workplace'

function screenSessionStorage(browserWindow) {
  try { return browserWindow.sessionStorage } catch (_) { return null }
}

function isWorkbenchRoute(route) {
  const matched = (route && route.matched) || []
  return matched.some(record => {
    const component = record.components && record.components.default
    if (!component) return false
    if (component.name === 'TabsView' || (component.options && component.options.name === 'TabsView')) return true
    // On a screen refresh the async root layout has not loaded yet. Only its
    // registered child routes belong to the workbench; router guards still run.
    return matched.length > 1 && !record.parent && (record.path === '' || record.path === '/') && typeof component === 'function'
  })
}

function screenContextKey(store) {
  const getters = (store && store.getters) || {}
  const user = getters['account/user'] || {}
  const tenant = getters['account/currentTenant'] || {}
  const userID = Number(user.id), tenantID = Number(tenant.id)
  if (!Number.isSafeInteger(userID) || userID <= 0 || !Number.isSafeInteger(tenantID) || tenantID <= 0) return null
  return `smartops.screen.return:${userID}:${tenantID}`
}

function rememberScreenReturn(storage, key, route) {
  if (!storage || !key || !isWorkbenchRoute(route)) return
  try { storage.setItem(key, route.fullPath) } catch (_) { /* private browsing may block storage */ }
}

function screenReturnPath(storage, key, router) {
  let path
  try { path = storage && key && storage.getItem(key) } catch (_) { /* fall back to the workbench */ }
  if (typeof path !== 'string' || !/^\/(?!\/)/.test(path) || /[\\\u0000-\u0020]/.test(path)) return FALLBACK_PATH
  try {
    const resolved = router.resolve(path).route
    return resolved.path !== SCREEN_PATH && isWorkbenchRoute(resolved) ? resolved.fullPath : FALLBACK_PATH
  } catch (_) { return FALLBACK_PATH }
}

function captureScreenScroll(root, browserWindow) {
  const elements = root ? [root, ...root.querySelectorAll('*')] : []
  const positions = elements.filter(element => element.scrollTop || element.scrollLeft)
    .map(element => ({element, top: element.scrollTop, left: element.scrollLeft}))
  const x = browserWindow.scrollX, y = browserWindow.scrollY
  return () => {
    for (const {element, top, left} of positions) {
      element.scrollTop = top
      element.scrollLeft = left
    }
    browserWindow.scrollTo(x, y)
  }
}

module.exports = {SCREEN_PATH, FALLBACK_PATH, screenSessionStorage, isWorkbenchRoute, screenContextKey, rememberScreenReturn, screenReturnPath, captureScreenScroll}
