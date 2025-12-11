/**
 * Phase 4: Client-Side Session Management
 * 
 * Manages analytics session IDs in the browser using localStorage.
 * Provides session ID that persists across page loads.
 */

'use client';

const SESSION_STORAGE_KEY = 'aa_session_id';
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get or create session ID from localStorage
 */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') {
    // Server-side: generate temporary ID (will be replaced by client)
    return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      const { sessionId, createdAt } = JSON.parse(stored);
      const age = Date.now() - createdAt;
      
      // Reuse session if less than 30 minutes old
      if (age < SESSION_DURATION_MS) {
        return sessionId;
      }
    }
  } catch (error) {
    // If parsing fails, create new session
    console.warn('[analytics] Failed to read session from localStorage', error);
  }

  // Create new session
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      sessionId,
      createdAt: Date.now(),
    }));
  } catch (error) {
    console.warn('[analytics] Failed to save session to localStorage', error);
  }

  return sessionId;
}

/**
 * Get current session ID (may be temporary if called server-side)
 */
export function getSessionId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      const { sessionId, createdAt } = JSON.parse(stored);
      const age = Date.now() - createdAt;
      
      if (age < SESSION_DURATION_MS) {
        return sessionId;
      }
    }
  } catch (error) {
    // Ignore errors
  }

  return null;
}

