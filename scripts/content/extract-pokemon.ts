#!/usr/bin/env tsx
/**
 * Pokemon Content Extraction Script
 *
 * Creates sources and collections for all Pokemon from the static/pokemon folder:
 * - One source per generation (9 sources total)
 * - One sticker per Pokemon
 * - One collection for "All Pokemon"
 * - One collection per generation
 * - Tags for ALL Pokemon attributes from CSV data
 *
 * Usage:
 *   pnpm content:pokemon
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createSqliteAdapter } from './core/db/sqlite-adapter.js';
import type { Source, Sticker, ID } from './core/types.js';

const POKEMON_DIR = join(process.cwd(), 'static', 'pokemon');
const CSV_PATH = join(POKEMON_DIR, 'data', 'pokemon_v2.csv');
const DB_PATH = join(process.cwd(), 'app.db');

// Map generation number to cover image filename
const GENERATION_COVERS: Record<number, string> = {
	1: '/pokemon/covers/Kanto Poster WT.png',
	2: '/pokemon/covers/Johto Poster WT.png',
	3: '/pokemon/covers/Hoenn Poster WT.png',
	4: '/pokemon/covers/Sinnoh Poster WT.png',
	5: '/pokemon/covers/Unova Poster WT.png',
	6: '/pokemon/covers/Kalos Poster WT.png',
	7: '/pokemon/covers/Alola Poster WT.png',
	8: '/pokemon/covers/Galar Poster WT.png',
	9: '/pokemon/covers/Paldea Scarlet WT.png'
};

interface GenerationData {
	name: string;
	number: number;
	folderName: string;
	coverImage: string;
	pokemon: PokemonData[];
}

interface PokemonData {
	number: number;
	name: string;
	filename: string;
	imagePath: string;
}

interface PokemonCsvData {
	number: number;
	name: string;
	nameUrl: string;
	hp: number;
	attack: number;
	defense: number;
	spAttack: number;
	spDefense: number;
	speed: number;
	primaryType: string;
	secondaryType: string;
	ability1: string;
	ability2: string;
	hiddenAbility: string;
	generation: number;
	malePercent: number;
	femalePercent: number;
	againstNormal: number;
	againstFire: number;
	againstWater: number;
	againstElectric: number;
	againstGrass: number;
	againstIce: number;
	againstFight: number;
	againstPoison: number;
	againstGround: number;
	againstFlying: number;
	againstPsychic: number;
	againstBug: number;
	againstRock: number;
	againstGhost: number;
	againstDragon: number;
	againstDark: number;
	againstSteel: number;
	againstFairy: number;
	heightM: number;
	weightKg: number;
	captureRate: number;
	baseHappiness: number;
	baseEggSteps: number;
	experienceGrowth: string;
	megaEvolution: boolean;
	legendary: boolean;
}

/**
 * Parse the Pokemon CSV file
 */
async function parsePokemonCsv(): Promise<Map<number, PokemonCsvData>> {
	const content = await readFile(CSV_PATH, 'utf-8');
	const lines = content.trim().split('\n');
	const pokemonMap = new Map<number, PokemonCsvData>();

	// Skip header
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		const cols = parseCSVLine(line);

		const number = parseInt(cols[0], 10);
		if (isNaN(number)) continue;

		pokemonMap.set(number, {
			number,
			name: cols[1],
			nameUrl: cols[2],
			hp: parseInt(cols[3], 10) || 0,
			attack: parseInt(cols[4], 10) || 0,
			defense: parseInt(cols[5], 10) || 0,
			spAttack: parseInt(cols[6], 10) || 0,
			spDefense: parseInt(cols[7], 10) || 0,
			speed: parseInt(cols[8], 10) || 0,
			primaryType: cols[9]?.toLowerCase() || '',
			secondaryType: cols[10]?.toLowerCase() || '',
			ability1: cols[11] || '',
			ability2: cols[12] || '',
			hiddenAbility: cols[13] || '',
			generation: parseInt(cols[14], 10) || 0,
			malePercent: parseFloat(cols[15]) || 0,
			femalePercent: parseFloat(cols[16]) || 0,
			againstNormal: parseFloat(cols[17]) || 1,
			againstFire: parseFloat(cols[18]) || 1,
			againstWater: parseFloat(cols[19]) || 1,
			againstElectric: parseFloat(cols[20]) || 1,
			againstGrass: parseFloat(cols[21]) || 1,
			againstIce: parseFloat(cols[22]) || 1,
			againstFight: parseFloat(cols[23]) || 1,
			againstPoison: parseFloat(cols[24]) || 1,
			againstGround: parseFloat(cols[25]) || 1,
			againstFlying: parseFloat(cols[26]) || 1,
			againstPsychic: parseFloat(cols[27]) || 1,
			againstBug: parseFloat(cols[28]) || 1,
			againstRock: parseFloat(cols[29]) || 1,
			againstGhost: parseFloat(cols[30]) || 1,
			againstDragon: parseFloat(cols[31]) || 1,
			againstDark: parseFloat(cols[32]) || 1,
			againstSteel: parseFloat(cols[33]) || 1,
			againstFairy: parseFloat(cols[34]) || 1,
			heightM: parseFloat(cols[35]) || 0,
			weightKg: parseFloat(cols[36]) || 0,
			captureRate: parseInt(cols[37], 10) || 0,
			baseHappiness: parseInt(cols[38], 10) || 0,
			baseEggSteps: parseInt(cols[39], 10) || 0,
			experienceGrowth: cols[40] || '',
			megaEvolution: cols[41] === '1',
			legendary: cols[42] === '1'
		});
	}

	return pokemonMap;
}

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === ',' && !inQuotes) {
			result.push(current.trim());
			current = '';
		} else {
			current += char;
		}
	}
	result.push(current.trim());

	return result;
}

/**
 * Parse Pokemon filename to extract number and name
 * Format: "0001 Bulbasaur.png" -> { number: 1, name: "Bulbasaur" }
 */
function parsePokemonFilename(filename: string): { number: number; name: string } | null {
	const match = filename.match(/^(\d{4})\s+(.+)\.png$/i);
	if (!match) return null;

	return {
		number: parseInt(match[1], 10),
		name: match[2].trim()
	};
}

/**
 * Parse generation folder name
 * Format: "Generation 1 Pokémon" -> { number: 1, name: "Generation 1" }
 */
function parseGenerationFolder(folderName: string): { number: number; name: string } | null {
	const match = folderName.match(/^Generation\s+(\d+)/i);
	if (!match) return null;

	return {
		number: parseInt(match[1], 10),
		name: `Generation ${match[1]}`
	};
}

async function scanPokemonDirectory(): Promise<GenerationData[]> {
	const generations: GenerationData[] = [];

	// Read generation folders
	const entries = await readdir(POKEMON_DIR, { withFileTypes: true });
	const genFolders = entries
		.filter(e => e.isDirectory() && e.name.startsWith('Generation'))
		.sort((a, b) => {
			const aNum = parseGenerationFolder(a.name)?.number ?? 0;
			const bNum = parseGenerationFolder(b.name)?.number ?? 0;
			return aNum - bNum;
		});

	for (const folder of genFolders) {
		const genInfo = parseGenerationFolder(folder.name);
		if (!genInfo) continue;

		const folderPath = join(POKEMON_DIR, folder.name);
		const files = await readdir(folderPath);

		const pokemon: PokemonData[] = [];
		for (const file of files) {
			if (!file.endsWith('.png')) continue;

			const parsed = parsePokemonFilename(file);
			if (!parsed) continue;

			pokemon.push({
				number: parsed.number,
				name: parsed.name,
				filename: file,
				imagePath: `/pokemon/${folder.name}/${file}`
			});
		}

		// Sort by Pokemon number
		pokemon.sort((a, b) => a.number - b.number);

		generations.push({
			name: genInfo.name,
			number: genInfo.number,
			folderName: folder.name,
			coverImage: GENERATION_COVERS[genInfo.number] || pokemon[0]?.imagePath || '',
			pokemon
		});
	}

	return generations;
}

async function main(): Promise<void> {
	console.log('📄 Loading Pokemon CSV data...');
	const csvData = await parsePokemonCsv();
	console.log(`   Loaded data for ${csvData.size} Pokemon\n`);

	console.log('🔍 Scanning Pokemon directory...');
	const generations = await scanPokemonDirectory();

	const totalPokemon = generations.reduce((sum, gen) => sum + gen.pokemon.length, 0);
	console.log(`📊 Found ${generations.length} generations with ${totalPokemon} Pokemon total\n`);

	for (const gen of generations) {
		console.log(`  ${gen.name}: ${gen.pokemon.length} Pokemon`);
	}
	console.log('');

	// Connect to database
	console.log('🔗 Connecting to database...');
	const db = createSqliteAdapter(DB_PATH);

	let totalTagAssociations = 0;

	try {
		// Track all created stickers for the "All Pokemon" collection
		const allStickers: Sticker[] = [];
		const generationStickers: Map<string, Sticker[]> = new Map();
		const pokemonNumberToSticker: Map<number, Sticker> = new Map();

		// Create sources and stickers for each generation
		for (const gen of generations) {
			console.log(`\n📦 Processing ${gen.name}...`);

			// Check if source already exists
			let source = await db.findSourceByTitle(`Pokemon ${gen.name}`);

			if (!source) {
				// Create source for this generation
				source = await db.createSource({
					sourceType: 'videogame',
					title: `Pokemon ${gen.name}`,
					description: `All Pokemon from ${gen.name} of the Pokemon franchise`,
					coverImage: gen.coverImage
				});
				console.log(`  ✅ Created source: ${source.title}`);
			} else {
				console.log(`  ⏭️  Source already exists: ${source.title}`);
			}

			// Create stickers for each Pokemon in this generation
			const stickers: Partial<Sticker>[] = gen.pokemon.map(pokemon => ({
				sourceId: source!.id,
				name: pokemon.name,
				image: pokemon.imagePath,
				imageSource: 'local'
			}));

			if (stickers.length > 0) {
				const created = await db.createStickersBatch(stickers);
				console.log(`  ✅ Created ${created.length} stickers`);

				// Map Pokemon number to sticker for tag association
				for (let i = 0; i < gen.pokemon.length; i++) {
					pokemonNumberToSticker.set(gen.pokemon[i].number, created[i]);
				}

				allStickers.push(...created);
				generationStickers.set(gen.name, created);
			}
		}

		// Create tags for each Pokemon - ALL CSV attributes
		console.log('\n🏷️  Creating tags from CSV data (all attributes)...');

		for (const [pokemonNumber, sticker] of pokemonNumberToSticker) {
			const data = csvData.get(pokemonNumber);
			if (!data) {
				console.log(`  ⚠️  No CSV data for Pokemon #${pokemonNumber}`);
				continue;
			}

			const tagsToCreate: { key: string; value: string }[] = [];

			// Basic info
			tagsToCreate.push({ key: 'pokedex-number', value: String(data.number) });

			// Types
			if (data.primaryType) {
				tagsToCreate.push({ key: 'type', value: data.primaryType });
			}
			if (data.secondaryType) {
				tagsToCreate.push({ key: 'type', value: data.secondaryType });
			}

			// Abilities
			if (data.ability1) {
				tagsToCreate.push({ key: 'ability', value: data.ability1 });
			}
			if (data.ability2) {
				tagsToCreate.push({ key: 'ability', value: data.ability2 });
			}
			if (data.hiddenAbility) {
				tagsToCreate.push({ key: 'hidden-ability', value: data.hiddenAbility });
			}

			// Generation
			tagsToCreate.push({ key: 'generation', value: String(data.generation) });

			// Base stats
			tagsToCreate.push({ key: 'hp', value: String(data.hp) });
			tagsToCreate.push({ key: 'attack', value: String(data.attack) });
			tagsToCreate.push({ key: 'defense', value: String(data.defense) });
			tagsToCreate.push({ key: 'sp-attack', value: String(data.spAttack) });
			tagsToCreate.push({ key: 'sp-defense', value: String(data.spDefense) });
			tagsToCreate.push({ key: 'speed', value: String(data.speed) });

			// Base stat total
			const bst = data.hp + data.attack + data.defense + data.spAttack + data.spDefense + data.speed;
			tagsToCreate.push({ key: 'base-stat-total', value: String(bst) });

			// Gender ratios
			tagsToCreate.push({ key: 'male-percent', value: String(data.malePercent) });
			tagsToCreate.push({ key: 'female-percent', value: String(data.femalePercent) });

			// Type matchups (damage multipliers)
			tagsToCreate.push({ key: 'against-normal', value: String(data.againstNormal) });
			tagsToCreate.push({ key: 'against-fire', value: String(data.againstFire) });
			tagsToCreate.push({ key: 'against-water', value: String(data.againstWater) });
			tagsToCreate.push({ key: 'against-electric', value: String(data.againstElectric) });
			tagsToCreate.push({ key: 'against-grass', value: String(data.againstGrass) });
			tagsToCreate.push({ key: 'against-ice', value: String(data.againstIce) });
			tagsToCreate.push({ key: 'against-fighting', value: String(data.againstFight) });
			tagsToCreate.push({ key: 'against-poison', value: String(data.againstPoison) });
			tagsToCreate.push({ key: 'against-ground', value: String(data.againstGround) });
			tagsToCreate.push({ key: 'against-flying', value: String(data.againstFlying) });
			tagsToCreate.push({ key: 'against-psychic', value: String(data.againstPsychic) });
			tagsToCreate.push({ key: 'against-bug', value: String(data.againstBug) });
			tagsToCreate.push({ key: 'against-rock', value: String(data.againstRock) });
			tagsToCreate.push({ key: 'against-ghost', value: String(data.againstGhost) });
			tagsToCreate.push({ key: 'against-dragon', value: String(data.againstDragon) });
			tagsToCreate.push({ key: 'against-dark', value: String(data.againstDark) });
			tagsToCreate.push({ key: 'against-steel', value: String(data.againstSteel) });
			tagsToCreate.push({ key: 'against-fairy', value: String(data.againstFairy) });

			// Physical attributes
			tagsToCreate.push({ key: 'height-m', value: String(data.heightM) });
			tagsToCreate.push({ key: 'weight-kg', value: String(data.weightKg) });

			// Catch/breeding stats
			tagsToCreate.push({ key: 'capture-rate', value: String(data.captureRate) });
			tagsToCreate.push({ key: 'base-happiness', value: String(data.baseHappiness) });
			tagsToCreate.push({ key: 'base-egg-steps', value: String(data.baseEggSteps) });

			// Experience growth
			if (data.experienceGrowth) {
				tagsToCreate.push({ key: 'experience-growth', value: data.experienceGrowth });
			}

			// Special status
			if (data.megaEvolution) {
				tagsToCreate.push({ key: 'mega-evolution', value: 'true' });
			}
			if (data.legendary) {
				tagsToCreate.push({ key: 'legendary', value: 'true' });
			}

			// Create and associate tags
			for (const { key, value } of tagsToCreate) {
				const tag = await db.findOrCreateTag(key, value);
				await db.addTagToSticker(sticker.id as ID, tag.id as ID);
				totalTagAssociations++;
			}
		}

		console.log(`  ✅ Created ${totalTagAssociations} tag associations`);

		// Create collections
		console.log('\n📚 Creating collections...');

		// Create "All Pokemon" collection (use Gen 1 Kanto cover)
		let allPokemonCollection = await db.findCollectionByTitle('All Pokemon');
		if (!allPokemonCollection) {
			allPokemonCollection = await db.createCollection({
				collectionTypeId: 'pokemon',
				title: 'All Pokemon',
				description: `Complete collection of all ${totalPokemon} Pokemon across all generations`,
				coverImage: GENERATION_COVERS[1]
			});
			console.log(`  ✅ Created collection: ${allPokemonCollection.title}`);
		} else {
			console.log(`  ⏭️  Collection already exists: ${allPokemonCollection.title}`);
		}

		// Add all stickers to the "All Pokemon" collection
		console.log(`  📎 Adding ${allStickers.length} stickers to "All Pokemon" collection...`);
		for (let i = 0; i < allStickers.length; i++) {
			const sticker = allStickers[i];
			await db.addStickerToCollection(allPokemonCollection.id, sticker.id, i);
		}

		// Create collection for each generation
		for (const gen of generations) {
			const genStickers = generationStickers.get(gen.name) ?? [];

			let genCollection = await db.findCollectionByTitle(`Pokemon ${gen.name}`);
			if (!genCollection) {
				genCollection = await db.createCollection({
					collectionTypeId: 'pokemon',
					title: `Pokemon ${gen.name}`,
					description: `Collection of all ${genStickers.length} Pokemon from ${gen.name}`,
					coverImage: gen.coverImage
				});
				console.log(`  ✅ Created collection: ${genCollection.title}`);
			} else {
				console.log(`  ⏭️  Collection already exists: ${genCollection.title}`);
			}

			// Add stickers to generation collection
			for (let i = 0; i < genStickers.length; i++) {
				const sticker = genStickers[i];
				await db.addStickerToCollection(genCollection.id, sticker.id, i);
			}
		}

		console.log('\n✨ Pokemon extraction complete!');
		console.log(`   Sources created: ${generations.length}`);
		console.log(`   Stickers created: ${allStickers.length}`);
		console.log(`   Tag associations: ${totalTagAssociations}`);
		console.log(`   Collections created: ${generations.length + 1} (${generations.length} generations + 1 "All Pokemon")`);

	} finally {
		db.close();
	}
}

main().catch(err => {
	console.error('❌ Error:', err);
	process.exit(1);
});
