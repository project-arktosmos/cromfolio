/**
 * Awards data loader for CLI scripts
 * Loads award event JSON files from the filesystem
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AwardEvent, EventInfo } from '../types.js';

// Get the path to src/data/awards relative to this file
function getAwardsDir(): string {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);
	// scripts/content/core/data -> src/data/awards
	return join(__dirname, '../../../../src/data/awards');
}

// Static event metadata (extracted from comments in event_ids.yml)
const EVENT_NAMES: Record<string, string> = {
	ev0000003: 'Academy Awards, USA',
	ev0000091: 'Berlin International Film Festival',
	ev0000123: 'BAFTA Awards',
	ev0000133: 'Critics Choice Awards',
	ev0000147: 'Cannes Film Festival',
	ev0000157: 'César Awards, France',
	ev0000223: 'Primetime Emmy Awards',
	ev0000245: 'Filmfare Awards',
	ev0000280: 'German Film Awards',
	ev0000292: 'Golden Globes, USA',
	ev0000329: 'Hong Kong Film Awards',
	ev0000349: 'Film Independent Spirit Awards',
	ev0000361: 'Awards of the International Indian Film Academy (IIFA)',
	ev0000415: 'Zee Cine Awards',
	ev0000467: 'National Film Awards, India',
	ev0000468: 'National Film Preservation Board, USA',
	ev0000530: "People's Choice Awards, USA",
	ev0000558: 'Razzie Awards',
	ev0000598: 'Actors Awards',
	ev0000631: 'Sundance Film Festival',
	ev0000659: 'Toronto International Film Festival',
	ev0000681: 'Venice Film Festival',
	ev0001931: 'Indian Television Academy Awards, India',
	ev0005699: 'Zee Rishtey Awards',
	ev0005770: "Nickelodeon Kids' Choice Awards, India",
	ev0011808: 'Indian Film Festival Of Melbourne',
	ev0035513: 'Filmfare OTT Awards',
	ev0036701: "Critics' Choice Shorts and Series Awards, India",
	ev0057191: 'Iconic Gold Awards',
	ev0060658: 'Bollywood Film Journalist Awards',
	ev0073358: 'International Iconic Awards'
};

/**
 * Get list of available award events
 */
export function getAwardEvents(): EventInfo[] {
	return Object.entries(EVENT_NAMES).map(([id, name]) => ({ id, name }));
}

/**
 * Get event name by ID
 */
export function getEventName(eventId: string): string {
	return EVENT_NAMES[eventId] || eventId;
}

/**
 * Load award data for a specific event from JSON file
 */
export function loadAwardEvent(eventId: string): AwardEvent | null {
	const awardsDir = getAwardsDir();
	const filePath = join(awardsDir, `${eventId}.json`);

	if (!existsSync(filePath)) {
		return null;
	}

	const content = readFileSync(filePath, 'utf-8');
	return JSON.parse(content) as AwardEvent;
}

/**
 * Get years available for an event
 */
export function getYearsForEvent(event: AwardEvent): string[] {
	return Object.keys(event).sort((a, b) => Number(b) - Number(a)); // Descending
}

/**
 * Get award types for a specific year
 */
export function getAwardTypesForYear(event: AwardEvent, year: string): string[] {
	const yearData = event[year];
	if (!yearData) return [];
	return Object.keys(yearData).sort();
}

/**
 * Get categories for a specific award type
 */
export function getCategoriesForAwardType(
	event: AwardEvent,
	year: string,
	awardType: string
): string[] {
	const awardData = event[year]?.[awardType];
	if (!awardData) return [];
	return Object.keys(awardData).sort();
}

/**
 * Get nominees and winners for a category
 */
export function getNomineesForCategory(
	event: AwardEvent,
	year: string,
	awardType: string,
	category: string
): { nominee: string[]; winner: string[] } | null {
	return event[year]?.[awardType]?.[category] || null;
}

/**
 * Format category name for display (capitalize words)
 */
export function formatCategoryName(category: string): string {
	return category
		.split(' ')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

/**
 * Format award type name for display
 */
export function formatAwardTypeName(awardType: string): string {
	return awardType
		.split(' ')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

/**
 * List all available event IDs
 */
export function listAvailableEventIds(): string[] {
	const awardsDir = getAwardsDir();

	if (!existsSync(awardsDir)) {
		return [];
	}

	return readdirSync(awardsDir)
		.filter((file) => file.endsWith('.json'))
		.map((file) => file.replace('.json', ''));
}
