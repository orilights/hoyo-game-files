<script setup lang="ts">
import type { FileData, FileInfoWithType, FileNode, VersionData } from '@/types'
import { NodeType } from '@/types'
import { GameConfigList, GithubRepoUrl, VoicePackList } from '@/constants'
import { copyToClipboard, formatBytes, openLink } from '@/utils'

const API_BASE = import.meta.env.VITE_API_BASE || '.'
const API_BASE_FALLBACK = import.meta.env.VITE_API_BASE_FALLBACK || ''

let apiBase: string = API_BASE

const useFallback = ref(false)
const versionListData = ref<
  Record<string, VersionData>
>({})
const displayVersionList = ref<string[]>([])
const game = ref('hk4e')
const version = ref('')
const loadVoicePack = ref(false)
const loadVoicePackList = ref([])
const gamePackageData = ref<FileInfoWithType[]>([])
const updatePackageData = ref<Record<string, FileInfoWithType[]>>({})
const loading = ref({
  versionList: false,
  fileList: false,
})
const contentState = ref<string[]>(['game', 'update', 'list'])
const fileListState = ref<{
  game: string
  version: string
  voice: string[]
  decompressed_path: string | null
  tree: FileNode
  currentPath: string
  displayFileNode?: FileNode
  count: number
  size: number
}>({
  game: '',
  version: '',
  voice: [],
  decompressed_path: '',
  tree: {
    type: NodeType.Directory,
    name: '',
    children: [],
    size: 0,
    displaySize: '',
  },
  currentPath: '',
  count: 0,
  size: 0,
})

const isRootPath = computed(() => fileListState.value.currentPath === '')

function updateDisplayFiles() {
  if (isRootPath.value) {
    fileListState.value.displayFileNode = fileListState.value.tree
    return
  }
  const path = fileListState.value.currentPath.split('/')
  let tree = fileListState.value.tree
  for (let i = 0; i < path.length; i++) {
    const name = path[i]
    const child = tree.children.find(child => child.name === name)
    if (child)
      tree = child

    else
      return
  }
  fileListState.value.displayFileNode = tree
}

function goPrevious() {
  if (isRootPath.value)
    return
  const path = fileListState.value.currentPath.split('/')
  path.pop()
  fileListState.value.currentPath = path.join('/')
  updateDisplayFiles()
}

function goRoot() {
  fileListState.value.currentPath = ''
  updateDisplayFiles()
}

function handleSelectVersion(data: any) {
  version.value = displayVersionList.value[data]
  refreshVersionData()
}

function handleClickFile(file: FileNode) {
  if (file.type === NodeType.Directory) {
    if (isRootPath.value)
      fileListState.value.currentPath = file.name
    else
      fileListState.value.currentPath += `/${file.name}`
    updateDisplayFiles()
  }
}

function sortTree(tree: FileNode) {
  tree.children.sort((a, b) => {
    if (a.type === NodeType.Directory && b.type === NodeType.File)
      return -1
    if (a.type === NodeType.File && b.type === NodeType.Directory)
      return 1
    return a.name.localeCompare(b.name)
  })
  tree.children.forEach((child) => {
    if (child.type === NodeType.Directory)
      sortTree(child)
  })
}

function loadGameVersionList(gameData: string) {
  game.value = gameData
  loading.value.versionList = true
  fetch(`${apiBase}/${gameData}_versions.json`)
    .then(res => res.json())
    .then((data) => {
      versionListData.value = data
      displayVersionList.value = Object.keys(versionListData.value).reverse()
      version.value = displayVersionList.value[0]
      loadVoicePackList.value = []
      refreshVersionData()
    })
    .catch((err) => {
      if (!useFallback.value && API_BASE_FALLBACK !== '') {
        useFallback.value = true
        apiBase = API_BASE_FALLBACK
        ElMessage.warning(`版本列表加载失败 尝试使用备用源`)
        loadGameVersionList(gameData)
        return
      }
      ElMessage.error(`版本列表加载失败 ${err}`)
    })
    .finally(() => {
      loading.value.versionList = false
    })
}

function refreshVersionData() {
  const versionData = versionListData.value[version.value]
  gamePackageData.value = []
  if (versionData.game.full) {
    gamePackageData.value.push({
      ...versionData.game.full,
      type: 'game',
    })
  }
  if (versionData.game.segments) {
    gamePackageData.value.push(...versionData.game.segments.map(
      segment => ({
        ...segment,
        type: 'game',
      }),
    ))
  }
  for (const langKey of Object.keys(versionData.voice)) {
    gamePackageData.value.push({
      ...versionData.voice[langKey],
      type: 'voice',
    })
  }
  updatePackageData.value = {}
  Object.keys(versionData.update).forEach((version) => {
    updatePackageData.value[version] = []
    updatePackageData.value[version].push({
      ...versionData.update[version].game,
      type: 'game',
    })
    Object.keys(versionData.update[version].voice).forEach((langKey) => {
      updatePackageData.value[version].push({
        ...versionData.update[version].voice[langKey],
        type: 'voice',
      })
    })
  })
  loadFileList()
}

async function fetchPkgVersion(version: string, filename: string) {
  const data = await fetch(`${apiBase}/${game.value}/${version}/${filename}`)
  return data.text()
}

async function loadFileList() {
  loading.value.fileList = true
  const loadedVoicePackList: string[] = []
  try {
    const newFileTree: FileNode = {
      type: NodeType.Directory,
      name: '',
      children: [],
      size: 0,
      displaySize: '',
    }
    const gameData = await fetchPkgVersion(version.value, 'pkg_version')

    const fileData: FileData[] = []
    gameData.split('\n').forEach((line) => {
      if (line === '')
        return
      fileData.push(JSON.parse(line))
    })
    if (loadVoicePack.value) {
      for (const key of loadVoicePackList.value) {
        try {
          const voiceData = await fetchPkgVersion(version.value, VoicePackList[key])
          voiceData.split('\n').forEach((line) => {
            if (line === '')
              return
            fileData.push(JSON.parse(line))
          })
          loadedVoicePackList.push(key)
        }
        catch (e) {
          ElMessage.error(`语音包[${key}]加载失败 ${e}`)
        }
      }
    }
    fileData.forEach((file) => {
      const path = file.remoteName.replace(/\\/g, '/').split('/')
      let tree = newFileTree
      for (let i = 0; i < path.length; i++) {
        const name = path[i]
        if (i === path.length - 1) {
          tree.size += file.fileSize
          tree.children.push({
            type: NodeType.File,
            name,
            children: [],
            size: file.fileSize,
            displaySize: formatBytes(file.fileSize),
            fileData: file,
          })
        }
        else {
          tree.size += file.fileSize
          const child = tree.children.find(child => child.name === name)
          if (child) {
            tree = child
          }
          else {
            const newTree = {
              type: NodeType.Directory,
              name,
              children: [],
              size: 0,
              displaySize: '',
            }
            tree.children.push(newTree)
            tree = newTree
          }
        }
      }
    })
    sortTree(newFileTree)
    fileListState.value.game = GameConfigList[game.value].name
    fileListState.value.version = version.value
    fileListState.value.voice = loadedVoicePackList
    fileListState.value.decompressed_path = versionListData.value[version.value].decompressed_path
    fileListState.value.tree = newFileTree
    fileListState.value.currentPath = ''
    fileListState.value.count = fileData.length
    fileListState.value.size = newFileTree.size
    updateDisplayFiles()
  }
  catch (e) {
    ElMessage.error(`文件列表加载失败 ${e}`)
    loading.value.fileList = false
  }
  loading.value.fileList = false
}

onMounted(() => {
  loadGameVersionList(game.value)
})
</script>

<template>
  <el-container class="h-screen overflow-auto">
    <el-aside
      class="h-screen border-r p-4" width="auto"
    >
      <el-space direction="vertical" size="large" alignment="center">
        <div
          v-for="[key, gameConfig] in Object.entries(GameConfigList)" :key="key"
          class="overflow-hidden rounded-xl border-2 border-transparent hover:border-gray-300"
          :class="{
            '!border-blue-500': game === key,
          }"
          :title="gameConfig.name"
          @click="loadGameVersionList(key)"
        >
          <img
            :src="gameConfig.icon" :alt="gameConfig.name"
            class="size-[48px]"
          >
        </div>
        <div
          class="overflow-hidden rounded-xl border-2 border-transparent hover:border-gray-300"
          title="Github"
          @click="openLink(GithubRepoUrl)"
        >
          <img
            src="/icon/github.png" alt="GithubRepoUrl"
            class="size-[48px]"
          >
        </div>
      </el-space>
    </el-aside>
    <el-aside v-loading="loading.versionList" width="160px" class="border-r">
      <el-scrollbar>
        <el-menu class="border-none" @select="handleSelectVersion">
          <el-menu-item v-for="v, index in displayVersionList" :key="v" class="h-[40px]" :index="String(index)">
            <span>{{ v }}</span>
          </el-menu-item>
        </el-menu>
      </el-scrollbar>
    </el-aside>
    <el-scrollbar class="w-full">
      <el-main>
        <el-collapse v-model="contentState">
          <el-collapse-item name="game" title="游戏包" class="mb-2 rounded-lg border px-4 shadow-md">
            <el-divider class="mb-2 mt-0" />
            <GamePackageTable :data="gamePackageData" />
          </el-collapse-item>
          <el-collapse-item name="update" title="升级包" class="mb-2 rounded-lg border px-4 shadow-md">
            <el-divider class="mb-2 mt-0" />
            <div v-loading="loading.versionList">
              <div v-if="Object.keys(updatePackageData).length === 0" class="py-2 text-center text-[color:var(--el-text-color-secondary)]">
                无数据
              </div>
              <el-collapse v-else>
                <el-collapse-item
                  v-for="[versionKey, updateData] in Object.entries(updatePackageData)" :key="versionKey"
                  :title="versionKey"
                  class="px-2"
                >
                  <el-divider class="mb-2 mt-0" />
                  <GamePackageTable :data="updateData" />
                </el-collapse-item>
              </el-collapse>
            </div>
          </el-collapse-item>
          <el-collapse-item name="list" title="文件列表" class="mb-2 rounded-lg border px-4 shadow-md">
            <el-divider class="mb-2 mt-0" />
            <div v-loading="loading.fileList || loading.versionList">
              <template v-if="GameConfigList[game].voice.length">
                <el-space>
                  <el-switch
                    v-model="loadVoicePack"
                    active-text="加载语音包"
                  />
                  <el-select
                    v-if="loadVoicePack"
                    v-model="loadVoicePackList"
                    multiple
                    collapse-tags
                    collapse-tags-tooltip
                    :max-collapse-tags="2"
                    placeholder="选择语音包"
                    class="w-[180px]"
                    size="small"
                  >
                    <el-option
                      v-for="item in GameConfigList[game].voice"
                      :key="item"
                      :label="item"
                      :value="item"
                    />
                  </el-select>
                  <el-button v-if="loadVoicePack" size="small" @click="loadFileList">
                    加载
                  </el-button>
                </el-space>
                <el-divider class="my-2" />
              </template>
              <el-space class="mb-2">
                <el-tag type="primary">
                  当前路径 {{ fileListState.currentPath || '根目录' }}
                </el-tag>
                <el-tag type="primary">
                  游戏 {{ fileListState.game }}
                </el-tag>
                <el-tag type="primary">
                  版本 {{ fileListState.version }}
                </el-tag>
                <el-tag type="primary">
                  语音包 {{ fileListState.voice.length ? fileListState.voice.join(' ') : '无' }}
                </el-tag>
                <el-tag type="primary">
                  文件数量 {{ fileListState.count }}
                </el-tag>
                <el-tag type="primary">
                  文件大小 {{ formatBytes(fileListState.size) }}
                </el-tag>
              </el-space>
              <table v-if="fileListState.displayFileNode" class="w-full">
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
                    }" @click="goRoot"
                  >
                    <td />
                    <td>...</td>
                    <td />
                    <td />
                  </tr>
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
                    v-for="file in fileListState.displayFileNode.children" :key="file.name" class="hover:bg-gray-100 " :class="{
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
                    <td>{{ file.displaySize || formatBytes(file.size) }}</td>
                    <td>
                      <template v-if="file.type === NodeType.File && file.fileData">
                        <button v-if="fileListState.decompressed_path" class="mr-1" @click="openLink(`${fileListState.decompressed_path}/${file.fileData.remoteName}`)">
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
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-main>
    </el-scrollbar>
  </el-container>
</template>
