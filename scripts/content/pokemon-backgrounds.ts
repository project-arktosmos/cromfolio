#!/usr/bin/env tsx
/**
 * Pokemon Background Color Generator
 *
 * Analyzes Pokemon images and applies background colors directly to the PNGs
 * based on each Pokemon's dominant color palette.
 *
 * Strategy:
 * 1. Extract non-transparent pixels from PNG images
 * 2. Use k-means clustering to find dominant colors
 * 3. Select the most vibrant (saturated) color
 * 4. Generate a softer, muted version for the background
 * 5. Composite the Pokemon onto the background and save
 *
 * Usage:
 *   pnpm pokemon:backgrounds
 */

import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';

const POKEMON_DIR = join(process.cwd(), 'static', 'pokemon');

interface RGB {
	r: number;
	g: number;
	b: number;
}

interface HSL {
	h: number;
	s: number;
	l: number;
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): HSL {
	r /= 255;
	g /= 255;
	b /= 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0;
	let s = 0;
	const l = (max + min) / 2;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

		switch (max) {
			case r:
				h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
				break;
			case g:
				h = ((b - r) / d + 2) / 6;
				break;
			case b:
				h = ((r - g) / d + 4) / 6;
				break;
		}
	}

	return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): RGB {
	h /= 360;
	s /= 100;
	l /= 100;

	let r: number, g: number, b: number;

	if (s === 0) {
		r = g = b = l;
	} else {
		const hue2rgb = (p: number, q: number, t: number): number => {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		};

		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;

		r = hue2rgb(p, q, h + 1 / 3);
		g = hue2rgb(p, q, h);
		b = hue2rgb(p, q, h - 1 / 3);
	}

	return {
		r: Math.round(r * 255),
		g: Math.round(g * 255),
		b: Math.round(b * 255)
	};
}

/**
 * Calculate Euclidean distance between two colors
 */
function colorDistance(c1: RGB, c2: RGB): number {
	return Math.sqrt(Math.pow(c1.r - c2.r, 2) + Math.pow(c1.g - c2.g, 2) + Math.pow(c1.b - c2.b, 2));
}

/**
 * K-means clustering to find dominant colors
 */
function kMeansClustering(pixels: RGB[], k: number, iterations: number = 10): RGB[] {
	if (pixels.length === 0) return [];
	if (pixels.length < k) k = pixels.length;

	// Initialize centroids by picking evenly spaced pixels
	const step = Math.floor(pixels.length / k);
	let centroids: RGB[] = [];
	for (let i = 0; i < k; i++) {
		centroids.push({ ...pixels[i * step] });
	}

	for (let iter = 0; iter < iterations; iter++) {
		// Assign pixels to nearest centroid
		const clusters: RGB[][] = Array.from({ length: k }, () => []);

		for (const pixel of pixels) {
			let minDist = Infinity;
			let closestIdx = 0;

			for (let i = 0; i < centroids.length; i++) {
				const dist = colorDistance(pixel, centroids[i]);
				if (dist < minDist) {
					minDist = dist;
					closestIdx = i;
				}
			}

			clusters[closestIdx].push(pixel);
		}

		// Update centroids
		centroids = clusters.map((cluster, idx) => {
			if (cluster.length === 0) return centroids[idx];

			const sum = cluster.reduce((acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }), {
				r: 0,
				g: 0,
				b: 0
			});

			return {
				r: Math.round(sum.r / cluster.length),
				g: Math.round(sum.g / cluster.length),
				b: Math.round(sum.b / cluster.length)
			};
		});
	}

	return centroids;
}

/**
 * Extract non-transparent pixels from image buffer
 */
function extractPixelsFromBuffer(data: Buffer, channels: number): RGB[] {
	const pixels: RGB[] = [];

	// Sample every 4th pixel to reduce processing time
	for (let i = 0; i < data.length; i += channels * 4) {
		const alpha = data[i + 3];
		// Only include pixels that are mostly opaque
		if (alpha > 200) {
			pixels.push({
				r: data[i],
				g: data[i + 1],
				b: data[i + 2]
			});
		}
	}

	return pixels;
}

/**
 * Calculate vibrance score for a color (higher saturation = more vibrant)
 */
function getVibrance(color: RGB): number {
	const hsl = rgbToHsl(color.r, color.g, color.b);
	// Prefer saturated colors that aren't too dark or too light
	const lightnessBonus = 1 - Math.abs(hsl.l - 50) / 50;
	return hsl.s * lightnessBonus;
}

/**
 * Find the most vibrant color from a palette
 */
function findMostVibrant(colors: RGB[]): RGB {
	if (colors.length === 0) {
		return { r: 128, g: 128, b: 128 };
	}

	let mostVibrant = colors[0];
	let maxVibrance = getVibrance(colors[0]);

	for (const color of colors) {
		const vibrance = getVibrance(color);
		if (vibrance > maxVibrance) {
			maxVibrance = vibrance;
			mostVibrant = color;
		}
	}

	return mostVibrant;
}

/**
 * Create a softer, muted background color from a dominant color
 * Uses the same hue but reduces saturation and adjusts lightness
 */
function createBackgroundColor(dominantColor: RGB): RGB {
	const hsl = rgbToHsl(dominantColor.r, dominantColor.g, dominantColor.b);

	// Keep the hue, reduce saturation, set to a soft lightness
	const bgHsl: HSL = {
		h: hsl.h,
		s: Math.max(20, hsl.s * 0.4), // Reduce saturation but keep some color
		l: Math.min(85, Math.max(70, hsl.l * 0.8 + 40)) // Soft, light background
	};

	return hslToRgb(bgHsl.h, bgHsl.s, bgHsl.l);
}

/**
 * Parse generation number from folder name
 */
function parseGenerationFolder(folderName: string): number | null {
	const match = folderName.match(/^Generation\s+(\d+)/i);
	return match ? parseInt(match[1], 10) : null;
}

/**
 * Process a single Pokemon image - analyze and apply background
 */
async function processPokemonImage(imagePath: string): Promise<boolean> {
	try {
		// Read the original image
		const image = sharp(imagePath);
		const metadata = await image.metadata();

		if (!metadata.width || !metadata.height) {
			console.log(`  ⚠️ Skipping ${basename(imagePath)} - no dimensions`);
			return false;
		}

		// Get raw pixel data for color analysis
		const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });

		const pixels = extractPixelsFromBuffer(data, info.channels);

		if (pixels.length < 10) {
			console.log(`  ⚠️ Skipping ${basename(imagePath)} - not enough pixels`);
			return false;
		}

		// Find 5 dominant colors using k-means
		const dominantColors = kMeansClustering(pixels, 5, 15);

		// Select the most vibrant color
		const dominantColor = findMostVibrant(dominantColors);

		// Create a soft background color
		const bgColor = createBackgroundColor(dominantColor);

		// Create background layer
		const background = sharp({
			create: {
				width: metadata.width,
				height: metadata.height,
				channels: 3,
				background: bgColor
			}
		}).png();

		// Read original image again for compositing (need fresh instance)
		const originalBuffer = await sharp(imagePath).png().toBuffer();

		// Composite: background + original Pokemon on top
		const result = await background
			.composite([
				{
					input: originalBuffer,
					blend: 'over'
				}
			])
			.png()
			.toBuffer();

		// Save back to the same file
		await sharp(result).toFile(imagePath);

		return true;
	} catch (error) {
		console.log(`  ❌ Error processing ${basename(imagePath)}:`, error);
		return false;
	}
}

/**
 * Scan and process all Pokemon images
 */
async function scanAndProcess(): Promise<{ processed: number; skipped: number }> {
	let totalProcessed = 0;
	let totalSkipped = 0;

	const entries = await readdir(POKEMON_DIR, { withFileTypes: true });
	const genFolders = entries
		.filter((e) => e.isDirectory() && e.name.startsWith('Generation'))
		.sort((a, b) => {
			const aNum = parseGenerationFolder(a.name) ?? 0;
			const bNum = parseGenerationFolder(b.name) ?? 0;
			return aNum - bNum;
		});

	for (const folder of genFolders) {
		const genNum = parseGenerationFolder(folder.name);
		if (!genNum) continue;

		console.log(`\n📦 Processing ${folder.name}...`);

		const folderPath = join(POKEMON_DIR, folder.name);
		const files = await readdir(folderPath);
		const pngFiles = files.filter((f) => f.endsWith('.png'));

		let genProcessed = 0;
		let genSkipped = 0;

		for (let i = 0; i < pngFiles.length; i++) {
			const file = pngFiles[i];
			const imagePath = join(folderPath, file);

			const success = await processPokemonImage(imagePath);
			if (success) {
				genProcessed++;
			} else {
				genSkipped++;
			}

			// Progress indicator every 10 Pokemon
			if ((i + 1) % 10 === 0) {
				process.stdout.write(`\r  Processing: ${i + 1}/${pngFiles.length}`);
			}
		}

		console.log(`\r  ✅ Processed ${genProcessed}/${pngFiles.length} Pokemon`);
		totalProcessed += genProcessed;
		totalSkipped += genSkipped;
	}

	return { processed: totalProcessed, skipped: totalSkipped };
}

async function main(): Promise<void> {
	console.log('🎨 Pokemon Background Color Applier\n');
	console.log(
		'Strategy: Extract dominant colors → Find most vibrant → Apply soft background to PNG\n'
	);
	console.log('⚠️  WARNING: This will MODIFY the original PNG files!\n');

	const startTime = Date.now();

	const { processed, skipped } = await scanAndProcess();

	console.log(`\n📊 Summary:`);
	console.log(`   Pokemon updated: ${processed}`);
	console.log(`   Skipped: ${skipped}`);

	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
	console.log(`\n✨ Done in ${elapsed}s`);
}

main().catch((err) => {
	console.error('❌ Error:', err);
	process.exit(1);
});
