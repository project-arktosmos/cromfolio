import { describe, it, expect } from 'vitest';
import {
	tmdbAdapter,
	type TMDBMovieResult,
	type TMDBTVResult,
	type TMDBCastResult,
	type TMDBCrewResult,
	type TMDBImageResult
} from '$adapters/classes/tmdb.adapter';

describe('tmdb.adapter', () => {
	describe('fromApi (movie)', () => {
		it('should transform TMDB movie result to Movie', () => {
			const apiData: TMDBMovieResult = {
				id: 550,
				title: 'Fight Club',
				original_title: 'Fight Club',
				overview: 'A ticking-Loss time bomb of a movie.',
				release_date: '1999-10-15',
				poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
				backdrop_path: '/hZkgoQYus5vegHoetLkCJzb17zJ.jpg',
				genres: [
					{ id: 18, name: 'Drama' },
					{ id: 53, name: 'Thriller' }
				],
				vote_average: 8.4,
				vote_count: 25000,
				runtime: 139,
				original_language: 'en',
				imdb_id: 'tt0137523'
			};

			const movie = tmdbAdapter.fromApi(apiData);

			expect(movie.id).toBe('550');
			expect(movie.title).toBe('Fight Club');
			expect(movie.year).toBe(1999);
			expect(movie.type).toBe('movie');
			expect(movie.poster).toBe('https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg');
			expect(movie.backdrop).toBe(
				'https://image.tmdb.org/t/p/w1280/hZkgoQYus5vegHoetLkCJzb17zJ.jpg'
			);
			expect(movie.plot).toBe('A ticking-Loss time bomb of a movie.');
			expect(movie.genres).toEqual(['Drama', 'Thriller']);
			expect(movie.rating).toBe(8.4);
			expect(movie.runtime).toBe(139);
			expect(movie.language).toBe('en');
			expect(movie.imdbId).toBe('tt0137523');
			expect(movie.tmdbId).toBe(550);
		});

		it('should handle missing optional fields', () => {
			const apiData: TMDBMovieResult = {
				id: 123,
				title: 'Minimal Movie'
			};

			const movie = tmdbAdapter.fromApi(apiData);

			expect(movie.id).toBe('123');
			expect(movie.title).toBe('Minimal Movie');
			expect(movie.year).toBe(new Date().getFullYear());
			expect(movie.poster).toBeUndefined();
			expect(movie.backdrop).toBeUndefined();
			expect(movie.genres).toEqual([]);
		});

		it('should handle genre_ids without genres array', () => {
			const apiData: TMDBMovieResult = {
				id: 123,
				title: 'Movie with genre_ids',
				genre_ids: [28, 12, 878]
			};

			const movie = tmdbAdapter.fromApi(apiData);

			// Without genre lookup, returns empty array
			expect(movie.genres).toEqual([]);
		});
	});

	describe('fromTVApi', () => {
		it('should transform TMDB TV result to TVShow', () => {
			const apiData: TMDBTVResult = {
				id: 1396,
				name: 'Breaking Bad',
				original_name: 'Breaking Bad',
				overview: 'A high school chemistry teacher turned meth maker.',
				first_air_date: '2008-01-20',
				last_air_date: '2013-09-29',
				poster_path: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
				backdrop_path: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
				genres: [{ id: 18, name: 'Drama' }],
				vote_average: 8.9,
				status: 'Ended',
				number_of_seasons: 5,
				number_of_episodes: 62,
				networks: [{ id: 174, name: 'AMC' }]
			};

			const tvShow = tmdbAdapter.fromTVApi(apiData);

			expect(tvShow.id).toBe('1396');
			expect(tvShow.name).toBe('Breaking Bad');
			expect(tvShow.status).toBe('Ended');
			expect(tvShow.premiered).toBe('2008-01-20');
			expect(tvShow.ended).toBe('2013-09-29');
			expect(tvShow.genres).toEqual(['Drama']);
			expect(tvShow.rating).toBe(8.9);
			expect(tvShow.image).toBe('https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg');
			expect(tvShow.summary).toBe('A high school chemistry teacher turned meth maker.');
			expect(tvShow.network).toBe('AMC');
		});

		it('should normalize TV status', () => {
			const returningShow: TMDBTVResult = {
				id: 1,
				name: 'Running Show',
				status: 'Returning Series'
			};
			const canceledShow: TMDBTVResult = { id: 2, name: 'Canceled Show', status: 'Canceled' };
			const plannedShow: TMDBTVResult = { id: 3, name: 'Planned Show', status: 'Planned' };

			expect(tmdbAdapter.fromTVApi(returningShow).status).toBe('Running');
			expect(tmdbAdapter.fromTVApi(canceledShow).status).toBe('Ended');
			expect(tmdbAdapter.fromTVApi(plannedShow).status).toBe('In Development');
		});
	});

	describe('fromCast', () => {
		it('should transform TMDB cast to CastMember', () => {
			const apiData: TMDBCastResult = {
				id: 819,
				name: 'Edward Norton',
				character: 'The Narrator',
				profile_path: '/5XBzD5WuTyVQZeS4II6gs1nn5P6.jpg',
				order: 0
			};

			const cast = tmdbAdapter.fromCast(apiData);

			expect(cast.id).toBe('819');
			expect(cast.name).toBe('Edward Norton');
			expect(cast.character).toBe('The Narrator');
			expect(cast.image).toBe('https://image.tmdb.org/t/p/w185/5XBzD5WuTyVQZeS4II6gs1nn5P6.jpg');
			expect(cast.order).toBe(0);
		});
	});

	describe('fromCrew', () => {
		it('should transform TMDB crew to CrewMember', () => {
			const apiData: TMDBCrewResult = {
				id: 7467,
				name: 'David Fincher',
				job: 'Director',
				department: 'Directing',
				profile_path: '/tpEczFHQBQS5dyTKCPDj2ZZYTOB.jpg'
			};

			const crew = tmdbAdapter.fromCrew(apiData);

			expect(crew.id).toBe('7467');
			expect(crew.name).toBe('David Fincher');
			expect(crew.job).toBe('Director');
			expect(crew.department).toBe('Directing');
			expect(crew.image).toBe('https://image.tmdb.org/t/p/w185/tpEczFHQBQS5dyTKCPDj2ZZYTOB.jpg');
		});
	});

	describe('fromImage', () => {
		it('should transform TMDB image to MediaImage', () => {
			const apiData: TMDBImageResult = {
				file_path: '/abc123.jpg',
				width: 1920,
				height: 1080,
				aspect_ratio: 1.78,
				vote_average: 5.5,
				iso_639_1: 'en'
			};

			const image = tmdbAdapter.fromImage(apiData, 'backdrop');

			expect(image.id).toBe('/abc123.jpg');
			expect(image.url).toBe('https://image.tmdb.org/t/p/original/abc123.jpg');
			expect(image.type).toBe('backdrop');
			expect(image.width).toBe(1920);
			expect(image.height).toBe(1080);
			expect(image.aspectRatio).toBe(1.78);
			expect(image.language).toBe('en');
		});

		it('should handle null language', () => {
			const apiData: TMDBImageResult = {
				file_path: '/poster.jpg',
				width: 500,
				height: 750,
				iso_639_1: null as unknown as string | undefined
			};

			const image = tmdbAdapter.fromImage(apiData, 'poster');

			expect(image.language).toBeUndefined();
		});
	});

	describe('batch transformations', () => {
		it('should transform array of TV shows', () => {
			const apiArray: TMDBTVResult[] = [
				{ id: 1, name: 'Show 1' },
				{ id: 2, name: 'Show 2' }
			];

			const shows = tmdbAdapter.fromTVApiMany(apiArray);

			expect(shows).toHaveLength(2);
			expect(shows[0].name).toBe('Show 1');
			expect(shows[1].name).toBe('Show 2');
		});

		it('should transform array of cast members', () => {
			const apiArray: TMDBCastResult[] = [
				{ id: 1, name: 'Actor 1', character: 'Char 1' },
				{ id: 2, name: 'Actor 2', character: 'Char 2' }
			];

			const cast = tmdbAdapter.fromCastMany(apiArray);

			expect(cast).toHaveLength(2);
			expect(cast[0].name).toBe('Actor 1');
			expect(cast[1].character).toBe('Char 2');
		});

		it('should transform array of crew members', () => {
			const apiArray: TMDBCrewResult[] = [
				{ id: 1, name: 'Crew 1', job: 'Director' },
				{ id: 2, name: 'Crew 2', job: 'Writer' }
			];

			const crew = tmdbAdapter.fromCrewMany(apiArray);

			expect(crew).toHaveLength(2);
			expect(crew[0].job).toBe('Director');
			expect(crew[1].job).toBe('Writer');
		});

		it('should transform array of images', () => {
			const apiArray: TMDBImageResult[] = [
				{ file_path: '/img1.jpg', width: 100, height: 150 },
				{ file_path: '/img2.jpg', width: 200, height: 300 }
			];

			const images = tmdbAdapter.fromImagesMany(apiArray, 'poster');

			expect(images).toHaveLength(2);
			expect(images[0].type).toBe('poster');
			expect(images[1].width).toBe(200);
		});
	});

	describe('toDisplayFormat', () => {
		it('should format movie for display', () => {
			const movie = {
				id: '550',
				title: 'Fight Club',
				year: 1999,
				type: 'movie' as const
			};

			const display = tmdbAdapter.toDisplayFormat(movie);

			expect(display).toBe('Fight Club (1999)');
		});
	});
});
