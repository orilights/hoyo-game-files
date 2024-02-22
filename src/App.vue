<script setup lang="ts">
interface FileData {
  remoteName: string
  md5: string
  hash?: string
  fileSize: number
}

enum NodeType {
  File = 'file',
  Directory = 'dir',
}

interface FileNode {
  type: NodeType
  name: string
  children: FileNode[]
  size: number
  displaySize: string
  fileData?: FileData
}

const fileData = ref<FileData[]>([])
const fileTree = ref<FileNode>({
  type: NodeType.Directory,
  name: '',
  children: [],
  size: 0,
  displaySize: '',
})
const currentPath = ref<string>('')
const displayFileNode = ref<FileNode>()
const isRootPath = computed(() => currentPath.value === '')

const game = ref('genshin')
const version = ref('')
const versionData = ref<
  Record<string, any>
>({})
const versionList = ref<string[]>([])

const message = ref('')

function getDisplaySize(size: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (size > 1024) {
    size /= 1024
    i++
  }
  return `${size.toFixed(2)} ${units[i]}`
}

function updateDisplayFiles() {
  if (isRootPath.value) {
    displayFileNode.value = fileTree.value
    return
  }
  const path = currentPath.value.split('/')
  let tree = fileTree.value
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

function goRoot() {
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

function loadGameVersionList() {
  fetch(`https://api.amarea.cn/game/${game.value}/version`)
    .then(res => res.json())
    .then((data) => {
      versionData.value = data
      versionList.value = Object.keys(data)
      version.value = versionList.value[versionList.value.length - 1]
      loadPkgVersion()
    })
    .catch((err) => {
      message.value = `加载版本列表失败 ${err}`
    })
}

function loadPkgVersion() {
  fileTree.value = {
    type: NodeType.Directory,
    name: '',
    children: [],
    size: 0,
    displaySize: '',
  }
  fetch(`https://api.amarea.cn/game/${game.value}/pkg_version/${version.value}/pkg_version`)
    .then(res => res.text())
    .then((data) => {
      fileData.value = []
      data.split('\n').forEach((line) => {
        if (line === '')
          return
        if (line.startsWith('{')) {
          fileData.value.push(JSON.parse(line))
        }
        else {
          fileData.value.push({
            remoteName: line.split(' ')[0],
            md5: line.split(' ')[1].split('|')[0],
            fileSize: Number.parseInt(line.split(' ')[1].split('|')[1]) || 0,
          })
        }
      })
      fileData.value.forEach((file) => {
        const path = file.remoteName.replace(/\\/g, '/').split('/')
        let tree = fileTree.value
        for (let i = 0; i < path.length; i++) {
          const name = path[i]
          if (i === path.length - 1) {
            tree.size += file.fileSize
            tree.children.push({
              type: NodeType.File,
              name,
              children: [],
              size: file.fileSize,
              displaySize: getDisplaySize(file.fileSize),
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
      sortTree(fileTree.value)
      message.value = `已加载 ${game.value} ${version.value} 版本文件列表，文件数量 ${fileData.value.length}，总大小 ${getDisplaySize(fileTree.value.size)}`
    })
    .catch((err) => {
      message.value = `加载失败 ${err}`
    })
    .finally(() => {
      currentPath.value = ''
      updateDisplayFiles()
    })
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
    .catch((err) => {
      // eslint-disable-next-line no-alert
      alert(`复制失败:${err}`)
    })
}

function downloadFile(remoteName: string) {
  const decompressedPath = versionData.value[version.value].decompressed_path
  if (!decompressedPath) {
    // eslint-disable-next-line no-alert
    alert('该文件不支持下载')
    return
  }
  const url = `${decompressedPath}/${remoteName}`
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.click()
}

onMounted(() => {
  loadGameVersionList()
})
</script>

<template>
  <div class="flex flex-col items-center p-2 gap-2">
    <div class="max-w-[1200px] w-full p-2 border">
      <div>
        游戏：
        <select
          v-model="game"
          class="border"
          @change="loadGameVersionList"
        >
          <option value="genshin">
            原神
          </option>
          <option value="starrail">
            崩坏：星穹铁道
          </option>
        </select>
        版本：
        <select
          v-model="version"
          class="border"
          @change="loadPkgVersion"
        >
          <option
            v-for="v in versionList" :key="v"
            :value="v"
          >
            {{ v }}
          </option>
        </select>
      </div>
      <div>
        {{ message }}
      </div>
    </div>
    <div class="max-w-[1200px] w-full p-2 border">
      <div>
        {{ currentPath || '根目录' }}
      </div>
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
              'hover:bg-gray-100 cursor-pointer': !isRootPath,
            }"
            @click="goRoot"
          >
            <td />
            <td>...</td>
            <td />
            <td />
          </tr>
          <tr
            :class="{
              'text-gray-400': isRootPath,
              'hover:bg-gray-100 cursor-pointer': !isRootPath,
            }"
            @click="goPrevious"
          >
            <td />
            <td>..</td>
            <td />
            <td />
          </tr>
          <tr
            v-for="file in displayFileNode.children" :key="file.name"
            class="hover:bg-gray-100 "
            :class="{
              'text-yellow-600 cursor-pointer': file.type === NodeType.Directory,
            }"
            @click="handleClickFile(file)"
          >
            <td>
              <template v-if="file.type === NodeType.Directory">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 inline-block">
                  <path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v3.26a3.235 3.235 0 0 1 1.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0 0 16.25 5h-4.836a.25.25 0 0 1-.177-.073L9.823 3.513A1.75 1.75 0 0 0 8.586 3H3.75ZM3.75 9A1.75 1.75 0 0 0 2 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0 0 18 15.25v-4.5A1.75 1.75 0 0 0 16.25 9H3.75Z" />
                </svg>
              </template>
              <template v-if="file.type === NodeType.File">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 inline-block">
                  <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" />
                </svg>
              </template>
            </td>
            <td class="overflow-hidden overflow-ellipsis whitespace-nowrap">
              {{ file.name }}
              <template v-if="file.type === NodeType.Directory">
                ({{ file.children.length }})
              </template>
            </td>
            <td>{{ file.type === NodeType.Directory ? '目录' : '文件' }}</td>
            <td>{{ file.displaySize || getDisplaySize(file.size) }}</td>
            <td>
              <template v-if="file.type === NodeType.File && file.fileData">
                <button class="mr-1" @click="downloadFile(file.fileData.remoteName)">
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
  </div>
</template>
