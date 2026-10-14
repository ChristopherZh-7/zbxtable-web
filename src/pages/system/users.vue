<template>
  <page-layout :noTitle="true">
    <a-form-model class="home-search" layout="inline" :colon='false'>
      <a-form-model-item :label="$t('label_username')">
        <a-input v-model.trim="username" :placeholder="$t('label_username')" />
      </a-form-model-item>
      <a-form-model-item :label="$t('label_state')">
        <a-select style="width: 80px" v-model.trim="status">
          <a-select-option :value="item.value" v-for="item in statusOption" :key="item.value">{{item.label}}</a-select-option>
        </a-select>
      </a-form-model-item>
      <a-form-model-item>
        <a-button type="primary" @click="init">{{ $t('search_btn') }}</a-button>
        <a-button style="margin-left: 10px;" @click="resetData">{{ $t('reset_btn') }}</a-button>
        <a-button type="primary" style="margin-left: 10px;" @click="showModal" v-auth="`add`">{{ $t('add_user_btn') }}</a-button>
      </a-form-model-item>
    </a-form-model>
    <div class="linux-list">
      <a-table :loading="loading" :columns="columns" :data-source="list" @change="changePage" :pagination="pagination" :rowKey="(record) => { return record.id;}">
        <span slot="id" slot-scope="record">{{record.id}}</span>
        <div slot="username" slot-scope="record">{{record.username}}</div>
        <div slot="role" slot-scope="record">{{getRoleLabel(record.role)}}</div>
        <div slot="email" slot-scope="record">{{record.email}}</div>
        <div slot="phone" slot-scope="record">{{record.phone}}</div>
        <span slot="ding_talk" slot-scope="record">{{record.ding_talk}}</span>
        <span slot="wechat" slot-scope="record">{{record.wechat}}</span>
        <span slot="wechat_robot_key" slot-scope="record">
          <a-tag :color="record.wechat_robot_key_configured ? 'green' : undefined">
            {{ record.wechat_robot_key_configured ? $t('configured') : $t('not_configured') }}
          </a-tag>
        </span>
        <div slot="created" slot-scope="record">{{record.created| parsetime}}</div>
        <span slot="status" slot-scope="record">
          <a-switch
            :checked="record.status == 0"
            :disabled="isProtectedRecord(record)"
            :checked-children="$t('enabled')"
            :un-checked-children="$t('disabled')"
            @change="onStatusChange($event, record)"
          />
        </span>
        <span slot="operation" slot-scope="record">
          <a-button class="pd20 paddingleft0" type="link" size="small" @click="editModal(record)">{{ $t('edit_btn') }}</a-button>
          <a-popconfirm :title="$t('delete_user_confirm')" :ok-text="$t('yes_btn')" :cancel-text="$t('no_btn')" @confirm="deleteRecord(record)">
            <a-button class="paddingleft0" type="link" size="small" :disabled="isProtectedRecord(record)" v-auth="`delete`">{{ $t('delete_btn') }}</a-button>
          </a-popconfirm>
        </span>
      </a-table>
    </div>
    <a-modal title="新增用户" :visible="visible" :confirm-loading="confirmLoading" @ok="createUser" @cancel="handleCancel" width="600px">
      <template>
        <a-form-model ref="createForm" :rules="rules" :model="user">
          <a-form-model-item :label="$t('modalUsername')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="username">
            <a-input v-model.trim="user.username" :placeholder="$t('modalInputUser')" />
          </a-form-model-item>
          <a-form-model-item :label="$t('label_password')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="password">
            <a-input-password v-model="user.password" :placeholder="$t('modalInputPassword')" />
          </a-form-model-item>
          <a-form-model-item :label="$t('label_role')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="role">
            <a-select v-model="user.role">
              <a-select-option v-for="(item, index) in roleOption" :key="index" :value="item.value" :label="item.label" :title="item.label">
                {{ item.label }}
              </a-select-option>
            </a-select>
          </a-form-model-item>
          <a-form-model-item :label="$t('label_email')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="email">
            <a-input v-model.trim="user.email" :placeholder="$t('modalInputEmail')" />
          </a-form-model-item>
          <a-form-model-item :label="$t('label_phone')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="phone">
            <a-input v-model.trim="user.phone" :placeholder="$t('modalInputPhone')" />
          </a-form-model-item>
          <a-form-model-item :label="$t('label_wechat')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="wechat">
            <a-input v-model.trim="user.wechat" :placeholder="$t('modalInputWechat')" />
          </a-form-model-item>
          <a-form-model-item :label="$t('label_wechat_robot_key')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="wechat_robot_key">
            <a-input-password v-model.trim="user.wechat_robot_key" :placeholder="$t('modalInputWechatRobotKey')" />
          </a-form-model-item>
          <a-form-model-item :label="$t('label_ding_talk')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="ding_talk">
            <a-input v-model.trim="user.ding_talk" :placeholder="$t('modalInputDingTalk')" />
          </a-form-model-item>
        </a-form-model>
      </template>
    </a-modal>
    <a-modal :title="$t('edit')" :visible="visibleEdit" :confirm-loading="confirmLoading" @ok="updateUser" @cancel="handleEditCancel" width="600px">
      <template>
        <a-form-model ref="editForm" :rules="rulesUpdate" :model="user">
          <a-form-model-item :label="$t('modalUsername')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="username">
            <span>{{user.username}}</span>
          </a-form-model-item>
          <a-form-model-item :label="$t('label_password')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="password">
            <a-input-password v-model="user.password" :placeholder="$t('modalEditPassword')" />
          </a-form-model-item>
          <a-form-model-item v-if="nowrole==='admin'" :label="$t('label_role')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="role">
            <a-select v-model="user.role" :disabled="isProtectedRecord(user)">
              <a-select-option v-for="(item, index) in roleOption" :key="index" :value="item.value" :label="item.label" :title="item.label">
                {{ item.label }}
              </a-select-option>
            </a-select>
          </a-form-model-item>
          <a-form-model-item :label="$t('label_email')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="email">
            <a-input v-model.trim="user.email" :placeholder="$t('modalInputEmail')" />
          </a-form-model-item>
          <a-form-model-item :label="$t('label_phone')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="phone">
            <a-input v-model.trim="user.phone" :placeholder="$t('modalInputPhone')" />
          </a-form-model-item>
          <a-form-model-item :label="$t('label_wechat')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="wechat">
            <a-input v-model.trim="user.wechat" :placeholder="$t('modalInputWechat')" />
          </a-form-model-item>
          <a-form-model-item :label="$t('label_wechat_robot_key')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="wechat_robot_key">
            <a-input-password v-model.trim="user.wechat_robot_key" :placeholder="$t('modalInputWechatRobotKey')" />
            <a-checkbox
              v-if="user.wechat_robot_key_configured"
              v-model="clearWechatRobotKey"
              :disabled="Boolean(user.wechat_robot_key)"
            >{{ $t('clear_robot_key') }}</a-checkbox>
          </a-form-model-item>
          <a-form-model-item :label="$t('label_ding_talk')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="ding_talk">
            <a-input v-model.trim="user.ding_talk" :placeholder="$t('modalInputDingTalk')" />
          </a-form-model-item>
        </a-form-model>
      </template>
    </a-modal>

  </page-layout>
</template>

<script>
import PageLayout from "@/layouts/PageLayout";
import { parseTimeFun } from "@/utils/formatter";
import { userList, userCreate, userDelete, userPut, userStatusPut } from "@/services/admin";
import { buildUserUpdatePayload, isValidPassword, isValidUsername, statusAfterResponse } from "./user-validation";

const emptyUser = () => ({
  username: "",
  password: "",
  role: "user",
  email: "",
  phone: "",
  wechat: "",
  wechat_robot_key: "",
  wechat_robot_key_configured: false,
  ding_talk: "",
});

export default {
  name: "userList",
  i18n: require('./i18n'),
  components: {
    PageLayout,
  },
  authorize: {              //权限校验注入设置
    deleteRecord: {        //需要 注入权限校验 的方法名：deleteRecord
      check: 'delete',     //需要校验的操作权限：check
      type: 'role'         //指定操作权限校验的类型，可选 permission 和 role。这里指定以 role.operation 校验操作权限
    },
    onStatusChange: {        //需要 注入权限校验 的方法名：deleteRecord
      check: 'update',     //需要校验的操作权限：check
      type: 'role'         //指定操作权限校验的类型，可选 permission 和 role。这里指定以 role.operation 校验操作权限
    },
  },
  data() {
    return {
      page: 1,
      pageSize: 10,
      loading: false,
      visible: false,
      visibleEdit: false,
      confirmLoading: false,
      loadingSwitch: false,
      status: "",
      username: "",
      nowuser: "",
      nowrole: "",
      clearWechatRobotKey: false,
      user: emptyUser(),
      rules: {
	username: [
          { required: true, message: '请输入用户名', trigger: 'blur' },
          { validator: (rule, value, callback) => isValidUsername(value) ? callback() : callback(new Error(this.$t('username_format_error'))), trigger: 'blur' },
        ],
        password: [
          { required: true, message: '请输入用户密码', trigger: 'change' },
          { validator: (rule, value, callback) => isValidPassword(value) ? callback() : callback(new Error(this.$t('password_length_error'))), trigger: 'change' },
        ],
        role: [{ required: true, message: '请选择角色', trigger: 'change' }],
        email: [{ required: false, type: 'email', message: '请输入正确邮箱', trigger: 'change' }],
        phone: [{ required: false, max: 32, message: '手机号不能超过 32 个字符', trigger: 'change' }],
        wechat: [{ required: false, type: 'string', message: '请输入正确的微信账号', trigger: 'blur' }],
        wechat_robot_key: [{ required: false, type: 'string', message: '请输入企业微信群机器人webhook key', trigger: 'blur' }],
        ding_talk: [{ required: false, type: 'string', message: '请输入正确的钉钉账号', trigger: 'blur' }],      
      },
      rulesUpdate: {
	username: [{ required: false, message: '请输入用户名', trigger: 'blur' }],
        password: [{ validator: (rule, value, callback) => isValidPassword(value, true) ? callback() : callback(new Error(this.$t('password_length_error'))), trigger: 'change' }],
        role: [{ required: true, message: '请选择角色', trigger: 'change' }],
        email: [{ required: false, type: 'email', message: '请输入正确邮箱', trigger: 'change' }],
        phone: [{ required: false, max: 32, message: '手机号不能超过 32 个字符', trigger: 'change' }],
        wechat: [{ required: false, type: 'string', message: '请输入正确的微信账号', trigger: 'blur' }],
        wechat_robot_key: [{ required: false, type: 'string', message: '请输入企业微信群机器人webhook key', trigger: 'blur' }],
        ding_talk: [{ required: false, type: 'string', message: '请输入正确的钉钉账号', trigger: 'blur' }],
      },
      list: [],
      pagination: {
        total: 0,
        current: 1,
        "show-quick-jumper": true,
        "page-size-options": ["10", "20", "30", "40", "50", "100", "200"],
        pageSize: 10,
        "show-size-changer": true,
        "show-total": (total) => `共 ${total} 条数据`,
      },
    };
  },
  computed: {
    statusOption() {
      return [
        { label: this.$t('state_enabled'), value: "0" },
        { label: this.$t('state_disabled'), value: "1" },
      ];
    },
    roleOption() {
      return [
        { label: this.$t('role_user'), value: "user" },
        { label: this.$t('role_admin'), value: "admin" },
      ];
    },
    columns() {
      return [
        { title: "ID", key: "id", align: "left", scopedSlots: { customRender: "id" }, },
        { title: this.$t('table_headers_username'), key: 'username', align: 'left', scopedSlots: { customRender: 'username' } },
        { title: this.$t('table_headers_role'), key: 'role', align: 'left', scopedSlots: { customRender: 'role' } },
        { title: this.$t('table_headers_email'), key: 'email', align: 'left', scopedSlots: { customRender: 'email' } },
        { title: this.$t('table_headers_phone'), key: 'phone', align: 'left', scopedSlots: { customRender: 'phone' } },
        { title: this.$t('table_headers_ding_talk'), key: 'ding_talk', align: 'left', scopedSlots: { customRender: 'ding_talk' } },
        { title: this.$t('table_headers_wechat'), key: 'wechat', align: 'left', scopedSlots: { customRender: 'wechat' } },
        { title: this.$t('table_headers_wechat_robot_key'), key: 'wechat_robot_key', align: 'left', scopedSlots: { customRender: 'wechat_robot_key' } },
        { title: this.$t('table_headers_creation_date'), key: 'created', align: 'left', scopedSlots: { customRender: 'created' } },
        { title: this.$t('table_headers_user_status'), key: 'status', align: 'left', scopedSlots: { customRender: 'status' } },
        { title: this.$t('table_headers_operation'), key: 'operation', align: 'center', scopedSlots: { customRender: 'operation' } }
      ];
    },
  },
  filters: {
    parsetime(v) {
      return parseTimeFun(v);
    },
  },
  created() {
    this.init();
  },
  methods: {
    getRoleLabel(role) {
      return role === "admin" ? this.$t('role_admin') : this.$t('role_user');
    },
    isProtectedRecord(record) {
      return record && (record.username === "admin" || record.username === this.nowuser);
    },
    init() {
      this.nowuser = this.$store.getters['account/user'].name;
      this.nowrole = this.$store.getters['account/user'].role;
      this.loading = true;
      userList({
        page: this.page,
        limit: this.pageSize,
        username: this.username,
        status: this.status,
      }).then((resp) => {
        let res = resp.data;
        if (res.code == 200) {
          this.pagination.total = res.data.total;
          this.pagination.current = this.page;
          this.pagination.pageSize = this.pageSize;
          this.list = res.data.items || [];
        } else {
          this.$message.error(res.message);
        }
      }).catch(() => {
        this.$message.error(this.$t('request_failed'));
      }).finally(() => {
        this.loading = false;
      });
    },
    onStatusChange(enabled, record) {
      const currentStatus = Number(record.status);
      this.loading = true;
      userStatusPut(record.id, {status: enabled ? 0 : 1}).then((resp) => {
        const res = resp.data;
        record.status = statusAfterResponse(currentStatus, enabled, res.code);
        if (res.code == 200) {
          this.$message.success(res.message);
        } else {
          this.$message.error(res.message);
        }
      }).catch(() => {
        record.status = currentStatus;
        this.$message.error(this.$t('request_failed'));
      }).finally(() => {
        this.loading = false;
      });
    },
    createUser() {
      this.$refs.createForm.validate(valid => {
        if (!valid) return;
        this.confirmLoading = true;
        userCreate(this.user).then((resp) => {
          const res = resp.data;
          if (res.code == 200) {
            this.$message.success(res.message);
            this.visible = false;
            this.user = emptyUser();
            this.init();
          } else {
            this.$message.error(res.message);
          }
        }).catch(() => {
          this.$message.error(this.$t('request_failed'));
        }).finally(() => {
          this.confirmLoading = false;
        });
      });
    },
    changePage(e) {
      // 切换页码
      this.page = e.current;
      this.pageSize = e.pageSize;
      this.init();
    },
    showModal() {
      this.user = emptyUser();
      this.visible = true;
      this.$nextTick(() => this.$refs.createForm && this.$refs.createForm.clearValidate());
    },
    handleCancel() {
      this.visible = false;
      this.user = emptyUser();
    },
    deleteRecord(record) {
      this.loading = true;
      userDelete(record.id).then((resp) => {
        const res = resp.data;
        if (res.code == 200) {
          this.$message.success(res.message);
          this.init();
        } else {
          this.$message.error(res.message);
        }
      }).catch(() => {
        this.$message.error(this.$t('request_failed'));
      }).finally(() => {
        this.loading = false;
      });
    },
    handleEditCancel() {
      this.visibleEdit = false;
      this.clearWechatRobotKey = false;
    },
    editModal(record) {
      this.clearWechatRobotKey = false;
      this.visibleEdit = true;
      this.user = {
        id: record.id,
        username: record.username,
        password: "",
        role: record.role,
        email: record.email,
        phone: record.phone,
        wechat: record.wechat,
        wechat_robot_key: "",
        wechat_robot_key_configured: record.wechat_robot_key_configured,
        ding_talk: record.ding_talk,
      };
      this.$nextTick(() => this.$refs.editForm && this.$refs.editForm.clearValidate());
    },
    updateUser() {
      this.$refs.editForm.validate(valid => {
        if (!valid) return;
        this.confirmLoading = true;
        const payload = buildUserUpdatePayload(this.user, {clearWechatRobotKey: this.clearWechatRobotKey});
        userPut(this.user.id, payload).then((resp) => {
          const res = resp.data;
          if (res.code == 200) {
            this.$message.success(res.message);
            this.visibleEdit = false;
            this.clearWechatRobotKey = false;
            this.init();
          } else {
            this.$message.error(res.message);
          }
        }).catch(() => {
          this.$message.error(this.$t('request_failed'));
        }).finally(() => {
          this.confirmLoading = false;
        });
      });
    },
    resetData() {
      if (this.username || this.status) {
        this.username = "";
        this.status = "";
        this.init();
      }
    },
  },
};
</script>

<style lang="less" scoped>
.card-avatar {
  width: 48px;
  height: 48px;
  border-radius: 48px;
}
.new-btn {
  border-radius: 2px;
  width: 100%;
  height: 187px;
}
.home-search {
  margin-bottom: 10px;
}
.meta-content {
  position: relative;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  height: 64px;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
.linux-list {
  /deep/ .ant-progress-bg {
    height: 14px !important;
  }
  /deep/ .ant-progress-text {
    margin-left: 2px;
  }
}
</style>
