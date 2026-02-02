import { describe, it, expect } from 'vitest';
import {
	inaturalistAdapter,
	type INatTaxonResult,
	type INatObservationResult,
	type INatPhoto
} from '$adapters/classes/inaturalist.adapter';

describe('inaturalist.adapter', () => {
	describe('fromApi (taxon)', () => {
		it('should transform iNaturalist taxon to Species', () => {
			const apiData: INatTaxonResult = {
				id: 48460,
				name: 'Panthera tigris',
				rank: 'species',
				rank_level: 10,
				preferred_common_name: 'Tiger',
				is_active: true,
				iconic_taxon_name: 'Mammalia',
				parent_id: 41944,
				ancestor_ids: [1, 2, 355675, 40151, 848317],
				observations_count: 5000,
				default_photo: {
					id: 123,
					url: 'https://example.com/tiger.jpg',
					medium_url: 'https://example.com/tiger_medium.jpg',
					small_url: 'https://example.com/tiger_small.jpg'
				},
				wikipedia_url: 'https://en.wikipedia.org/wiki/Tiger',
				wikipedia_summary: 'The tiger is the largest living cat species.'
			};

			const species = inaturalistAdapter.fromApi(apiData);

			expect(species.id).toBe('48460');
			expect(species.scientificName).toBe('Panthera tigris');
			expect(species.commonName).toBe('Tiger');
			expect(species.rank).toBe('species');
			expect(species.parentId).toBe('41944');
			expect(species.ancestorIds).toEqual(['1', '2', '355675', '40151', '848317']);
			expect(species.observationCount).toBe(5000);
			expect(species.isActive).toBe(true);
			expect(species.iconicTaxonName).toBe('Mammalia');
			expect(species.defaultPhoto).toBe('https://example.com/tiger_medium.jpg');
			expect(species.wikipedia?.url).toBe('https://en.wikipedia.org/wiki/Tiger');
			expect(species.wikipedia?.summary).toBe('The tiger is the largest living cat species.');
			expect(species.inatId).toBe(48460);
		});

		it('should fallback to english_common_name', () => {
			const apiData: INatTaxonResult = {
				id: 123,
				name: 'Canis lupus',
				rank: 'species',
				english_common_name: 'Wolf'
			};

			const species = inaturalistAdapter.fromApi(apiData);

			expect(species.commonName).toBe('Wolf');
		});

		it('should handle missing optional fields', () => {
			const apiData: INatTaxonResult = {
				id: 123,
				name: 'Unknown species',
				rank: 'species'
			};

			const species = inaturalistAdapter.fromApi(apiData);

			expect(species.id).toBe('123');
			expect(species.scientificName).toBe('Unknown species');
			expect(species.commonName).toBeUndefined();
			expect(species.parentId).toBeUndefined();
			expect(species.ancestorIds).toBeUndefined();
			expect(species.observationCount).toBe(0);
			expect(species.defaultPhoto).toBeUndefined();
			expect(species.wikipedia).toBeUndefined();
		});

		it('should normalize taxonomic ranks', () => {
			const ranks = [
				{ input: 'kingdom', expected: 'kingdom' },
				{ input: 'phylum', expected: 'phylum' },
				{ input: 'class', expected: 'class' },
				{ input: 'order', expected: 'order' },
				{ input: 'family', expected: 'family' },
				{ input: 'genus', expected: 'genus' },
				{ input: 'species', expected: 'species' },
				{ input: 'subspecies', expected: 'subspecies' },
				{ input: 'variety', expected: 'variety' },
				{ input: 'form', expected: 'form' },
				{ input: 'unknown_rank', expected: 'species' }
			];

			ranks.forEach(({ input, expected }) => {
				const apiData: INatTaxonResult = { id: 1, name: 'Test', rank: input };
				const species = inaturalistAdapter.fromApi(apiData);
				expect(species.rank).toBe(expected);
			});
		});

		it('should extract photo URL preferring medium', () => {
			const apiData: INatTaxonResult = {
				id: 1,
				name: 'Test',
				rank: 'species',
				default_photo: {
					id: 1,
					url: 'url.jpg',
					small_url: 'small.jpg',
					medium_url: 'medium.jpg',
					large_url: 'large.jpg'
				}
			};

			const species = inaturalistAdapter.fromApi(apiData);

			expect(species.defaultPhoto).toBe('medium.jpg');
		});

		it('should fallback to small_url if medium not available', () => {
			const apiData: INatTaxonResult = {
				id: 1,
				name: 'Test',
				rank: 'species',
				default_photo: {
					id: 1,
					url: 'url.jpg',
					small_url: 'small.jpg'
				}
			};

			const species = inaturalistAdapter.fromApi(apiData);

			expect(species.defaultPhoto).toBe('small.jpg');
		});
	});

	describe('fromObservation', () => {
		it('should transform iNaturalist observation to NatureObservation', () => {
			const apiData: INatObservationResult = {
				id: 12345,
				uuid: 'uuid-12345',
				taxon: { id: 48460, name: 'Panthera tigris', rank: 'species' },
				species_guess: 'Tiger',
				observed_on: '2023-06-15',
				latitude: 26.8467,
				longitude: 80.9462,
				place_guess: 'Dudhwa National Park, India',
				quality_grade: 'research',
				photos: [
					{
						id: 1,
						url: 'photo1.jpg',
						medium_url: 'photo1_medium.jpg'
					}
				],
				user: {
					id: 999,
					login: 'naturalist123',
					name: 'John Naturalist'
				}
			};

			const observation = inaturalistAdapter.fromObservation(apiData);

			expect(observation.id).toBe('uuid-12345');
			expect(observation.speciesId).toBe('48460');
			expect(observation.speciesGuess).toBe('Tiger');
			expect(observation.observedAt).toBe('2023-06-15');
			expect(observation.location?.latitude).toBe(26.8467);
			expect(observation.location?.longitude).toBe(80.9462);
			expect(observation.location?.placeGuess).toBe('Dudhwa National Park, India');
			expect(observation.qualityGrade).toBe('research');
			expect(observation.photos).toHaveLength(1);
			expect(observation.userId).toBe('999');
			expect(observation.userName).toBe('John Naturalist');
			expect(observation.inatId).toBe(12345);
		});

		it('should fallback to id when uuid is missing', () => {
			const apiData: INatObservationResult = {
				id: 12345,
				taxon: { id: 1, name: 'Test', rank: 'species' }
			};

			const observation = inaturalistAdapter.fromObservation(apiData);

			expect(observation.id).toBe('12345');
		});

		it('should parse location from string format', () => {
			const apiData: INatObservationResult = {
				id: 1,
				location: '40.7128, -74.0060'
			};

			const observation = inaturalistAdapter.fromObservation(apiData);

			expect(observation.location?.latitude).toBe(40.7128);
			expect(observation.location?.longitude).toBe(-74.006);
		});

		it('should prefer explicit lat/lng over location string', () => {
			const apiData: INatObservationResult = {
				id: 1,
				latitude: 35.6762,
				longitude: 139.6503,
				location: '40.7128, -74.0060' // Should be ignored
			};

			const observation = inaturalistAdapter.fromObservation(apiData);

			expect(observation.location?.latitude).toBe(35.6762);
			expect(observation.location?.longitude).toBe(139.6503);
		});

		it('should handle missing location', () => {
			const apiData: INatObservationResult = {
				id: 1
			};

			const observation = inaturalistAdapter.fromObservation(apiData);

			expect(observation.location).toBeUndefined();
		});

		it('should normalize quality grades', () => {
			const grades = [
				{ input: 'casual', expected: 'casual' },
				{ input: 'needs_id', expected: 'needs_id' },
				{ input: 'research', expected: 'research' },
				{ input: 'unknown', expected: undefined }
			];

			grades.forEach(({ input, expected }) => {
				const apiData: INatObservationResult = { id: 1, quality_grade: input };
				const observation = inaturalistAdapter.fromObservation(apiData);
				expect(observation.qualityGrade).toBe(expected);
			});
		});

		it('should fallback to login if name is missing', () => {
			const apiData: INatObservationResult = {
				id: 1,
				user: { id: 1, login: 'user123' }
			};

			const observation = inaturalistAdapter.fromObservation(apiData);

			expect(observation.userName).toBe('user123');
		});
	});

	describe('fromPhoto', () => {
		it('should transform iNaturalist photo to NaturePhoto', () => {
			const apiData: INatPhoto = {
				id: 123,
				url: 'https://example.com/photo.jpg',
				square_url: 'https://example.com/photo_square.jpg',
				small_url: 'https://example.com/photo_small.jpg',
				medium_url: 'https://example.com/photo_medium.jpg',
				large_url: 'https://example.com/photo_large.jpg',
				original_url: 'https://example.com/photo_original.jpg',
				attribution: '(c) John Doe, some rights reserved',
				license_code: 'cc-by-nc'
			};

			const photo = inaturalistAdapter.fromPhoto(apiData);

			expect(photo.id).toBe('123');
			expect(photo.url).toBe('https://example.com/photo.jpg');
			expect(photo.squareUrl).toBe('https://example.com/photo_square.jpg');
			expect(photo.smallUrl).toBe('https://example.com/photo_small.jpg');
			expect(photo.mediumUrl).toBe('https://example.com/photo_medium.jpg');
			expect(photo.largeUrl).toBe('https://example.com/photo_large.jpg');
			expect(photo.originalUrl).toBe('https://example.com/photo_original.jpg');
			expect(photo.attribution).toBe('(c) John Doe, some rights reserved');
			expect(photo.licenseCode).toBe('cc-by-nc');
		});
	});

	describe('fromAncestor', () => {
		it('should transform taxon to TaxonomicAncestor', () => {
			const apiData: INatTaxonResult = {
				id: 40151,
				name: 'Mammalia',
				rank: 'class',
				preferred_common_name: 'Mammals',
				iconic_taxon_name: 'Mammalia'
			};

			const ancestor = inaturalistAdapter.fromAncestor(apiData);

			expect(ancestor.id).toBe('40151');
			expect(ancestor.rank).toBe('class');
			expect(ancestor.name).toBe('Mammalia');
			expect(ancestor.commonName).toBe('Mammals');
			expect(ancestor.iconicTaxonName).toBe('Mammalia');
		});
	});

	describe('batch transformations', () => {
		it('should transform array of observations', () => {
			const apiArray: INatObservationResult[] = [
				{ id: 1, species_guess: 'Bird 1' },
				{ id: 2, species_guess: 'Bird 2' }
			];

			const observations = inaturalistAdapter.fromObservationMany(apiArray);

			expect(observations).toHaveLength(2);
			expect(observations[0].speciesGuess).toBe('Bird 1');
		});

		it('should transform array of photos', () => {
			const apiArray: INatPhoto[] = [
				{ id: 1, url: 'photo1.jpg' },
				{ id: 2, url: 'photo2.jpg' }
			];

			const photos = inaturalistAdapter.fromPhotoMany(apiArray);

			expect(photos).toHaveLength(2);
		});

		it('should transform array of ancestors', () => {
			const apiArray: INatTaxonResult[] = [
				{ id: 1, name: 'Animalia', rank: 'kingdom' },
				{ id: 2, name: 'Chordata', rank: 'phylum' }
			];

			const ancestors = inaturalistAdapter.fromAncestorMany(apiArray);

			expect(ancestors).toHaveLength(2);
			expect(ancestors[0].rank).toBe('kingdom');
		});
	});

	describe('toDisplayFormat', () => {
		it('should format species with common name', () => {
			const species = {
				id: '1',
				scientificName: 'Panthera tigris',
				commonName: 'Tiger',
				rank: 'species' as const,
				observationCount: 1000,
				inatId: 1
			};

			const display = inaturalistAdapter.toDisplayFormat(species);

			expect(display).toBe('Tiger (Panthera tigris)');
		});

		it('should format species without common name', () => {
			const species = {
				id: '1',
				scientificName: 'Unknown species',
				rank: 'species' as const,
				observationCount: 0,
				inatId: 1
			};

			const display = inaturalistAdapter.toDisplayFormat(species);

			expect(display).toBe('Unknown species');
		});
	});
});
