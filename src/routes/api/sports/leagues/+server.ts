import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	searchLeagues,
	getLeagueById,
	getAllLeagues,
	isTheSportsDBConfigured
} from '$services/thesportsdb.service';

export const GET: RequestHandler = async ({ url }) => {
	const leagueId = url.searchParams.get('id');
	const country = url.searchParams.get('country');
	const all = url.searchParams.get('all');

	if (!isTheSportsDBConfigured()) {
		return json({ error: 'TheSportsDB API not configured.' }, { status: 503 });
	}

	try {
		// Get league by ID
		if (leagueId) {
			const result = await getLeagueById(leagueId);
			return json(result);
		}

		// Get all leagues (for dropdown)
		if (all === 'true') {
			const result = await getAllLeagues();
			return json(result);
		}

		// Search leagues by country
		const result = await searchLeagues(country || undefined);
		return json(result);
	} catch (error) {
		console.error('[api/sports/leagues] Error:', error);
		return json({ error: 'Failed to fetch leagues' }, { status: 500 });
	}
};
