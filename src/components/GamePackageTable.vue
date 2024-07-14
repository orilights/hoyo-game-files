<script setup lang="ts">
import type { FileInfoWithType } from '@/types'
import { copyToClipboard, openLink, formatBytes } from '@/utils'

const props = defineProps<{
  data: FileInfoWithType[]
}>()

const selection = ref<any[]>([])

function handleSelectionChange(val: any[]) {
  selection.value = val
}

function handleCopyAll() {
  const urls = props.data.map((item: any) => item.url).join('\n')
  copyToClipboard(urls)
}

function handleCopySelected() {
  const urls = selection.value.map((item: any) => item.url).join('\n')
  copyToClipboard(urls)
}
</script>

<template>
  <el-space>
    <el-button size="small" @click="handleCopyAll">
      复制全部链接
    </el-button>
    <el-button v-if="selection.length !== 0" size="small" @click="handleCopySelected">
      复制选中链接
    </el-button>
  </el-space>
  <el-table
    :data="data" style="width: 100%" size="small"
    @selection-change="handleSelectionChange"
  >
    <el-table-column type="selection" width="55" />
    <el-table-column prop="name" label="文件名" min-width="200" />
    <el-table-column prop="type" label="类型" width="60" />
    <el-table-column prop="checksum" label="校验信息" width="250">
      <template #default="scope">
        <el-button link size="small" class="!p-0" @click="copyToClipboard(scope.row.checksum)">
          {{ scope.row.checksum }}
        </el-button>
      </template>
    </el-table-column>
    <el-table-column prop="size" label="文件大小" width="80">
      <template #default="scope">
        <span>{{ formatBytes(scope.row.size) }}</span>
      </template>
    </el-table-column>
    <el-table-column fixed="right" width="120">
      <template #default="scope">
        <el-button link type="primary" size="small" @click="copyToClipboard(scope.row.url)">
          复制链接
        </el-button>
        <el-button link type="primary" size="small" @click="openLink(scope.row.checksum)">
          下载
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped>

</style>
