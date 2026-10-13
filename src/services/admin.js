import {
	HOST_LIST,
	HOST_EXPORT,
	HOST_MOCK,
	HOST_MOCKD,
	INDEX_RESTOP,
	INDEX_TRIGGER,
	INDEX__OVERVIEW,
	INDEX__EGRESS,
	INDEX_VERSION,
	INDEX_SESSION,
	TRIGGER_LIST,
	INDEX_INFO,
	ALARM,
	ALARM_ANALYSIS,
	ALARM_EXPORT,
	TOPOLOGY_LIST,
	ITEM_LIST,
	INVENTORY_LIST,
	SYSTEM_LIST,
	HOST_GROUP,
	HOST_FILTER_BY_TAG,
	TEMPLATE_lIST,
	ITEM_TRAFFIC,
	TOPO_TRAFFIC,
	TASK_LOG,
	EVENT_LOG,
	MANAGER,
	RULE,
	USER,
	GROUP,
	AI,
	INVENTORY_EXPORT,
	REPORT,
	ZABBIX,
	METRIC_MAPPING,
	SYSTEM_UPDATE,
	ASSET_TYPE,
	ASSET_GROUP,
	SYSTEM_BINDING,
	DASHBOARD,
	BASELINE_RULE,
	CONFIG_CONSUMPTION,
	NETWORK_DISCOVERY,
	RESOURCE_DISCOVERY,
	SCRIPT_DISCOVERY,
} from '@/services/api'
import { request, METHOD } from '@/utils/request'
// import { INDEX_VERSION, INVENTORY_EXPORT, REPORT } from "./api";

const cmdbOrganizationHeaderName = 'X-CMDB-Organization-ID'
const cmdbGenerationHeaderName = 'X-CMDB-Mapping-Generation'

function configurationWriteConfig(context) {
	const source = context || {}
	return {
		headers: {
			[cmdbOrganizationHeaderName]: String(Number(source.organization_id) || ''),
			[cmdbGenerationHeaderName]: String(Number(source.generation) || ''),
		},
	}
}
export async function hostList(params) {
	return request(HOST_LIST, METHOD.GET, { ...params })
}
export async function hostExport(params, config) {
	return request(HOST_EXPORT, METHOD.POST, params, config)
}
export async function inventoryExport(params, config) {
	return request(INVENTORY_EXPORT, METHOD.POST, params, config)
}
export async function hostDetail(id, zid) {
	const params = zid ? { zid } : {}
	return request(HOST_LIST + '/' + id, METHOD.GET, params)
}
export async function getHostAssetAttributes(id, zid) {
	const params = zid ? { zid } : {}
	return request(HOST_LIST + '/' + id + '/attributes', METHOD.GET, params)
}
export async function hostGraph(id, params) {
	const { zid, ...range } = params || {}
	return request(HOST_LIST + '/graph/' + id, METHOD.POST, zid ? range : params, zid ? { params: { zid } } : undefined)
}
export async function hostMock(id) {
	return request(HOST_MOCK + '/' + id, METHOD.GET)
}
export async function hostMockd(params) {
	return request(HOST_MOCKD, METHOD.POST, params)
}
export async function indexRestop(params) {
	return request(INDEX_RESTOP, METHOD.GET, { ...params })
}
export async function indexTrigger() {
	return request(INDEX_TRIGGER, METHOD.GET)
}
export async function indexEgress() {
	return request(INDEX__EGRESS, METHOD.GET)
}
export async function triggerList(params) {
	return request(TRIGGER_LIST, METHOD.GET, { ...params })
}
export async function indexInfo() {
	return request(INDEX_INFO, METHOD.GET)
}
export async function alarm(params) {
	return request(ALARM, METHOD.GET, { ...params })
}
export async function alarmHandlingDetail(id) {
	return request(ALARM + '/' + id + '/handling', METHOD.GET)
}
export async function claimAlarm(id) {
	return request(ALARM + '/' + id + '/claim', METHOD.POST, {})
}
export async function handleAlarm(id, action, note) {
	return request(ALARM + '/' + id + '/handling', METHOD.POST, { action, note })
}
export async function getAlarmPipeline() {
	return request(ALARM + '/pipeline', METHOD.GET)
}
export async function updateAlarmPipeline(params) {
	return request(ALARM + '/pipeline', METHOD.PUT, params)
}
export async function runAlarmPipeline() {
	return request(ALARM + '/pipeline/run', METHOD.POST, {})
}
export async function getAlarmAggregation() {
	return request(ALARM + '/aggregation', METHOD.GET)
}
export async function updateAlarmAggregation(params) {
	return request(ALARM + '/aggregation', METHOD.PUT, params)
}
export async function alarmAnalysis(params) {
	return request(ALARM_ANALYSIS, METHOD.GET, { ...params })
}
export async function alarmExport(params, config) {
	return request(ALARM_EXPORT, METHOD.POST, params, config)
}
export async function alarmTenantGet() {
	return request(ALARM + '/tenant', METHOD.GET)
}
export async function zabbixTenantList() {
	return request(ZABBIX + '/tenants', METHOD.GET)
}
export async function topologyList(params) {
	return request(TOPOLOGY_LIST, METHOD.GET, { ...params })
}
export async function topologyDetail(id) {
	return request(TOPOLOGY_LIST + '/' + id, METHOD.GET)
}
export async function createTopology(params) {
	return request(TOPOLOGY_LIST, METHOD.POST, params)
}
export async function updateTopology(id, params) {
	return request(TOPOLOGY_LIST + '/' + id, METHOD.PUT, params)
}
export async function deleteTopology(id) {
	return request(TOPOLOGY_LIST + '/' + id, METHOD.DELETE)
}
export async function deployTopology(params) {
	return request(TOPOLOGY_LIST + '/status', METHOD.POST, params)
}
export async function dashboardList(params) {
	return request(DASHBOARD, METHOD.GET, params)
}
export async function dashboardDetail(id) {
	return request(DASHBOARD + '/' + id, METHOD.GET)
}
export async function createDashboard(params) {
	return request(DASHBOARD, METHOD.POST, params)
}
export async function updateDashboard(id, params) {
	return request(DASHBOARD + '/' + id, METHOD.PUT, params)
}
export async function deleteDashboard(id) {
	return request(DASHBOARD + '/' + id, METHOD.DELETE)
}
export async function generateDashboardShare(id) {
	return request(DASHBOARD + '/' + id + '/share', METHOD.POST)
}
export async function revokeDashboardShare(id) {
	return request(DASHBOARD + '/' + id + '/share', METHOD.DELETE)
}
export async function baselineRuleList() {
	return request(BASELINE_RULE, METHOD.GET)
}
export async function baselineRuleDetail(id, zid) {
	return request(BASELINE_RULE + '/' + id, METHOD.GET, {zid})
}
export async function createBaselineRule(params) {
	return request(BASELINE_RULE, METHOD.POST, params)
}
export async function updateBaselineRule(id, zid, params) {
	return request(BASELINE_RULE + '/' + id + '?zid=' + encodeURIComponent(zid), METHOD.PUT, params)
}
export async function deleteBaselineRule(id, zid) {
	return request(BASELINE_RULE + '/' + id + '?zid=' + encodeURIComponent(zid), METHOD.DELETE)
}
export async function baselineRulePreview(id, zid) {
	return request(BASELINE_RULE + '/' + id + '/preview', METHOD.GET, {zid})
}
export async function baselineRuleEvents(id, zid) {
	return request(BASELINE_RULE + '/' + id + '/events', METHOD.GET, {zid})
}
export async function configurationResources(zid) {
	return request(CONFIG_CONSUMPTION + '/resources', METHOD.GET, zid ? {zid} : {})
}
export async function configurationScenarioList(params) {
	return request(CONFIG_CONSUMPTION + '/scenarios', METHOD.GET, params)
}
export async function createConfigurationScenario(params, context) {
	return request(CONFIG_CONSUMPTION + '/scenarios', METHOD.POST, params, configurationWriteConfig(context))
}
export async function updateConfigurationScenario(id, params, context) {
	return request(CONFIG_CONSUMPTION + '/scenarios/' + encodeURIComponent(id), METHOD.PUT, params, configurationWriteConfig(context))
}
export async function deleteConfigurationScenario(id, expectedVersion, context) {
	return request(CONFIG_CONSUMPTION + '/scenarios/' + encodeURIComponent(id), METHOD.DELETE, {
		expected_version: Number(expectedVersion),
	}, configurationWriteConfig(context))
}
export async function configurationTaskList(params) {
	return request(CONFIG_CONSUMPTION + '/tasks', METHOD.GET, params)
}
export async function applyConfigurationScenario(assetClass, assetID, params, context) {
	return request(CONFIG_CONSUMPTION + '/assets/' + encodeURIComponent(assetClass) + '/' + encodeURIComponent(assetID), METHOD.PUT, params, configurationWriteConfig(context))
}
export async function retryConfigurationTask(id, expectedVersion, context) {
	return request(CONFIG_CONSUMPTION + '/tasks/' + encodeURIComponent(id) + '/retry', METHOD.POST, {
		expected_version: Number(expectedVersion),
	}, configurationWriteConfig(context))
}
export async function networkDiscoveryResources() {
	return request(NETWORK_DISCOVERY + '/resources', METHOD.GET)
}
export async function networkDiscoveryRules() {
	return request(NETWORK_DISCOVERY + '/rules', METHOD.GET)
}
export async function networkDiscoveryResults() {
	return request(NETWORK_DISCOVERY + '/results', METHOD.GET)
}
export async function createNetworkDiscoveryRule(params) {
	return request(NETWORK_DISCOVERY + '/rules', METHOD.POST, params)
}
export async function deleteNetworkDiscoveryRule(id) {
	return request(NETWORK_DISCOVERY + '/rules/' + id, METHOD.DELETE)
}
export async function resourceDiscoveryOverview() {
	return request(RESOURCE_DISCOVERY, METHOD.GET)
}
export async function scriptDiscoveryList() {
	return request(SCRIPT_DISCOVERY, METHOD.GET)
}
export async function itemList(params) {
	return request(ITEM_LIST, METHOD.GET, params)
}
export async function inventoryTree() {
	return request(INVENTORY_LIST, METHOD.GET)
}
export async function hostUpdate(params) {
	return request(HOST_LIST, METHOD.POST, params)
}
export async function hostSearch(params) {
	return request(HOST_LIST + '/search', METHOD.GET, params)
}
export async function netInterfaceList(id) {
	return request(HOST_LIST + '/interface/' + id, METHOD.GE)
}
export async function netInterfaceData(params) {
	return request(HOST_LIST + '/interface/data', METHOD.POST, params)
}
export async function winMonList(id, zid) {
	const params = zid ? { zid } : {}
	return request(HOST_LIST + '/winmon/' + id, METHOD.GET, params)
}
export async function linMonList(id, zid) {
	const params = zid ? { zid } : {}
	return request(HOST_LIST + '/linmon/' + id, METHOD.GET, params)
}
export async function indexOverview() {
	return request(INDEX__OVERVIEW, METHOD.GET)
}
export async function systemList() {
	return request(SYSTEM_LIST, METHOD.GET)
}
export async function systemInfo(id) {
	return request(SYSTEM_LIST + '/' + id, METHOD.GET)
}
export async function egressGet() {
	return request(SYSTEM_LIST + '/egress/', METHOD.GET)
}
export async function egressUpdate(params) {
	return request(SYSTEM_LIST + '/egress/', METHOD.PUT, params)
}
// 新的出口配置 API
export async function egressConfigList() {
	return request('/v1/egress/configs', METHOD.GET)
}
export async function egressConfigGet(id) {
	return request('/v1/egress/configs/' + id, METHOD.GET)
}
export async function egressConfigAdd(params) {
	return request('/v1/egress/configs', METHOD.POST, params)
}
export async function egressConfigUpdate(id, params) {
	return request('/v1/egress/configs/' + id, METHOD.PUT, params)
}
export async function egressConfigDelete(id) {
	return request('/v1/egress/configs/' + id, METHOD.DELETE)
}
export async function configGetList() {
	return request(SYSTEM_LIST + '/config/', METHOD.GET)
}
export async function configGetOne(id) {
	return request(SYSTEM_LIST + '/config/' + id, METHOD.GET)
}
export async function configUpdate(id, params) {
	return request(SYSTEM_LIST + '/config/' + id, METHOD.PUT, params)
}
export async function configUpdateGroup(category, params) {
	return request(SYSTEM_LIST + '/config/group/' + category, METHOD.PUT, params)
}
export async function hostgroupList(id) {
	return request(HOST_GROUP, METHOD.GET, { zid: id })
}
export async function hostgroupHosts(groupId, zid) {
	try {
		return await request(HOST_GROUP + '/' + groupId + '/hosts', METHOD.GET, { zid })
	} catch (error) {
		const status = error && (error.status || (error.data && error.data.code))
		if (status === 404) {
			return hostgroupHostsLegacy(groupId, zid)
		}
		throw error
	}
}
export async function hostgroupHostsLegacy(groupId, zid) {
	return request(HOST_GROUP + '/list/' + groupId, METHOD.GET, { zid })
}
export async function hostFilterByTag(params) {
	return request(HOST_FILTER_BY_TAG, METHOD.GET, params)
}
export async function templateList(id) {
	return request(TEMPLATE_lIST, METHOD.GET, { zid: id })
}
export async function templateGetItemList(id, zid) {
	return request(TEMPLATE_lIST + '/item/' + id, METHOD.GET, { zid: zid })
}
export async function baseVersion() {
	return request(INDEX_VERSION, METHOD.GET)
}
export async function zbxSession() {
	return request(INDEX_SESSION, METHOD.GET)
}
export async function reportAdd(params) {
	return request(REPORT, METHOD.POST, params)
}
export async function reportList(params) {
	return request(REPORT, METHOD.GET, params)
}
export async function reportGet(id) {
	return request(REPORT + '/' + id, METHOD.GET)
}
export async function reportPut(id, params) {
	return request(REPORT + '/' + id, METHOD.PUT, params)
}
export async function reportDelete(id) {
	return request(REPORT + '/' + id, METHOD.DELETE)
}
export async function reportCheckNow(params) {
	return request(REPORT + '/checknow', METHOD.POST, params)
}
export async function reportStatusUpdate(params) {
	return request(REPORT + '/status', METHOD.POST, params)
}
export async function itemListTraffic(params) {
	return request(ITEM_TRAFFIC, METHOD.GET, params)
}
export async function itemTopoTraffic(params) {
	return request(TOPO_TRAFFIC, METHOD.GET, params)
}
export async function taskLogList(params) {
	return request(TASK_LOG, METHOD.GET, { ...params })
}
export async function taskLogDelete(id) {
	return request(TASK_LOG + '/' + id, METHOD.DELETE)
}
export async function managerChpwd(params) {
	return request(MANAGER + '/chpwd', METHOD.POST, params)
}
export async function ruleList(params) {
	return request(RULE, METHOD.GET, { ...params })
}
export async function ruleAdd(params) {
	return request(RULE, METHOD.POST, params)
}
export async function rulePut(id, params) {
	return request(RULE + '/' + id, METHOD.PUT, params)
}
export async function ruleStatusPut(id, params) {
	return request(RULE + '/status/' + id, METHOD.PUT, params)
}
export async function ruleDelete(id) {
	return request(RULE + '/' + id, METHOD.DELETE)
}
export async function ruleGet(id) {
	return request(RULE + '/' + id, METHOD.GET)
}
export async function userList(params) {
	return request(USER, METHOD.GET, { ...params })
}
export async function userCreate(params) {
	return request(USER, METHOD.POST, params)
}
export async function userDelete(id) {
	return request(USER + '/' + id, METHOD.DELETE)
}
export async function userPut(id, params) {
	return request(USER + '/' + id, METHOD.PUT, params)
}
export async function userStatusPut(id, params) {
	return request(USER + '/status/' + id, METHOD.PUT, params)
}
export async function groupList(params) {
	return request(GROUP, METHOD.GET, { ...params })
}
export async function groupCreate(params) {
	return request(GROUP, METHOD.POST, params)
}
export async function groupPut(id, params) {
	return request(GROUP + '/' + id, METHOD.PUT, params)
}
export async function groupMemberPut(id, params) {
	return request(GROUP + '/member/' + id, METHOD.PUT, params)
}
export async function groupDelete(id) {
	return request(GROUP + '/' + id, METHOD.DELETE)
}
export async function eventLogGet(id) {
	return request(ALARM + '/' + id + '/notifications', METHOD.GET)
}
export async function retryNotificationDelivery(alarmId, deliveryId, expectedVersion, idempotencyKey) {
	return request(ALARM + '/' + alarmId + '/notifications/' + deliveryId + '/retry', METHOD.POST, {
		expected_version: expectedVersion,
		idempotency_key: idempotencyKey,
	})
}
export async function alarmDeepseekAnalysis(params) {
	return request(AI+'/chat', METHOD.POST, params, {
		responseType: 'text',
		timeout: 300000,
		retry: 3,
		retryDelay: 1000,
		signal: params.signal,
		onDownloadProgress: (progressEvent) => {
			try {
				const xhr = progressEvent.target;
				if (xhr.status === 200) {
					const responseText = xhr.responseText;
					if (params.onProgress && typeof params.onProgress === 'function') {
						params.onProgress(responseText, params.requestId);
					}
				}
			} catch (error) {
				console.debug('Stream progress error:', error);
			}
		}
	})
}
export async function metricMappingList(params) {
	return request(METRIC_MAPPING, METHOD.GET, params)
}
export async function metricMappingGet(id) {
	return request(METRIC_MAPPING + '/' + id, METHOD.GET)
}
export async function metricMappingHistory(params) {
	return request(METRIC_MAPPING + '/history', METHOD.GET, params)
}

// 系统更新相关 API
export async function systemVersion() {
	return request(SYSTEM_UPDATE + '/version', METHOD.GET)
}

export async function systemCheckUpdate() {
	return request(SYSTEM_UPDATE + '/check-update', METHOD.GET)
}

// 获取系统公开信息（无需认证）
export async function getPublicSystemInfo() {
	return request('/v1/info', METHOD.GET)
}

// 获取初始配置状态
export async function getInitialSetupStatus() {
	return request('/v1/system/setup-status', METHOD.GET)
}

// 完成初始配置
export async function completeInitialSetup() {
	return request('/v1/system/complete-setup', METHOD.POST)
}

// 资产类型管理
export async function getAssetTypes() {
	return request(ASSET_TYPE, METHOD.GET)
}
export async function createAssetType(params) {
	return request(ASSET_TYPE, METHOD.POST, params)
}
export async function updateAssetType(id, params) {
	return request(ASSET_TYPE + '/' + id, METHOD.PUT, params)
}
export async function deleteAssetType(id) {
	return request(ASSET_TYPE + '/' + id, METHOD.DELETE)
}
export async function getAssetTypeFields(id) {
	return request(ASSET_TYPE + '/' + id + '/fields', METHOD.GET)
}
export async function updateAssetTypeFields(id, fields) {
	return request(ASSET_TYPE + '/' + id + '/fields', METHOD.PUT, fields)
}

// 设备分组管理
export async function getAssetGroups() {
	return request(ASSET_GROUP, METHOD.GET)
}
export async function createAssetGroup(params) {
	return request(ASSET_GROUP, METHOD.POST, params)
}
export async function updateAssetGroup(id, params) {
	return request(ASSET_GROUP + '/' + id, METHOD.PUT, params)
}
export async function deleteAssetGroup(id) {
	return request(ASSET_GROUP + '/' + id, METHOD.DELETE)
}

// 资产绑定配置
export async function getSystemBindings() {
	return request(SYSTEM_BINDING, METHOD.GET)
}
export async function getSystemBinding(id) {
	return request(SYSTEM_BINDING + '/' + id, METHOD.GET)
}
export async function getSystemBindingHistory(id, params) {
	return request(SYSTEM_BINDING + '/' + id + '/history', METHOD.GET, params)
}

export default {
	hostList,
	hostDetail,
	getHostAssetAttributes,
	hostGraph,
	hostMock,
	hostMockd,
	hostSearch,
	indexRestop,
	indexInfo,
	indexEgress,
	alarm,
	alarmAnalysis,
	alarmTenantGet,
	zabbixTenantList,
	topologyList,
	topologyDetail,
	createTopology,
	updateTopology,
	deleteTopology,
	dashboardList,
	dashboardDetail,
	createDashboard,
	updateDashboard,
	deleteDashboard,
	generateDashboardShare,
	revokeDashboardShare,
	configurationResources,
	configurationScenarioList,
	createConfigurationScenario,
	updateConfigurationScenario,
	deleteConfigurationScenario,
	configurationTaskList,
	applyConfigurationScenario,
	retryConfigurationTask,
	networkDiscoveryResources,
	networkDiscoveryRules,
	networkDiscoveryResults,
	createNetworkDiscoveryRule,
	deleteNetworkDiscoveryRule,
	resourceDiscoveryOverview,
	scriptDiscoveryList,
	itemList,
	triggerList,
	deployTopology,
	inventoryTree,
	inventoryExport,
	hostUpdate,
	netInterfaceList,
	netInterfaceData,
	winMonList,
	linMonList,
	indexOverview,
	systemList,
	systemInfo,
	egressGet,
	egressUpdate,
	egressConfigList,
	egressConfigGet,
	egressConfigAdd,
	egressConfigUpdate,
	egressConfigDelete,
	configGetList,
	configGetOne,
	configUpdate,
	configUpdateGroup,
	hostgroupList,
	hostgroupHosts,
	hostFilterByTag,
	templateList,
	templateGetItemList,
	baseVersion,
	zbxSession,
	reportAdd,
	reportList,
	reportGet,
	reportPut,
	reportCheckNow,
	reportDelete,
	itemListTraffic,
	itemTopoTraffic,
	reportStatusUpdate,
	taskLogList,
	taskLogDelete,
	eventLogGet,
	retryNotificationDelivery,
	ruleList,
	ruleAdd,
	rulePut,
	ruleStatusPut,
	userList,
	ruleGet,
	userCreate,
	userDelete,
	userPut,
	userStatusPut,
	groupList,
	groupCreate,
	groupPut,
	groupMemberPut,
	groupDelete,
	alarmDeepseekAnalysis,
	metricMappingList,
	metricMappingGet,
	metricMappingHistory,
	systemVersion,
	systemCheckUpdate,
	getPublicSystemInfo,
	getAssetTypes,
	createAssetType,
	updateAssetType,
	deleteAssetType,
	getAssetTypeFields,
	updateAssetTypeFields,
	getAssetGroups,
	createAssetGroup,
	updateAssetGroup,
	deleteAssetGroup,
	getSystemBindings,
	getSystemBinding,
	getSystemBindingHistory,
}
