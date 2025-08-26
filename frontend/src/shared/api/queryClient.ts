import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // How long data stays fresh (no background refetch)
      staleTime: 5 * 60 * 1000, // 5 minutes
      
      // How long to keep in memory after component unmounts
      gcTime: 30 * 60 * 1000, // 30 minutes
      
      // Retry failed requests
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) {
          return false
        }
        // Retry up to 3 times for network/server errors
        return failureCount < 3
      },
      
      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Don't refetch on window focus (can be annoying)
      refetchOnWindowFocus: false,
      
      // Refetch when connection is restored
      refetchOnReconnect: true,
      
      // Background refetch interval (keep data fresh)
      refetchInterval: 10 * 60 * 1000, // 10 minutes
      
      // Only refetch in background if window is focused
      refetchIntervalInBackground: false,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      retryDelay: 1000,
    },
  },
})

// Helper to invalidate all queries on reconnection
export const invalidateAllQueries = () => {
  queryClient.invalidateQueries()
}

// Helper to clear all cached data (useful for logout/reset)
export const clearAllQueries = () => {
  queryClient.clear()
}
