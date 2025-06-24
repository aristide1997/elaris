declare global {
  interface Window {
    electronAPI?: {
      onServerPort(callback: (event: any, port: number) => void): void
      removeAllListeners(channel: string): void
    }
  }
}

export {} 