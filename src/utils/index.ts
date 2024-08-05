import type { FileNode } from '@/types'
import { NodeType } from '@/types'

export function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
    .then(() => {
      ElMessage.success('复制成功')
    })
    .catch((err) => {
      ElMessage.error(`复制失败 ${err}`)
    })
}

export function openLink(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.click()
}

export function formatBytes(size: number | string) {
  if (typeof size === 'string')
    size = Number.parseInt(size)
  if (size < 0) {
    return '未知'
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (size > 1024) {
    size /= 1024
    i++
  }
  return `${size.toFixed(2)} ${units[i]}`
}

export function sortTree(tree: FileNode) {
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
