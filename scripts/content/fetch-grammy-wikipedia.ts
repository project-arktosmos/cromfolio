/**
 * Fetch Grammy Award data from Wikipedia
 *
 * This script parses Wikipedia's Grammy Awards pages which have more complete data
 * than Wikidata. It fetches data from pages like:
 * - https://en.wikipedia.org/wiki/66th_Annual_Grammy_Awards (ceremony pages)
 * - https://en.wikipedia.org/wiki/Grammy_Award_for_Album_of_the_Year (category pages)
 *
 * Run with: npx tsx scripts/content/fetch-grammy-wikipedia.ts
 */

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'CromfolioGrammyFetcher/1.0';
const RATE_LIMIT_MS = 1000;

// Major Grammy categories to fetch
const MAJOR_CATEGORIES = [
	'Grammy_Award_for_Album_of_the_Year',
	'Grammy_Award_for_Record_of_the_Year',
	'Grammy_Award_for_Song_of_the_Year',
	'Grammy_Award_for_Best_New_Artist',
	'Grammy_Award_for_Best_Pop_Vocal_Album',
	'Grammy_Award_for_Best_Rock_Album',
	'Grammy_Award_for_Best_Rap_Album',
	'Grammy_Award_for_Best_Country_Album',
	'Grammy_Award_for_Best_R%26B_Album',
	'Grammy_Award_for_Best_Latin_Pop_Album',
	'Grammy_Award_for_Best_Jazz_Vocal_Album',
	'Grammy_Award_for_Best_Classical_Album'
];

interface GrammyEntry {
	year: number;
	category: string;
	nominees: string[];
	winner: string;
	wikidataIds?: string[];
}

/**
 * Sleep for rate limiting
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
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
 * Parse Grammy ceremony page for nominees and winners
 * Ceremony pages like "66th_Annual_Grammy_Awards" contain tables with all categories
 */
async function parseGrammyCeremonyPage(ceremonyNumber: number): Promise<GrammyEntry[]> {
	const title = `${ceremonyNumber}${getOrdinalSuffix(ceremonyNumber)}_Annual_Grammy_Awards`;
	console.log(`Fetching: ${title}`);

	const content = await fetchWikipediaPage(title);
	if (!content) {
		console.log(`  Page not found`);
		return [];
	}

	const entries: GrammyEntry[] = [];

	// Extract year from page content (ceremony year)
	const yearMatch = content.match(/\|\s*date\s*=.*?(\d{4})/i);
	const year = yearMatch ? parseInt(yearMatch[1], 10) : 2024 - (67 - ceremonyNumber);

	// Find category sections - they typically look like:
	// === General Field ===
	// {{Grammy Award category
	// | category = Album of the Year
	// | winner = ...
	// | nominees = ...
	// }}

	// Or tables like:
	// {| class="wikitable"
	// ! Category !! Nominees !! Winner

	// Look for award templates
	const templateRegex = /\{\{Grammy Award category[^}]*\}\}/gi;
	const templates = content.match(templateRegex) || [];

	for (const template of templates) {
		const categoryMatch = template.match(/\|\s*category\s*=\s*([^|\n]+)/i);
		const winnerMatch = template.match(/\|\s*winner\s*=\s*([^|\n]+)/i);
		const nomineesMatch = template.match(/\|\s*nominees\s*=\s*([^}]+)/i);

		if (categoryMatch && winnerMatch) {
			const category = cleanWikitext(categoryMatch[1]);
			const winner = cleanWikitext(winnerMatch[1]);
			const nominees = nomineesMatch
				? nomineesMatch[1]
						.split(/[,\n]/)
						.map((n) => cleanWikitext(n))
						.filter(Boolean)
				: [];

			entries.push({
				year,
				category,
				winner,
				nominees: [winner, ...nominees.filter((n) => n !== winner)]
			});
		}
	}

	// Also try to parse wikitables if templates didn't work
	if (entries.length === 0) {
		// Parse General Field section specifically
		const generalFieldMatch = content.match(/===\s*General\s*[Ff]ield\s*===([^=]*?)(?====|$)/s);
		if (generalFieldMatch) {
			const section = generalFieldMatch[1];
			// Look for album of the year, record of the year, etc.
			const categories = [
				'Album of the Year',
				'Record of the Year',
				'Song of the Year',
				'Best New Artist'
			];

			for (const cat of categories) {
				const catRegex = new RegExp(`'''${cat}'''[^*]*\\*\\s*'''([^']+)'''`, 'i');
				const match = section.match(catRegex);
				if (match) {
					entries.push({
						year,
						category: cat,
						winner: cleanWikitext(match[1]),
						nominees: []
					});
				}
			}
		}
	}

	console.log(`  Found ${entries.length} entries`);
	return entries;
}

/**
 * Parse Grammy category page for historical winners/nominees
 * Category pages like "Grammy_Award_for_Album_of_the_Year" have tables by year
 *
 * The table structure is:
 * {| class="wikitable"
 * ! Year !! Album !! Artist(s)
 * |-
 * ! rowspan="6" | [[1st Annual Grammy Awards|1959]]
 * |-style="background:#FAEB86;"   <-- Winner row (yellow background)
 * | '''''[[Album]]'''''
 * | '''[[Artist]]'''
 * |-
 * | ''[[Album]]''                 <-- Nominee row (no background)
 * | [[Artist]]
 */
async function parseGrammyCategoryPage(categorySlug: string): Promise<GrammyEntry[]> {
	console.log(`Fetching category: ${categorySlug.replace(/_/g, ' ')}`);

	const content = await fetchWikipediaPage(categorySlug);
	if (!content) {
		console.log(`  Page not found`);
		return [];
	}

	const entries: GrammyEntry[] = [];
	const categoryName = categorySlug
		.replace('Grammy_Award_for_', '')
		.replace(/_/g, ' ')
		.replace(/%26/g, '&');

	// Split content into wikitable sections
	const tables = content.split(/\{\|\s*class="wikitable"/);

	for (const table of tables) {
		if (!table.includes('Year') && !table.includes('year')) continue;

		// Split table into rows
		const rows = table.split(/\|-/);

		let currentYear: number | null = null;
		let currentYearNominees: string[] = [];
		let currentYearWinner: string | null = null;

		for (const row of rows) {
			// Check for year in rowspan header
			// Pattern: rowspan="6" ... [[1st Annual Grammy Awards|1959]]
			const yearMatch =
				row.match(/\[\[\d+(?:st|nd|rd|th)\s+Annual\s+Grammy\s+Awards\|(\d{4})\]\]/i) ||
				row.match(/rowspan[^|]*\|\s*\[\[.*?\|(\d{4})\]\]/i) ||
				row.match(/\|\s*(\d{4})\s*(?:<br|$|\|)/);

			if (yearMatch) {
				// Save previous year's data
				if (currentYear && (currentYearWinner || currentYearNominees.length > 0)) {
					entries.push({
						year: currentYear,
						category: categoryName,
						winner: currentYearWinner || currentYearNominees[0] || '',
						nominees: currentYearNominees
					});
				}

				currentYear = parseInt(yearMatch[1], 10);
				currentYearNominees = [];
				currentYearWinner = null;
				continue;
			}

			if (!currentYear) continue;

			// Check if this is a winner row (yellow background)
			const isWinner = row.includes('background:#FAEB86') || row.includes('background:#faeb86');

			// Extract album/artist from the row
			// Pattern: | '''''[[Album]]''''' or | ''[[Album]]'' or | '''[[Artist]]''' or | [[Artist]]
			const linkMatches = row.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);

			if (linkMatches && linkMatches.length > 0) {
				// First link is usually album, second is artist
				// We'll use artist name as the identifier
				let identifier = '';

				for (const link of linkMatches) {
					const match = link.match(/\[\[([^\]|]+)/);
					if (match) {
						const name = match[1].trim();
						// Skip years, references, and ceremony links
						if (!name.match(/^\d+/) && !name.includes('Grammy Awards') && !name.includes('ref')) {
							identifier = name;
							break;
						}
					}
				}

				if (identifier) {
					if (isWinner) {
						currentYearWinner = identifier;
					}
					if (!currentYearNominees.includes(identifier)) {
						currentYearNominees.push(identifier);
					}
				}
			}
		}

		// Don't forget the last year
		if (currentYear && (currentYearWinner || currentYearNominees.length > 0)) {
			entries.push({
				year: currentYear,
				category: categoryName,
				winner: currentYearWinner || currentYearNominees[0] || '',
				nominees: currentYearNominees
			});
		}
	}

	// Sort by year descending
	entries.sort((a, b) => b.year - a.year);

	console.log(`  Found ${entries.length} entries`);
	return entries;
}

/**
 * Clean wikitext markup
 */
function cleanWikitext(text: string): string {
	return text
		.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2') // [[link|text]] -> text
		.replace(/\[\[([^\]]+)\]\]/g, '$1') // [[link]] -> link
		.replace(/'''?/g, '') // bold/italic
		.replace(/\{\{[^}]+\}\}/g, '') // templates
		.replace(/<[^>]+>/g, '') // HTML tags
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Get ordinal suffix (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(n: number): string {
	const s = ['th', 'st', 'nd', 'rd'];
	const v = n % 100;
	return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Transform entries to award format
 */
function transformToAwardFormat(
	entries: GrammyEntry[]
): Record<string, { grammy: Record<string, { nominee: string[]; winner: string[] }> }> {
	const result: Record<
		string,
		{ grammy: Record<string, { nominee: string[]; winner: string[] }> }
	> = {};

	for (const entry of entries) {
		const yearKey = String(entry.year);

		if (!result[yearKey]) {
			result[yearKey] = { grammy: {} };
		}

		const categoryKey = entry.category.toLowerCase();

		if (!result[yearKey].grammy[categoryKey]) {
			result[yearKey].grammy[categoryKey] = { nominee: [], winner: [] };
		}

		// Add winner
		if (entry.winner && !result[yearKey].grammy[categoryKey].winner.includes(entry.winner)) {
			result[yearKey].grammy[categoryKey].winner.push(entry.winner);
		}

		// Add nominees
		for (const nominee of entry.nominees) {
			if (nominee && !result[yearKey].grammy[categoryKey].nominee.includes(nominee)) {
				result[yearKey].grammy[categoryKey].nominee.push(nominee);
			}
		}
	}

	// Sort by year descending
	const sortedResult: typeof result = {};
	const sortedYears = Object.keys(result).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
	for (const year of sortedYears) {
		sortedResult[year] = result[year];
	}

	return sortedResult;
}

/**
 * Main execution
 */
async function main() {
	const args = process.argv.slice(2);

	let mode: 'ceremonies' | 'categories' = 'categories';
	let startCeremony = 60; // 60th Grammys (2018)
	let endCeremony = 67; // 67th Grammys (2025)
	let outputFile = 'src/data/awards/grammy-wikipedia.json';

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case '--ceremonies':
			case '-c':
				mode = 'ceremonies';
				break;
			case '--categories':
			case '-t':
				mode = 'categories';
				break;
			case '--start':
			case '-s':
				startCeremony = parseInt(args[++i], 10);
				break;
			case '--end':
			case '-e':
				endCeremony = parseInt(args[++i], 10);
				break;
			case '--output':
			case '-o':
				outputFile = args[++i];
				break;
			case '--help':
			case '-h':
				console.log(`
Grammy Awards Wikipedia Fetcher

Usage: npx tsx scripts/content/fetch-grammy-wikipedia.ts [options]

Options:
  -c, --ceremonies       Fetch from ceremony pages (e.g., 66th Annual Grammy Awards)
  -t, --categories       Fetch from category pages (e.g., Album of the Year) [default]
  -s, --start <number>   Start ceremony number (default: 60)
  -e, --end <number>     End ceremony number (default: 67)
  -o, --output <file>    Output JSON file (default: src/data/awards/grammy-wikipedia.json)
  -h, --help             Show this help

Note: Grammy ceremony numbers:
  - 1st Grammy Awards = 1959
  - 67th Grammy Awards = 2025
  - To calculate: ceremony_number = year - 1958

Examples:
  npx tsx scripts/content/fetch-grammy-wikipedia.ts --categories
  npx tsx scripts/content/fetch-grammy-wikipedia.ts --ceremonies -s 65 -e 67
`);
				process.exit(0);
		}
	}

	console.log('='.repeat(60));
	console.log('Grammy Awards Wikipedia Fetcher');
	console.log('='.repeat(60));
	console.log(`Mode: ${mode}`);
	console.log(`Output: ${outputFile}`);
	console.log('');

	const allEntries: GrammyEntry[] = [];

	try {
		if (mode === 'ceremonies') {
			console.log(`Fetching ceremonies ${startCeremony} to ${endCeremony}...`);
			for (let i = endCeremony; i >= startCeremony; i--) {
				const entries = await parseGrammyCeremonyPage(i);
				allEntries.push(...entries);
				await sleep(RATE_LIMIT_MS);
			}
		} else {
			console.log('Fetching major category pages...');
			for (const category of MAJOR_CATEGORIES) {
				const entries = await parseGrammyCategoryPage(category);
				allEntries.push(...entries);
				await sleep(RATE_LIMIT_MS);
			}
		}

		console.log('');
		console.log(`Total entries fetched: ${allEntries.length}`);

		// Transform and save
		const awardData = transformToAwardFormat(allEntries);

		const fs = await import('fs');
		const path = await import('path');

		const outputDir = path.dirname(outputFile);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		fs.writeFileSync(outputFile, JSON.stringify(awardData, null, 2));
		console.log(`Written to: ${outputFile}`);

		// Stats
		const years = Object.keys(awardData);
		console.log(`Years covered: ${years.length}`);
	} catch (error) {
		console.error('Error:', error);
		process.exit(1);
	}
}

main();
