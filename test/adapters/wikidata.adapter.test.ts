import { describe, it, expect } from 'vitest';
import {
	wikidataAdapter,
	WIKIDATA_PROPERTIES,
	type WDEntityResult,
	type WDSearchResult
} from '$adapters/classes/wikidata.adapter';

describe('wikidata.adapter', () => {
	describe('fromApi', () => {
		it('should transform WikiData entity to WikiDataItem', () => {
			const apiData: WDEntityResult = {
				type: 'item',
				id: 'Q42',
				labels: {
					en: { language: 'en', value: 'Douglas Adams' },
					de: { language: 'de', value: 'Douglas Adams' }
				},
				descriptions: {
					en: { language: 'en', value: 'English author and scriptwriter' }
				},
				aliases: {
					en: [
						{ language: 'en', value: 'Douglas Noel Adams' },
						{ language: 'en', value: 'DNA' }
					]
				},
				sitelinks: {
					enwiki: { site: 'enwiki', title: 'Douglas Adams' }
				},
				claims: {
					P18: [
						{
							mainsnak: {
								snaktype: 'value',
								property: 'P18',
								datavalue: {
									value: 'Douglas adams portrait.jpg',
									type: 'string'
								}
							},
							type: 'statement',
							id: 'Q42$P18',
							rank: 'normal'
						}
					]
				},
				modified: '2023-12-01T12:00:00Z'
			};

			const item = wikidataAdapter.fromApi(apiData);

			expect(item.id).toBe('Q42');
			expect(item.label).toBe('Douglas Adams');
			expect(item.description).toBe('English author and scriptwriter');
			expect(item.aliases).toEqual(['Douglas Noel Adams', 'DNA']);
			expect(item.wikipediaUrl).toBe('https://en.wikipedia.org/wiki/Douglas_Adams');
			expect(item.imageUrl).toBe(
				'https://commons.wikimedia.org/wiki/Special:FilePath/Douglas_adams_portrait.jpg'
			);
			expect(item.modified).toBe('2023-12-01T12:00:00Z');
		});

		it('should fallback to English for localized values', () => {
			const apiData: WDEntityResult = {
				type: 'item',
				id: 'Q1',
				labels: {
					de: { language: 'de', value: 'Universum' },
					en: { language: 'en', value: 'Universe' }
				}
			};

			const item = wikidataAdapter.fromApi(apiData, 'fr'); // Request French

			expect(item.label).toBe('Universe'); // Falls back to English
		});

		it('should fallback to ID if no labels available', () => {
			const apiData: WDEntityResult = {
				type: 'item',
				id: 'Q12345'
			};

			const item = wikidataAdapter.fromApi(apiData);

			expect(item.label).toBe('Q12345');
		});

		it('should handle missing optional fields', () => {
			const apiData: WDEntityResult = {
				type: 'item',
				id: 'Q1',
				labels: {
					en: { language: 'en', value: 'Test' }
				}
			};

			const item = wikidataAdapter.fromApi(apiData);

			expect(item.description).toBeUndefined();
			expect(item.aliases).toEqual([]);
			expect(item.wikipediaUrl).toBeUndefined();
			expect(item.imageUrl).toBeUndefined();
		});

		it('should generate Wikipedia URL with proper encoding', () => {
			const apiData: WDEntityResult = {
				type: 'item',
				id: 'Q1',
				labels: { en: { language: 'en', value: 'Test' } },
				sitelinks: {
					enwiki: { site: 'enwiki', title: 'Test Article With Spaces' }
				}
			};

			const item = wikidataAdapter.fromApi(apiData);

			expect(item.wikipediaUrl).toBe(
				'https://en.wikipedia.org/wiki/Test_Article_With_Spaces'
			);
		});

		it('should use sitelink URL if provided', () => {
			const apiData: WDEntityResult = {
				type: 'item',
				id: 'Q1',
				labels: { en: { language: 'en', value: 'Test' } },
				sitelinks: {
					enwiki: { site: 'enwiki', title: 'Test', url: 'https://en.wikipedia.org/wiki/Custom_URL' }
				}
			};

			const item = wikidataAdapter.fromApi(apiData);

			expect(item.wikipediaUrl).toBe('https://en.wikipedia.org/wiki/Custom_URL');
		});
	});

	describe('fromSearchResult', () => {
		it('should transform WikiData search result', () => {
			const result: WDSearchResult = {
				id: 'Q42',
				title: 'Q42',
				pageid: 123,
				display: {
					label: { language: 'en', value: 'Douglas Adams' },
					description: { language: 'en', value: 'English author' }
				},
				repository: 'wikidata',
				url: 'https://www.wikidata.org/wiki/Q42',
				concepturi: 'http://www.wikidata.org/entity/Q42',
				label: 'Douglas Adams',
				description: 'English author',
				match: { type: 'label', language: 'en', text: 'Douglas Adams' }
			};

			const item = wikidataAdapter.fromSearchResult(result);

			expect(item.id).toBe('Q42');
			expect(item.label).toBe('Douglas Adams');
			expect(item.description).toBe('English author');
			expect(item.aliases).toEqual([]);
			expect(item.properties.size).toBe(0);
		});

		it('should fallback to label field if display.label is missing', () => {
			const result: WDSearchResult = {
				id: 'Q1',
				title: 'Q1',
				pageid: 1,
				display: {},
				repository: 'wikidata',
				url: 'https://www.wikidata.org/wiki/Q1',
				concepturi: 'http://www.wikidata.org/entity/Q1',
				label: 'Fallback Label',
				match: { type: 'label', language: 'en', text: 'Test' }
			};

			const item = wikidataAdapter.fromSearchResult(result);

			expect(item.label).toBe('Fallback Label');
		});
	});

	describe('claim transformations', () => {
		it('should transform entity claims', () => {
			const apiData: WDEntityResult = {
				type: 'item',
				id: 'Q1',
				labels: { en: { language: 'en', value: 'Test' } },
				claims: {
					P31: [
						{
							mainsnak: {
								snaktype: 'value',
								property: 'P31',
								datavalue: {
									value: { 'entity-type': 'item', 'numeric-id': 5, id: 'Q5' },
									type: 'wikibase-entityid'
								}
							},
							type: 'statement',
							id: 'claim1',
							rank: 'normal'
						}
					]
				}
			};

			const item = wikidataAdapter.fromApi(apiData);

			const instanceOf = item.properties.get(WIKIDATA_PROPERTIES.INSTANCE_OF);
			expect(instanceOf).toBeDefined();
			expect(instanceOf?.[0].type).toBe('entity');
			expect(instanceOf?.[0].entityId).toBe('Q5');
		});

		it('should transform string claims', () => {
			const apiData: WDEntityResult = {
				type: 'item',
				id: 'Q1',
				labels: { en: { language: 'en', value: 'Test' } },
				claims: {
					P345: [
						{
							mainsnak: {
								snaktype: 'value',
								property: 'P345',
								datavalue: {
									value: 'nm0000001',
									type: 'string'
								}
							},
							type: 'statement',
							id: 'claim1',
							rank: 'normal'
						}
					]
				}
			};

			const item = wikidataAdapter.fromApi(apiData);

			const imdbId = item.properties.get(WIKIDATA_PROPERTIES.IMDB_ID);
			expect(imdbId).toBeDefined();
			expect(imdbId?.[0].type).toBe('string');
			expect(imdbId?.[0].value).toBe('nm0000001');
		});

		it('should transform time claims', () => {
			const apiData: WDEntityResult = {
				type: 'item',
				id: 'Q1',
				labels: { en: { language: 'en', value: 'Test' } },
				claims: {
					P571: [
						{
							mainsnak: {
								snaktype: 'value',
								property: 'P571',
								datavalue: {
									value: { time: '+1952-03-11T00:00:00Z', precision: 11 },
									type: 'time'
								}
							},
							type: 'statement',
							id: 'claim1',
							rank: 'normal'
						}
					]
				}
			};

			const item = wikidataAdapter.fromApi(apiData);

			const inception = item.properties.get(WIKIDATA_PROPERTIES.INCEPTION);
			expect(inception).toBeDefined();
			expect(inception?.[0].type).toBe('time');
			expect(inception?.[0].value).toBe('+1952-03-11T00:00:00Z');
		});

		it('should transform quantity claims', () => {
			const apiData: WDEntityResult = {
				type: 'item',
				id: 'Q1',
				labels: { en: { language: 'en', value: 'Test' } },
				claims: {
					P1082: [
						{
							mainsnak: {
								snaktype: 'value',
								property: 'P1082',
								datavalue: {
									value: { amount: '+8000000', unit: '1' },
									type: 'quantity'
								}
							},
							type: 'statement',
							id: 'claim1',
							rank: 'normal'
						}
					]
				}
			};

			const item = wikidataAdapter.fromApi(apiData);

			const population = item.properties.get('P1082');
			expect(population).toBeDefined();
			expect(population?.[0].type).toBe('quantity');
			expect(population?.[0].numericValue).toBe(8000000);
		});

		it('should transform coordinate claims', () => {
			const apiData: WDEntityResult = {
				type: 'item',
				id: 'Q1',
				labels: { en: { language: 'en', value: 'Test' } },
				claims: {
					P625: [
						{
							mainsnak: {
								snaktype: 'value',
								property: 'P625',
								datavalue: {
									value: { latitude: 51.5074, longitude: -0.1278 },
									type: 'globecoordinate'
								}
							},
							type: 'statement',
							id: 'claim1',
							rank: 'normal'
						}
					]
				}
			};

			const item = wikidataAdapter.fromApi(apiData);

			const coords = item.properties.get(WIKIDATA_PROPERTIES.COORDINATE_LOCATION);
			expect(coords).toBeDefined();
			expect(coords?.[0].type).toBe('coordinate');
			expect(coords?.[0].coordinates?.latitude).toBe(51.5074);
			expect(coords?.[0].coordinates?.longitude).toBe(-0.1278);
		});

		it('should transform monolingual text claims', () => {
			const apiData: WDEntityResult = {
				type: 'item',
				id: 'Q1',
				labels: { en: { language: 'en', value: 'Test' } },
				claims: {
					P1476: [
						{
							mainsnak: {
								snaktype: 'value',
								property: 'P1476',
								datavalue: {
									value: { text: 'Original Title', language: 'en' },
									type: 'monolingualtext'
								}
							},
							type: 'statement',
							id: 'claim1',
							rank: 'normal'
						}
					]
				}
			};

			const item = wikidataAdapter.fromApi(apiData);

			const title = item.properties.get('P1476');
			expect(title).toBeDefined();
			expect(title?.[0].type).toBe('text');
			expect(title?.[0].value).toBe('Original Title');
		});
	});

	describe('property access helpers', () => {
		it('should get property string value', () => {
			const apiData: WDEntityResult = {
				type: 'item',
				id: 'Q1',
				labels: { en: { language: 'en', value: 'Test' } },
				claims: {
					P856: [
						{
							mainsnak: {
								snaktype: 'value',
								property: 'P856',
								datavalue: { value: 'https://example.com', type: 'string' }
							},
							type: 'statement',
							id: 'claim1',
							rank: 'normal'
						}
					]
				}
			};

			const item = wikidataAdapter.fromApi(apiData);
			const website = wikidataAdapter.getPropertyString(item, WIKIDATA_PROPERTIES.OFFICIAL_WEBSITE);

			expect(website).toBe('https://example.com');
		});

		it('should return undefined for missing property', () => {
			const apiData: WDEntityResult = {
				type: 'item',
				id: 'Q1',
				labels: { en: { language: 'en', value: 'Test' } }
			};

			const item = wikidataAdapter.fromApi(apiData);
			const website = wikidataAdapter.getPropertyString(item, WIKIDATA_PROPERTIES.OFFICIAL_WEBSITE);

			expect(website).toBeUndefined();
		});

		it('should get all property strings', () => {
			const apiData: WDEntityResult = {
				type: 'item',
				id: 'Q1',
				labels: { en: { language: 'en', value: 'Test' } },
				claims: {
					P856: [
						{
							mainsnak: {
								snaktype: 'value',
								property: 'P856',
								datavalue: { value: 'https://example1.com', type: 'string' }
							},
							type: 'statement',
							id: 'claim1',
							rank: 'normal'
						},
						{
							mainsnak: {
								snaktype: 'value',
								property: 'P856',
								datavalue: { value: 'https://example2.com', type: 'string' }
							},
							type: 'statement',
							id: 'claim2',
							rank: 'normal'
						}
					]
				}
			};

			const item = wikidataAdapter.fromApi(apiData);
			const websites = wikidataAdapter.getPropertyStrings(item, WIKIDATA_PROPERTIES.OFFICIAL_WEBSITE);

			expect(websites).toEqual(['https://example1.com', 'https://example2.com']);
		});

		it('should get property entity ID', () => {
			const apiData: WDEntityResult = {
				type: 'item',
				id: 'Q1',
				labels: { en: { language: 'en', value: 'Test' } },
				claims: {
					P17: [
						{
							mainsnak: {
								snaktype: 'value',
								property: 'P17',
								datavalue: {
									value: { 'entity-type': 'item', id: 'Q30' },
									type: 'wikibase-entityid'
								}
							},
							type: 'statement',
							id: 'claim1',
							rank: 'normal'
						}
					]
				}
			};

			const item = wikidataAdapter.fromApi(apiData);
			const country = wikidataAdapter.getPropertyEntityId(item, WIKIDATA_PROPERTIES.COUNTRY);

			expect(country).toBe('Q30');
		});

		it('should get property coordinates', () => {
			const apiData: WDEntityResult = {
				type: 'item',
				id: 'Q1',
				labels: { en: { language: 'en', value: 'Test' } },
				claims: {
					P625: [
						{
							mainsnak: {
								snaktype: 'value',
								property: 'P625',
								datavalue: {
									value: { latitude: 40.7128, longitude: -74.006 },
									type: 'globecoordinate'
								}
							},
							type: 'statement',
							id: 'claim1',
							rank: 'normal'
						}
					]
				}
			};

			const item = wikidataAdapter.fromApi(apiData);
			const coords = wikidataAdapter.getPropertyCoordinates(
				item,
				WIKIDATA_PROPERTIES.COORDINATE_LOCATION
			);

			expect(coords).toEqual({ latitude: 40.7128, longitude: -74.006 });
		});
	});

	describe('batch transformations', () => {
		it('should transform array of search results', () => {
			const results: WDSearchResult[] = [
				{
					id: 'Q1',
					title: 'Q1',
					pageid: 1,
					display: { label: { language: 'en', value: 'Item 1' } },
					repository: 'wikidata',
					url: 'url1',
					concepturi: 'uri1',
					match: { type: 'label', language: 'en', text: 'Item 1' }
				},
				{
					id: 'Q2',
					title: 'Q2',
					pageid: 2,
					display: { label: { language: 'en', value: 'Item 2' } },
					repository: 'wikidata',
					url: 'url2',
					concepturi: 'uri2',
					match: { type: 'label', language: 'en', text: 'Item 2' }
				}
			];

			const items = wikidataAdapter.fromSearchResults(results);

			expect(items).toHaveLength(2);
			expect(items[0].label).toBe('Item 1');
			expect(items[1].label).toBe('Item 2');
		});
	});

	describe('toDisplayFormat', () => {
		it('should format item with description', () => {
			const item = {
				id: 'Q42',
				label: 'Douglas Adams',
				description: 'English author',
				aliases: [],
				properties: new Map()
			};

			const display = wikidataAdapter.toDisplayFormat(item);

			expect(display).toBe('Douglas Adams - English author');
		});

		it('should format item without description', () => {
			const item = {
				id: 'Q1',
				label: 'Test',
				aliases: [],
				properties: new Map()
			};

			const display = wikidataAdapter.toDisplayFormat(item);

			expect(display).toBe('Test');
		});
	});
});
