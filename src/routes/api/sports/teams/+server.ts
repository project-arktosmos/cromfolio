import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	searchTeams,
	getTeamById,
	getTeamsByLeague,
	isTheSportsDBConfigured
} from '$services/thesportsdb.service';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('search');
	const teamId = url.searchParams.get('id');
	const leagueName = url.searchParams.get('league');

	if (!isTheSportsDBConfigured()) {
		return json({ error: 'TheSportsDB API not configured.' }, { status: 503 });
	}

	try {
		// Get team by ID
		if (teamId) {
			const result = await getTeamById(teamId);
			return json(result);
		}

		// Get all teams in a league
		if (leagueName) {
			const result = await getTeamsByLeague(leagueName);
			return json(result);
		}

		// Search teams by name
		if (query) {
			const result = await searchTeams(query);
			return json(result);
		}

		return json({ error: 'Provide search, id, or league parameter' }, { status: 400 });
	} catch (error) {
		console.error('[api/sports/teams] Error:', error);
		return json({ error: 'Failed to fetch teams' }, { status: 500 });
	}
};
