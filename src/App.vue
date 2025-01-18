<script setup lang="ts">
import type { ChunkData, ChunkInfo, FileInfoWithType, FileListState, FileNode, PkgVersionFile, VersionData } from '@/types'
import { API_BASE, API_BASE_FALLBACK, DEFAULT_GAME, GAME_CONFIG, GITHUB_REPO_URL, VOICEPACK_LIST } from '@/constants'
import { NodeType } from '@/types'
import { formatBytes, openLink, sortTree } from '@/utils'
import { useUrlSearchParams } from '@vueuse/core'

let apiBase: string = API_BASE

const params = useUrlSearchParams('history')

const game = computed({
  get: () => GAME_CONFIG[params.game as string] ? params.game as string : DEFAULT_GAME,
  set: value => params.game = value,
})
const version = ref('')
const useFallback = ref(false)
const versionListData = ref<
  Record<string, VersionData>
>({})
const versionList = ref<string[]>([])
const loadVoicePack = ref(false)
const loadVoicePackList = ref([])

const loading = ref({
  versionList: false,
  chunkData: false,
  fileList: false,
})
const collapseState = ref<string[]>(['game', 'update', 'file-list'])
const packageList = ref<{
  game: FileInfoWithType[]
  update: Record<string, FileInfoWithType[]>
}>({
  game: [],
  update: {},
})
const chunkState = ref<{
  info: ChunkInfo | null
  data: ChunkData | null
} >({
  info: null,
  data: null,
})
const fileListState = ref<FileListState>({
  game: '',
  version: '',
  voice: [],
  decompressedPath: '',
  tree: null,
  count: 0,
  size: 0,
})
const fileBrowser = ref()

watchEffect(() => {
  document.title = loading.value.versionList
    ? 'HoyoFiles'
    : `${GAME_CONFIG[game.value].name} ${version.value} 版本文件列表 - HoyoFiles`
})

function handleSelectGame(gameName: string) {
  game.value = gameName
  loadGameVersionList()
}

function handleSelectVersion(newVersion: string) {
  version.value = newVersion
  refreshVersionData()
}

function refreshVersionData() {
  const versionData = versionListData.value[version.value]
  packageList.value.game = []
  if (versionData.game.full) {
    packageList.value.game.push({
      ...versionData.game.full,
      type: '游戏本体',
    })
  }
  if (versionData.game.segments) {
    packageList.value.game.push(...versionData.game.segments.map(
      segment => ({
        ...segment,
        type: '游戏本体(分卷)',
      }),
    ))
  }
  for (const langKey of Object.keys(versionData.voice)) {
    packageList.value.game.push({
      ...versionData.voice[langKey],
      type: '语音包',
    })
  }
  packageList.value.update = {}
  Object.keys(versionData.update).forEach((version) => {
    packageList.value.update[version] = []
    packageList.value.update[version].push({
      ...versionData.update[version].game,
      type: '游戏本体',
    })
    Object.keys(versionData.update[version].voice).forEach((langKey) => {
      packageList.value.update[version].push({
        ...versionData.update[version].voice[langKey],
        type: '语音包',
      })
    })
  })
  chunkState.value.info = versionData.chunk
  loadChunkData()
  loadFileList()
}

async function fetchPkgVersion(filename: string) {
  const data = await fetch(`${apiBase}/${game.value}/${version.value}/${filename}`)
  return await data.text()
}

function loadGameVersionList() {
  loading.value.versionList = true
  fetch(`${apiBase}/${game.value}_versions.json`)
    .then(res => res.json())
    .then((data) => {
      versionListData.value = data
      versionList.value = Object.keys(versionListData.value).reverse()
      version.value = versionList.value[0]
      loadVoicePackList.value = []
      refreshVersionData()
    })
    .catch((err) => {
      if (!useFallback.value && API_BASE_FALLBACK !== '') {
        useFallback.value = true
        apiBase = API_BASE_FALLBACK
        ElMessage.warning(`版本列表加载失败 尝试使用备用源`)
        loadGameVersionList()
        return
      }
      ElMessage.error(`版本列表加载失败 ${err}`)
    })
    .finally(() => {
      loading.value.versionList = false
    })
}

function loadChunkData() {
  if (!chunkState.value.info)
    return
  loading.value.chunkData = true
  fetch(`${apiBase}/chunk/${game.value}_${version.value}.json`)
    .then(res => res.json())
    .then((res) => {
      chunkState.value.data = res.data
    })
    .catch((err) => {
      ElMessage.error(`chunk 数据加载失败 ${err}`)
    })
    .finally(() => {
      loading.value.chunkData = false
    })
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
    }
    const gameData = await fetchPkgVersion('pkg_version')

    const fileData: PkgVersionFile[] = []
    gameData.split('\n').forEach((line) => {
      if (line === '')
        return
      fileData.push(JSON.parse(line))
    })
    if (loadVoicePack.value) {
      for (const key of loadVoicePackList.value) {
        try {
          const voiceData = await fetchPkgVersion(VOICEPACK_LIST[key])
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
            }
            tree.children.push(newTree)
            tree = newTree
          }
        }
      }
    })
    sortTree(newFileTree)
    fileListState.value.game = GAME_CONFIG[game.value].name
    fileListState.value.version = version.value
    fileListState.value.voice = loadedVoicePackList
    fileListState.value.decompressedPath = versionListData.value[version.value].decompressed_path
    fileListState.value.tree = newFileTree
    fileListState.value.count = fileData.length
    fileListState.value.size = newFileTree.size
    nextTick(() => {
      fileBrowser.value.refresh()
    })
  }
  catch (e) {
    ElMessage.error(`文件列表加载失败 ${e}`)
    loading.value.fileList = false
  }
  loading.value.fileList = false
}

onMounted(() => {
  handleSelectGame(game.value)
})
</script>

<template>
  <el-container class="h-screen min-w-[900px] overflow-auto">
    <el-aside
      class="h-screen border-r p-4" width="auto"
    >
      <el-space direction="vertical" size="large" alignment="center">
        <div
          v-for="[key, gameConfig] in Object.entries(GAME_CONFIG)" :key="key"
          class="overflow-hidden rounded-xl border-2 border-transparent transition-all duration-300 hover:border-gray-300"
          :class="{
            '!border-blue-500': game === key,
          }"
          :title="gameConfig.name"
          @click="handleSelectGame(key)"
        >
          <img
            :src="gameConfig.icon" :alt="gameConfig.name"
            class="size-[48px]"
          >
        </div>
        <div
          class="overflow-hidden rounded-xl border-2 border-transparent transition-all  duration-300 hover:border-gray-300"
          title="Github"
          @click="openLink(GITHUB_REPO_URL)"
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
        <div class="p-3">
          <div
            v-for="ver in versionList" :key="ver"
            class="my-1 cursor-pointer rounded-lg px-4 py-1.5 text-sm transition-colors hover:bg-gray-100"
            :class="{
              '!bg-blue-100': version === ver,
            }"
            @click="handleSelectVersion(ver)"
          >
            {{ ver }}
          </div>
        </div>
      </el-scrollbar>
    </el-aside>
    <el-scrollbar class="w-full">
      <el-main>
        <el-collapse v-model="collapseState">
          <div class="xl:flex xl:gap-4">
            <div class="mb-2 min-w-0 xl:flex-1">
              <el-collapse-item name="game" title="游戏包" class="mb-2 rounded-lg border px-4 shadow-md">
                <GamePackageTable :data="packageList.game" />
                <el-collapse v-if="chunkState.info" class="mt-2">
                  <el-collapse-item
                    title="chunk"
                    class="mb-1 rounded-lg border px-4"
                  >
                    <el-scrollbar v-loading="loading.chunkData">
                      <el-space class="mb-2">
                        <el-tag type="primary" effect="plain">
                          branch={{ chunkState.info.branch }}
                        </el-tag>
                        <el-tag type="primary" effect="plain">
                          package_id={{ chunkState.info.package_id }}
                        </el-tag>
                        <el-tag type="primary" effect="plain">
                          password={{ chunkState.info.password }}
                        </el-tag>
                        <el-tag type="primary" effect="plain">
                          tag={{ chunkState.info.tag }}
                        </el-tag>
                        <el-tag type="primary" effect="plain">
                          build_id={{ chunkState.data?.build_id }}
                        </el-tag>
                      </el-space>
                      <el-descriptions
                        v-for="manifest, index in chunkState.data?.manifests" :key="index"
                        :column="3"
                        class="mb-2"
                        border
                        size="small"
                      >
                        <el-descriptions-item>
                          <template #label>
                            分类
                          </template>
                          {{ manifest.category_id }} - {{ manifest.category_name }}
                        </el-descriptions-item>
                        <el-descriptions-item :span="2">
                          <template #label>
                            Manifest ID
                          </template>
                          <CopyAbleText :text="manifest.manifest.id" />
                        </el-descriptions-item>
                        <el-descriptions-item :span="3">
                          <template #label>
                            Chunk 下载地址前缀
                          </template>
                          <CopyAbleText :text="manifest.chunk_download.url_prefix" />
                        </el-descriptions-item>
                        <el-descriptions-item :span="3">
                          <template #label>
                            Manifest 下载地址前缀
                          </template>
                          <CopyAbleText :text="manifest.manifest_download.url_prefix" />
                        </el-descriptions-item>
                        <el-descriptions-item>
                          <template #label>
                            未压缩大小
                          </template>
                          {{ manifest.stats.uncompressed_size }} ({{ formatBytes(manifest.stats.uncompressed_size) }})
                        </el-descriptions-item>
                        <el-descriptions-item>
                          <template #label>
                            文件数量
                          </template>
                          {{ manifest.stats.file_count }}
                        </el-descriptions-item>
                        <el-descriptions-item>
                          <template #label>
                            文件块数量
                          </template>
                          {{ manifest.stats.chunk_count }}
                        </el-descriptions-item>
                      </el-descriptions>
                    </el-scrollbar>
                  </el-collapse-item>
                </el-collapse>
              </el-collapse-item>
              <el-collapse-item name="update" title="升级包" class="mb-2 rounded-lg border px-4 shadow-md">
                <div v-loading="loading.versionList">
                  <div v-if="Object.keys(packageList.update).length === 0" class="py-2 text-center text-[color:var(--el-text-color-secondary)]">
                    无数据
                  </div>
                  <el-collapse v-else>
                    <el-collapse-item
                      v-for="[versionKey, updateData] in Object.entries(packageList.update)" :key="versionKey"
                      :title="versionKey"
                      class="mb-1 rounded-lg border px-4"
                    >
                      <GamePackageTable :data="updateData" />
                    </el-collapse-item>
                  </el-collapse>
                </div>
              </el-collapse-item>
            </div>
            <div class="mb-2 min-w-0 xl:flex-1">
              <el-collapse-item name="file-list" title="文件列表" class="mb-2 rounded-lg border px-4 shadow-md">
                <div v-loading="loading.fileList || loading.versionList">
                  <template v-if="GAME_CONFIG[game].voice.length">
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
                          v-for="item in GAME_CONFIG[game].voice"
                          :key="item"
                          :label="item"
                          :value="item"
                        />
                      </el-select>
                      <el-button size="small" @click="loadFileList">
                        应用
                      </el-button>
                    </el-space>
                    <el-divider class="mb-2 mt-1" />
                  </template>
                  <el-space class="mb-2">
                    <el-tag type="primary" effect="plain">
                      游戏 {{ fileListState.game }}
                    </el-tag>
                    <el-tag type="primary" effect="plain">
                      版本 {{ fileListState.version }}
                    </el-tag>
                    <el-tag type="primary" effect="plain">
                      语音包 {{ fileListState.voice.length ? fileListState.voice.join(' ') : '无' }}
                    </el-tag>
                    <el-tag type="primary" effect="plain">
                      文件数量 {{ fileListState.count }}
                    </el-tag>
                    <el-tag type="primary" effect="plain">
                      文件大小 {{ formatBytes(fileListState.size) }}
                    </el-tag>
                  </el-space>
                  <FileBrowser ref="fileBrowser" :file-tree="fileListState.tree" :decompressed-path="fileListState.decompressedPath" />
                </div>
              </el-collapse-item>
            </div>
          </div>
        </el-collapse>
      </el-main>
    </el-scrollbar>
  </el-container>
</template>
