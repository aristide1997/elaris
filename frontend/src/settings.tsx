import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './shared/api/queryClient'
import SettingsWindow from './features/ui/components/SettingsWindow'
import './index.css'
import './App.css'

ReactDOM.createRoot(document.getElementById('settings-root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SettingsWindow />
    </QueryClientProvider>
  </React.StrictMode>,
)
