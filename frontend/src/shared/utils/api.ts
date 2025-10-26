// A central helper to get the API base URL for HTTP calls.
// Uses the dynamic serverPort from the connection store with fallback to 8000.
import { useConnectionStore } from '../../features/connection/stores/useConnectionStore';

/**
 * Returns the base HTTP URL, e.g. "http://localhost:8000"
 */
export function getApiBase(): string {
  const port = useConnectionStore.getState().serverPort;
  return `http://localhost:${port ?? 8000}`;
}

/**
 * Returns the full WebSocket URL, e.g. "ws://localhost:8000/ws"
 * @param path the WS path (defaults to '/ws')
 */
export function getWsUrl(path: string = '/ws'): string {
  const port = useConnectionStore.getState().serverPort;
  return `ws://localhost:${port ?? 8000}${path}`;
} 