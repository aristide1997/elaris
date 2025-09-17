import { useState, useEffect, useRef, useCallback, type RefObject } from 'react'

interface UseDropdownReturn {
  isOpen: boolean
  dropdownRef: RefObject<HTMLDivElement | null>
  toggleDropdown: () => void
  openDropdown: () => void
  closeDropdown: () => void
}

export const useDropdown = (): UseDropdownReturn => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const toggleDropdown = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  const openDropdown = useCallback(() => {
    setIsOpen(true)
  }, [])

  const closeDropdown = useCallback(() => {
    setIsOpen(false)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return {
    isOpen,
    dropdownRef,
    toggleDropdown,
    openDropdown,
    closeDropdown
  }
}
