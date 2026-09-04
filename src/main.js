import Vue from "vue";
import App from "./App.vue";
import { initRouter } from "./router";
import "./theme/index.less";
import "./theme/smartops.less";
import Antd from "ant-design-vue";
import LegacyCharts from "@/plugins/legacy-charts";
//import echats
// import echarts from "echarts";
// Vue.prototype.$echarts = echarts;
// import '@/mock'
import store from "./store";
import "animate.css/source/animate.css";
import Plugins from "@/plugins";
import { initI18n } from "@/utils/i18n";
import bootstrap from "@/bootstrap";
import "moment/locale/zh-cn";
import "moment/locale/zh-tw";
import 'highlight.js/styles/github.css';  // 或其他主题样式
import Cookie from 'js-cookie'
import { startTokenRefresher, stopTokenRefresher } from '@/utils/tokenRefresher'
const router = initRouter(store.state.setting.asyncRoutes);
const i18n = initI18n("CN", "US");

// 将 i18n 实例挂载到 window，方便在 store 中访问
window.$i18n = i18n;

Vue.use(Antd);
Vue.config.productionTip = false;
Vue.use(LegacyCharts);
Vue.use(Plugins);

// 添加全局 mixin 来处理主题颜色
Vue.mixin({
  computed: {
    $themeColor() {
      return this.$store?.state?.setting?.theme?.color || '#1b5a96';
    },
    $cardHeadStyle() {
      const color = this.$themeColor;
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return {
        background: `rgba(${r}, ${g}, ${b}, 0.08)`,
        color: color,
        fontWeight: 600
      };
    }
  }
});

window.loginNoAuth = function () {
  stopTokenRefresher()
  Vue.prototype.$message.warning("登录已失效，请重新登录");
  router.push({ path: "/login" });
};

async function mountApplication() {
  // 先刷新当前租户的权限和菜单，再让 Vue Router 处理首个 hash 路径。
  // 这样已有登录会话在版本升级后刷新即可获得新增入口，无需退出重登。
  await bootstrap({ router, store, i18n, message: Vue.prototype.$message });

  if (Cookie.get('X-Token')) {
    startTokenRefresher()
  }

  new Vue({
    router,
    store,
    i18n,
    render: (h) => h(App),
  }).$mount("#app");
}

mountApplication()
