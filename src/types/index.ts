export enum NodeType {
  File = 'file',
  Directory = 'dir',
}

export interface FileData {
  remoteName: string
  md5: string
  hash?: string
  fileSize: number
}

export interface FileNode {
  type: NodeType
  name: string
  children: FileNode[]
  size: number
  displaySize: string
  fileData?: FileData
}

export interface FileInfo {
  name: string
  url: string
  checksum: string
  size: number
}

export interface FileInfoWithType extends FileInfo {
  type: string
}

export interface VersionData {
  game: {
    full?: FileInfo
    segments: FileInfo[]
  }
  voice: {
    [langKey: string]: FileInfo
  }
  update: {
    [version: string]: {
      game: FileInfo
      voice: {
        [langKey: string]: FileInfo
      }
    }
  }
  decompressed_path: string | null
  chunk: string | null
}

export interface GameConfig {
  name: string
  icon: string
  voice: string[]
}
