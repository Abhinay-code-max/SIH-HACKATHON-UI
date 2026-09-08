/**
 * Shared application-wide constants for BorderWatch Command Pro.
 * Import from this file to avoid duplication across components.
 */

/** The four perimeter sectors monitored by BorderWatch. */
export const SECTORS = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'] as const;

export type SectorName = typeof SECTORS[number];
