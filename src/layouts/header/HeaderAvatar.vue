<template>
  <div class="header-avatar-wrap">
    <a-dropdown :trigger="['click']" v-model="dropdownVisible">
      <div
        class="header-avatar"
        role="button"
        tabindex="0"
        :aria-expanded="dropdownVisible ? 'true' : 'false'"
        aria-haspopup="menu"
        @keydown.enter.prevent="toggleDropdown"
        @keydown.space.prevent="toggleDropdown"
      >
        <span class="identity-mark" aria-hidden="true">{{ roleMark }}</span>
        <span class="identity-copy">
          <span class="name">{{ displayName }}</span>
          <span class="role-name">{{ roleLabel }}</span>
        </span>
        <a-icon class="identity-arrow" type="down" aria-hidden="true" />
      </div>
      <a-menu :class="['avatar-menu']" slot="overlay" @click="handleMenuClick">
        <a-menu-item class="avatar-menu-identity" key="identity" disabled>
          <span class="identity-mark identity-mark-small" aria-hidden="true">{{ roleMark }}</span>
          <span class="avatar-menu-account">
            <strong>{{ displayName }}</strong>
            <span>{{ roleLabel }}</span>
          </span>
        </a-menu-item>
        <a-menu-divider />
        <a-menu-item key="change-password">
          <a-icon type="lock" />
          <span>{{ $t('change_password_title') }}</span>
        </a-menu-item>
        <a-menu-divider />
        <a-menu-item key="logout">
          <a-icon type="poweroff" />
          <span>{{ $t('logout_btn') }}</span>
        </a-menu-item>
      </a-menu>
    </a-dropdown>
    <a-modal
      :visible="changePasswordVisible"
      :title="$t('change_password_title')"
      :footer="null"
      :destroyOnClose="true"
      @cancel="closeChangePassword"
      width="680px"
    >
      <change-password-form
        modal-mode
        @cancel="closeChangePassword"
        @success="handlePasswordChanged"
      />
    </a-modal>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { logout } from '@/services/user'
import { stopTokenRefresher } from '@/utils/tokenRefresher'
import ChangePasswordForm from '@/pages/system/components/ChangePasswordForm.vue'

export default {
  name: 'HeaderAvatar',
  version: '',
  i18n: require('@/pages/system/i18n'),
  components: { ChangePasswordForm },
  data() {
    return {
      dropdownVisible: false,
      changePasswordVisible: false
    }
  },
  computed: {
    ...mapGetters('account', ['user']),
    displayName() {
      return this.user && (this.user.name || this.user.username) ? (this.user.name || this.user.username) : '用户'
    },
    normalizedRole() {
      const role = this.user && this.user.role ? String(this.user.role).toLowerCase() : ''
      const roles = this.user && Array.isArray(this.user.roles) ? this.user.roles : []
      const roleIDs = roles.map(item => String(item && (item.id || item.name || item)).toLowerCase())
      return role || roleIDs[0] || ''
    },
    roleLabel() {
      if (['admin', 'platform_admin'].includes(this.normalizedRole)) {
        return '平台管理员'
      }
      if (this.normalizedRole === 'tenant_admin') {
        return '租户管理员'
      }
      if (this.normalizedRole === 'viewer') {
        return '只读用户'
      }
      return '授权用户'
    },
    roleMark() {
      if (['admin', 'platform_admin'].includes(this.normalizedRole)) return '管'
      if (this.normalizedRole === 'tenant_admin') return '租'
      if (this.normalizedRole === 'viewer') return '读'
      return '用'
    }
  },
  methods: {
    toggleDropdown() {
      this.dropdownVisible = !this.dropdownVisible
    },
    handleMenuClick({ key }) {
      if (key === 'change-password') {
        this.openChangePassword()
        return
      }
      if (key === 'logout') {
        this.logout()
      }
    },
    openChangePassword() {
      this.dropdownVisible = false
      const activeElement = typeof document !== 'undefined' ? document.activeElement : null
      if (activeElement && typeof activeElement.blur === 'function') {
        activeElement.blur()
      }
      window.setTimeout(() => {
        this.changePasswordVisible = true
      }, 80)
    },
    closeChangePassword() {
      this.changePasswordVisible = false
    },
    handlePasswordChanged() {
      this.$message.success(this.$t('password_change_success_relogin'))
      this.changePasswordVisible = false
      this.logout()
    },
    logout() {
      stopTokenRefresher()
      logout()
      this.$router.push('/login')
    }
  }
}
</script>

<style lang="less">
.header-avatar-wrap {
  display: inline-flex;
  align-items: center;
  height: 64px;
}

.header-avatar {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  height: 44px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 2px;
  cursor: pointer;
  transition: border-color .16s ease, background-color .16s ease;

  &:hover,
  &:focus-visible,
  &[aria-expanded="true"] {
    border-color: #d6e0ea;
    background: #f3f6fa;
    outline: none;
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px rgba(27, 90, 150, .2);
  }
}

.identity-mark {
  display: inline-grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #31577f;
  border-radius: 2px;
  background: #163a63;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  box-shadow: inset 3px 0 0 #1b5a96;
}

.identity-copy {
  display: grid;
  min-width: 0;
  line-height: 1.2;

  .name {
    max-width: 112px;
    overflow: hidden;
    color: #17283d;
    font-size: 13px;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .role-name {
    margin-top: 3px;
    color: #738398;
    font-size: 10px;
    letter-spacing: .06em;
  }
}

.identity-arrow {
  color: #718196;
  font-size: 10px;
}

.avatar-menu {
  width: 218px;
  padding: 6px;
  border: 1px solid #d9e2eb;
  border-radius: 2px;
  box-shadow: 0 10px 26px rgba(10, 31, 68, .14);

  .ant-dropdown-menu-item {
    display: flex;
    align-items: center;
    min-height: 42px;
    padding: 0 12px;
    border-radius: 1px;
    color: #2d4057;

    .anticon {
      width: 18px;
      margin-right: 9px;
      color: #60758d;
    }

    &:hover,
    &:focus {
      background: #edf3f8;
      color: #0a1f44;
    }
  }

  .avatar-menu-identity.ant-dropdown-menu-item-disabled {
    min-height: 62px;
    cursor: default;
    opacity: 1;
    color: #17283d;
    background: #f3f6fa;
  }

  .identity-mark-small {
    width: 34px;
    height: 34px;
    margin-right: 10px;
  }

  .avatar-menu-account {
    display: grid;
    line-height: 1.35;

    strong {
      color: #0a1f44;
      font-size: 13px;
    }

    span {
      color: #6f8094;
      font-size: 11px;
    }
  }

  .ant-dropdown-menu-item-divider {
    margin: 6px 4px;
    background: #e3e9f0;
  }
}

@media screen and (max-width: 760px) {
  .header-avatar {
    gap: 0;
    padding: 0 7px;

    .identity-copy,
    .identity-arrow {
      display: none;
    }
  }
}
</style>
