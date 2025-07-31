import { create } from 'zustand'
import { UpdaterState, UpdateInfo, UpdateProgress } from '../types'

export const useUpdaterStore = create<UpdaterState>((set) => ({
  updateAvailable: false,
  updateInfo: null,
  isDownloading: false,
  downloadProgress: null,
  isDownloaded: false,
  error: null,

  setUpdateAvailable: (info: UpdateInfo) => set({
    updateAvailable: true,
    updateInfo: info,
    error: null
  }),

  setDownloading: (downloading: boolean) => set({
    isDownloading: downloading,
    downloadProgress: downloading ? null : undefined
  }),

  setDownloadProgress: (progress: UpdateProgress) => set({
    downloadProgress: progress
  }),

  setDownloaded: (info: UpdateInfo) => set({
    isDownloaded: true,
    isDownloading: false,
    downloadProgress: null,
    updateInfo: info
  }),

  setError: (error: string | null) => set({
    error,
    isDownloading: false,
    downloadProgress: null
  }),

  clearUpdate: () => set({
    updateAvailable: false,
    updateInfo: null,
    isDownloading: false,
    downloadProgress: null,
    isDownloaded: false,
    error: null
  })
}))
