/**
 * Fetch best-selling video games by console from Wikipedia
 *
 * This script parses Wikipedia's best-selling video games pages which have comprehensive data.
 * It fetches data from pages like:
 * - https://en.wikipedia.org/wiki/List_of_best-selling_PlayStation_4_video_games
 * - https://en.wikipedia.org/wiki/List_of_best-selling_Nintendo_Switch_video_games
 *
 * Output format:
 * {
 *   "playstation-4": {
 *     "name": "PlayStation 4",
 *     "releaseYear": 2013,
 *     "manufacturer": "Sony",
 *     "games": [
 *       { "rank": 1, "title": "...", "copies": 20.0, "developer": "...", "publisher": "..." }
 *     ]
 *   }
 * }
 *
 * Run with: npx tsx scripts/content/fetch-console-bestsellers.ts
 */

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'SynaxisGameFetcher/1.0';
const RATE_LIMIT_MS = 1000;

/**
 * Console definitions - consoles released after 2000
 */
interface ConsoleDefinition {
	id: string;
	name: string;
	manufacturer: string;
	releaseYear: number;
	wikipediaSlug: string;
	type: 'home' | 'handheld' | 'hybrid';
}

const CONSOLES_POST_2000: ConsoleDefinition[] = [
	// Sony
	{
		id: 'playstation-2',
		name: 'PlayStation 2',
		manufacturer: 'Sony',
		releaseYear: 2000,
		wikipediaSlug: 'List_of_best-selling_PlayStation_2_video_games',
		type: 'home'
	},
	{
		id: 'playstation-portable',
		name: 'PlayStation Portable',
		manufacturer: 'Sony',
		releaseYear: 2004,
		wikipediaSlug: 'List_of_best-selling_PlayStation_Portable_video_games',
		type: 'handheld'
	},
	{
		id: 'playstation-3',
		name: 'PlayStation 3',
		manufacturer: 'Sony',
		releaseYear: 2006,
		wikipediaSlug: 'List_of_best-selling_PlayStation_3_video_games',
		type: 'home'
	},
	{
		id: 'playstation-vita',
		name: 'PlayStation Vita',
		manufacturer: 'Sony',
		releaseYear: 2011,
		wikipediaSlug: 'List_of_best-selling_PlayStation_Vita_video_games',
		type: 'handheld'
	},
	{
		id: 'playstation-4',
		name: 'PlayStation 4',
		manufacturer: 'Sony',
		releaseYear: 2013,
		wikipediaSlug: 'List_of_best-selling_PlayStation_4_video_games',
		type: 'home'
	},
	{
		id: 'playstation-5',
		name: 'PlayStation 5',
		manufacturer: 'Sony',
		releaseYear: 2020,
		wikipediaSlug: 'List_of_best-selling_PlayStation_5_video_games',
		type: 'home'
	},

	// Microsoft
	{
		id: 'xbox',
		name: 'Xbox',
		manufacturer: 'Microsoft',
		releaseYear: 2001,
		wikipediaSlug: 'List_of_best-selling_Xbox_video_games',
		type: 'home'
	},
	{
		id: 'xbox-360',
		name: 'Xbox 360',
		manufacturer: 'Microsoft',
		releaseYear: 2005,
		wikipediaSlug: 'List_of_best-selling_Xbox_360_video_games',
		type: 'home'
	},
	{
		id: 'xbox-one',
		name: 'Xbox One',
		manufacturer: 'Microsoft',
		releaseYear: 2013,
		wikipediaSlug: 'List_of_best-selling_Xbox_One_video_games',
		type: 'home'
	},
	// Note: Xbox Series X/S sales data is not publicly disclosed by Microsoft

	// Nintendo
	{
		id: 'game-boy-advance',
		name: 'Game Boy Advance',
		manufacturer: 'Nintendo',
		releaseYear: 2001,
		wikipediaSlug: 'List_of_best-selling_Game_Boy_Advance_video_games',
		type: 'handheld'
	},
	{
		id: 'gamecube',
		name: 'GameCube',
		manufacturer: 'Nintendo',
		releaseYear: 2001,
		wikipediaSlug: 'List_of_best-selling_GameCube_video_games',
		type: 'home'
	},
	{
		id: 'nintendo-ds',
		name: 'Nintendo DS',
		manufacturer: 'Nintendo',
		releaseYear: 2004,
		wikipediaSlug: 'List_of_best-selling_Nintendo_DS_video_games',
		type: 'handheld'
	},
	{
		id: 'wii',
		name: 'Wii',
		manufacturer: 'Nintendo',
		releaseYear: 2006,
		wikipediaSlug: 'List_of_best-selling_Wii_video_games',
		type: 'home'
	},
	{
		id: 'nintendo-3ds',
		name: 'Nintendo 3DS',
		manufacturer: 'Nintendo',
		releaseYear: 2011,
		wikipediaSlug: 'List_of_best-selling_Nintendo_3DS_video_games',
		type: 'handheld'
	},
	{
		id: 'wii-u',
		name: 'Wii U',
		manufacturer: 'Nintendo',
		releaseYear: 2012,
		wikipediaSlug: 'List_of_best-selling_Wii_U_video_games',
		type: 'home'
	},
	{
		id: 'nintendo-switch',
		name: 'Nintendo Switch',
		manufacturer: 'Nintendo',
		releaseYear: 2017,
		wikipediaSlug: 'List_of_best-selling_Nintendo_Switch_video_games',
		type: 'hybrid'
	}
];

interface GameEntry {
	rank: number;
	title: string;
	copies: number; // in millions
	releaseDate?: string;
	developer?: string;
	publisher?: string;
	genre?: string;
}

interface ConsoleData {
	id: string;
	name: string;
	releaseYear: number;
	manufacturer: string;
	type: 'home' | 'handheld' | 'hybrid';
	games: GameEntry[];
	fetchedAt: string;
}

interface OutputData {
	[consoleId: string]: ConsoleData;
}

/**
 * Sleep for rate limiting
 */
function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch Wikipedia page content via API
 */
async function fetchWikipediaPage(title: string): Promise<string | null> {
	const url = new URL(WIKIPEDIA_API);
	url.searchParams.set('action', 'query');
	url.searchParams.set('titles', title);
	url.searchParams.set('prop', 'revisions');
	url.searchParams.set('rvprop', 'content');
	url.searchParams.set('rvslots', 'main');
	url.searchParams.set('format', 'json');
	url.searchParams.set('formatversion', '2');

	const response = await fetch(url.toString(), {
		headers: { 'User-Agent': USER_AGENT }
	});

	if (!response.ok) {
		console.error(`Failed to fetch ${title}: ${response.status}`);
		return null;
	}

	const data = await response.json();
	const pages = data.query?.pages;

	if (!pages || pages.length === 0 || pages[0].missing) {
		return null;
	}

	return pages[0].revisions?.[0]?.slots?.main?.content || null;
}

/**
 * Clean wikitext markup
 */
function cleanWikitext(text: string): string {
	return text
		.replace(/rowspan="?\d+"?\s*\|/gi, '') // rowspan="N" |
		.replace(/colspan="?\d+"?\s*\|/gi, '') // colspan="N" |
		.replace(/style="[^"]*"\s*\|/gi, '') // style="..." |
		.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2') // [[link|text]] -> text
		.replace(/\[\[([^\]]+)\]\]/g, '$1') // [[link]] -> link
		.replace(/'''?/g, '') // bold/italic
		.replace(/\{\{[^}]*\}\}/g, '') // templates
		.replace(/<ref[^>]*>.*?<\/ref>/gi, '') // references
		.replace(/<ref[^/]*\/>/gi, '') // self-closing refs
		.replace(/<[^>]+>/g, '') // HTML tags
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Parse copies sold from various formats
 * Examples: "{{nts|69.56}} million", "20.0 million", "20 million", "20,000,000", "~20 million"
 */
function parseCopiesSold(text: string): number {
	// Extract number from {{nts|NUMBER}} template first
	const ntsMatch = text.match(/\{\{nts\|([\d.]+)\}\}/i);
	if (ntsMatch) {
		const num = parseFloat(ntsMatch[1]);
		// Check if "million" follows
		if (text.toLowerCase().includes('million')) {
			return num;
		}
		// Otherwise assume it's already in millions if reasonable (< 1000)
		return num < 1000 ? num : num / 1000000;
	}

	const cleaned = cleanWikitext(text);

	// Try to find a number followed by "million"
	const millionMatch = cleaned.match(/~?([\d,.]+)\s*million/i);
	if (millionMatch) {
		return parseFloat(millionMatch[1].replace(/,/g, ''));
	}

	// Try raw number (assume it's in units, convert to millions)
	const rawMatch = cleaned.match(/([\d,]+)/);
	if (rawMatch) {
		const num = parseInt(rawMatch[1].replace(/,/g, ''), 10);
		if (num > 1000000) {
			return num / 1000000;
		}
		return num;
	}

	return 0;
}

/**
 * Parse best-selling games from Wikipedia content
 * Wikipedia tables use format like:
 * |-
 * ! scope="row" | ''[[Game Title]]''
 * | {{nts|69.56}}{{nbsp}}million
 * | ...
 */
function parseGamesFromContent(content: string, consoleName: string): GameEntry[] {
	const games: GameEntry[] = [];

	// Find wikitables in the content
	const tableRegex = /\{\|[^]*?class="[^"]*wikitable[^"]*"[^]*?\|\}/g;
	const tables = content.match(tableRegex) || [];

	for (const table of tables) {
		// Check if this looks like a games table (has relevant headers)
		if (!table.match(/title|copies|sold|sales/i)) {
			continue;
		}

		// Split into rows by |- delimiter
		const rows = table.split(/\n\|-/);

		// Parse header row to find column indices
		let headerRowIdx = -1;
		for (let i = 0; i < rows.length; i++) {
			if (rows[i].includes('! scope="col"') || (rows[i].includes('!') && rows[i].match(/title|copies|sold/i))) {
				headerRowIdx = i;
				break;
			}
		}

		if (headerRowIdx === -1) continue;

		// Parse headers to find column positions
		const headerRow = rows[headerRowIdx];
		const headerCells = headerRow.split(/\n!/).map(h => h.toLowerCase().trim());

		let titleCol = -1;
		let copiesCol = -1;
		let developerCol = -1;
		let publisherCol = -1;
		let genreCol = -1;
		let dateCol = -1;

		headerCells.forEach((h, i) => {
			if (h.includes('title') || h.includes('game')) titleCol = i;
			if (h.includes('copies') || h.includes('sold') || h.includes('sales')) copiesCol = i;
			if (h.includes('developer')) developerCol = i;
			if (h.includes('publisher')) publisherCol = i;
			if (h.includes('genre')) genreCol = i;
			if (h.includes('release') && h.includes('date')) dateCol = i;
		});

		// If we couldn't find columns, use defaults (Title=0, Copies=1)
		if (titleCol === -1) titleCol = 0;
		if (copiesCol === -1) copiesCol = 1;

		// Parse data rows (after the header)
		let rank = 1;
		for (let i = headerRowIdx + 1; i < rows.length; i++) {
			const row = rows[i];

			// Skip empty rows and footer rows
			if (row.trim().length < 10 || row.includes('|}')) continue;

			// Extract title from ! scope="row" | or just from the row
			let title = '';
			const titleMatch = row.match(/!\s*scope="row"\s*\|\s*(.+?)(?:\n\||\|{2}|$)/s);
			if (titleMatch) {
				title = cleanWikitext(titleMatch[1]);
			} else {
				// Try alternative format - first cell
				const firstCellMatch = row.match(/^\s*\|\s*(.+?)(?:\n\||\|{2}|$)/s);
				if (firstCellMatch) {
					title = cleanWikitext(firstCellMatch[1]);
				}
			}

			// Skip if no title
			if (!title || title.length < 2) continue;

			// Clean up title - remove quotes, extra formatting
			title = title.replace(/^['"]+|['"]+$/g, '').trim();

			// Extract all cell values from the row
			// Cells are separated by \n| or ||
			const cellMatches = row.split(/\n\|(?!\|)|\|{2}/).slice(1); // Skip the title cell

			// Find copies sold
			let copies = 0;
			for (const cell of cellMatches) {
				if (cell.match(/\{\{nts\|[\d.]+\}\}|million|[\d,]+\s*(million|copies)/i)) {
					copies = parseCopiesSold(cell);
					if (copies > 0) break;
				}
			}

			// If no copies found, try the second cell directly
			if (copies === 0 && cellMatches.length > 0) {
				copies = parseCopiesSold(cellMatches[0]);
			}

			// Skip if no valid sales data
			if (copies === 0) continue;

			const game: GameEntry = {
				rank,
				title,
				copies
			};

			// Try to extract other fields from cells
			for (const cell of cellMatches) {
				const cleanedCell = cleanWikitext(cell);

				// Try to identify developer/publisher by context
				if (!game.developer && cleanedCell.match(/studios?|games?|software|entertainment|interactive/i) && !cleanedCell.match(/million|copies|\d{4}/i)) {
					if (!game.developer) {
						game.developer = cleanedCell;
					} else if (!game.publisher) {
						game.publisher = cleanedCell;
					}
				}

				// Try to identify genre
				if (!game.genre && cleanedCell.match(/action|adventure|rpg|racing|sports|shooter|fighting|simulation|strategy|puzzle|platformer|party/i)) {
					game.genre = cleanedCell;
				}

				// Try to identify release date (format: Month DD, YYYY or YYYY-MM-DD)
				if (!game.releaseDate && cleanedCell.match(/\b(19|20)\d{2}\b/) && cleanedCell.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2})\b/i)) {
					game.releaseDate = cleanedCell;
				}
			}

			games.push(game);
			rank++;
		}
	}

	// Sort by copies sold descending and re-rank
	games.sort((a, b) => b.copies - a.copies);
	games.forEach((g, i) => (g.rank = i + 1));

	return games;
}

/**
 * Fetch best-selling games for a specific console
 */
async function fetchConsoleGames(consoleDef: ConsoleDefinition, maxGames: number = 100): Promise<ConsoleData | null> {
	console.log(`\nFetching: ${consoleDef.name} (${consoleDef.wikipediaSlug})`);

	const content = await fetchWikipediaPage(consoleDef.wikipediaSlug);
	if (!content) {
		console.log(`  Page not found or empty`);
		return null;
	}

	const games = parseGamesFromContent(content, consoleDef.name);

	// Limit to top N games
	const topGames = games.slice(0, maxGames);

	console.log(`  Found ${games.length} games, keeping top ${topGames.length}`);

	return {
		id: consoleDef.id,
		name: consoleDef.name,
		releaseYear: consoleDef.releaseYear,
		manufacturer: consoleDef.manufacturer,
		type: consoleDef.type,
		games: topGames,
		fetchedAt: new Date().toISOString()
	};
}

/**
 * Main execution
 */
async function main() {
	const args = process.argv.slice(2);

	let outputFile = 'src/data/games/console-bestsellers.json';
	let maxGames = 100;
	let consoleFilter: string[] = [];
	let manufacturerFilter: string | null = null;
	let typeFilter: string | null = null;
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
			case '--type':
			case '-t':
				typeFilter = args[++i].toLowerCase();
				break;
			case '--list':
			case '-l':
				listConsoles = true;
				break;
			case '--help':
			case '-h':
				console.log(`
Console Best-Sellers Wikipedia Fetcher

Usage: npx tsx scripts/content/fetch-console-bestsellers.ts [options]

Options:
  -o, --output <file>     Output JSON file (default: src/data/games/console-bestsellers.json)
  -m, --max <number>      Maximum games per console (default: 100)
  -c, --console <id>      Only fetch specific console(s) (can be repeated)
  -t, --type <type>       Filter by console type: home, handheld, hybrid
  --manufacturer <name>   Filter by manufacturer: Sony, Microsoft, Nintendo
  -l, --list              List available consoles
  -h, --help              Show this help

Available consoles (post-2000):
${CONSOLES_POST_2000.map(c => `  ${c.id.padEnd(20)} ${c.name} (${c.manufacturer}, ${c.releaseYear})`).join('\n')}

Examples:
  npx tsx scripts/content/fetch-console-bestsellers.ts
  npx tsx scripts/content/fetch-console-bestsellers.ts -c playstation-4 -c nintendo-switch
  npx tsx scripts/content/fetch-console-bestsellers.ts --manufacturer nintendo
  npx tsx scripts/content/fetch-console-bestsellers.ts --type handheld -m 50
`);
				process.exit(0);
		}
	}

	console.log('='.repeat(60));
	console.log('Console Best-Sellers Wikipedia Fetcher');
	console.log('='.repeat(60));

	if (listConsoles) {
		console.log('\nAvailable consoles (released after 2000):');
		console.log('-'.repeat(60));
		for (const c of CONSOLES_POST_2000) {
			console.log(`  ${c.id.padEnd(20)} ${c.name.padEnd(20)} ${c.manufacturer.padEnd(10)} ${c.releaseYear} (${c.type})`);
		}
		return;
	}

	// Filter consoles
	let consolesToFetch = CONSOLES_POST_2000;

	if (consoleFilter.length > 0) {
		consolesToFetch = consolesToFetch.filter(c => consoleFilter.includes(c.id));
	}

	if (manufacturerFilter) {
		consolesToFetch = consolesToFetch.filter(c => c.manufacturer.toLowerCase() === manufacturerFilter);
	}

	if (typeFilter) {
		consolesToFetch = consolesToFetch.filter(c => c.type === typeFilter);
	}

	console.log(`\nConsoles to fetch: ${consolesToFetch.length}`);
	console.log(`Max games per console: ${maxGames}`);
	console.log(`Output file: ${outputFile}`);

	const output: OutputData = {};

	for (const consoleDef of consolesToFetch) {
		try {
			const data = await fetchConsoleGames(consoleDef, maxGames);
			if (data) {
				output[consoleDef.id] = data;
			}
		} catch (error) {
			console.error(`  Error fetching ${consoleDef.name}:`, error);
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
		console.log(`  ${data.name.padEnd(25)} ${data.games.length} games`);
		totalGames += data.games.length;
	}

	console.log('-'.repeat(60));
	console.log(`  Total: ${totalGames} games across ${Object.keys(output).length} consoles`);
	console.log(`\nWritten to: ${outputFile}`);
}

main().catch(console.error);
