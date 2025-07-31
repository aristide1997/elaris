export interface UpdateInfo {
  version: string
  releaseNotes?: string
  releaseName?: string
  releaseDate?: string
}

export interface UpdateProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export interface UpdaterState {
  updateAvailable: boolean
  updateInfo: UpdateInfo | null
  isDownloading: boolean
  downloadProgress: UpdateProgress | null
  isDownloaded: boolean
  error: string | null
  
  // Actions
  setUpdateAvailable: (info: UpdateInfo) => void
  setDownloading: (downloading: boolean) => void
  setDownloadProgress: (progress: UpdateProgress) => void
  setDownloaded: (info: UpdateInfo) => void
  setError: (error: string | null) => void
  clearUpdate: () => void
}
