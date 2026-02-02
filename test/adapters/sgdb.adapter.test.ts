import { describe, it, expect } from 'vitest';
import { sgdbAdapter, type SGDBImageResult } from '$adapters/classes/sgdb.adapter';

describe('sgdb.adapter', () => {
	describe('fromApi (grid)', () => {
		it('should transform SGDB image result to GameImage as grid', () => {
			const apiData: SGDBImageResult = {
				id: 12345,
				url: 'https://example.com/grid.png',
				thumb: 'https://example.com/grid_thumb.png',
				width: 600,
				height: 900,
				mime: 'image/png',
				language: 'en',
				style: 'alternate',
				score: 4.5,
				upvotes: 100,
				downvotes: 5,
				nsfw: false,
				humor: false,
				epilepsy: false,
				notes: 'High quality grid',
				author: {
					name: 'GridMaker',
					steam64: '76561198000000000',
					avatar: 'https://example.com/avatar.jpg'
				},
				lock: false
			};

			const image = sgdbAdapter.fromApi(apiData);

			expect(image.id).toBe('12345');
			expect(image.url).toBe('https://example.com/grid.png');
			expect(image.thumbUrl).toBe('https://example.com/grid_thumb.png');
			expect(image.type).toBe('grid');
			expect(image.width).toBe(600);
			expect(image.height).toBe(900);
			expect(image.style).toBe('alternate');
			expect(image.mimeType).toBe('image/png');
			expect(image.animated).toBe(false);
			expect(image.nsfw).toBe(false);
			expect(image.humor).toBe(false);
			expect(image.epilepsy).toBe(false);
			expect(image.score).toBe(4.5);
			expect(image.upvotes).toBe(100);
			expect(image.downvotes).toBe(5);
			expect(image.author?.name).toBe('GridMaker');
			expect(image.author?.avatar).toBe('https://example.com/avatar.jpg');
		});

		it('should detect animated images from mime type', () => {
			const gifImage: SGDBImageResult = {
				id: 1,
				url: 'test.gif',
				thumb: 'test_thumb.gif',
				width: 100,
				height: 100,
				mime: 'image/gif'
			};

			const webpImage: SGDBImageResult = {
				id: 2,
				url: 'test.webp',
				thumb: 'test_thumb.webp',
				width: 100,
				height: 100,
				mime: 'image/webp'
			};

			expect(sgdbAdapter.fromApi(gifImage).animated).toBe(true);
			expect(sgdbAdapter.fromApi(webpImage).animated).toBe(true);
		});

		it('should handle missing optional fields', () => {
			const apiData: SGDBImageResult = {
				id: 1,
				url: 'https://example.com/image.png',
				thumb: 'https://example.com/thumb.png',
				width: 460,
				height: 215
			};

			const image = sgdbAdapter.fromApi(apiData);

			expect(image.id).toBe('1');
			expect(image.style).toBeUndefined();
			expect(image.mimeType).toBeUndefined();
			expect(image.animated).toBeFalsy();
			expect(image.author).toBeUndefined();
		});

		it('should normalize style values', () => {
			const styles = [
				{ input: 'alternate', expected: 'alternate' },
				{ input: 'blurred', expected: 'blurred' },
				{ input: 'white_logo', expected: 'white_logo' },
				{ input: 'material', expected: 'material' },
				{ input: 'no_logo', expected: 'no_logo' },
				{ input: 'unknown', expected: undefined }
			];

			styles.forEach(({ input, expected }) => {
				const apiData: SGDBImageResult = {
					id: 1,
					url: 'test.png',
					thumb: 'test_thumb.png',
					width: 100,
					height: 100,
					style: input
				};
				const image = sgdbAdapter.fromApi(apiData);
				expect(image.style).toBe(expected);
			});
		});
	});

	describe('fromGrid', () => {
		it('should set type as grid', () => {
			const apiData: SGDBImageResult = {
				id: 1,
				url: 'grid.png',
				thumb: 'thumb.png',
				width: 600,
				height: 900
			};

			const image = sgdbAdapter.fromGrid(apiData);

			expect(image.type).toBe('grid');
		});
	});

	describe('fromHero', () => {
		it('should set type as hero', () => {
			const apiData: SGDBImageResult = {
				id: 1,
				url: 'hero.png',
				thumb: 'thumb.png',
				width: 1920,
				height: 620
			};

			const image = sgdbAdapter.fromHero(apiData);

			expect(image.type).toBe('hero');
		});
	});

	describe('fromLogo', () => {
		it('should set type as logo', () => {
			const apiData: SGDBImageResult = {
				id: 1,
				url: 'logo.png',
				thumb: 'thumb.png',
				width: 400,
				height: 200
			};

			const image = sgdbAdapter.fromLogo(apiData);

			expect(image.type).toBe('logo');
		});
	});

	describe('fromIcon', () => {
		it('should set type as icon', () => {
			const apiData: SGDBImageResult = {
				id: 1,
				url: 'icon.png',
				thumb: 'thumb.png',
				width: 256,
				height: 256
			};

			const image = sgdbAdapter.fromIcon(apiData);

			expect(image.type).toBe('icon');
		});
	});

	describe('batch transformations', () => {
		it('should transform array of grids', () => {
			const apiArray: SGDBImageResult[] = [
				{ id: 1, url: 'grid1.png', thumb: 'thumb1.png', width: 600, height: 900 },
				{ id: 2, url: 'grid2.png', thumb: 'thumb2.png', width: 600, height: 900 }
			];

			const images = sgdbAdapter.fromGridMany(apiArray);

			expect(images).toHaveLength(2);
			expect(images[0].type).toBe('grid');
			expect(images[1].type).toBe('grid');
		});

		it('should transform array of heroes', () => {
			const apiArray: SGDBImageResult[] = [
				{ id: 1, url: 'hero1.png', thumb: 'thumb1.png', width: 1920, height: 620 },
				{ id: 2, url: 'hero2.png', thumb: 'thumb2.png', width: 1920, height: 620 }
			];

			const images = sgdbAdapter.fromHeroMany(apiArray);

			expect(images).toHaveLength(2);
			expect(images[0].type).toBe('hero');
		});

		it('should transform array of logos', () => {
			const apiArray: SGDBImageResult[] = [
				{ id: 1, url: 'logo1.png', thumb: 'thumb1.png', width: 400, height: 200 },
				{ id: 2, url: 'logo2.png', thumb: 'thumb2.png', width: 400, height: 200 }
			];

			const images = sgdbAdapter.fromLogoMany(apiArray);

			expect(images).toHaveLength(2);
			expect(images[0].type).toBe('logo');
		});

		it('should transform array of icons', () => {
			const apiArray: SGDBImageResult[] = [
				{ id: 1, url: 'icon1.png', thumb: 'thumb1.png', width: 256, height: 256 },
				{ id: 2, url: 'icon2.png', thumb: 'thumb2.png', width: 256, height: 256 }
			];

			const images = sgdbAdapter.fromIconMany(apiArray);

			expect(images).toHaveLength(2);
			expect(images[0].type).toBe('icon');
		});
	});

	describe('toDisplayFormat', () => {
		it('should format image with author', () => {
			const image = {
				id: '1',
				url: 'test.png',
				thumbUrl: 'thumb.png',
				type: 'grid' as const,
				width: 600,
				height: 900,
				author: { name: 'Artist' }
			};

			const display = sgdbAdapter.toDisplayFormat(image);

			expect(display).toBe('grid (600x900) by Artist');
		});

		it('should format image without author', () => {
			const image = {
				id: '1',
				url: 'test.png',
				thumbUrl: 'thumb.png',
				type: 'hero' as const,
				width: 1920,
				height: 620
			};

			const display = sgdbAdapter.toDisplayFormat(image);

			expect(display).toBe('hero (1920x620)');
		});
	});
});
