/**
 * TheSportsDB Service
 * Provides functions for searching sports teams, leagues, and players via TheSportsDB API
 *
 * Requires THESPORTSDB_API_KEY environment variable to be set
 * Get a free API key at: https://www.thesportsdb.com/free_sports_api
 * Free test key: 3 (with watermarks) or $1/month Patreon for full access
 */

import { env } from '$env/dynamic/private';

const THESPORTSDB_BASE_URL = 'https://www.thesportsdb.com/api/v1/json';

function getApiKey(): string {
	// Default to free test key if not configured
	return env.THESPORTSDB_API_KEY || '123';
}

export interface SportsDBTeam {
	idTeam: string;
	strTeam: string;
	strTeamShort: string | null;
	strAlternate: string | null;
	intFormedYear: string | null;
	strSport: string;
	strLeague: string;
	idLeague: string;
	strStadium: string | null;
	strStadiumThumb: string | null;
	strStadiumLocation: string | null;
	intStadiumCapacity: string | null;
	strWebsite: string | null;
	strBadge: string | null;
	strJersey: string | null;
	strLogo: string | null;
	strBanner: string | null;
	strDescriptionEN: string | null;
	strCountry: string | null;
}

export interface SportsDBLeague {
	idLeague: string;
	strLeague: string;
	strSport: string;
	strLeagueAlternate: string | null;
	intFormedYear: string | null;
	strCountry: string | null;
	strWebsite: string | null;
	strDescriptionEN: string | null;
	strBadge: string | null;
	strLogo: string | null;
	strBanner: string | null;
	strPoster: string | null;
	strTrophy: string | null;
	strFanart1: string | null;
	strFanart2: string | null;
	strFanart3: string | null;
	strFanart4: string | null;
}

export interface SportsDBPlayer {
	idPlayer: string;
	strPlayer: string;
	strNationality: string | null;
	strTeam: string | null;
	idTeam: string | null;
	strSport: string;
	strPosition: string | null;
	strNumber: string | null;
	strHeight: string | null;
	strWeight: string | null;
	dateBorn: string | null;
	strDescriptionEN: string | null;
	strThumb: string | null;
	strCutout: string | null;
	strRender: string | null;
	strBanner: string | null;
	strFanart1: string | null;
	strFanart2: string | null;
	strFanart3: string | null;
	strFanart4: string | null;
}

export interface SportsDBSearchTeamsResponse {
	teams: SportsDBTeam[] | null;
}

export interface SportsDBSearchLeaguesResponse {
	countrys?: SportsDBLeague[] | null;
	leagues?: SportsDBLeague[] | null;
}

export interface SportsDBSearchPlayersResponse {
	player: SportsDBPlayer[] | null;
}

export interface SportsDBAllLeaguesResponse {
	leagues: Array<{
		idLeague: string;
		strLeague: string;
		strSport: string;
		strLeagueAlternate: string | null;
	}> | null;
}

/**
 * Check if TheSportsDB API key is configured (always returns true as free key available)
 */
export function isTheSportsDBConfigured(): boolean {
	return true; // Free test key is always available
}

/**
 * Search teams by name
 */
export async function searchTeams(
	query: string
): Promise<SportsDBSearchTeamsResponse | { error: string }> {
	const apiKey = getApiKey();

	try {
		const response = await fetch(
			`${THESPORTSDB_BASE_URL}/${apiKey}/searchteams.php?t=${encodeURIComponent(query)}`
		);

		if (!response.ok) {
			throw new Error(`TheSportsDB API error: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('[thesportsdb.service] searchTeams error:', error);
		return { error: 'Failed to search teams' };
	}
}

/**
 * Get team details by ID
 */
export async function getTeamById(
	teamId: string
): Promise<SportsDBSearchTeamsResponse | { error: string }> {
	const apiKey = getApiKey();

	try {
		const response = await fetch(`${THESPORTSDB_BASE_URL}/${apiKey}/lookupteam.php?id=${teamId}`);

		if (!response.ok) {
			throw new Error(`TheSportsDB API error: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('[thesportsdb.service] getTeamById error:', error);
		return { error: 'Failed to get team details' };
	}
}

/**
 * Get all teams in a league
 */
export async function getTeamsByLeague(
	leagueName: string
): Promise<SportsDBSearchTeamsResponse | { error: string }> {
	const apiKey = getApiKey();

	try {
		const response = await fetch(
			`${THESPORTSDB_BASE_URL}/${apiKey}/search_all_teams.php?l=${encodeURIComponent(leagueName)}`
		);

		if (!response.ok) {
			throw new Error(`TheSportsDB API error: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('[thesportsdb.service] getTeamsByLeague error:', error);
		return { error: 'Failed to get teams by league' };
	}
}

/**
 * Search leagues by country or name
 */
export async function searchLeagues(
	country?: string
): Promise<SportsDBSearchLeaguesResponse | { error: string }> {
	const apiKey = getApiKey();

	try {
		let url: string;
		if (country) {
			url = `${THESPORTSDB_BASE_URL}/${apiKey}/search_all_leagues.php?c=${encodeURIComponent(country)}`;
		} else {
			url = `${THESPORTSDB_BASE_URL}/${apiKey}/all_leagues.php`;
		}

		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`TheSportsDB API error: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('[thesportsdb.service] searchLeagues error:', error);
		return { error: 'Failed to search leagues' };
	}
}

/**
 * Get league details by ID
 */
export async function getLeagueById(
	leagueId: string
): Promise<{ leagues: SportsDBLeague[] | null } | { error: string }> {
	const apiKey = getApiKey();

	try {
		const response = await fetch(
			`${THESPORTSDB_BASE_URL}/${apiKey}/lookupleague.php?id=${leagueId}`
		);

		if (!response.ok) {
			throw new Error(`TheSportsDB API error: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('[thesportsdb.service] getLeagueById error:', error);
		return { error: 'Failed to get league details' };
	}
}

/**
 * Get all leagues (for dropdown/autocomplete)
 */
export async function getAllLeagues(): Promise<SportsDBAllLeaguesResponse | { error: string }> {
	const apiKey = getApiKey();

	try {
		const response = await fetch(`${THESPORTSDB_BASE_URL}/${apiKey}/all_leagues.php`);

		if (!response.ok) {
			throw new Error(`TheSportsDB API error: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('[thesportsdb.service] getAllLeagues error:', error);
		return { error: 'Failed to get all leagues' };
	}
}

/**
 * Search players by name
 */
export async function searchPlayers(
	query: string
): Promise<SportsDBSearchPlayersResponse | { error: string }> {
	const apiKey = getApiKey();

	try {
		const response = await fetch(
			`${THESPORTSDB_BASE_URL}/${apiKey}/searchplayers.php?p=${encodeURIComponent(query)}`
		);

		if (!response.ok) {
			throw new Error(`TheSportsDB API error: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('[thesportsdb.service] searchPlayers error:', error);
		return { error: 'Failed to search players' };
	}
}

/**
 * Get all players in a team
 */
export async function getPlayersByTeam(
	teamId: string
): Promise<SportsDBSearchPlayersResponse | { error: string }> {
	const apiKey = getApiKey();

	try {
		const response = await fetch(
			`${THESPORTSDB_BASE_URL}/${apiKey}/lookup_all_players.php?id=${teamId}`
		);

		if (!response.ok) {
			throw new Error(`TheSportsDB API error: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('[thesportsdb.service] getPlayersByTeam error:', error);
		return { error: 'Failed to get players by team' };
	}
}

/**
 * Get player details by ID
 */
export async function getPlayerById(
	playerId: string
): Promise<{ players: SportsDBPlayer[] | null } | { error: string }> {
	const apiKey = getApiKey();

	try {
		const response = await fetch(
			`${THESPORTSDB_BASE_URL}/${apiKey}/lookupplayer.php?id=${playerId}`
		);

		if (!response.ok) {
			throw new Error(`TheSportsDB API error: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('[thesportsdb.service] getPlayerById error:', error);
		return { error: 'Failed to get player details' };
	}
}
