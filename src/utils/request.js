import axios from 'axios'
import Cookie from 'js-cookie'

// 跨域认证信息 header 名
const xsrfHeaderName = 'X-Token'
const tenantHeaderName = 'X-Tenant-ID'
const tenantStorageKey = 'smartops.currentTenant'
const tenantContextChangingEvent = 'smartops:tenant-context-changing'
const zbxSessionName = 'zbx_session'

axios.defaults.timeout = 20000
axios.defaults.withCredentials = true
axios.defaults.xsrfHeaderName = xsrfHeaderName
axios.defaults.xsrfCookieName = xsrfHeaderName

// 认证类型
const AUTH_TYPE = {
	BEARER: 'Bearer',
	BASIC: 'basic',
	AUTH1: 'auth1',
	AUTH2: 'auth2',
}

// http method
const METHOD = {
	GET: 'get',
	POST: 'post',
	PUT: 'put',
	DELETE: 'delete',
}

/**
 * axios请求
 * @param url 请求地址
 * @param method {METHOD} http method
 * @param params 请求参数
 * @returns {Promise<AxiosResponse<T>>}
 */
async function request(url, method, params, config) {
	const tenant = getTenantContext()
	const requestConfig = {
		...(config || {}),
		headers: {
			...(tenant && tenant.id ? { [tenantHeaderName]: String(tenant.id) } : {}),
			...((config && config.headers) || {}),
		},
	}
	switch (method) {
		case METHOD.GET:
			return axios.get(url, { params, ...requestConfig })
		case METHOD.POST:
			return axios.post(url, params, requestConfig)
		case METHOD.PUT:
			return axios.put(url, params, requestConfig)
		case METHOD.DELETE:
			return axios.delete(url, { ...requestConfig, data: params })
		default:
			return axios.get(url, { params, ...requestConfig })
	}
}

function getTenantContext() {
	try {
		const stored = localStorage.getItem(tenantStorageKey)
		return stored ? JSON.parse(stored) : null
	} catch (error) {
		return null
	}
}

function setTenantContext(tenant) {
	if (!tenant || !tenant.id) {
		removeTenantContext()
		return
	}
	const normalized = { id: Number(tenant.id), code: tenant.code, name: tenant.name }
	notifyTenantContextChanging(normalized)
	localStorage.setItem(tenantStorageKey, JSON.stringify(normalized))
	Cookie.set(tenantHeaderName, String(normalized.id), { expires: 7, sameSite: 'strict' })
}

function removeTenantContext() {
	notifyTenantContextChanging(null)
	localStorage.removeItem(tenantStorageKey)
	Cookie.remove(tenantHeaderName)
}

function notifyTenantContextChanging(tenant) {
	if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
	if (typeof window.CustomEvent !== 'function') return
	window.dispatchEvent(new window.CustomEvent(tenantContextChangingEvent, { detail: { tenant } }))
}

/**
 * 设置认证信息
 * @param auth {Object}
 * @param authType {AUTH_TYPE} 认证类型，默认：{AUTH_TYPE.BEARER}
 */
function setAuthorization(auth, authType = AUTH_TYPE.BEARER) {
	switch (authType) {
		case AUTH_TYPE.BEARER:
			Cookie.set(xsrfHeaderName, auth.token)
			break
		case AUTH_TYPE.BASIC:
		case AUTH_TYPE.AUTH1:
		case AUTH_TYPE.AUTH2:
		default:
			break
	}
}

/**
 * 移出认证信息
 * @param authType {AUTH_TYPE} 认证类型
 */
function removeAuthorization(authType = AUTH_TYPE.BEARER) {
	switch (authType) {
		case AUTH_TYPE.BEARER:
			Cookie.remove(xsrfHeaderName)
			Cookie.remove(zbxSessionName)
			removeTenantContext()
			break
		case AUTH_TYPE.BASIC:
		case AUTH_TYPE.AUTH1:
		case AUTH_TYPE.AUTH2:
		default:
			break
	}
}

/**
 * 检查认证信息
 * @param authType
 * @returns {boolean}
 */
function checkAuthorization(authType = AUTH_TYPE.BEARER) {
	switch (authType) {
		case AUTH_TYPE.BEARER:
			if (Cookie.get(xsrfHeaderName)) {
				return true
			}
			break
		case AUTH_TYPE.BASIC:
		case AUTH_TYPE.AUTH1:
		case AUTH_TYPE.AUTH2:
		default:
			break
	}
	return false
}

/**
 * 加载 axios 拦截器
 * @param interceptors
 * @param options
 */
function loadInterceptors(interceptors, options) {
	const { request, response } = interceptors
	// 加载请求拦截器
	request.forEach((item) => {
		let { onFulfilled, onRejected } = item
		if (!onFulfilled || typeof onFulfilled !== 'function') {
			onFulfilled = (config) => config
		}
		if (!onRejected || typeof onRejected !== 'function') {
			onRejected = (error) => Promise.reject(error)
		}
		axios.interceptors.request.use(
			(config) => onFulfilled(config, options),
			(error) => onRejected(error, options)
		)
	})
	// 加载响应拦截器
	response.forEach((item) => {
		let { onFulfilled, onRejected } = item
		if (!onFulfilled || typeof onFulfilled !== 'function') {
			onFulfilled = (response) => response
		}
		if (!onRejected || typeof onRejected !== 'function') {
			onRejected = (error) => Promise.reject(error)
		}
		axios.interceptors.response.use(
			(response) => {
				// 兼容多重拦截器链：这里的 response 可能已经是业务对象 {code,message,data}
				const isBizObject =
					response && typeof response === 'object' && typeof response.code !== 'undefined'
				const biz = isBizObject ? response : (response && response.data ? response.data : undefined)

				// token 失效（统一用业务 code 判断）
				if (biz && (biz.code === 50014 || biz.code === '50014')) {
					// 清除 token
					removeAuthorization()
					// 跳转到登录页
					if (window.loginNoAuth && typeof window.loginNoAuth === 'function') {
						window.loginNoAuth()
					} else {
						// 如果 window.loginNoAuth 还未定义，直接跳转
						const router = options && options.router
						if (router) {
							router.push({ path: '/login' })
						} else {
							window.location.href = '/login'
						}
					}
					return Promise.reject(new Error('token过期或非法的token'))
				} else {
					// 向后兼容：项目里大量地方使用 resp.data.code
					// 因此始终返回 axios-like 结构：{ data: <biz> }
					const axiosLike =
						(!isBizObject && response && typeof response === 'object' && typeof response.data !== 'undefined')
							? { ...response, data: biz }
							: { data: biz }
					return onFulfilled(axiosLike, options)
				}
			},
			(error) => {
				// 错误处理：检查是否是 401 未授权错误
				if (error.response) {
					const status = error.response.status
					const data = error.response.data
					
					// 处理 401 或 code 为 50014 的情况
					if (status === 401 || (data && (data.code === 50014 || data.code === '50014'))) {
						// 清除 token
						removeAuthorization()
						// 跳转到登录页
						if (window.loginNoAuth && typeof window.loginNoAuth === 'function') {
							window.loginNoAuth()
						} else {
							// 如果 window.loginNoAuth 还未定义，直接跳转
							const router = options && options.router
							if (router) {
								router.push({ path: '/login' })
							} else {
								window.location.href = '/login'
							}
						}
						return Promise.reject(new Error('token过期或非法的token'))
					}
					
					return onRejected({ ...error.response, data: error.response.data }, options)
				}
				// 如果没有 response，创建一个错误对象
				const errorData = {
					code: error.code || 500,
					message: error.message || '网络错误，请检查网络连接',
					error: error
				}
				return onRejected({ data: errorData }, options)
			}
		)
	})
}

/**
 * 解析 url 中的参数
 * @param url
 * @returns {Object}
 */
function parseUrlParams(url) {
	const params = {}
	if (!url || url === '' || typeof url !== 'string') {
		return params
	}
	const paramsStr = url.split('?')[1]
	if (!paramsStr) {
		return params
	}
	const paramsArr = paramsStr.replace(/&|=/g, ' ').split(' ')
	for (let i = 0; i < paramsArr.length / 2; i++) {
		const value = paramsArr[i * 2 + 1]
		params[paramsArr[i * 2]] =
			value === 'true' ? true : value === 'false' ? false : value
	}
	return params
}

export {
	METHOD,
	AUTH_TYPE,
	request,
	setAuthorization,
	removeAuthorization,
	checkAuthorization,
	loadInterceptors,
	parseUrlParams,
	getTenantContext,
	setTenantContext,
	removeTenantContext,
	tenantContextChangingEvent,
}
