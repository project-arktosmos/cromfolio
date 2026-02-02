/**
 * TheSportsDB Adapter
 *
 * Transforms TheSportsDB API responses to internal Team, Player, and League types.
 * TheSportsDB provides sports data including teams, players, events, and leagues.
 */

import { AdapterClass } from './adapter.class';
import type { Team, Player, League, SportsEvent, Season } from '$types/sports.type';

// ============================================================================
// TheSportsDB API Types
// ============================================================================

/**
 * TheSportsDB team result
 */
export interface TSDBTeamResult {
	idTeam: string;
	strTeam: string;
	strTeamShort?: string;
	strAlternate?: string;
	strSport: string;
	idLeague?: string;
	strLeague?: string;
	strCountry?: string;
	strCity?: string;
	strStadium?: string;
	intStadiumCapacity?: string;
	intFormedYear?: string;
	strTeamBadge?: string;
	strTeamJersey?: string;
	strTeamBanner?: string;
	strDescriptionEN?: string;
	strWebsite?: string;
	strFacebook?: string;
	strTwitter?: string;
	strInstagram?: string;
	strYoutube?: string;
	strColour1?: string;
	strColour2?: string;
}

/**
 * TheSportsDB player result
 */
export interface TSDBPlayerResult {
	idPlayer: string;
	strPlayer: string;
	strNationality?: string;
	strPosition?: string;
	idTeam?: string;
	strTeam?: string;
	dateBorn?: string;
	strBirthLocation?: string;
	strHeight?: string;
	strWeight?: string;
	strThumb?: string;
	strCutout?: string;
	strRender?: string;
	strBanner?: string;
	strDescriptionEN?: string;
	strGender?: string;
	strSport?: string;
	strFacebook?: string;
	strTwitter?: string;
	strInstagram?: string;
	strYoutube?: string;
}

/**
 * TheSportsDB league result
 */
export interface TSDBLeagueResult {
	idLeague: string;
	strLeague: string;
	strLeagueAlternate?: string;
	strSport: string;
	strCountry?: string;
	intFormedYear?: string;
	strCurrentSeason?: string;
	dateFirstEvent?: string;
	strBadge?: string;
	strLogo?: string;
	strTrophy?: string;
	strBanner?: string;
	strPoster?: string;
	strFanart1?: string;
	strFanart2?: string;
	strFanart3?: string;
	strFanart4?: string;
	strDescriptionEN?: string;
	strWebsite?: string;
	strFacebook?: string;
	strTwitter?: string;
	strYoutube?: string;
}

/**
 * TheSportsDB event result
 */
export interface TSDBEventResult {
	idEvent: string;
	strEvent: string;
	strSport: string;
	idLeague?: string;
	strSeason?: string;
	intRound?: string;
	idHomeTeam?: string;
	strHomeTeam?: string;
	idAwayTeam?: string;
	strAwayTeam?: string;
	intHomeScore?: string;
	intAwayScore?: string;
	dateEvent?: string;
	strTime?: string;
	strVenue?: string;
	strCity?: string;
	strCountry?: string;
	strThumb?: string;
	strVideo?: string;
	strStatus?: string;
}

/**
 * TheSportsDB season result
 */
export interface TSDBSeasonResult {
	strSeason: string;
}

// ============================================================================
// Adapter Implementation
// ============================================================================

class TheSportsDBAdapter extends AdapterClass<TSDBTeamResult, Team> {
	constructor() {
		super('thesportsdb');
	}

	/**
	 * Transform TheSportsDB team to internal Team format
	 */
	fromApi(apiData: TSDBTeamResult): Team {
		return {
			id: apiData.idTeam,
			name: apiData.strTeam,
			shortName: apiData.strTeamShort,
			alternateName: apiData.strAlternate,
			sport: apiData.strSport,
			leagueId: apiData.idLeague,
			leagueName: apiData.strLeague,
			country: apiData.strCountry,
			city: apiData.strCity,
			stadium: apiData.strStadium,
			stadiumCapacity: this.parseNumber(apiData.intStadiumCapacity),
			formedYear: this.parseNumber(apiData.intFormedYear),
			badge: apiData.strTeamBadge,
			jersey: apiData.strTeamJersey,
			banner: apiData.strTeamBanner,
			description: apiData.strDescriptionEN,
			website: this.normalizeUrl(apiData.strWebsite),
			facebook: apiData.strFacebook,
			twitter: apiData.strTwitter,
			instagram: apiData.strInstagram,
			youtube: apiData.strYoutube,
			primaryColor: apiData.strColour1,
			secondaryColor: apiData.strColour2,
			sportsDbId: apiData.idTeam
		};
	}

	/**
	 * Transform TheSportsDB player to internal Player format
	 */
	fromPlayer(apiData: TSDBPlayerResult): Player {
		return {
			id: apiData.idPlayer,
			name: apiData.strPlayer,
			nationality: apiData.strNationality,
			position: apiData.strPosition,
			teamId: apiData.idTeam,
			teamName: apiData.strTeam,
			birthDate: apiData.dateBorn,
			birthPlace: apiData.strBirthLocation,
			height: apiData.strHeight,
			weight: apiData.strWeight,
			photo: apiData.strThumb,
			thumbUrl: apiData.strThumb,
			cutoutUrl: apiData.strCutout,
			renderUrl: apiData.strRender,
			bannerUrl: apiData.strBanner,
			description: apiData.strDescriptionEN,
			gender: this.normalizeGender(apiData.strGender),
			sport: apiData.strSport,
			facebook: apiData.strFacebook,
			twitter: apiData.strTwitter,
			instagram: apiData.strInstagram,
			youtube: apiData.strYoutube,
			sportsDbId: apiData.idPlayer
		};
	}

	/**
	 * Transform TheSportsDB league to internal League format
	 */
	fromLeague(apiData: TSDBLeagueResult): League {
		const fanart = [
			apiData.strFanart1,
			apiData.strFanart2,
			apiData.strFanart3,
			apiData.strFanart4
		].filter((f): f is string => !!f);

		return {
			id: apiData.idLeague,
			name: apiData.strLeague,
			alternateName: apiData.strLeagueAlternate,
			sport: apiData.strSport,
			country: apiData.strCountry,
			formedYear: this.parseNumber(apiData.intFormedYear),
			currentSeason: apiData.strCurrentSeason,
			firstEventDate: apiData.dateFirstEvent,
			badge: apiData.strBadge,
			logo: apiData.strLogo,
			trophy: apiData.strTrophy,
			banner: apiData.strBanner,
			poster: apiData.strPoster,
			fanart: fanart.length > 0 ? fanart : undefined,
			description: apiData.strDescriptionEN,
			website: this.normalizeUrl(apiData.strWebsite),
			facebook: apiData.strFacebook,
			twitter: apiData.strTwitter,
			youtube: apiData.strYoutube,
			sportsDbId: apiData.idLeague
		};
	}

	/**
	 * Transform TheSportsDB event to internal SportsEvent format
	 */
	fromEvent(apiData: TSDBEventResult): SportsEvent {
		return {
			id: apiData.idEvent,
			name: apiData.strEvent,
			sport: apiData.strSport,
			leagueId: apiData.idLeague,
			season: apiData.strSeason,
			round: apiData.intRound,
			homeTeamId: apiData.idHomeTeam,
			homeTeamName: apiData.strHomeTeam,
			awayTeamId: apiData.idAwayTeam,
			awayTeamName: apiData.strAwayTeam,
			homeScore: this.parseNumber(apiData.intHomeScore),
			awayScore: this.parseNumber(apiData.intAwayScore),
			eventDate: apiData.dateEvent,
			eventTime: apiData.strTime,
			venue: apiData.strVenue,
			city: apiData.strCity,
			country: apiData.strCountry,
			thumbnail: apiData.strThumb,
			video: apiData.strVideo,
			status: this.normalizeEventStatus(apiData.strStatus)
		};
	}

	/**
	 * Transform TheSportsDB season to internal Season format
	 */
	fromSeason(apiData: TSDBSeasonResult, leagueId: string): Season {
		const year = this.extractYear(apiData.strSeason);
		return {
			id: `${leagueId}-${apiData.strSeason}`,
			leagueId,
			name: apiData.strSeason,
			year
		};
	}

	/**
	 * Format team for display
	 */
	toDisplayFormat(team: Team): string {
		if (team.city) {
			return `${team.name} (${team.city})`;
		}
		return team.name;
	}

	// ========================================================================
	// Batch Transformations
	// ========================================================================

	fromPlayerMany(apiDataArray: TSDBPlayerResult[]): Player[] {
		return apiDataArray.map((item) => this.fromPlayer(item));
	}

	fromLeagueMany(apiDataArray: TSDBLeagueResult[]): League[] {
		return apiDataArray.map((item) => this.fromLeague(item));
	}

	fromEventMany(apiDataArray: TSDBEventResult[]): SportsEvent[] {
		return apiDataArray.map((item) => this.fromEvent(item));
	}

	fromSeasonMany(apiDataArray: TSDBSeasonResult[], leagueId: string): Season[] {
		return apiDataArray.map((item) => this.fromSeason(item, leagueId));
	}

	// ========================================================================
	// Private Helpers
	// ========================================================================

	private parseNumber(value?: string): number | undefined {
		if (!value) {
			return undefined;
		}
		const parsed = parseInt(value, 10);
		return isNaN(parsed) ? undefined : parsed;
	}

	private normalizeUrl(url?: string): string | undefined {
		if (!url) {
			return undefined;
		}
		if (url.startsWith('http://') || url.startsWith('https://')) {
			return url;
		}
		return `https://${url}`;
	}

	private normalizeGender(gender?: string): Player['gender'] {
		if (!gender) {
			return undefined;
		}
		const g = gender.toLowerCase();
		if (g === 'male' || g === 'm') {
			return 'Male';
		}
		if (g === 'female' || g === 'f') {
			return 'Female';
		}
		return undefined;
	}

	private normalizeEventStatus(status?: string): SportsEvent['status'] {
		if (!status) {
			return undefined;
		}
		const statusLower = status.toLowerCase();
		const statusMap: Record<string, SportsEvent['status']> = {
			'match finished': 'Finished',
			finished: 'Finished',
			ft: 'Finished',
			scheduled: 'Scheduled',
			'not started': 'Scheduled',
			ns: 'Scheduled',
			'in progress': 'In Progress',
			live: 'In Progress',
			postponed: 'Postponed',
			cancelled: 'Cancelled',
			canceled: 'Cancelled'
		};
		return statusMap[statusLower] || (status as SportsEvent['status']);
	}

	private extractYear(season: string): number | undefined {
		// Handle formats like "2023", "2023-2024", "2023/24"
		const match = season.match(/^(\d{4})/);
		return match ? parseInt(match[1], 10) : undefined;
	}
}

export const thesportsdbAdapter = new TheSportsDBAdapter();
