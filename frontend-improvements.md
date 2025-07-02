## Specific Implementation Suggestions

1. __Extract WebSocket Logic Further__

   - Create a WebSocketService class
   - Handle reconnection with exponential backoff
   - Provide connection status observables

2. __Refactor Message Management__

   - Create a MessageService to handle formatting
   - Implement optimistic UI updates
   - Add message queue for offline support

3. __Component Structure__

   - Move conversation management to its own hook
   - Create a ChatContext for sharing state
   - Split App.tsx into smaller focused components

4. __Add Testing Infrastructure__

   - Unit tests for the reducer
   - Component tests with React Testing Library
   - Mock WebSocket for testing real-time features
