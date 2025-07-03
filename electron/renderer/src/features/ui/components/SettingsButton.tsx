import React from 'react'
import './SettingsButton.css'

const SettingsButton: React.FC = () => {
  const handleSettingsClick = () => {
    // TODO: Implement settings functionality
    console.log('Settings clicked - to be implemented')
  }

  return (
    <button className="settings-button" onClick={handleSettingsClick}>
      <span className="settings-icon">⚙️</span>
      <span className="settings-text">Settings</span>
    </button>
  )
}

export default SettingsButton
