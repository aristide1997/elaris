import React from 'react'
import { useUIStore } from '../stores/useUIStore'
import './SettingsButton.css'

const SettingsButton: React.FC = () => {
  const { openSettings } = useUIStore()

  const handleSettingsClick = () => {
    openSettings()
  }

  return (
    <button className="settings-button" onClick={handleSettingsClick}>
      <span className="settings-icon">⚙️</span>
      <span className="settings-text">Settings</span>
    </button>
  )
}

export default SettingsButton
