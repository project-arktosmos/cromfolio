/**
 * Console Best-Sellers Service
 * Loads console bestsellers data from JSON and provides query functions
 */

import consoleBestsellersData from '$data/games/console-bestsellers.json';

// Types for the console bestsellers data
export interface GameEntry {
	rank: number;
	title: string;
	copies: number; // in millions
	releaseDate?: string;
	developer?: string;
	publisher?: string;
	genre?: string;
}

export interface ConsoleData {
	id: string;
	name: string;
	releaseYear: number;
	manufacturer: string;
	type: 'home' | 'handheld' | 'hybrid';
	games: GameEntry[];
	fetchedAt: string;
}

export interface ConsoleBestsellersData {
	[consoleId: string]: ConsoleData;
}

// Cast the imported data to the correct type
const CONSOLE_DATA = consoleBestsellersData as ConsoleBestsellersData;

/**
 * Get all available consoles (sorted by release year descending)
 */
export function getConsoles(): ConsoleData[] {
	return Object.values(CONSOLE_DATA).sort((a, b) => b.releaseYear - a.releaseYear);
}

/**
 * Get console IDs
 */
export function getConsoleIds(): string[] {
	return Object.keys(CONSOLE_DATA);
}

/**
 * Get a specific console by ID
 */
export function getConsole(consoleId: string): ConsoleData | null {
	return CONSOLE_DATA[consoleId] || null;
}

/**
 * Get consoles filtered by manufacturer
 */
export function getConsolesByManufacturer(manufacturer: string): ConsoleData[] {
	return getConsoles().filter(
		(c) => c.manufacturer.toLowerCase() === manufacturer.toLowerCase()
	);
}

/**
 * Get consoles filtered by type
 */
export function getConsolesByType(type: 'home' | 'handheld' | 'hybrid'): ConsoleData[] {
	return getConsoles().filter((c) => c.type === type);
}

/**
 * Get all games for a specific console
 */
export function getGamesForConsole(consoleId: string): GameEntry[] {
	const console = CONSOLE_DATA[consoleId];
	return console?.games || [];
}

/**
 * Get all games across all consoles (with console info attached)
 */
export interface GameWithConsole extends GameEntry {
	consoleId: string;
	consoleName: string;
	consoleManufacturer: string;
}

export function getAllGames(): GameWithConsole[] {
	const games: GameWithConsole[] = [];

	for (const [consoleId, consoleData] of Object.entries(CONSOLE_DATA)) {
		for (const game of consoleData.games) {
			games.push({
				...game,
				consoleId,
				consoleName: consoleData.name,
				consoleManufacturer: consoleData.manufacturer
			});
		}
	}

	// Sort by copies sold descending
	return games.sort((a, b) => b.copies - a.copies);
}

/**
 * Search games by title across all consoles
 */
export function searchGames(query: string, consoleId?: string): GameWithConsole[] {
	const lowerQuery = query.toLowerCase();
	let games = getAllGames();

	if (consoleId) {
		games = games.filter((g) => g.consoleId === consoleId);
	}

	return games.filter((g) => g.title.toLowerCase().includes(lowerQuery));
}

/**
 * Get total game count
 */
export function getTotalGameCount(): number {
	return Object.values(CONSOLE_DATA).reduce((sum, c) => sum + c.games.length, 0);
}

/**
 * Get manufacturer badge class
 */
export function getManufacturerBadgeClass(manufacturer: string): string {
	switch (manufacturer.toLowerCase()) {
		case 'sony':
			return 'badge-primary';
		case 'nintendo':
			return 'badge-error';
		case 'microsoft':
			return 'badge-success';
		default:
			return 'badge-ghost';
	}
}

/**
 * Get console type badge class
 */
export function getConsoleTypeBadgeClass(type: 'home' | 'handheld' | 'hybrid'): string {
	switch (type) {
		case 'home':
			return 'badge-secondary';
		case 'handheld':
			return 'badge-accent';
		case 'hybrid':
			return 'badge-warning';
		default:
			return 'badge-ghost';
	}
}

/**
 * Format copies sold for display
 */
export function formatCopiesSold(copies: number): string {
	if (copies >= 1) {
		return `${copies.toFixed(2)}M`;
	}
	return `${(copies * 1000).toFixed(0)}K`;
}
