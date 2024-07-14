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
  chunk: ChunkInfo | null
}

export interface GameConfig {
  name: string
  icon: string
  voice: string[]
}

export interface FileListState {
  game: string
  version: string
  voice: string[]
  decompressed_path: string | null
  tree: FileNode
  currentPath: string
  displayFileNode?: FileNode
  count: number
  size: number
}

export interface ChunkInfo {
  branch: string
  package_id: string
  password: string
  tag: string
}

export interface ChunkStat {
  build_id: string
  tag: string
  manifests: {
    category_id: string
    category_name: string
    manifest: {
      id: string
      checksum: string
      compressed_size: string
      uncompressed_size: string
    }
    chunk_download: {
      url_prefix: string
    }
    manifest_download: {
      url_prefix: string
    }
    stats: {
      compressed_size: string
      uncompressed_size: string
      file_count: string
      chunk_count: string
    }
  }[]
}
