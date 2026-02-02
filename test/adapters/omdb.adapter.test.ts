import { describe, it, expect } from 'vitest';
import { omdbAdapter, type OMDBDetailedResult, type OMDBSearchResult } from '$adapters/classes/omdb.adapter';

describe('omdb.adapter', () => {
	describe('fromApi', () => {
		it('should transform OMDB detailed result to Movie', () => {
			const apiData: OMDBDetailedResult = {
				Title: 'The Matrix',
				Year: '1999',
				imdbID: 'tt0133093',
				Type: 'movie',
				Poster: 'https://example.com/matrix.jpg',
				Plot: 'A computer hacker learns about the true nature of reality.',
				Director: 'Lana Wachowski, Lilly Wachowski',
				Actors: 'Keanu Reeves, Laurence Fishburne, Carrie-Anne Moss',
				Genre: 'Action, Sci-Fi',
				imdbRating: '8.7',
				Runtime: '136 min',
				Language: 'English',
				Country: 'USA',
				Awards: 'Won 4 Oscars',
				Response: 'True'
			};

			const movie = omdbAdapter.fromApi(apiData);

			expect(movie.id).toBe('tt0133093');
			expect(movie.title).toBe('The Matrix');
			expect(movie.year).toBe(1999);
			expect(movie.type).toBe('movie');
			expect(movie.poster).toBe('https://example.com/matrix.jpg');
			expect(movie.plot).toBe('A computer hacker learns about the true nature of reality.');
			expect(movie.director).toBe('Lana Wachowski, Lilly Wachowski');
			expect(movie.actors).toEqual(['Keanu Reeves', 'Laurence Fishburne', 'Carrie-Anne Moss']);
			expect(movie.genres).toEqual(['Action', 'Sci-Fi']);
			expect(movie.rating).toBe(8.7);
			expect(movie.runtime).toBe(136);
			expect(movie.language).toBe('English');
			expect(movie.country).toBe('USA');
			expect(movie.awards).toBe('Won 4 Oscars');
			expect(movie.imdbId).toBe('tt0133093');
		});

		it('should handle N/A values', () => {
			const apiData: OMDBDetailedResult = {
				Title: 'Unknown Movie',
				Year: '2023',
				imdbID: 'tt0000001',
				Type: 'movie',
				Poster: 'N/A',
				Plot: 'N/A',
				Director: 'N/A',
				Actors: 'N/A',
				Genre: 'N/A',
				imdbRating: 'N/A',
				Runtime: 'N/A',
				Language: 'N/A',
				Country: 'N/A',
				Awards: 'N/A',
				Response: 'True'
			};

			const movie = omdbAdapter.fromApi(apiData);

			expect(movie.poster).toBeUndefined();
			expect(movie.plot).toBeUndefined();
			expect(movie.director).toBeUndefined();
			expect(movie.actors).toBeUndefined();
			expect(movie.genres).toBeUndefined();
			expect(movie.rating).toBeUndefined();
			expect(movie.runtime).toBeUndefined();
			expect(movie.language).toBeUndefined();
			expect(movie.country).toBeUndefined();
			expect(movie.awards).toBeUndefined();
		});

		it('should parse year ranges', () => {
			const apiData: OMDBDetailedResult = {
				Title: 'Breaking Bad',
				Year: '2008–2013',
				imdbID: 'tt0903747',
				Type: 'series',
				Response: 'True'
			};

			const movie = omdbAdapter.fromApi(apiData);

			expect(movie.year).toBe(2008);
		});
	});

	describe('fromSearchResult', () => {
		it('should transform OMDB search result to Movie', () => {
			const result: OMDBSearchResult = {
				Title: 'Inception',
				Year: '2010',
				imdbID: 'tt1375666',
				Type: 'movie',
				Poster: 'https://example.com/inception.jpg'
			};

			const movie = omdbAdapter.fromSearchResult(result);

			expect(movie.id).toBe('tt1375666');
			expect(movie.title).toBe('Inception');
			expect(movie.year).toBe(2010);
			expect(movie.type).toBe('movie');
			expect(movie.poster).toBe('https://example.com/inception.jpg');
			expect(movie.imdbId).toBe('tt1375666');
		});
	});

	describe('fromSearchResults', () => {
		it('should transform array of search results', () => {
			const results: OMDBSearchResult[] = [
				{ Title: 'Movie 1', Year: '2020', imdbID: 'tt1', Type: 'movie', Poster: 'p1.jpg' },
				{ Title: 'Movie 2', Year: '2021', imdbID: 'tt2', Type: 'movie', Poster: 'p2.jpg' }
			];

			const movies = omdbAdapter.fromSearchResults(results);

			expect(movies).toHaveLength(2);
			expect(movies[0].title).toBe('Movie 1');
			expect(movies[1].title).toBe('Movie 2');
		});
	});

	describe('toDisplayFormat', () => {
		it('should format movie for display', () => {
			const movie = {
				id: 'tt1',
				title: 'The Dark Knight',
				year: 2008,
				type: 'movie' as const
			};

			const display = omdbAdapter.toDisplayFormat(movie);

			expect(display).toBe('The Dark Knight (2008)');
		});
	});

	describe('edge cases', () => {
		it('should handle missing optional fields', () => {
			const apiData: OMDBDetailedResult = {
				Title: 'Minimal Movie',
				Year: '2023',
				imdbID: 'tt0000001',
				Type: 'movie',
				Response: 'True'
			};

			const movie = omdbAdapter.fromApi(apiData);

			expect(movie.title).toBe('Minimal Movie');
			expect(movie.poster).toBeUndefined();
			expect(movie.plot).toBeUndefined();
		});

		it('should handle invalid year format', () => {
			const apiData: OMDBDetailedResult = {
				Title: 'Invalid Year Movie',
				Year: 'Unknown',
				imdbID: 'tt0000001',
				Type: 'movie',
				Response: 'True'
			};

			const movie = omdbAdapter.fromApi(apiData);

			// Should fallback to current year
			expect(movie.year).toBe(new Date().getFullYear());
		});

		it('should handle invalid runtime format', () => {
			const apiData: OMDBDetailedResult = {
				Title: 'Invalid Runtime Movie',
				Year: '2023',
				imdbID: 'tt0000001',
				Type: 'movie',
				Runtime: 'Unknown',
				Response: 'True'
			};

			const movie = omdbAdapter.fromApi(apiData);

			expect(movie.runtime).toBeUndefined();
		});
	});
});
