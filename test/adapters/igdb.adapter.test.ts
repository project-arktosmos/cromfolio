import { describe, it, expect } from 'vitest';
import {
	igdbAdapter,
	type IGDBGameResult,
	type IGDBPlatformResult,
	type IGDBCompanyResult,
	type IGDBGenreResult
} from '$adapters/classes/igdb.adapter';

describe('igdb.adapter', () => {
	describe('fromApi (game)', () => {
		it('should transform IGDB game result to Game', () => {
			const apiData: IGDBGameResult = {
				id: 1942,
				name: 'The Witcher 3: Wild Hunt',
				slug: 'the-witcher-3-wild-hunt',
				summary: 'An open world RPG set in a fantasy universe.',
				storyline: 'Geralt searches for his adopted daughter.',
				first_release_date: 1431993600, // 2015-05-19
				total_rating: 93.5,
				total_rating_count: 5000,
				aggregated_rating: 92.0,
				cover: { id: 123, image_id: 'co1234' },
				platforms: [{ id: 6, name: 'PC', abbreviation: 'PC' }],
				genres: [{ id: 12, name: 'Role-playing (RPG)', slug: 'rpg' }],
				themes: [{ id: 1, name: 'Fantasy', slug: 'fantasy' }],
				game_modes: [{ id: 1, name: 'Single player', slug: 'single-player' }],
				involved_companies: [
					{ id: 1, company: { id: 1, name: 'CD Projekt Red' }, developer: true, publisher: false },
					{ id: 2, company: { id: 2, name: 'CD Projekt' }, developer: false, publisher: true }
				],
				franchises: [{ id: 452, name: 'The Witcher', slug: 'the-witcher' }]
			};

			const game = igdbAdapter.fromApi(apiData);

			expect(game.id).toBe('1942');
			expect(game.name).toBe('The Witcher 3: Wild Hunt');
			expect(game.slug).toBe('the-witcher-3-wild-hunt');
			expect(game.summary).toBe('An open world RPG set in a fantasy universe.');
			expect(game.storyline).toBe('Geralt searches for his adopted daughter.');
			expect(game.releaseDate).toBe('2015-05-19');
			expect(game.rating).toBe(93.5);
			expect(game.aggregatedRating).toBe(92.0);
			expect(game.cover).toBe('https://images.igdb.com/igdb/image/upload/t_cover_big/co1234.jpg');
			expect(game.platforms).toEqual(['PC']);
			expect(game.genres).toEqual(['Role-playing (RPG)']);
			expect(game.themes).toEqual(['Fantasy']);
			expect(game.gameModes).toEqual(['Single player']);
			expect(game.developers).toEqual(['CD Projekt Red']);
			expect(game.publishers).toEqual(['CD Projekt']);
			expect(game.franchises).toEqual(['The Witcher']);
			expect(game.igdbId).toBe(1942);
		});

		it('should handle missing optional fields', () => {
			const apiData: IGDBGameResult = {
				id: 123,
				name: 'Minimal Game'
			};

			const game = igdbAdapter.fromApi(apiData);

			expect(game.id).toBe('123');
			expect(game.name).toBe('Minimal Game');
			expect(game.slug).toBe('minimal-game');
			expect(game.summary).toBeUndefined();
			expect(game.releaseDate).toBeUndefined();
			expect(game.cover).toBeUndefined();
			expect(game.platforms).toEqual([]);
			expect(game.genres).toEqual([]);
		});

		it('should handle cover as number (ID reference)', () => {
			const apiData: IGDBGameResult = {
				id: 123,
				name: 'Game with cover ID',
				cover: 456 // Just the ID, not the full object
			};

			const game = igdbAdapter.fromApi(apiData);

			expect(game.cover).toBeUndefined();
		});

		it('should handle arrays of IDs instead of objects', () => {
			const apiData: IGDBGameResult = {
				id: 123,
				name: 'Game with ID arrays',
				platforms: [6, 48, 49] as unknown as IGDBGameResult['platforms'],
				genres: [12, 31] as unknown as IGDBGameResult['genres']
			};

			const game = igdbAdapter.fromApi(apiData);

			expect(game.platforms).toEqual([]);
			expect(game.genres).toEqual([]);
		});

		it('should fallback to rating if total_rating is missing', () => {
			const apiData: IGDBGameResult = {
				id: 123,
				name: 'Game',
				rating: 85.5,
				rating_count: 100
			};

			const game = igdbAdapter.fromApi(apiData);

			expect(game.rating).toBe(85.5);
			expect(game.ratingCount).toBe(100);
		});
	});

	describe('fromPlatform', () => {
		it('should transform IGDB platform to GamePlatform', () => {
			const apiData: IGDBPlatformResult = {
				id: 6,
				name: 'PC (Microsoft Windows)',
				slug: 'win',
				abbreviation: 'PC',
				generation: 8,
				category: 6,
				platform_logo: { id: 123, image_id: 'pl123' }
			};

			const platform = igdbAdapter.fromPlatform(apiData);

			expect(platform.id).toBe('6');
			expect(platform.name).toBe('PC (Microsoft Windows)');
			expect(platform.slug).toBe('win');
			expect(platform.abbreviation).toBe('PC');
			expect(platform.generation).toBe(8);
			expect(platform.category).toBe('computer');
			expect(platform.logo).toBe('https://images.igdb.com/igdb/image/upload/t_cover_big/pl123.jpg');
		});

		it('should map platform categories', () => {
			const categories = [
				{ category: 1, expected: 'console' },
				{ category: 2, expected: 'arcade' },
				{ category: 3, expected: 'platform' },
				{ category: 4, expected: 'operating_system' },
				{ category: 5, expected: 'portable_console' },
				{ category: 6, expected: 'computer' },
				{ category: 99, expected: undefined }
			];

			categories.forEach(({ category, expected }) => {
				const apiData: IGDBPlatformResult = { id: 1, name: 'Test', category };
				const platform = igdbAdapter.fromPlatform(apiData);
				expect(platform.category).toBe(expected);
			});
		});

		it('should generate slug from name if missing', () => {
			const apiData: IGDBPlatformResult = {
				id: 1,
				name: 'PlayStation 5'
			};

			const platform = igdbAdapter.fromPlatform(apiData);

			expect(platform.slug).toBe('playstation-5');
		});
	});

	describe('fromCompany', () => {
		it('should transform IGDB company to GameCompany', () => {
			const apiData: IGDBCompanyResult = {
				id: 1,
				name: 'CD Projekt Red',
				slug: 'cd-projekt-red',
				description: 'Polish video game developer.',
				logo: { id: 1, image_id: 'cl123' },
				country: 616, // Poland country code
				start_date: 1010102400, // 2002-01-04
				websites: [{ url: 'https://cdprojektred.com', category: 1 }]
			};

			const company = igdbAdapter.fromCompany(apiData);

			expect(company.id).toBe('1');
			expect(company.name).toBe('CD Projekt Red');
			expect(company.slug).toBe('cd-projekt-red');
			expect(company.description).toBe('Polish video game developer.');
			expect(company.logo).toBe('https://images.igdb.com/igdb/image/upload/t_cover_big/cl123.jpg');
			expect(company.country).toBe(616);
			expect(company.startDate).toBe('2002-01-04');
			expect(company.websites).toEqual(['https://cdprojektred.com']);
		});
	});

	describe('fromGenre', () => {
		it('should transform IGDB genre to GameGenre', () => {
			const apiData: IGDBGenreResult = {
				id: 12,
				name: 'Role-playing (RPG)',
				slug: 'rpg'
			};

			const genre = igdbAdapter.fromGenre(apiData);

			expect(genre.id).toBe('12');
			expect(genre.name).toBe('Role-playing (RPG)');
			expect(genre.slug).toBe('rpg');
		});
	});

	describe('batch transformations', () => {
		it('should transform array of platforms', () => {
			const apiArray: IGDBPlatformResult[] = [
				{ id: 1, name: 'PC' },
				{ id: 2, name: 'PlayStation 5' }
			];

			const platforms = igdbAdapter.fromPlatformMany(apiArray);

			expect(platforms).toHaveLength(2);
			expect(platforms[0].name).toBe('PC');
			expect(platforms[1].name).toBe('PlayStation 5');
		});

		it('should transform array of companies', () => {
			const apiArray: IGDBCompanyResult[] = [
				{ id: 1, name: 'Company A' },
				{ id: 2, name: 'Company B' }
			];

			const companies = igdbAdapter.fromCompanyMany(apiArray);

			expect(companies).toHaveLength(2);
		});

		it('should transform array of genres', () => {
			const apiArray: IGDBGenreResult[] = [
				{ id: 1, name: 'RPG', slug: 'rpg' },
				{ id: 2, name: 'Action', slug: 'action' }
			];

			const genres = igdbAdapter.fromGenreMany(apiArray);

			expect(genres).toHaveLength(2);
			expect(genres[0].slug).toBe('rpg');
		});
	});

	describe('toDisplayFormat', () => {
		it('should format game with release year', () => {
			const game = {
				id: '1',
				name: 'The Witcher 3',
				releaseDate: '2015-05-19'
			};

			const display = igdbAdapter.toDisplayFormat(game);

			expect(display).toBe('The Witcher 3 (2015)');
		});

		it('should show TBA for unknown release date', () => {
			const game = {
				id: '1',
				name: 'Upcoming Game'
			};

			const display = igdbAdapter.toDisplayFormat(game);

			expect(display).toBe('Upcoming Game (TBA)');
		});
	});

	describe('edge cases', () => {
		it('should handle special characters in slugify', () => {
			const apiData: IGDBGameResult = {
				id: 123,
				name: "Assassin's Creed: Unity"
			};

			const game = igdbAdapter.fromApi(apiData);

			expect(game.slug).toBe('assassins-creed-unity');
		});

		it('should handle empty arrays', () => {
			const apiData: IGDBGameResult = {
				id: 123,
				name: 'Game',
				platforms: [],
				genres: [],
				themes: [],
				game_modes: [],
				involved_companies: [],
				franchises: []
			};

			const game = igdbAdapter.fromApi(apiData);

			expect(game.platforms).toEqual([]);
			expect(game.genres).toEqual([]);
			expect(game.developers).toEqual([]);
			expect(game.publishers).toEqual([]);
		});
	});
});
