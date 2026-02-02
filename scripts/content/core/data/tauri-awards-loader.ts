/**
 * Awards data loader adapter for UI (Tauri/browser context)
 * Wraps the UI's awards.service.ts functions for use with the extractor
 */

import type { AwardEvent, EventInfo } from '../types.js';
import type { AwardsDataLoader } from '../awards-extractor.js';

// These will be dynamically imported from the UI service
let uiAwardsService: typeof import('$services/awards.service') | null = null;

/**
 * Initialize the Tauri awards loader
 * Must be called before using other functions
 */
export async function initTauriAwardsLoader(): Promise<void> {
	if (!uiAwardsService) {
		uiAwardsService = await import('$services/awards.service');
	}
}

/**
 * Create a Tauri-compatible awards data loader
 */
export function createTauriAwardsLoader(): AwardsDataLoader {
	if (!uiAwardsService) {
		throw new Error('Tauri awards loader not initialized. Call initTauriAwardsLoader() first.');
	}

	const service = uiAwardsService;

	return {
		loadAwardEvent(eventId: string): AwardEvent | null {
			return service.loadAwardEvent(eventId);
		},

		getEventName(eventId: string): string {
			return service.getEventName(eventId);
		},

		getYearsForEvent(event: AwardEvent): string[] {
			return service.getYearsForEvent(event);
		},

		getAwardTypesForYear(event: AwardEvent, year: string): string[] {
			return service.getAwardTypesForYear(event, year);
		},

		getCategoriesForAwardType(event: AwardEvent, year: string, awardType: string): string[] {
			return service.getCategoriesForAwardType(event, year, awardType);
		},

		getNomineesForCategory(
			event: AwardEvent,
			year: string,
			awardType: string,
			category: string
		): { nominee: string[]; winner: string[] } | null {
			return service.getNomineesForCategory(event, year, awardType, category);
		},

		formatCategoryName(category: string): string {
			return service.formatCategoryName(category);
		},

		formatAwardTypeName(awardType: string): string {
			return service.formatAwardTypeName(awardType);
		}
	};
}
