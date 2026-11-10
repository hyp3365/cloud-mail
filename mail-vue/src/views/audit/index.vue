<template>
  <div class="audit">
    <div class="header-actions">
      <Icon class="icon" icon="ion:reload" width="18" height="18" @click="refresh"/>
    </div>
    <el-scrollbar class="scrollbar">
      <div class="loading" :class="auditLoading ? 'loading-show' : 'loading-hide'">
        <loading/>
      </div>
      <el-table v-if="!auditLoading" :data="auditData" :fit="true" style="width: 100%">
        <el-table-column property="createTime" :label="$t('auditTime')" width="170" :show-overflow-tooltip="true"/>
        <el-table-column property="email" :label="$t('user')" min-width="180" :show-overflow-tooltip="true"/>
        <el-table-column property="action" :label="$t('auditAction')" width="140" :show-overflow-tooltip="true"/>
        <el-table-column property="detail" :label="$t('auditDetail')" min-width="180" :show-overflow-tooltip="true"/>
        <el-table-column property="ip" :label="$t('auditIp')" width="140" :show-overflow-tooltip="true"/>
      </el-table>
      <div class="empty" v-if="auditData.length === 0 && !auditLoading">
        <el-empty />
      </div>
    </el-scrollbar>
    <el-pagination
        v-if="total > 0"
        :current-page="params.num"
        :page-size="params.size"
        :page-sizes="[20, 50, 100]"
        :total="total"
        layout="prev, pager, next, sizes, total"
        @size-change="onSizeChange"
        @current-change="onPageChange"
    />
  </div>
</template>

<script setup>
import { defineOptions, reactive, ref, onMounted } from "vue"
import { Icon } from "@iconify/vue";
import loading from "@/components/loading/index.vue";
import { auditList } from "@/request/audit.js";

defineOptions({
  name: 'audit'
})

const params = reactive({
  num: 1,
  size: 50,
})
const auditData = reactive([])
const auditLoading = ref(true)
const total = ref(0)

function search() {
  auditLoading.value = true
  auditList(params).then(data => {
    auditData.splice(0, auditData.length, ...(data.list || []))
    total.value = data.total || 0
  }).finally(() => {
    auditLoading.value = false
  })
}

function refresh() {
  params.num = 1
  search()
}

function onSizeChange(size) {
  params.size = size
  params.num = 1
  search()
}

function onPageChange(num) {
  params.num = num
  search()
}

onMounted(() => {
  search()
})
</script>

<style scoped lang="less">
.audit {
  height: 100%;
  display: flex;
  flex-direction: column;
  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    .icon {
      cursor: pointer;
    }
  }
  .scrollbar {
    flex: 1;
    padding: 0 16px;
  }
  .loading {
    transition: opacity 0.3s;
  }
  .loading-hide {
    opacity: 0;
    pointer-events: none;
    height: 0;
  }
  .empty {
    display: flex;
    justify-content: center;
    padding: 40px 0;
  }
}
</style>
