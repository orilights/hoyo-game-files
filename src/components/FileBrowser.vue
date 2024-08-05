<script setup lang="ts">
import type { FileNode } from '@/types'
import { NodeType } from '@/types'
import { copyToClipboard, formatBytes, openLink } from '@/utils'

const props = defineProps<{
  decompressedPath: string | null
  fileTree: FileNode | null
}>()

const displayFileNode = ref<FileNode | null>()
const currentPath = ref('')

const isRootPath = computed(() => currentPath.value === '')
const breadcrumbItems = computed(() => {
  const res = currentPath.value.split('/')
  if (res.length === 1 && res[0] === '')
    return []
  return res
})

function updateDisplayFiles() {
  if (isRootPath.value) {
    displayFileNode.value = props.fileTree
    return
  }
  const path = currentPath.value.split('/')
  if (props.fileTree === null)
    return
  let tree = props.fileTree
  for (let i = 0; i < path.length; i++) {
    const name = path[i]
    const child = tree.children.find(child => child.name === name)
    if (child)
      tree = child

    else
      return
  }
  displayFileNode.value = tree
}

function goPrevious() {
  if (isRootPath.value)
    return
  const path = currentPath.value.split('/')
  path.pop()
  currentPath.value = path.join('/')
  updateDisplayFiles()
}

function goPath(path: string) {
  currentPath.value = path
  updateDisplayFiles()
}

function refresh() {
  currentPath.value = ''
  updateDisplayFiles()
}

function handleClickFile(file: FileNode) {
  if (file.type === NodeType.Directory) {
    if (isRootPath.value)
      currentPath.value = file.name
    else
      currentPath.value += `/${file.name}`
    updateDisplayFiles()
  }
}

defineExpose({
  refresh,
})
</script>

<template>
  <el-breadcrumb class="mb-2">
    <el-breadcrumb-item>
      <el-button text size="small" class="font-bold" @click="refresh">
        根目录
      </el-button>
    </el-breadcrumb-item>
    <el-breadcrumb-item v-for="path, index in breadcrumbItems" :key="index">
      <el-button text size="small" class="font-bold" @click="goPath(currentPath.split('/').slice(0, index + 1).join('/'))">
        {{ path }}
      </el-button>
    </el-breadcrumb-item>
  </el-breadcrumb>
  <table v-if="displayFileNode" class="w-full">
    <colgroup>
      <col class="w-6">
      <col>
      <col class="w-10">
      <col class="w-20">
      <col class="w-32">
    </colgroup>
    <thead>
      <tr class="text-left text-sm">
        <th />
        <th>名称</th>
        <th>类型</th>
        <th>大小</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody class="text-sm">
      <tr
        :class="{
          'text-gray-400': isRootPath,
          'cursor-pointer hover:bg-gray-100': !isRootPath,
        }" @click="goPrevious"
      >
        <td />
        <td>..</td>
        <td />
        <td />
      </tr>
      <tr
        v-for="file in displayFileNode.children" :key="file.name" class="transition-colors hover:bg-gray-100" :class="{
          'cursor-pointer text-yellow-600': file.type === NodeType.Directory,
        }" @click="handleClickFile(file)"
      >
        <td>
          <template v-if="file.type === NodeType.Directory">
            <svg
              xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
              class="inline-block size-5"
            >
              <path
                d="M3.75 3A1.75 1.75 0 0 0 2 4.75v3.26a3.235 3.235 0 0 1 1.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0 0 16.25 5h-4.836a.25.25 0 0 1-.177-.073L9.823 3.513A1.75 1.75 0 0 0 8.586 3H3.75ZM3.75 9A1.75 1.75 0 0 0 2 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0 0 18 15.25v-4.5A1.75 1.75 0 0 0 16.25 9H3.75Z"
              />
            </svg>
          </template>
          <template v-if="file.type === NodeType.File">
            <svg
              xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
              class="inline-block size-5"
            >
              <path
                d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z"
              />
            </svg>
          </template>
        </td>
        <td class="truncate">
          {{ file.name }}
          <template v-if="file.type === NodeType.Directory">
            ({{ file.children.length }})
          </template>
        </td>
        <td>{{ file.type === NodeType.Directory ? '目录' : '文件' }}</td>
        <td>{{ formatBytes(file.size) }}</td>
        <td>
          <template v-if="file.type === NodeType.File && file.fileData">
            <button v-if="decompressedPath" class="mr-1" @click="openLink(`${decompressedPath}/${file.fileData.remoteName}`)">
              下载
            </button>
            <button v-if="file.fileData.md5" class="mr-1" @click="copyToClipboard(file.fileData.md5)">
              md5
            </button>
            <button v-if="file.fileData.hash" class="mr-1" @click="copyToClipboard(file.fileData.hash)">
              hash
            </button>
          </template>
        </td>
      </tr>
    </tbody>
  </table>
</template>
