declare global {
  interface Window {
    electronAPI?: {
      onServerPort(callback: (event: any, port: number) => void): void
      removeAllListeners(channel: string): void
      openSettings(): Promise<void>
      closeSettings(): Promise<void>
      settingsUpdated(settings: any): Promise<void>
      onSettingsUpdated(callback: (event: any, settings: any) => void): void
    }
  }
}

export {}
