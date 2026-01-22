import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { AniListCharactersResponse } from '../../../../../admin/sources/sources.types';

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

const CHARACTERS_QUERY = `
query ($id: Int!, $page: Int, $perPage: Int) {
  Media(id: $id, type: ANIME) {
    characters(page: $page, perPage: $perPage, sort: [ROLE, RELEVANCE]) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
      }
      edges {
        node {
          id
          name {
            full
            native
          }
          image {
            large
            medium
          }
          description
          gender
          age
        }
        role
        voiceActors(language: JAPANESE, sort: [RELEVANCE]) {
          id
          name {
            full
            native
          }
          image {
            large
            medium
          }
          languageV2
        }
      }
    }
  }
}
`;

type CharacterEdge = AniListCharactersResponse['data']['Media']['characters']['edges'][0];

async function fetchCharactersPage(
	animeId: number,
	page: number,
	perPage: number
): Promise<AniListCharactersResponse> {
	const response = await fetch(ANILIST_ENDPOINT, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json'
		},
		body: JSON.stringify({
			query: CHARACTERS_QUERY,
			variables: { id: animeId, page, perPage }
		})
	});

	if (!response.ok) {
		throw new Error(`AniList API error: ${response.status} ${response.statusText}`);
	}

	return response.json();
}

async function fetchAllCharacters(animeId: number): Promise<AniListCharactersResponse> {
	const perPage = 25;
	let page = 1;
	let allEdges: CharacterEdge[] = [];
	let lastPageInfo = null;

	// Fetch all pages
	while (true) {
		const result = await fetchCharactersPage(animeId, page, perPage);

		if (!result.data?.Media?.characters) {
			break;
		}

		const { edges, pageInfo } = result.data.Media.characters;
		allEdges = allEdges.concat(edges);
		lastPageInfo = pageInfo;

		if (!pageInfo.hasNextPage) {
			break;
		}

		page++;

		// Safety limit to prevent infinite loops (max 400 characters)
		if (page > 16) {
			break;
		}
	}

	// Return combined result
	return {
		data: {
			Media: {
				characters: {
					pageInfo: lastPageInfo || {
						total: allEdges.length,
						currentPage: 1,
						lastPage: 1,
						hasNextPage: false
					},
					edges: allEdges
				}
			}
		}
	};
}

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const animeId = parseInt(params.id, 10);

		if (isNaN(animeId)) {
			return json({ error: 'Invalid anime ID' }, { status: 400 });
		}

		// Check if client wants all pages or just one
		const fetchAll = url.searchParams.get('all') === 'true';

		if (fetchAll) {
			const result = await fetchAllCharacters(animeId);
			return json(result);
		}

		// Single page fetch (for backward compatibility)
		const page = parseInt(url.searchParams.get('page') || '1', 10);
		const perPage = parseInt(url.searchParams.get('perPage') || '25', 10);
		const result = await fetchCharactersPage(animeId, page, perPage);

		return json(result);
	} catch (err) {
		console.error('AniList characters fetch error:', err);
		return json(
			{ error: err instanceof Error ? err.message : 'An unexpected error occurred' },
			{ status: 500 }
		);
	}
};
