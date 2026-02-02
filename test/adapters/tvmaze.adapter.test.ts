import { describe, it, expect } from 'vitest';
import {
	tvmazeAdapter,
	type TVMazeShowResult,
	type TVMazeEpisodeResult,
	type TVMazeCastResult,
	type TVMazeSearchResult
} from '$adapters/classes/tvmaze.adapter';

describe('tvmaze.adapter', () => {
	describe('fromApi', () => {
		it('should transform TVMaze show to TVShow', () => {
			const apiData: TVMazeShowResult = {
				id: 169,
				url: 'https://www.tvmaze.com/shows/169/breaking-bad',
				name: 'Breaking Bad',
				type: 'Scripted',
				language: 'English',
				genres: ['Drama', 'Crime', 'Thriller'],
				status: 'Ended',
				runtime: 60,
				premiered: '2008-01-20',
				ended: '2013-09-29',
				officialSite: 'http://www.amc.com/shows/breaking-bad',
				schedule: { time: '21:00', days: ['Sunday'] },
				rating: { average: 9.3 },
				network: { id: 20, name: 'AMC', country: { name: 'United States', code: 'US', timezone: 'America/New_York' } },
				externals: { tvrage: 18164, thetvdb: 81189, imdb: 'tt0903747' },
				image: { medium: 'https://example.com/medium.jpg', original: 'https://example.com/original.jpg' },
				summary: '<p>A high school chemistry teacher.</p>'
			};

			const tvShow = tvmazeAdapter.fromApi(apiData);

			expect(tvShow.id).toBe('169');
			expect(tvShow.name).toBe('Breaking Bad');
			expect(tvShow.status).toBe('Ended');
			expect(tvShow.premiered).toBe('2008-01-20');
			expect(tvShow.ended).toBe('2013-09-29');
			expect(tvShow.genres).toEqual(['Drama', 'Crime', 'Thriller']);
			expect(tvShow.rating).toBe(9.3);
			expect(tvShow.image).toBe('https://example.com/original.jpg');
			expect(tvShow.summary).toBe('A high school chemistry teacher.');
			expect(tvShow.network).toBe('AMC');
			expect(tvShow.schedule).toEqual({ time: '21:00', days: ['Sunday'] });
			expect(tvShow.imdbId).toBe('tt0903747');
			expect(tvShow.tvdbId).toBe(81189);
			expect(tvShow.tvRageId).toBe(18164);
		});

		it('should strip HTML from summary', () => {
			const apiData: TVMazeShowResult = {
				id: 1,
				name: 'Test Show',
				summary: '<p>A <b>bold</b> description with <a href="#">links</a>.</p>'
			};

			const tvShow = tvmazeAdapter.fromApi(apiData);

			expect(tvShow.summary).toBe('A bold description with links.');
		});

		it('should prefer original image over medium', () => {
			const apiData: TVMazeShowResult = {
				id: 1,
				name: 'Test Show',
				image: { medium: 'medium.jpg', original: 'original.jpg' }
			};

			const tvShow = tvmazeAdapter.fromApi(apiData);

			expect(tvShow.image).toBe('original.jpg');
		});

		it('should fall back to medium image', () => {
			const apiData: TVMazeShowResult = {
				id: 1,
				name: 'Test Show',
				image: { medium: 'medium.jpg' }
			};

			const tvShow = tvmazeAdapter.fromApi(apiData);

			expect(tvShow.image).toBe('medium.jpg');
		});

		it('should handle webChannel instead of network', () => {
			const apiData: TVMazeShowResult = {
				id: 1,
				name: 'Streaming Show',
				webChannel: { id: 1, name: 'Netflix' }
			};

			const tvShow = tvmazeAdapter.fromApi(apiData);

			expect(tvShow.network).toBe('Netflix');
		});

		it('should normalize status values', () => {
			const running: TVMazeShowResult = { id: 1, name: 'Show', status: 'Running' };
			const ended: TVMazeShowResult = { id: 2, name: 'Show', status: 'Ended' };
			const tbd: TVMazeShowResult = { id: 3, name: 'Show', status: 'To Be Determined' };
			const inDev: TVMazeShowResult = { id: 4, name: 'Show', status: 'In Development' };
			const unknown: TVMazeShowResult = { id: 5, name: 'Show', status: 'Unknown' };

			expect(tvmazeAdapter.fromApi(running).status).toBe('Running');
			expect(tvmazeAdapter.fromApi(ended).status).toBe('Ended');
			expect(tvmazeAdapter.fromApi(tbd).status).toBe('To Be Determined');
			expect(tvmazeAdapter.fromApi(inDev).status).toBe('In Development');
			expect(tvmazeAdapter.fromApi(unknown).status).toBe('Unknown');
		});

		it('should handle missing optional fields', () => {
			const apiData: TVMazeShowResult = {
				id: 1,
				name: 'Minimal Show'
			};

			const tvShow = tvmazeAdapter.fromApi(apiData);

			expect(tvShow.id).toBe('1');
			expect(tvShow.name).toBe('Minimal Show');
			expect(tvShow.genres).toEqual([]);
			expect(tvShow.rating).toBeUndefined();
			expect(tvShow.image).toBeUndefined();
			expect(tvShow.summary).toBeUndefined();
		});
	});

	describe('fromEpisode', () => {
		it('should transform TVMaze episode to TVEpisode', () => {
			const apiData: TVMazeEpisodeResult = {
				id: 1,
				url: 'https://www.tvmaze.com/episodes/1',
				name: 'Pilot',
				season: 1,
				number: 1,
				airdate: '2008-01-20',
				airtime: '21:00',
				runtime: 58,
				rating: { average: 8.5 },
				image: { medium: 'medium.jpg', original: 'original.jpg' },
				summary: '<p>Episode summary.</p>'
			};

			const episode = tvmazeAdapter.fromEpisode(apiData, 169);

			expect(episode.id).toBe('1');
			expect(episode.showId).toBe('169');
			expect(episode.season).toBe(1);
			expect(episode.episode).toBe(1);
			expect(episode.name).toBe('Pilot');
			expect(episode.airdate).toBe('2008-01-20');
			expect(episode.runtime).toBe(58);
			expect(episode.image).toBe('original.jpg');
			expect(episode.summary).toBe('Episode summary.');
			expect(episode.rating).toBe(8.5);
		});
	});

	describe('fromCast', () => {
		it('should transform TVMaze cast to CastMember', () => {
			const apiData: TVMazeCastResult = {
				person: {
					id: 17052,
					name: 'Bryan Cranston',
					birthday: '1956-03-07',
					gender: 'Male',
					image: { medium: 'medium.jpg', original: 'original.jpg' }
				},
				character: {
					id: 1,
					name: 'Walter White',
					image: { medium: 'char_medium.jpg' }
				}
			};

			const cast = tvmazeAdapter.fromCast(apiData);

			expect(cast.id).toBe('17052');
			expect(cast.name).toBe('Bryan Cranston');
			expect(cast.character).toBe('Walter White');
			expect(cast.image).toBe('original.jpg');
		});
	});

	describe('fromSearchResult', () => {
		it('should transform search result wrapper', () => {
			const result: TVMazeSearchResult = {
				score: 0.95,
				show: {
					id: 169,
					name: 'Breaking Bad',
					status: 'Ended'
				}
			};

			const tvShow = tvmazeAdapter.fromSearchResult(result);

			expect(tvShow.id).toBe('169');
			expect(tvShow.name).toBe('Breaking Bad');
		});
	});

	describe('batch transformations', () => {
		it('should transform array of episodes', () => {
			const episodes: TVMazeEpisodeResult[] = [
				{ id: 1, name: 'Episode 1', season: 1, number: 1 },
				{ id: 2, name: 'Episode 2', season: 1, number: 2 }
			];

			const result = tvmazeAdapter.fromEpisodeMany(episodes, 100);

			expect(result).toHaveLength(2);
			expect(result[0].showId).toBe('100');
			expect(result[1].episode).toBe(2);
		});

		it('should transform array of cast members', () => {
			const cast: TVMazeCastResult[] = [
				{ person: { id: 1, name: 'Actor 1' }, character: { id: 1, name: 'Char 1' } },
				{ person: { id: 2, name: 'Actor 2' }, character: { id: 2, name: 'Char 2' } }
			];

			const result = tvmazeAdapter.fromCastMany(cast);

			expect(result).toHaveLength(2);
			expect(result[0].name).toBe('Actor 1');
			expect(result[1].character).toBe('Char 2');
		});

		it('should transform array of search results', () => {
			const results: TVMazeSearchResult[] = [
				{ score: 0.9, show: { id: 1, name: 'Show 1' } },
				{ score: 0.8, show: { id: 2, name: 'Show 2' } }
			];

			const shows = tvmazeAdapter.fromSearchResults(results);

			expect(shows).toHaveLength(2);
			expect(shows[0].name).toBe('Show 1');
			expect(shows[1].name).toBe('Show 2');
		});
	});

	describe('toDisplayFormat', () => {
		it('should format show with premiere year', () => {
			const show = {
				id: '1',
				name: 'Breaking Bad',
				premiered: '2008-01-20',
				genres: [],
				status: 'Ended' as const
			};

			const display = tvmazeAdapter.toDisplayFormat(show);

			expect(display).toBe('Breaking Bad (2008)');
		});

		it('should show TBA for unknown premiere', () => {
			const show = {
				id: '1',
				name: 'New Show',
				genres: [],
				status: 'In Development' as const
			};

			const display = tvmazeAdapter.toDisplayFormat(show);

			expect(display).toBe('New Show (TBA)');
		});
	});
});
