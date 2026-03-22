/**
 * Generate a unique ID with a prefix.
 * Uses timestamp + random suffix to avoid collisions.
 * Example: generateId('SHP') → 'SHP-m1abc2-x7f3'
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
