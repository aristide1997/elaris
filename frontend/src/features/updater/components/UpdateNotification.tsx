import React, { useEffect } from 'react'
import { useUpdaterStore } from '../stores/useUpdaterStore'
import './UpdateNotification.css'

interface UpdateNotificationProps {
  className?: string
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({ className }) => {
  const {
    updateAvailable,
    updateInfo,
    isDownloading,
    downloadProgress,
    isDownloaded,
    error,
    setUpdateAvailable,
    setDownloading,
    setDownloadProgress,
    setDownloaded,
    setError,
    clearUpdate
  } = useUpdaterStore()

  // Setup event listeners for updater events
  useEffect(() => {
    if (!window.electronAPI) return

    const handleUpdateAvailable = (_event: any, info: any) => {
      console.log('Update available event received:', info)
      setUpdateAvailable(info)
    }

    const handleUpdateError = (_event: any, errorMessage: string) => {
      console.error('Update error event received:', errorMessage)
      setError(errorMessage)
    }

    const handleDownloadProgress = (_event: any, progress: any) => {
      console.log('Update download progress:', progress)
      setDownloadProgress(progress)
    }

    const handleUpdateDownloaded = (_event: any, info: any) => {
      console.log('Update downloaded event received:', info)
      setDownloaded(info)
    }

    // Register event listeners
    window.electronAPI.onUpdateAvailable(handleUpdateAvailable)
    window.electronAPI.onUpdateError(handleUpdateError)
    window.electronAPI.onUpdateDownloadProgress(handleDownloadProgress)
    window.electronAPI.onUpdateDownloaded(handleUpdateDownloaded)

    return () => {
      // Cleanup listeners
      window.electronAPI?.removeAllListeners('update-available')
      window.electronAPI?.removeAllListeners('update-error')
      window.electronAPI?.removeAllListeners('update-download-progress')
      window.electronAPI?.removeAllListeners('update-downloaded')
    }
  }, [setUpdateAvailable, setDownloading, setDownloadProgress, setDownloaded, setError])

  const handleDownload = async () => {
    setDownloading(true)
    await window.electronAPI?.downloadUpdate()
  }

  const handleInstall = async () => {
    await window.electronAPI?.installUpdate()
  }

  const handleDismiss = () => {
    clearUpdate()
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatSpeed = (bytesPerSecond: number) => {
    return formatBytes(bytesPerSecond) + '/s'
  }

  if (!updateAvailable && !isDownloading && !isDownloaded && !error) {
    return null
  }

  return (
    <div className={`update-notification ${className || ''}`}>
      <div className="update-notification-content">
        {error && (
          <div className="update-error">
            <div className="update-header">
              <h3>Update Error</h3>
            </div>
            <p>Failed to check for updates: {error}</p>
            <div className="update-actions">
              <button onClick={handleDismiss} className="btn-secondary">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {updateAvailable && !isDownloading && !isDownloaded && !error && (
          <div className="update-available">
            <div className="update-header">
              <h3>Update Available</h3>
            </div>
            <p>
              A new version ({updateInfo?.version}) is available.
              {updateInfo?.releaseName && ` - ${updateInfo.releaseName}`}
            </p>
            {updateInfo?.releaseNotes && (
              <div className="release-notes">
                <h4>Release Notes:</h4>
                <div dangerouslySetInnerHTML={{ __html: updateInfo.releaseNotes }} />
              </div>
            )}
            <div className="update-actions">
              <button onClick={handleDownload} className="btn-primary">
                Download Update
              </button>
              <button onClick={handleDismiss} className="btn-secondary">
                Later
              </button>
            </div>
          </div>
        )}

        {isDownloading && (
          <div className="update-downloading">
            <div className="update-header">
              <h3>Downloading Update</h3>
            </div>
            <p>Downloading version {updateInfo?.version}...</p>
            {downloadProgress && (
              <div className="download-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${downloadProgress.percent}%` }}
                  />
                </div>
                <div className="progress-details">
                  <span>{downloadProgress.percent}%</span>
                  <span>
                    {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
                  </span>
                  <span>{formatSpeed(downloadProgress.bytesPerSecond)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {isDownloaded && (
          <div className="update-downloaded">
            <div className="update-header">
              <h3>Update Ready</h3>
            </div>
            <p>
              Version {updateInfo?.version} has been downloaded and is ready to install.
              The application will restart to complete the installation.
            </p>
            <div className="update-actions">
              <button onClick={handleInstall} className="btn-primary">
                Install & Restart
              </button>
              <button onClick={handleDismiss} className="btn-secondary">
                Install Later
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
