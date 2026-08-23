<template>
  <a-layout-header :class="[headerTheme, 'admin-header']">
    <div :class="['admin-header-wide', layout, pageWidth]">
      <router-link v-if="isMobile || layout === 'head'" to="/" :class="['logo', isMobile ? null : 'pc', headerTheme]">
        <img width="32" :src="systemLogo" />
        <h1 v-if="!isMobile">{{systemName}}</h1>
      </router-link>
      <a-divider v-if="isMobile" type="vertical" />
      <a-icon v-if="layout !== 'head'" class="trigger" :type="collapsed ? 'menu-unfold' : 'menu-fold'" @click="toggleCollapse" />
      <div v-if="layout !== 'side' && !isMobile" class="admin-header-menu" :style="`width: ${menuWidth};`">
        <i-menu class="head-menu" :theme="headerTheme" mode="horizontal" :options="menuData" @select="onSelect" />
      </div>
      <div :class="['admin-header-right', headerTheme]">
        <a-select
          v-if="tenantOptions.length"
          class="header-item tenant-selector"
          size="small"
          :value="activeTenantID"
          :loading="switchingTenant"
          placeholder="选择租户"
          @change="switchTenant"
        >
          <a-select-option v-for="tenant in tenantOptions" :key="tenant.id" :value="tenant.id">
            {{ tenant.name }}
          </a-select-option>
        </a-select>
        <header-search
          v-if="!isMobile"
          class="header-item header-search-item"
          @active="searchActive = $event"
        />
        <!-- 演示模式提示（悬浮说明） -->
        <a-tooltip v-if="demoMode" placement="bottom">
          <template slot="title">
            <span>当前为只读演示环境，禁止修改数据</span>
          </template>
          <a-tag color="orange" class="header-item demo-tag">演示模式</a-tag>
        </a-tooltip>

        <a-button
          v-if="showEnterScreen"
          class="header-item enter-screen-btn"
          type="primary"
          ghost
          icon="fullscreen"
          size="small"
          @click="goToScreen"
        >
          {{ $t('topology.enterScreen') }}
        </a-button>
        <header-avatar class="header-item" />
        <a-dropdown class="lang header-item">
          <div>
            <a-icon type="global" /> {{langAlias}}
          </div>
          <a-menu @click="val => setLang(val.key)" :selected-keys="[lang]" slot="overlay">
            <a-menu-item v-for=" lang in langList" :key="lang.key">{{lang.key.toLowerCase() + ' ' + lang.name}}</a-menu-item>
          </a-menu>
        </a-dropdown>
      </div>
    </div>
  </a-layout-header>
</template>

<script>
import HeaderSearch from './HeaderSearch'
// import HeaderNotice from './HeaderNotice'
import HeaderAvatar from "./HeaderAvatar";
import IMenu from "@/components/menu/menu";
import { mapState, mapMutations } from "vuex";
import { getCurrentTenant } from '@/services/tenant'
import { getPermissionContext, getRoutesConfig } from '@/services/user'
import { getTenantContext, removeTenantContext, setTenantContext } from '@/utils/request'
import { businessPayload, normalizePermissionContext } from '@/utils/permission-policy'

export default {
  name: "AdminHeader",
  components: { HeaderSearch, IMenu, HeaderAvatar },
  props: ["collapsed", "menuData"],
  data() {
    return {
      langList: [
        { key: "CN", name: "简体中文", alias: "简体" },
        { key: "HK", name: "繁體中文", alias: "繁體" },
        { key: "US", name: "English", alias: "English" },
      ],
      searchActive: false,
      switchingTenant: false,
    };
  },
  computed: {
    ...mapState("setting", [
      "theme",
      "isMobile",
      "layout",
      "systemName",
      "systemLogo",
      "lang",
      "pageWidth",
      "demoMode",
    ]),
    headerTheme() {
      if (
        this.layout == "side" &&
        this.theme.mode == "dark" &&
        !this.isMobile
      ) {
        return "light";
      }
      return this.theme.mode;
    },
    langAlias() {
      let lang = this.langList.find((item) => item.key == this.lang);
      return lang.alias;
    },
    showEnterScreen() {
      return this.$route.path !== '/screen/dashboard'
    },
    tenantOptions() {
      return this.$store.getters['account/tenants'] || []
    },
    activeTenantID() {
      const tenant = this.$store.getters['account/currentTenant'] || getTenantContext()
      return tenant && tenant.id
    },
    menuWidth() {
      const { layout, searchActive } = this;
      const headWidth = layout === "head" ? "100% - 188px" : "100%";
      const extraWidth = searchActive ? "600px" : "400px";
      return `calc(${headWidth} - ${extraWidth})`;
    },
  },
  methods: {
    toggleCollapse() {
      this.$emit("toggleCollapse");
    },
    onSelect(obj) {
      this.$emit("menuSelect", obj);
    },
    goToScreen() {
      this.$router.push('/screen/dashboard')
    },
    async switchTenant(id) {
      const candidate = this.tenantOptions.find((tenant) => Number(tenant.id) === Number(id))
      if (!candidate || Number(this.activeTenantID) === Number(id)) return
      const previous = getTenantContext()
      this.switchingTenant = true
      try {
        setTenantContext(candidate)
        const response = await getCurrentTenant()
        const business = response && response.data && response.data.code !== undefined ? response.data : response
        if (!business || Number(business.code) !== 200) throw new Error(business && business.message)
        this.$store.commit('account/setCurrentTenant', candidate)
		const permissionResponse = await getPermissionContext()
		const permissionBusiness = businessPayload(permissionResponse)
		if (!permissionBusiness || Number(permissionBusiness.code) !== 200) throw new Error(permissionBusiness && permissionBusiness.message)
		const permissionContext = normalizePermissionContext(permissionResponse)
		this.$store.commit('account/setRoles', permissionContext.roles)
		this.$store.commit('account/setPermissions', permissionContext.permissions)
		const routesBusiness = businessPayload(await getRoutesConfig())
		if (!routesBusiness || Number(routesBusiness.code) !== 200) throw new Error(routesBusiness && routesBusiness.message)
		this.$store.commit('account/setRoutesConfig', Array.isArray(routesBusiness.data) ? routesBusiness.data : [])
        window.location.reload()
      } catch (error) {
        if (previous) setTenantContext(previous)
        else removeTenantContext()
        this.$message.error(error.message || '切换租户失败')
      } finally {
        this.switchingTenant = false
      }
    },
    ...mapMutations("setting", ["setLang"]),
  },
};
</script>

<style lang="less" scoped>
@import "index";

.demo-tag {
  margin-right: 8px;
  border-radius: 10px;
  font-weight: 500;
}

.header-search-item {
  padding-right: 4px;
  padding-left: 4px;
}

.enter-screen-btn {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

.tenant-selector {
  min-width: 150px;
  margin-right: 8px;
}
</style>
