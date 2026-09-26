import TabsView from "@/layouts/tabs/TabsView";
import BlankView from "@/layouts/BlankView";
// import PageView from '@/layouts/PageView'

// 路由配置
const options = {
  routes: [
    {
      path: "/install",
      name: "安装",
      component: () => import("@/pages/install"),
    },
    {
      path: "/login",
      name: "登录",
      component: () => import("@/pages/login"),
    },
    {
      path: "/tenant-select",
      name: "选择租户",
      component: () => import("@/pages/system/tenants/select"),
    },
    {
      path: "/share/dashboard/:token",
      name: "场景分享",
      component: () => import("@/pages/dashboard/custom/share"),
    },
    {
      path: "*",
      name: "404",
      component: () => import("@/pages/exception/404"),
    },
    {
      path: "/403",
      name: "403",
      component: () => import("@/pages/exception/403"),
    },
    {
      path: "/screen/dashboard",
      name: "运维大屏",
      component: () => import("@/pages/screen/index"),
    },
    {
      path: "/",
      name: "首页",
      component: TabsView,
      redirect: "/dashboard/workplace",
      children: [
        {
          path: "dashboard",
          name: "监控",
          meta: { icon: "dashboard" },
          component: BlankView,
          children: [
            {
              path: "workplace",
              name: "面板",
              meta: { page: { closable: false } },
              component: () => import("@/pages/dashboard/index"),
            },
            {
              path: "overview",
              name: "状态总览",
              meta: { page: { closable: false } },
              component: () => import("@/pages/dashboard/overview-redesign"),
            },
            {
              path: "custom-dashboards",
              name: "自定义仪表盘",
              component: () => import("@/pages/dashboard/custom/index"),
            },
            {
              path: "custom-dashboard-designer",
              name: "仪表盘设计",
              meta: { highlight: "/dashboard/custom-dashboards", invisible: true },
              component: () => import("@/pages/dashboard/custom/designer"),
            },
            {
              path: "baselines",
              name: "动态基线",
              component: () => import("@/pages/dashboard/baseline"),
            },
            {
              path: "domains",
              name: "域名监控",
              component: () => import("@/pages/dashboard/domains"),
            },
          ],
        },
        {
          path: "alarm",
          name: "告警",
          meta: { icon: "history", page: { cacheAble: false } },
          component: BlankView,
          children: [
            {
              path: "analysis",
              name: "告警分析",
              component: () => import("@/pages/alarm/analysis"),
            },
            {
              path: "query",
              name: "告警查询",
              component: () => import("@/pages/alarm/query"),
            },
            {
              path: "rule",
              name: "分发规则",
              component: () => import("@/pages/alarm/rule"),
            },
            {
              path: "mutes",
              name: "屏蔽规则",
              component: () => import("@/pages/alarm/mutes"),
            },
          ],
        },
        {
          path: "assets",
          name: "资产",
          meta: { icon: "appstore", page: { cacheAble: false } },
          component: BlankView,
          children: [
            {
              path: "tree",
              name: "设备树",
              component: () => import("@/pages/host/AssetBrowser"),
            },
          ],
        },
        {
          // 主机/网络/硬件列表已并入“资产管理”，父容器保留仅用于挂载详情路由
          path: "host",
          name: "主机应用",
          meta: { icon: "hdd", page: { cacheAble: false }, invisible: true },
          component: BlankView,
          children: [
            {
              path: "windetail",
              name: "Windows详情",
              meta: { highlight: "/host", invisible: true },
              component: () => import("@/pages/host/winDetail"),
            },
            {
              path: "lindetail",
              name: "Linux详情",
              meta: { highlight: "/host", invisible: true },
              component: () => import("@/pages/host/linuxDetail"),
            },
          ],
        },
        {
          path: "net",
          name: "网络管理",
          meta: { icon: "ie", page: { cacheAble: false }, invisible: true },
          component: BlankView,
          children: [
            {
              path: "detail",
              name: "设备详情",
              meta: { highlight: "/net", invisible: true },
              component: () => import("@/pages/host/netDetail"),
            },
          ],
        },
        {
          path: "server",
          name: "硬件管理",
          meta: { icon: "folder", page: { cacheAble: false }, invisible: true },
          component: BlankView,
          children: [
            {
              path: "detail",
              name: "详细信息",
              meta: { highlight: "/server", invisible: true },
              component: () => import("@/pages/host/serDetail"),
            },
          ],
        },
        {
          path: "topology",
          name: "可视化",
          meta: { icon: "cluster", page: { cacheAble: false } },
          component: BlankView,
          children: [
            {
              path: "list",
              name: "拓扑维护",
              component: () => import("@/pages/topology/index"),
            },
            {
              path: "detail",
              name: "编辑",
              meta: { highlight: "/topology", invisible: true },
              component: () => import("@/pages/topology/detail"),
            },
            {
              path: "show",
              name: "展示",
              meta: { highlight: "/topology", invisible: true },
              component: () => import("@/pages/topology/show"),
            },
            {
              path: "/screen/dashboard",
              name: "运维大屏",
              component: () => import("@/pages/screen/index"),
            },
            {
              path: "custom-screens",
              name: "自定义大屏",
              component: () => import("@/pages/dashboard/custom/index"),
            },
            {
              path: "custom-screen-designer",
              name: "大屏设计",
              meta: { highlight: "/topology/custom-screens", invisible: true },
              component: () => import("@/pages/dashboard/custom/designer"),
            },
          ],
        },
        {
          path: "report",
          name: "报表管理",
          meta: { icon: "cluster", page: { cacheAble: false }, invisible: true },
          component: BlankView,
          children: [
            {
              path: "host",
              name: "主机报表",
              component: () => import("@/pages/report/host"),
            },
          ],
        },
        {
          path: "system",
          name: "系统管理",
          meta: {
            icon: "setting",
            page: { cacheAble: false },
            // invisible: true,
          },
          component: BlankView,
          children: [
            {
              path: "users",
              name: "用户管理",
              meta: { icon: "user", page: { cacheAble: false } },
              component: () => import("@/pages/system/users"),
            },
            {
              path: "tenants",
              name: "租户管理",
              meta: { icon: "team", page: { cacheAble: false } },
              component: () => import("@/pages/system/tenants"),
            },
            {
              path: "bandwidth",
              name: "出口配置",
              component: () => import("@/pages/system/bandwidth"),
            },
            {
              path: "zabbix",
              name: "监控源管理",
              component: () => import("@/pages/system/zabbix"),
            },
            {
              path: "proxy-management",
              name: "代理管理",
              component: () => import("@/pages/system/proxy-management"),
            },
            {
              path: "config",
              name: "参数配置",
              component: () => import("@/pages/system/config"),
            },
            {
              path: "asset-management",
              name: "设备配置",
              component: () => import("@/pages/system/asset-management"),
            },
            {
              path: "version",
              name: "版本信息",
              component: () => import("@/pages/system/version"),
            },
            {
              path: "audit",
              name: "操作审计",
              component: () => import("@/pages/system/audit"),
            },
            {
              path: "asset-type",
              name: "资产类型",
              meta: { invisible: true, highlight: "/system/asset-management" },
              component: () => import("@/pages/system/asset-type"),
            },
            {
              path: "asset-binding",
              name: "设备绑定",
              meta: { invisible: true, highlight: "/system/asset-management" },
              component: () => import("@/pages/system/asset-binding"),
            },
          ],
        },
      ],
    },
  ],
};

export default options;
