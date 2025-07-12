import React from 'react'
import ReactDOM from 'react-dom/client'
import SettingsWindow from './features/ui/components/SettingsWindow'
import './index.css'

ReactDOM.createRoot(document.getElementById('settings-root')!).render(
  <React.StrictMode>
    <SettingsWindow />
  </React.StrictMode>,
)
