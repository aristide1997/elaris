import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface SearchState {
  query: string
  isExpanded: boolean
  searchHistory: string[]
}

interface SearchActions {
  setQuery: (query: string) => void
  clearQuery: () => void
  setExpanded: (expanded: boolean) => void
  toggleExpanded: () => void
  addToHistory: (query: string) => void
  clearHistory: () => void
}

type SearchStore = SearchState & SearchActions

const initialState: SearchState = {
  query: '',
  isExpanded: false,
  searchHistory: []
}

export const useSearchStore = create<SearchStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Actions
      setQuery: (query: string) => {
        set({ query }, false, 'setQuery')
      },

      clearQuery: () => {
        set({ query: '' }, false, 'clearQuery')
      },

      setExpanded: (expanded: boolean) => {
        set({ isExpanded: expanded }, false, 'setExpanded')
      },

      toggleExpanded: () => {
        set((state) => ({ isExpanded: !state.isExpanded }), false, 'toggleExpanded')
      },

      addToHistory: (query: string) => {
        const trimmedQuery = query.trim()
        if (!trimmedQuery) return

        set((state) => {
          const history = state.searchHistory.filter(item => item !== trimmedQuery)
          return {
            searchHistory: [trimmedQuery, ...history].slice(0, 10) // Keep last 10 searches
          }
        }, false, 'addToHistory')
      },

      clearHistory: () => {
        set({ searchHistory: [] }, false, 'clearHistory')
      }
    }),
    {
      name: 'search-store'
    }
  )
)
