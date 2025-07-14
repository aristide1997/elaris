declare global {
  interface Window {
    electronAPI?: {
      onServerPort(callback: (event: any, port: number) => void): void
      removeAllListeners(channel: string): void
      openSettings(): Promise<void>
      closeSettings(): Promise<void>
      settingsUpdated(settings: any): Promise<void>
      onSettingsUpdated(callback: (event: any, settings: any) => void): void
      
      // Backend restart event handlers
      onBackendRestarting(callback: (event: any) => void): void
      onBackendRestarted(callback: (event: any, port: number) => void): void
      onBackendRestartFailed(callback: (event: any) => void): void
      
      // Auto-updater methods
      downloadUpdate(): Promise<void>
      installUpdate(): Promise<void>
      checkForUpdates(): Promise<void>
      
      // Auto-updater event handlers
      onUpdateAvailable(callback: (event: any, info: any) => void): void
      onUpdateError(callback: (event: any, error: string) => void): void
      onUpdateDownloadProgress(callback: (event: any, progress: any) => void): void
      onUpdateDownloaded(callback: (event: any, info: any) => void): void
    }
  }
}

export {}
