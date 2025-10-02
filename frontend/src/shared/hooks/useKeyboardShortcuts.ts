import { useEffect } from 'react'
import { useUIStore } from '../../features/ui'
import { useChatActions } from '../../features/chat/hooks/useChatActions'
import { useSearchStore } from '../../features/ui/stores/useSearchStore'

/**
 * Global keyboard shortcuts hook
 * Manages all application-wide keyboard shortcuts in a centralized location
 */
export const useKeyboardShortcuts = () => {
  const { toggleSidebar, openDebug, openSettings } = useUIStore()
  const { resetConversation } = useChatActions()
  const { setExpanded } = useSearchStore()

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

      // Cmd+N / Ctrl+N - New Chat
      if (isModifierPressed && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        resetConversation()
        return
      }

      // Cmd+F / Ctrl+F - Search
      if (isModifierPressed && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setExpanded(true)
        return
      }

      // Cmd+, / Ctrl+, - Settings
      if (isModifierPressed && event.key === ',') {
        event.preventDefault()
        openSettings()
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
  }, [toggleSidebar, openDebug, resetConversation, setExpanded, openSettings])
}
