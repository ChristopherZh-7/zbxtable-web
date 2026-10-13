const CHUNK_RELOAD_KEY = 'smartops:chunk-reload-url'
const loginRecoveries = new WeakSet()
const CHUNK_ERROR = /Loading (?:CSS )?chunk [\s\S]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i

function recoverChunkLoadError(error, browser, pendingRoute) {
  if (!browser || !CHUNK_ERROR.test(String(error && error.message || error))) return false
  try {
    const target = new URL(browser.location.href)
    if (pendingRoute != null) {
      if (typeof pendingRoute !== 'string' || !/^\/(?![\/\\])/.test(pendingRoute) || pendingRoute.includes('\\')) return false
      // Only replace the hash; origin, document path and query stay unchanged.
      target.hash = pendingRoute
    }
    const url = target.href
    if (browser.sessionStorage.getItem(CHUNK_RELOAD_KEY) === url) return false
    // Write before reloading: a broken first route must not cause a reload loop.
    browser.sessionStorage.setItem(CHUNK_RELOAD_KEY, url)
    if (url !== browser.location.href) browser.history.replaceState(browser.history.state, '', url)
    browser.location.reload()
    return true
  } catch (_) {
    return false
  }
}

function consumeLoginChunkRecovery(router) {
  const recovering = loginRecoveries.has(router)
  loginRecoveries.delete(router)
  return recovering
}

function installChunkRecovery(router, browser) {
  if (!browser) return
  // Capture the old release's marker before onReady clears sessionStorage.
  try {
    const url = browser.location.href
    if (new URL(url).hash === '#/login' && browser.sessionStorage.getItem(CHUNK_RELOAD_KEY) === url) loginRecoveries.add(router)
  } catch (_) { /* Disabled storage must not change navigation. */ }
  let pendingRoute
  router.beforeEach((to, from, next) => { pendingRoute = to.fullPath; next() })
  router.afterEach(() => { pendingRoute = undefined })
  router.onError(error => recoverChunkLoadError(error, browser, pendingRoute))
  router.onReady(() => {
    try { browser.sessionStorage.removeItem(CHUNK_RELOAD_KEY) } catch (_) { /* Storage may be disabled. */ }
  })
}

module.exports = { recoverChunkLoadError, installChunkRecovery, consumeLoginChunkRecovery }
