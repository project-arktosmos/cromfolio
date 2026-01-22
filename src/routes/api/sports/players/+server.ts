import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	searchPlayers,
	getPlayerById,
	getPlayersByTeam,
	isTheSportsDBConfigured
} from '$services/thesportsdb.service';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('search');
	const playerId = url.searchParams.get('id');
	const teamId = url.searchParams.get('team');

	if (!isTheSportsDBConfigured()) {
		return json(
			{ error: 'TheSportsDB API not configured.' },
			{ status: 503 }
		);
	}

	try {
		// Get player by ID
		if (playerId) {
			const result = await getPlayerById(playerId);
			return json(result);
		}

		// Get all players in a team
		if (teamId) {
			const result = await getPlayersByTeam(teamId);
			return json(result);
		}

		// Search players by name
		if (query) {
			const result = await searchPlayers(query);
			return json(result);
		}

		return json(
			{ error: 'Provide search, id, or team parameter' },
			{ status: 400 }
		);
	} catch (error) {
		console.error('[api/sports/players] Error:', error);
		return json({ error: 'Failed to fetch players' }, { status: 500 });
	}
};
