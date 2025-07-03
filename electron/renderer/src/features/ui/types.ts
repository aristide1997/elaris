export interface UIState {
  isSidebarCollapsed: boolean
  isDebugModalOpen: boolean
}

export interface UIActions {
  toggleSidebar: () => void
  collapseSidebar: () => void
  expandSidebar: () => void
  openDebug: () => void
  closeDebug: () => void
}

export type UIStore = UIState & UIActions 