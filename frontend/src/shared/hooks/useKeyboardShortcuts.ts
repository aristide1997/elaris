import { useEffect } from 'react'
import { useUIStore } from '../../features/ui'

/**
 * Global keyboard shortcuts hook
 * Manages all application-wide keyboard shortcuts in a centralized location
 */
export const useKeyboardShortcuts = () => {
  const { toggleSidebar, openDebug } = useUIStore()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.metaKey || event.ctrlKey
      
      // Cmd+B / Ctrl+B - Toggle Sidebar
      if (isModifierPressed && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        toggleSidebar()
        return
      }

      // Cmd+D / Ctrl+D - Open Debug Modal
      if (isModifierPressed && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        openDebug()
        return
      }

      // Future shortcuts can be added here:
      // Cmd+K / Ctrl+K - Command Palette
      // if (isModifierPressed && event.key.toLowerCase() === 'k') {
      //   event.preventDefault()
      //   openCommandPalette()
      //   return
      // }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar, openDebug])
}
