import { describe, it, expect } from 'vitest';
import {
	sketchfabAdapter,
	type SFModelResult,
	type SFCollectionResult,
	type SFLicense
} from '$adapters/classes/sketchfab.adapter';

describe('sketchfab.adapter', () => {
	describe('fromApi (model)', () => {
		it('should transform Sketchfab model to Model3D', () => {
			const apiData: SFModelResult = {
				uid: 'abc123',
				name: 'Cool 3D Model',
				description: 'A very cool 3D model',
				thumbnails: {
					images: [
						{ url: 'https://example.com/thumb_small.jpg', width: 200, height: 200 },
						{ url: 'https://example.com/thumb_medium.jpg', width: 512, height: 512 },
						{ url: 'https://example.com/thumb_large.jpg', width: 1920, height: 1080 }
					]
				},
				embedUrl: 'https://sketchfab.com/models/abc123/embed',
				viewerUrl: 'https://sketchfab.com/3d-models/abc123',
				user: {
					uid: 'user123',
					username: 'artist3d',
					displayName: '3D Artist',
					profileUrl: 'https://sketchfab.com/artist3d',
					avatar: {
						url: 'https://example.com/avatar.jpg'
					}
				},
				license: {
					slug: 'cc-by',
					label: 'CC BY 4.0',
					fullName: 'Creative Commons Attribution 4.0',
					url: 'https://creativecommons.org/licenses/by/4.0/'
				},
				tags: [
					{ name: 'character', slug: 'character' },
					{ name: 'fantasy', slug: 'fantasy' }
				],
				categories: [
					{ name: 'Characters', slug: 'characters' }
				],
				createdAt: '2023-01-15T10:00:00Z',
				publishedAt: '2023-01-16T12:00:00Z',
				viewCount: 10000,
				likeCount: 500,
				commentCount: 50,
				downloadCount: 100,
				faceCount: 50000,
				vertexCount: 25000,
				textureCount: 5,
				isAnimated: true,
				hasSound: false,
				isDownloadable: true,
				archives: {
					gltf: { size: 5000000, textured: true },
					usdz: { size: 3000000, textured: true },
					source: { size: 10000000, textured: true }
				}
			};

			const model = sketchfabAdapter.fromApi(apiData);

			expect(model.id).toBe('abc123');
			expect(model.name).toBe('Cool 3D Model');
			expect(model.description).toBe('A very cool 3D model');
			expect(model.thumbnailUrl).toBe('https://example.com/thumb_medium.jpg'); // Prefers 256-1024 range
			expect(model.embedUrl).toBe('https://sketchfab.com/models/abc123/embed');
			expect(model.viewerUrl).toBe('https://sketchfab.com/3d-models/abc123');
			expect(model.downloadUrl).toBe('https://sketchfab.com/models/abc123/download');
			expect(model.author?.id).toBe('user123');
			expect(model.author?.username).toBe('artist3d');
			expect(model.author?.displayName).toBe('3D Artist');
			expect(model.author?.avatar).toBe('https://example.com/avatar.jpg');
			expect(model.license?.slug).toBe('cc-by');
			expect(model.license?.label).toBe('CC BY 4.0');
			expect(model.tags).toEqual(['character', 'fantasy']);
			expect(model.categories).toEqual(['Characters']);
			expect(model.viewCount).toBe(10000);
			expect(model.likeCount).toBe(500);
			expect(model.faceCount).toBe(50000);
			expect(model.vertexCount).toBe(25000);
			expect(model.isAnimated).toBe(true);
			expect(model.hasSound).toBe(false);
			expect(model.isDownloadable).toBe(true);
			expect(model.archives).toHaveLength(3);
			expect(model.sketchfabId).toBe('abc123');
		});

		it('should build embed and viewer URLs if not provided', () => {
			const apiData: SFModelResult = {
				uid: 'xyz789',
				name: 'Test Model'
			};

			const model = sketchfabAdapter.fromApi(apiData);

			expect(model.embedUrl).toBe('https://sketchfab.com/models/xyz789/embed');
			expect(model.viewerUrl).toBe('https://sketchfab.com/3d-models/xyz789');
		});

		it('should not include download URL if not downloadable', () => {
			const apiData: SFModelResult = {
				uid: 'abc123',
				name: 'Non-downloadable Model',
				isDownloadable: false
			};

			const model = sketchfabAdapter.fromApi(apiData);

			expect(model.downloadUrl).toBeUndefined();
		});

		it('should handle missing optional fields', () => {
			const apiData: SFModelResult = {
				uid: 'minimal123',
				name: 'Minimal Model'
			};

			const model = sketchfabAdapter.fromApi(apiData);

			expect(model.id).toBe('minimal123');
			expect(model.name).toBe('Minimal Model');
			expect(model.description).toBeUndefined();
			expect(model.thumbnailUrl).toBeUndefined();
			expect(model.author).toBeUndefined();
			expect(model.license).toBeUndefined();
			expect(model.tags).toBeUndefined();
			expect(model.archives).toBeUndefined();
		});

		it('should select best thumbnail (prefer 256-1024 width)', () => {
			const apiData: SFModelResult = {
				uid: '1',
				name: 'Test',
				thumbnails: {
					images: [
						{ url: 'tiny.jpg', width: 100, height: 100 },
						{ url: 'medium.jpg', width: 512, height: 512 },
						{ url: 'huge.jpg', width: 4096, height: 4096 }
					]
				}
			};

			const model = sketchfabAdapter.fromApi(apiData);

			expect(model.thumbnailUrl).toBe('medium.jpg');
		});

		it('should fallback to largest thumbnail if no preferred size', () => {
			const apiData: SFModelResult = {
				uid: '1',
				name: 'Test',
				thumbnails: {
					images: [
						{ url: 'tiny.jpg', width: 50, height: 50 },
						{ url: 'small.jpg', width: 100, height: 100 }
					]
				}
			};

			const model = sketchfabAdapter.fromApi(apiData);

			// Should get the larger one (sorted by size)
			expect(model.thumbnailUrl).toBe('small.jpg');
		});

		it('should extract avatar URL from images array', () => {
			const apiData: SFModelResult = {
				uid: '1',
				name: 'Test',
				user: {
					uid: 'u1',
					username: 'user',
					avatar: {
						images: [{ url: 'avatar_from_array.jpg', width: 100, height: 100 }]
					}
				}
			};

			const model = sketchfabAdapter.fromApi(apiData);

			expect(model.author?.avatar).toBe('avatar_from_array.jpg');
		});

		it('should transform archives correctly', () => {
			const apiData: SFModelResult = {
				uid: '1',
				name: 'Test',
				archives: {
					gltf: { size: 1000000, textured: true, url: 'gltf.zip' },
					usdz: { size: 500000, textured: false },
					source: { size: 2000000, textured: true, url: 'source.zip' }
				}
			};

			const model = sketchfabAdapter.fromApi(apiData);

			expect(model.archives).toHaveLength(3);

			const gltf = model.archives?.find((a) => a.format === 'gltf');
			expect(gltf?.size).toBe(1000000);
			expect(gltf?.textured).toBe(true);
			expect(gltf?.url).toBe('gltf.zip');

			const usdz = model.archives?.find((a) => a.format === 'usdz');
			expect(usdz?.size).toBe(500000);
			expect(usdz?.textured).toBe(false);
		});
	});

	describe('fromCollection', () => {
		it('should transform Sketchfab collection to Model3DCollection', () => {
			const apiData: SFCollectionResult = {
				uid: 'col123',
				name: 'My Collection',
				description: 'A collection of cool models',
				modelCount: 25,
				thumbnails: {
					images: [{ url: 'collection_thumb.jpg', width: 512, height: 512 }]
				},
				user: {
					uid: 'user1',
					username: 'collector',
					displayName: 'Model Collector'
				},
				createdAt: '2023-01-01T00:00:00Z',
				updatedAt: '2023-06-15T00:00:00Z'
			};

			const collection = sketchfabAdapter.fromCollection(apiData);

			expect(collection.id).toBe('col123');
			expect(collection.name).toBe('My Collection');
			expect(collection.description).toBe('A collection of cool models');
			expect(collection.modelCount).toBe(25);
			expect(collection.thumbnailUrl).toBe('collection_thumb.jpg');
			expect(collection.author?.id).toBe('user1');
			expect(collection.author?.username).toBe('collector');
			expect(collection.author?.displayName).toBe('Model Collector');
			expect(collection.createdAt).toBe('2023-01-01T00:00:00Z');
			expect(collection.updatedAt).toBe('2023-06-15T00:00:00Z');
		});
	});

	describe('toLicenseType', () => {
		it('should convert license slugs to license types', () => {
			const licenses: Array<{ slug: string; expected: string }> = [
				{ slug: 'cc0', expected: 'cc0' },
				{ slug: 'cc-by', expected: 'cc-by' },
				{ slug: 'cc-by-4.0', expected: 'cc-by' },
				{ slug: 'cc-by-sa', expected: 'cc-by-sa' },
				{ slug: 'cc-by-sa-4.0', expected: 'cc-by-sa' },
				{ slug: 'cc-by-nc', expected: 'cc-by-nc' },
				{ slug: 'cc-by-nc-4.0', expected: 'cc-by-nc' },
				{ slug: 'cc-by-nc-sa', expected: 'cc-by-nc-sa' },
				{ slug: 'cc-by-nc-sa-4.0', expected: 'cc-by-nc-sa' },
				{ slug: 'cc-by-nd', expected: 'cc-by-nd' },
				{ slug: 'cc-by-nd-4.0', expected: 'cc-by-nd' },
				{ slug: 'cc-by-nc-nd', expected: 'cc-by-nc-nd' },
				{ slug: 'cc-by-nc-nd-4.0', expected: 'cc-by-nc-nd' },
				{ slug: 'standard', expected: 'standard' },
				{ slug: 'editorial', expected: 'editorial' },
				{ slug: 'unknown', expected: 'other' }
			];

			licenses.forEach(({ slug, expected }) => {
				const license: SFLicense = { slug, label: slug };
				const type = sketchfabAdapter.toLicenseType(license);
				expect(type).toBe(expected);
			});
		});

		it('should return "other" for undefined license', () => {
			const type = sketchfabAdapter.toLicenseType(undefined);
			expect(type).toBe('other');
		});
	});

	describe('batch transformations', () => {
		it('should transform array of collections', () => {
			const apiArray: SFCollectionResult[] = [
				{ uid: 'col1', name: 'Collection 1', modelCount: 10 },
				{ uid: 'col2', name: 'Collection 2', modelCount: 20 }
			];

			const collections = sketchfabAdapter.fromCollectionMany(apiArray);

			expect(collections).toHaveLength(2);
			expect(collections[0].name).toBe('Collection 1');
			expect(collections[1].modelCount).toBe(20);
		});
	});

	describe('toDisplayFormat', () => {
		it('should format model with displayName', () => {
			const model = {
				id: '1',
				name: 'Cool Model',
				author: {
					id: 'u1',
					username: 'user',
					displayName: 'Artist Name'
				},
				sketchfabId: '1'
			};

			const display = sketchfabAdapter.toDisplayFormat(model);

			expect(display).toBe('Cool Model by Artist Name');
		});

		it('should fallback to username if no displayName', () => {
			const model = {
				id: '1',
				name: 'Cool Model',
				author: {
					id: 'u1',
					username: 'user123'
				},
				sketchfabId: '1'
			};

			const display = sketchfabAdapter.toDisplayFormat(model);

			expect(display).toBe('Cool Model by user123');
		});

		it('should format model without author', () => {
			const model = {
				id: '1',
				name: 'Anonymous Model',
				sketchfabId: '1'
			};

			const display = sketchfabAdapter.toDisplayFormat(model);

			expect(display).toBe('Anonymous Model');
		});
	});
});
