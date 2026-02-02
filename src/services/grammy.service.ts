/**
 * Grammy Awards Service
 * Loads Grammy data from the Wikipedia JSON and provides query functions
 */

import grammyData from '$data/awards/grammy-wikipedia.json';
import type {
	GrammyData,
	GrammyCategory,
	GrammyNominee,
	GrammyEntityType
} from '$types/grammy.type';

// Cast the imported data to the correct type
const GRAMMY_DATA = grammyData as GrammyData;

/**
 * Get all available Grammy years (sorted descending)
 */
export function getGrammyYears(): string[] {
	return Object.keys(GRAMMY_DATA).sort((a, b) => Number(b) - Number(a));
}

/**
 * Get all categories available for a specific year
 */
export function getGrammyCategories(year: string): string[] {
	const yearData = GRAMMY_DATA[year];
	if (!yearData || !yearData.grammy) return [];
	return Object.keys(yearData.grammy).sort();
}

/**
 * Get nominees and winners for a specific category
 */
export function getGrammyCategoryData(year: string, category: string): GrammyCategory | null {
	const yearData = GRAMMY_DATA[year];
	if (!yearData || !yearData.grammy) return null;
	return yearData.grammy[category] || null;
}

/**
 * Get all nominees for a year/category as GrammyNominee objects
 */
export function getGrammyNominees(year: string, category: string): GrammyNominee[] {
	const categoryData = getGrammyCategoryData(year, category);
	if (!categoryData) return [];

	const entityType = detectEntityType(category);
	const winnerSet = new Set(categoryData.winner);

	// Get all unique entries (nominees include winners in some years)
	const allEntries = new Set([...categoryData.nominee, ...categoryData.winner]);

	return Array.from(allEntries).map((article) => ({
		wikipediaArticle: article,
		year,
		category,
		isWinner: winnerSet.has(article),
		entityType
	}));
}

/**
 * Get all nominees for a year across all categories
 */
export function getGrammyNomineesForYear(year: string): GrammyNominee[] {
	const categories = getGrammyCategories(year);
	const allNominees: GrammyNominee[] = [];

	for (const category of categories) {
		const nominees = getGrammyNominees(year, category);
		allNominees.push(...nominees);
	}

	return allNominees;
}

/**
 * Detect the entity type based on category name
 */
export function detectEntityType(category: string): GrammyEntityType {
	const lower = category.toLowerCase();

	// Artist categories
	if (
		lower.includes('artist') ||
		lower.includes('producer') ||
		lower.includes('composer') ||
		lower.includes('songwriter')
	) {
		return 'artist';
	}

	// Album categories
	if (
		lower.includes('album') ||
		lower.includes('vocal') ||
		lower.includes('classical') ||
		lower.includes('compilation')
	) {
		return 'album';
	}

	// Recording/song categories
	if (
		lower.includes('record') ||
		lower.includes('song') ||
		lower.includes('performance') ||
		lower.includes('single')
	) {
		return 'recording';
	}

	// Default to album
	return 'album';
}

/**
 * Normalize Wikipedia article name for MusicBrainz search
 * Removes disambiguation suffixes like "(song)", "(album)", etc.
 */
export function normalizeWikipediaName(articleName: string): string {
	// Remove parenthetical disambiguation at the end
	// Examples:
	// "Anti-Hero (song)" -> "Anti-Hero"
	// "Midnights" -> "Midnights"
	// "Gracie Abrams" -> "Gracie Abrams"
	// "The Tortured Poets Department" -> "The Tortured Poets Department"
	return articleName.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * Format category name for display (capitalize words)
 */
export function formatGrammyCategoryName(category: string): string {
	return category
		.split(' ')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

/**
 * Get entity type display name
 */
export function getEntityTypeLabel(entityType: GrammyEntityType): string {
	switch (entityType) {
		case 'artist':
			return 'Artist';
		case 'album':
			return 'Album';
		case 'recording':
			return 'Song';
		default:
			return 'Unknown';
	}
}

/**
 * Get badge color for entity type
 */
export function getEntityTypeBadgeClass(entityType: GrammyEntityType): string {
	switch (entityType) {
		case 'artist':
			return 'badge-primary';
		case 'album':
			return 'badge-secondary';
		case 'recording':
			return 'badge-accent';
		default:
			return 'badge-ghost';
	}
}
