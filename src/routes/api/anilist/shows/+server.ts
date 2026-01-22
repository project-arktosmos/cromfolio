import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { AniListShowSearchResponse } from '../../../admin/sources/sources.types';

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

const SHOW_SEARCH_QUERY = `
query ($search: String!, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
      perPage
    }
    media(search: $search, type: ANIME) {
      id
      title {
        romaji
        english
      }
      coverImage {
        large
        medium
      }
      bannerImage
      description
      startDate {
        year
        month
        day
      }
      season
      seasonYear
      format
      status
      episodes
      genres
      averageScore
      popularity
      favourites
      studios(isMain: true) {
        nodes {
          id
          name
        }
      }
    }
  }
}
`;

async function fetchFromAniList(
	search: string,
	page: number,
	perPage: number
): Promise<AniListShowSearchResponse> {
	const response = await fetch(ANILIST_ENDPOINT, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json'
		},
		body: JSON.stringify({
			query: SHOW_SEARCH_QUERY,
			variables: { search, page, perPage }
		})
	});

	if (!response.ok) {
		throw new Error(`AniList API error: ${response.status} ${response.statusText}`);
	}

	return response.json();
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { search, page = 1, perPage = 12 } = await request.json();

		if (!search || typeof search !== 'string') {
			return json({ error: 'Search query is required' }, { status: 400 });
		}

		const result = await fetchFromAniList(search.trim(), page, perPage);

		return json(result);
	} catch (err) {
		console.error('AniList shows search error:', err);
		return json(
			{ error: err instanceof Error ? err.message : 'An unexpected error occurred' },
			{ status: 500 }
		);
	}
};
