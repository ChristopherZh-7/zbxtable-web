const {screenContextKey, SCREEN_PATH} = require('../../../utils/screen-navigation')
const {normalizeDashboardNodes} = require('./dashboard-canvas')

function screenID(value) {
  const text = String(value == null ? '' : value)
  return /^[1-9]\d*$/.test(text) && Number.isSafeInteger(Number(text)) ? text : null
}

function defaultScreenKey(store) {
  const scope = screenContextKey(store)
  return scope ? scope.replace('smartops.screen.return:', 'smartops.screen.default:') : null
}

function screenPreferenceStorage(browserWindow) {
  try { return browserWindow.localStorage } catch (_) { return null }
}

function readDefaultScreen(storage, key) {
  try { return storage && key ? screenID(storage.getItem(key)) : null } catch (_) { return null }
}

function writeDefaultScreen(storage, key, id) {
  if (!storage || !key || (id != null && !screenID(id))) return false
  try {
    if (id == null) storage.removeItem(key)
    else storage.setItem(key, screenID(id))
    return true
  } catch (_) { return false }
}

function screenLocation(id) {
  const custom = screenID(id)
  return custom ? {path: SCREEN_PATH, query: {custom}} : {path: SCREEN_PATH}
}

function copyScreenDraft(source) {
  const nodes = Array.isArray(source.nodes) ? source.nodes : JSON.parse(source.nodes || '[]')
  return {
    form: {
      name: `${String(source.name || '大屏').slice(0, 90)} - 副本`, visibility: 'personal',
      canvasWidth: source.canvas_width || 1600, canvasHeight: source.canvas_height || 900,
    },
    nodes: normalizeDashboardNodes(nodes),
  }
}

module.exports = {screenID, defaultScreenKey, screenPreferenceStorage, readDefaultScreen, writeDefaultScreen, screenLocation, copyScreenDraft}
