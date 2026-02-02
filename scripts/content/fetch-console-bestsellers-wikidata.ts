/**
 * Fetch best-selling video games by console from Wikidata
 *
 * Uses the Wikidata SPARQL endpoint to query for:
 * - Video games (P31 = Q7889) that are for specific platforms (P400)
 * - Copies sold data (P2664)
 *
 * This provides structured data with Wikidata IDs for cross-referencing.
 *
 * Output format matches the Wikipedia fetcher:
 * {
 *   "playstation-4": {
 *     "name": "PlayStation 4",
 *     "games": [
 *       { "rank": 1, "title": "...", "copies": 20.0, "wikidataId": "Q..." }
 *     ]
 *   }
 * }
 *
 * Run with: npx tsx scripts/content/fetch-console-bestsellers-wikidata.ts
 */

const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'CromfolioGameFetcher/1.0 (game sales data collector)';
const RATE_LIMIT_MS = 2000;

/**
 * Console Wikidata IDs for consoles released after 2000
 */
interface ConsoleWikidata {
	id: string;
	name: string;
	manufacturer: string;
	releaseYear: number;
	wikidataId: string; // Wikidata Q-ID for the console
	type: 'home' | 'handheld' | 'hybrid';
}

const CONSOLES_POST_2000: ConsoleWikidata[] = [
	// Sony
	{
		id: 'playstation-2',
		name: 'PlayStation 2',
		manufacturer: 'Sony',
		releaseYear: 2000,
		wikidataId: 'Q10680',
		type: 'home'
	},
	{
		id: 'playstation-portable',
		name: 'PlayStation Portable',
		manufacturer: 'Sony',
		releaseYear: 2004,
		wikidataId: 'Q170325',
		type: 'handheld'
	},
	{
		id: 'playstation-3',
		name: 'PlayStation 3',
		manufacturer: 'Sony',
		releaseYear: 2006,
		wikidataId: 'Q10683',
		type: 'home'
	},
	{
		id: 'playstation-vita',
		name: 'PlayStation Vita',
		manufacturer: 'Sony',
		releaseYear: 2011,
		wikidataId: 'Q188808',
		type: 'handheld'
	},
	{
		id: 'playstation-4',
		name: 'PlayStation 4',
		manufacturer: 'Sony',
		releaseYear: 2013,
		wikidataId: 'Q5014725',
		type: 'home'
	},
	{
		id: 'playstation-5',
		name: 'PlayStation 5',
		manufacturer: 'Sony',
		releaseYear: 2020,
		wikidataId: 'Q63184502',
		type: 'home'
	},

	// Microsoft
	{
		id: 'xbox',
		name: 'Xbox',
		manufacturer: 'Microsoft',
		releaseYear: 2001,
		wikidataId: 'Q132020',
		type: 'home'
	},
	{
		id: 'xbox-360',
		name: 'Xbox 360',
		manufacturer: 'Microsoft',
		releaseYear: 2005,
		wikidataId: 'Q48263',
		type: 'home'
	},
	{
		id: 'xbox-one',
		name: 'Xbox One',
		manufacturer: 'Microsoft',
		releaseYear: 2013,
		wikidataId: 'Q13361286',
		type: 'home'
	},
	{
		id: 'xbox-series',
		name: 'Xbox Series X/S',
		manufacturer: 'Microsoft',
		releaseYear: 2020,
		wikidataId: 'Q64513817',
		type: 'home'
	},

	// Nintendo
	{
		id: 'game-boy-advance',
		name: 'Game Boy Advance',
		manufacturer: 'Nintendo',
		releaseYear: 2001,
		wikidataId: 'Q188642',
		type: 'handheld'
	},
	{
		id: 'gamecube',
		name: 'GameCube',
		manufacturer: 'Nintendo',
		releaseYear: 2001,
		wikidataId: 'Q182172',
		type: 'home'
	},
	{
		id: 'nintendo-ds',
		name: 'Nintendo DS',
		manufacturer: 'Nintendo',
		releaseYear: 2004,
		wikidataId: 'Q170323',
		type: 'handheld'
	},
	{
		id: 'wii',
		name: 'Wii',
		manufacturer: 'Nintendo',
		releaseYear: 2006,
		wikidataId: 'Q8079',
		type: 'home'
	},
	{
		id: 'nintendo-3ds',
		name: 'Nintendo 3DS',
		manufacturer: 'Nintendo',
		releaseYear: 2011,
		wikidataId: 'Q203597',
		type: 'handheld'
	},
	{
		id: 'wii-u',
		name: 'Wii U',
		manufacturer: 'Nintendo',
		releaseYear: 2012,
		wikidataId: 'Q56942',
		type: 'home'
	},
	{
		id: 'nintendo-switch',
		name: 'Nintendo Switch',
		manufacturer: 'Nintendo',
		releaseYear: 2017,
		wikidataId: 'Q19610114',
		type: 'hybrid'
	}
];

interface WikidataGame {
	wikidataId: string;
	title: string;
	copies: number;
	developer?: string;
	publisher?: string;
	releaseDate?: string;
}

interface ConsoleData {
	id: string;
	name: string;
	releaseYear: number;
	manufacturer: string;
	type: 'home' | 'handheld' | 'hybrid';
	wikidataId: string;
	games: Array<WikidataGame & { rank: number }>;
	fetchedAt: string;
}

interface OutputData {
	[consoleId: string]: ConsoleData;
}

/**
 * Execute a SPARQL query against Wikidata
 */
async function sparqlQuery<T>(query: string): Promise<T[]> {
	const url = new URL(WIKIDATA_SPARQL_ENDPOINT);
	url.searchParams.set('query', query);
	url.searchParams.set('format', 'json');

	const response = await fetch(url.toString(), {
		headers: {
			Accept: 'application/sparql-results+json',
			'User-Agent': USER_AGENT
		}
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}\n${text}`);
	}

	const data = await response.json();
	return data.results.bindings;
}

/**
 * Sleep for rate limiting
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch best-selling games for a specific console from Wikidata
 *
 * SPARQL query explanation:
 * - ?game wdt:P31/wdt:P279* wd:Q7889 : game is instance of video game (or subclass)
 * - ?game wdt:P400 wd:{platformId} : game platform is the target console
 * - ?game wdt:P2664 ?copies : game has copies sold property
 */
async function fetchConsoleGamesWikidata(
	console: ConsoleWikidata,
	maxGames: number = 100
): Promise<WikidataGame[]> {
	const query = `
		SELECT DISTINCT ?game ?gameLabel ?copies ?developerLabel ?publisherLabel ?releaseDate
		WHERE {
			# Game is a video game
			?game wdt:P31/wdt:P279* wd:Q7889 .

			# Game is for this platform
			?game wdt:P400 wd:${console.wikidataId} .

			# Game has copies sold data
			?game wdt:P2664 ?copies .

			# Optional: developer
			OPTIONAL { ?game wdt:P178 ?developer . }

			# Optional: publisher
			OPTIONAL { ?game wdt:P123 ?publisher . }

			# Optional: release date (publication date)
			OPTIONAL { ?game wdt:P577 ?releaseDate . }

			SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
		}
		ORDER BY DESC(?copies)
		LIMIT ${maxGames}
	`;

	const results = await sparqlQuery<{
		game: { value: string };
		gameLabel: { value: string };
		copies: { value: string };
		developerLabel?: { value: string };
		publisherLabel?: { value: string };
		releaseDate?: { value: string };
	}>(query);

	return results.map((r) => ({
		wikidataId: r.game.value.replace('http://www.wikidata.org/entity/', ''),
		title: r.gameLabel.value,
		copies: parseFloat(r.copies.value) / 1000000, // Convert to millions
		developer: r.developerLabel?.value,
		publisher: r.publisherLabel?.value,
		releaseDate: r.releaseDate?.value?.split('T')[0]
	}));
}

/**
 * Alternative query: Fetch games with sales data from any source
 * This is a fallback when P2664 (copies sold) data is sparse
 */
async function fetchConsoleGamesAlternative(
	console: ConsoleWikidata,
	maxGames: number = 100
): Promise<WikidataGame[]> {
	// Try to get games with any sales-related qualifier
	const query = `
		SELECT DISTINCT ?game ?gameLabel ?copies
		WHERE {
			?game wdt:P31/wdt:P279* wd:Q7889 .
			?game wdt:P400 wd:${console.wikidataId} .

			# Try different sales properties
			{
				?game wdt:P2664 ?copies .
			}
			UNION
			{
				?game p:P2664 ?statement .
				?statement ps:P2664 ?copies .
			}

			SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
		}
		ORDER BY DESC(?copies)
		LIMIT ${maxGames}
	`;

	try {
		const results = await sparqlQuery<{
			game: { value: string };
			gameLabel: { value: string };
			copies: { value: string };
		}>(query);

		return results.map((r) => ({
			wikidataId: r.game.value.replace('http://www.wikidata.org/entity/', ''),
			title: r.gameLabel.value,
			copies: parseFloat(r.copies.value) / 1000000
		}));
	} catch (error) {
		console.log('    Alternative query failed, returning empty');
		return [];
	}
}

/**
 * Fetch all video games for a platform (without sales data requirement)
 * Useful to understand Wikidata coverage
 */
async function fetchPlatformGameCount(console: ConsoleWikidata): Promise<number> {
	const query = `
		SELECT (COUNT(DISTINCT ?game) as ?count)
		WHERE {
			?game wdt:P31/wdt:P279* wd:Q7889 .
			?game wdt:P400 wd:${console.wikidataId} .
		}
	`;

	try {
		const results = await sparqlQuery<{ count: { value: string } }>(query);
		return parseInt(results[0]?.count?.value || '0', 10);
	} catch {
		return 0;
	}
}

/**
 * Main execution
 */
async function main() {
	const args = process.argv.slice(2);

	let outputFile = 'src/data/games/console-bestsellers-wikidata.json';
	let maxGames = 100;
	let consoleFilter: string[] = [];
	let manufacturerFilter: string | null = null;
	let showCoverage = false;
	let listConsoles = false;

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case '--output':
			case '-o':
				outputFile = args[++i];
				break;
			case '--max':
			case '-m':
				maxGames = parseInt(args[++i], 10);
				break;
			case '--console':
			case '-c':
				consoleFilter.push(args[++i]);
				break;
			case '--manufacturer':
				manufacturerFilter = args[++i].toLowerCase();
				break;
			case '--coverage':
				showCoverage = true;
				break;
			case '--list':
			case '-l':
				listConsoles = true;
				break;
			case '--help':
			case '-h':
				console.log(`
Console Best-Sellers Wikidata Fetcher

Usage: npx tsx scripts/content/fetch-console-bestsellers-wikidata.ts [options]

Options:
  -o, --output <file>     Output JSON file (default: src/data/games/console-bestsellers-wikidata.json)
  -m, --max <number>      Maximum games per console (default: 100)
  -c, --console <id>      Only fetch specific console(s) (can be repeated)
  --manufacturer <name>   Filter by manufacturer: Sony, Microsoft, Nintendo
  --coverage              Show Wikidata coverage statistics
  -l, --list              List available consoles with Wikidata IDs
  -h, --help              Show this help

Note: Wikidata sales data (P2664 - copies sold) coverage varies by console.
Wikipedia often has more complete sales data; use fetch-console-bestsellers.ts for that.

Wikidata properties used:
  - P31: instance of (video game)
  - P400: platform
  - P2664: copies sold
  - P178: developer
  - P123: publisher
  - P577: publication date

Examples:
  npx tsx scripts/content/fetch-console-bestsellers-wikidata.ts
  npx tsx scripts/content/fetch-console-bestsellers-wikidata.ts -c playstation-4
  npx tsx scripts/content/fetch-console-bestsellers-wikidata.ts --coverage
`);
				process.exit(0);
		}
	}

	console.log('='.repeat(60));
	console.log('Console Best-Sellers Wikidata Fetcher');
	console.log('='.repeat(60));

	if (listConsoles) {
		console.log('\nAvailable consoles with Wikidata IDs:');
		console.log('-'.repeat(70));
		for (const c of CONSOLES_POST_2000) {
			console.log(`  ${c.id.padEnd(20)} ${c.wikidataId.padEnd(12)} ${c.name} (${c.manufacturer})`);
		}
		return;
	}

	// Filter consoles
	let consolesToFetch = CONSOLES_POST_2000;

	if (consoleFilter.length > 0) {
		consolesToFetch = consolesToFetch.filter((c) => consoleFilter.includes(c.id));
	}

	if (manufacturerFilter) {
		consolesToFetch = consolesToFetch.filter(
			(c) => c.manufacturer.toLowerCase() === manufacturerFilter
		);
	}

	if (showCoverage) {
		console.log('\nWikidata Coverage Analysis:');
		console.log('-'.repeat(60));
		for (const consoleDef of consolesToFetch) {
			console.log(`\n${consoleDef.name}:`);
			const totalGames = await fetchPlatformGameCount(consoleDef);
			console.log(`  Total games in Wikidata: ${totalGames}`);

			const gamesWithSales = await fetchConsoleGamesWikidata(consoleDef, 1000);
			console.log(`  Games with sales data: ${gamesWithSales.length}`);
			console.log(
				`  Coverage: ${totalGames > 0 ? ((gamesWithSales.length / totalGames) * 100).toFixed(1) : 0}%`
			);

			await sleep(RATE_LIMIT_MS);
		}
		return;
	}

	console.log(`\nConsoles to fetch: ${consolesToFetch.length}`);
	console.log(`Max games per console: ${maxGames}`);
	console.log(`Output file: ${outputFile}`);

	const output: OutputData = {};

	for (const consoleDef of consolesToFetch) {
		console.log(`\nFetching: ${consoleDef.name} (${consoleDef.wikidataId})`);

		try {
			let games = await fetchConsoleGamesWikidata(consoleDef, maxGames);

			if (games.length === 0) {
				console.log('  No results with primary query, trying alternative...');
				games = await fetchConsoleGamesAlternative(consoleDef, maxGames);
			}

			console.log(`  Found ${games.length} games with sales data`);

			// Add rank
			const rankedGames = games.map((g, i) => ({ ...g, rank: i + 1 }));

			output[consoleDef.id] = {
				id: consoleDef.id,
				name: consoleDef.name,
				releaseYear: consoleDef.releaseYear,
				manufacturer: consoleDef.manufacturer,
				type: consoleDef.type,
				wikidataId: consoleDef.wikidataId,
				games: rankedGames,
				fetchedAt: new Date().toISOString()
			};
		} catch (error) {
			console.error(`  Error:`, error);
		}

		await sleep(RATE_LIMIT_MS);
	}

	// Write output
	const fs = await import('fs');
	const path = await import('path');

	const outputDir = path.dirname(outputFile);
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

	// Print statistics
	console.log('\n' + '='.repeat(60));
	console.log('Statistics:');
	console.log('-'.repeat(60));

	let totalGames = 0;
	for (const [id, data] of Object.entries(output)) {
		console.log(`  ${data.name.padEnd(25)} ${data.games.length} games with sales data`);
		totalGames += data.games.length;
	}

	console.log('-'.repeat(60));
	console.log(`  Total: ${totalGames} games across ${Object.keys(output).length} consoles`);
	console.log(`\nWritten to: ${outputFile}`);
	console.log('\nNote: Wikidata coverage for sales data is often incomplete.');
	console.log('Consider combining with Wikipedia data for better coverage.');
}

main().catch(console.error);
