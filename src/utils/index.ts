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
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (size > 1024) {
    size /= 1024
    i++
  }
  return `${size.toFixed(2)} ${units[i]}`
}
