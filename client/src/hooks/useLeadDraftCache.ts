import type { Lead } from '@/types';

const PREFIX = 'solar-lead-draft:';

/**
 * A thin localStorage mirror of the in-progress lead draft. This is a
 * convenience cache only - the backend record (saved on every step) is
 * always the source of truth. It exists so an accidental refresh or a
 * brief connectivity drop doesn't lose whatever the agent just typed.
 */
export function getCachedDraft(leadId: string): Partial<Lead> | null {
  try {
    const raw = localStorage.getItem(PREFIX + leadId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCachedDraft(leadId: string, lead: Partial<Lead>): void {
  try {
    localStorage.setItem(PREFIX + leadId, JSON.stringify(lead));
  } catch {
    // localStorage may be unavailable (private browsing, quota) - fail silently.
  }
}

export function clearCachedDraft(leadId: string): void {
  try {
    localStorage.removeItem(PREFIX + leadId);
  } catch {
    // ignore
  }
}
