import { useRef, useEffect } from 'react'
import { useSearchStore } from '../stores/useSearchStore'
import './SearchBar.css'

const SearchBar: React.FC = () => {
  const { 
    query: searchQuery, 
    isExpanded, 
    setQuery, 
    clearQuery, 
    setExpanded, 
    addToHistory 
  } = useSearchStore()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
  }

  const handleClear = () => {
    clearQuery()
  }

  const handleExpand = () => {
    setExpanded(true)
  }

  const handleCollapse = () => {
    if (!searchQuery) {
      setExpanded(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (searchQuery.trim()) {
        addToHistory(searchQuery)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      clearQuery()
      setExpanded(false)
    }
  }

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isExpanded])

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const shortcut = isMac ? '⌘F' : 'Ctrl+F'

  return (
    <div 
      className={`sidebar-button search-container ${isExpanded ? 'expanded' : ''}`}
      onClick={!isExpanded ? handleExpand : undefined}
    >
      {/* Search icon - always visible */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>

      {/* Text label and shortcut - only show when not expanded */}
      {!isExpanded && (
        <>
          <span className="sidebar-button-text">Search</span>
          <span className="sidebar-button-shortcut">{shortcut}</span>
        </>
      )}

      {/* Input field - shows when expanded */}
      {isExpanded && (
        <>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            onBlur={handleCollapse}
            onKeyDown={handleKeyDown}
            placeholder="Search conversations..."
            className="search-input"
            aria-label="Search conversations"
          />
          {searchQuery && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
              className="search-clear-btn"
              aria-label="Clear search"
            >
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default SearchBar
