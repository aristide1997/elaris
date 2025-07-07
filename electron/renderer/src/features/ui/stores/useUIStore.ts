import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface UIState {
  isConversationListOpen: boolean
  isDebugModalOpen: boolean
  isSidebarCollapsed: boolean
}

interface UIActions {
  openHistory: () => void
  closeHistory: () => void
  openDebug: () => void
  closeDebug: () => void
  openSettings: () => Promise<void>
  closeSettings: () => Promise<void>
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

type UIStore = UIState & UIActions

const initialState: UIState = {
  isConversationListOpen: false,
  isDebugModalOpen: false,
  isSidebarCollapsed: false
}

export const useUIStore = create<UIStore>()(
  devtools(
    (set) => ({
      // Initial state
      ...initialState,

      // Actions
      openHistory: () => {
        set({ isConversationListOpen: true }, false, 'openHistory')
      },

      closeHistory: () => {
        set({ isConversationListOpen: false }, false, 'closeHistory')
      },

      openDebug: () => {
        set({ isDebugModalOpen: true }, false, 'openDebug')
      },

      closeDebug: () => {
        set({ isDebugModalOpen: false }, false, 'closeDebug')
      },

      openSettings: async () => {
        if (window.electronAPI?.openSettings) {
          await window.electronAPI.openSettings()
        }
        // No fallback needed - settings are now in a separate window
      },

      closeSettings: async () => {
        if (window.electronAPI?.closeSettings) {
          await window.electronAPI.closeSettings()
        }
        // No fallback needed - settings are now in a separate window
      },

      toggleSidebar: () => {
        set((state) => ({
          ...state,
          isSidebarCollapsed: !state.isSidebarCollapsed
        }), false, 'toggleSidebar')
      },

      setSidebarCollapsed: (collapsed: boolean) => {
        set({ isSidebarCollapsed: collapsed }, false, 'setSidebarCollapsed')
      }
    }),
    {
      name: 'ui-store'
    }
  )
)
