import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiBase } from '../../utils/api'
import type { UIMessage } from '../../../features/chat/types'

interface ConversationSummary {
  conversation_id: string
  created_at: string
  updated_at: string
  message_count: number
  preview: string
}

interface ConversationDetail {
  conversation_id: string
  created_at: string
  updated_at: string
  messages: UIMessage[]
}

// Query Keys
export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...conversationKeys.lists(), { filters }] as const,
  details: () => [...conversationKeys.all, 'detail'] as const,
  detail: (id: string) => [...conversationKeys.details(), id] as const,
}

// Fetch conversations list
const fetchConversations = async (limit = 20): Promise<ConversationSummary[]> => {
  const url = `${getApiBase()}/api/conversations?limit=${limit}`
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch conversations: ${response.status} ${response.statusText}`)
  }
  
  const data = await response.json()
  return data.conversations || []
}

// Fetch single conversation
const fetchConversation = async (id: string): Promise<ConversationDetail> => {
  const url = `${getApiBase()}/api/conversations/${id}`
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Failed to load conversation: ${response.status} ${response.statusText}`)
  }
  
  const data = await response.json()
  
  if (!data || !data.conversation || !Array.isArray(data.conversation.messages)) {
    throw new Error('Invalid conversation data received from server')
  }
  
  // Transform messages to UI format
  const uiMessages: UIMessage[] = data.conversation.messages.map((msg: any) => {
    if (!msg.id || !msg.type || !msg.timestamp) {
      console.warn('Invalid message structure:', msg)
      return null
    }
    
    return {
      ...msg,
      timestamp: new Date(msg.timestamp),
      ...(msg.type === 'thinking' && {
        isStreaming: msg.is_streaming,
        isCollapsed: msg.is_collapsed
      })
    }
  }).filter(Boolean)
  
  return {
    conversation_id: data.conversation.conversation_id,
    created_at: data.conversation.created_at,
    updated_at: data.conversation.updated_at,
    messages: uiMessages
  }
}

// Create new conversation
const createConversation = async (): Promise<{ conversation_id: string }> => {
  const url = `${getApiBase()}/api/conversations`
  const response = await fetch(url, { method: 'POST' })
  
  if (!response.ok) {
    throw new Error(`Failed to create conversation: ${response.status}`)
  }
  
  const data = await response.json()
  return { conversation_id: data.conversation_id }
}

// Delete conversation
const deleteConversation = async (id: string): Promise<void> => {
  const url = `${getApiBase()}/api/conversations/${id}`
  const response = await fetch(url, { method: 'DELETE' })
  
  if (!response.ok) {
    throw new Error(`Failed to delete conversation: ${response.status}`)
  }
}

// Hooks
export const useConversationsQuery = (limit = 20) => {
  return useQuery({
    queryKey: conversationKeys.list({ limit }),
    queryFn: () => fetchConversations(limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

export const useConversationQuery = (id: string | null) => {
  return useQuery({
    queryKey: conversationKeys.detail(id || ''),
    queryFn: () => fetchConversation(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  })
}

export const useCreateConversationMutation = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createConversation,
    onSuccess: () => {
      // Invalidate conversations list to show new conversation
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() })
    },
  })
}

export const useDeleteConversationMutation = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteConversation,
    onSuccess: (_, deletedId) => {
      // Remove from conversations list cache
      queryClient.setQueryData(
        conversationKeys.list({ limit: 20 }),
        (old: ConversationSummary[] | undefined) => 
          old?.filter(conv => conv.conversation_id !== deletedId) || []
      )
      
      // Remove conversation detail from cache
      queryClient.removeQueries({ queryKey: conversationKeys.detail(deletedId) })
    },
  })
}
