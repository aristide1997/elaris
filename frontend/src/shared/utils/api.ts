// A central helper to get the API base URL for HTTP calls.
// Uses the dynamic serverPort from the connection store with fallback to 43759.
import { useConnectionStore } from '../../features/connection/stores/useConnectionStore';

/**
 * Returns the base HTTP URL, e.g. "http://localhost:43759"
 */
export function getApiBase(): string {
  const port = useConnectionStore.getState().serverPort;
  return `http://localhost:${port ?? 43759}`;
}

/**
 * Returns the full WebSocket URL, e.g. "ws://localhost:43759/ws"
 * @param path the WS path (defaults to '/ws')
 */
export function getWsUrl(path: string = '/ws'): string {
  const port = useConnectionStore.getState().serverPort;
  return `ws://localhost:${port ?? 43759}${path}`;
}
