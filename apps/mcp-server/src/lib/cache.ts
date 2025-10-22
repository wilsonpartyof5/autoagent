/**
 * In-memory LRU cache with TTL support
 */

interface CacheEntry<T> {
  value: T;
  expires: number;
  accessTime: number;
}

export class LRUCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder: string[] = [];

  constructor(
    private maxSize: number = 200,
    private ttlMs: number = 60000, // 60 seconds
  ) {}

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.delete(key);
      return null;
    }

    // Update access time and move to end of access order
    entry.accessTime = Date.now();
    this.moveToEnd(key);
    
    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    const now = Date.now();
    const expires = now + this.ttlMs;

    // If key exists, update it
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.value = value;
      entry.expires = expires;
      entry.accessTime = now;
      this.moveToEnd(key);
      return;
    }

    // If cache is full, remove least recently used item
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // Add new entry
    this.cache.set(key, {
      value,
      expires,
      accessTime: now,
    });
    
    this.accessOrder.push(key);
  }

  /**
   * Delete key from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
    return deleted;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }
    
    if (Date.now() > entry.expires) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Move key to end of access order (most recently used)
   */
  private moveToEnd(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Remove least recently used item
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) {
      return;
    }
    
    const lruKey = this.accessOrder[0];
    this.delete(lruKey);
  }
}

// Global cache instance for search results
export const searchCache = new LRUCache<{ vehicles: unknown[]; totalCount: number }>(200, 60000); // 200 max entries, 60s TTL
