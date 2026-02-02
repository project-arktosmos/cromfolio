/**
 * Sports Types
 *
 * Internal types for teams, players, leagues, and sports content.
 * These are the normalized internal representations used throughout the app.
 */

import type { ID } from './core.type';

/**
 * Sports team representation (normalized from TheSportsDB, etc.)
 */
export interface Team {
	id: string;
	name: string;
	shortName?: string;
	alternateName?: string;
	sport: string;
	leagueId?: ID;
	leagueName?: string;
	country?: string;
	city?: string;
	stadium?: string;
	stadiumCapacity?: number;
	formedYear?: number;
	badge?: string; // logo URL
	jersey?: string; // jersey image URL
	banner?: string; // banner image URL
	description?: string;
	website?: string;
	facebook?: string;
	twitter?: string;
	instagram?: string;
	youtube?: string;
	primaryColor?: string;
	secondaryColor?: string;
	sportsDbId?: string;
}

/**
 * Sports player representation
 */
export interface Player {
	id: string;
	name: string;
	nationality?: string;
	position?: string;
	teamId?: ID;
	teamName?: string;
	birthDate?: string; // ISO date
	birthPlace?: string;
	height?: string;
	weight?: string;
	photo?: string;
	thumbUrl?: string;
	cutoutUrl?: string;
	renderUrl?: string;
	bannerUrl?: string;
	description?: string;
	gender?: 'Male' | 'Female';
	sport?: string;
	facebook?: string;
	twitter?: string;
	instagram?: string;
	youtube?: string;
	sportsDbId?: string;
}

/**
 * Sports league representation
 */
export interface League {
	id: string;
	name: string;
	alternateName?: string;
	sport: string;
	country?: string;
	formedYear?: number;
	currentSeason?: string;
	firstEventDate?: string;
	badge?: string; // logo URL
	logo?: string;
	trophy?: string;
	banner?: string;
	poster?: string;
	fanart?: string[];
	description?: string;
	website?: string;
	facebook?: string;
	twitter?: string;
	youtube?: string;
	sportsDbId?: string;
}

/**
 * Sports event/match representation
 */
export interface SportsEvent {
	id: string;
	name: string;
	sport: string;
	leagueId?: ID;
	season?: string;
	round?: string;
	homeTeamId?: ID;
	homeTeamName?: string;
	awayTeamId?: ID;
	awayTeamName?: string;
	homeScore?: number;
	awayScore?: number;
	eventDate?: string; // ISO date
	eventTime?: string;
	venue?: string;
	city?: string;
	country?: string;
	thumbnail?: string;
	video?: string;
	status?: 'Scheduled' | 'In Progress' | 'Finished' | 'Postponed' | 'Cancelled';
}

/**
 * Sports season representation
 */
export interface Season {
	id: string;
	leagueId: ID;
	name: string;
	year?: number;
	startDate?: string;
	endDate?: string;
}

/**
 * Union type for all sports entities
 */
export type SportsEntity = Team | Player | League;

/**
 * Type guard to check if entity is a Team
 */
export function isTeam(entity: SportsEntity): entity is Team {
	return 'stadium' in entity || 'badge' in entity;
}

/**
 * Type guard to check if entity is a Player
 */
export function isPlayer(entity: SportsEntity): entity is Player {
	return 'position' in entity || 'birthDate' in entity;
}

/**
 * Type guard to check if entity is a League
 */
export function isLeague(entity: SportsEntity): entity is League {
	return 'currentSeason' in entity || 'trophy' in entity;
}
