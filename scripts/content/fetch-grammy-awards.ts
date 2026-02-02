/**
 * Fetch Grammy Award nominees and winners from Wikidata
 *
 * Uses the Wikidata SPARQL endpoint to query for:
 * - Grammy Award categories (subclasses of Q41254)
 * - Winners per category per year (P166 - award received)
 * - Nominees per category per year (P1411 - nominated for)
 *
 * Output format matches existing award JSON structure:
 * {
 *   "2024": {
 *     "grammy": {
 *       "Album of the Year": {
 *         "nominee": ["Q123", "Q456"],
 *         "winner": ["Q123"]
 *       }
 *     }
 *   }
 * }
 *
 * Run with: npx tsx scripts/content/fetch-grammy-awards.ts
 */

const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'SynaxisGrammyFetcher/1.0 (https://github.com/your-repo; your@email.com)';

// Rate limiting - Wikidata recommends max 1 request per second
const RATE_LIMIT_MS = 1500;

interface GrammyCategory {
	id: string;
	label: string;
}

interface GrammyRecipient {
	recipientId: string;
	recipientLabel: string;
	categoryId: string;
	categoryLabel: string;
	year: number;
	isWinner: boolean;
}

interface AwardCategory {
	nominee: string[];
	winner: string[];
}

interface AwardType {
	[categoryName: string]: AwardCategory;
}

interface AwardYear {
	[awardType: string]: AwardType;
}

interface AwardEvent {
	[year: string]: AwardYear;
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
		throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`);
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
 * Fetch all Grammy Award categories from Wikidata
 * Grammy Award is Q41254, we look for subclasses (P279) that are specific category awards
 */
async function fetchGrammyCategories(): Promise<GrammyCategory[]> {
	console.log('Fetching Grammy Award categories...');

	const query = `
		SELECT DISTINCT ?category ?categoryLabel WHERE {
			?category wdt:P279* wd:Q41254 .
			?category rdfs:label ?categoryLabel .
			FILTER(LANG(?categoryLabel) = "en")

			# Filter to only get actual award categories (those that have been given)
			FILTER EXISTS {
				?recipient wdt:P166 ?category .
			}
		}
		ORDER BY ?categoryLabel
	`;

	const results = await sparqlQuery<{
		category: { value: string };
		categoryLabel: { value: string };
	}>(query);

	return results.map((r) => ({
		id: r.category.value.replace('http://www.wikidata.org/entity/', ''),
		label: r.categoryLabel.value
	}));
}

/**
 * Fetch winners for a specific Grammy category
 */
async function fetchCategoryWinners(
	categoryId: string,
	startYear: number,
	endYear: number
): Promise<GrammyRecipient[]> {
	const query = `
		SELECT DISTINCT ?recipient ?recipientLabel ?year WHERE {
			?recipient p:P166 ?awardStatement .
			?awardStatement ps:P166 wd:${categoryId} .
			?awardStatement pq:P585 ?date .
			BIND(YEAR(?date) AS ?year)

			FILTER(?year >= ${startYear} && ?year <= ${endYear})

			SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
		}
		ORDER BY DESC(?year)
	`;

	const results = await sparqlQuery<{
		recipient: { value: string };
		recipientLabel: { value: string };
		year: { value: string };
	}>(query);

	return results.map((r) => ({
		recipientId: r.recipient.value.replace('http://www.wikidata.org/entity/', ''),
		recipientLabel: r.recipientLabel.value,
		categoryId,
		categoryLabel: '',
		year: parseInt(r.year.value, 10),
		isWinner: true
	}));
}

/**
 * Fetch nominees for a specific Grammy category
 */
async function fetchCategoryNominees(
	categoryId: string,
	startYear: number,
	endYear: number
): Promise<GrammyRecipient[]> {
	const query = `
		SELECT DISTINCT ?recipient ?recipientLabel ?year WHERE {
			?recipient p:P1411 ?nominationStatement .
			?nominationStatement ps:P1411 wd:${categoryId} .
			?nominationStatement pq:P585 ?date .
			BIND(YEAR(?date) AS ?year)

			FILTER(?year >= ${startYear} && ?year <= ${endYear})

			SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
		}
		ORDER BY DESC(?year)
	`;

	const results = await sparqlQuery<{
		recipient: { value: string };
		recipientLabel: { value: string };
		year: { value: string };
	}>(query);

	return results.map((r) => ({
		recipientId: r.recipient.value.replace('http://www.wikidata.org/entity/', ''),
		recipientLabel: r.recipientLabel.value,
		categoryId,
		categoryLabel: '',
		year: parseInt(r.year.value, 10),
		isWinner: false
	}));
}

/**
 * Alternative approach: Fetch all Grammy winners and nominees in bulk
 * This is more efficient but may timeout for large date ranges
 */
async function fetchAllGrammyData(
	startYear: number,
	endYear: number
): Promise<{
	winners: GrammyRecipient[];
	nominees: GrammyRecipient[];
}> {
	console.log(`Fetching all Grammy data from ${startYear} to ${endYear}...`);

	// Fetch winners with point in time qualifier
	console.log('Fetching winners (with year qualifier)...');
	const winnersQuery = `
		SELECT DISTINCT ?recipient ?recipientLabel ?category ?categoryLabel ?year WHERE {
			?category wdt:P279* wd:Q41254 .
			?recipient p:P166 ?awardStatement .
			?awardStatement ps:P166 ?category .
			?awardStatement pq:P585 ?date .
			BIND(YEAR(?date) AS ?year)

			FILTER(?year >= ${startYear} && ?year <= ${endYear})

			SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
		}
		ORDER BY DESC(?year) ?categoryLabel
	`;

	const winnerResults = await sparqlQuery<{
		recipient: { value: string };
		recipientLabel: { value: string };
		category: { value: string };
		categoryLabel: { value: string };
		year: { value: string };
	}>(winnersQuery);

	const winners = winnerResults.map((r) => ({
		recipientId: r.recipient.value.replace('http://www.wikidata.org/entity/', ''),
		recipientLabel: r.recipientLabel.value,
		categoryId: r.category.value.replace('http://www.wikidata.org/entity/', ''),
		categoryLabel: r.categoryLabel.value,
		year: parseInt(r.year.value, 10),
		isWinner: true
	}));

	console.log(`Found ${winners.length} winners`);
	await sleep(RATE_LIMIT_MS);

	// Fetch nominees with point in time qualifier
	console.log('Fetching nominees (with year qualifier)...');
	const nomineesQuery = `
		SELECT DISTINCT ?recipient ?recipientLabel ?category ?categoryLabel ?year WHERE {
			?category wdt:P279* wd:Q41254 .
			?recipient p:P1411 ?nominationStatement .
			?nominationStatement ps:P1411 ?category .
			?nominationStatement pq:P585 ?date .
			BIND(YEAR(?date) AS ?year)

			FILTER(?year >= ${startYear} && ?year <= ${endYear})

			SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
		}
		ORDER BY DESC(?year) ?categoryLabel
	`;

	const nomineeResults = await sparqlQuery<{
		recipient: { value: string };
		recipientLabel: { value: string };
		category: { value: string };
		categoryLabel: { value: string };
		year: { value: string };
	}>(nomineesQuery);

	const nominees = nomineeResults.map((r) => ({
		recipientId: r.recipient.value.replace('http://www.wikidata.org/entity/', ''),
		recipientLabel: r.recipientLabel.value,
		categoryId: r.category.value.replace('http://www.wikidata.org/entity/', ''),
		categoryLabel: r.categoryLabel.value,
		year: parseInt(r.year.value, 10),
		isWinner: false
	}));

	console.log(`Found ${nominees.length} nominees`);

	return { winners, nominees };
}

/**
 * Fetch Grammy data without requiring year qualifier
 * This gets ALL Grammy winners/nominees ever recorded in Wikidata
 * Useful to understand the data coverage
 */
async function fetchAllGrammyDataNoYearFilter(): Promise<{
	winners: GrammyRecipient[];
	nominees: GrammyRecipient[];
}> {
	console.log('Fetching ALL Grammy data (no year filter)...');
	console.log('Note: This may take a while and return data without year information');

	// Fetch all winners (may not have year)
	console.log('Fetching all winners...');
	const winnersQuery = `
		SELECT DISTINCT ?recipient ?recipientLabel ?category ?categoryLabel ?year WHERE {
			?category wdt:P279* wd:Q41254 .
			?recipient p:P166 ?awardStatement .
			?awardStatement ps:P166 ?category .
			OPTIONAL {
				?awardStatement pq:P585 ?date .
				BIND(YEAR(?date) AS ?year)
			}
			SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
		}
		ORDER BY DESC(?year) ?categoryLabel
		LIMIT 10000
	`;

	const winnerResults = await sparqlQuery<{
		recipient: { value: string };
		recipientLabel: { value: string };
		category: { value: string };
		categoryLabel: { value: string };
		year?: { value: string };
	}>(winnersQuery);

	const winners = winnerResults.map((r) => ({
		recipientId: r.recipient.value.replace('http://www.wikidata.org/entity/', ''),
		recipientLabel: r.recipientLabel.value,
		categoryId: r.category.value.replace('http://www.wikidata.org/entity/', ''),
		categoryLabel: r.categoryLabel.value,
		year: r.year ? parseInt(r.year.value, 10) : 0,
		isWinner: true
	}));

	console.log(`Found ${winners.length} winners total`);
	console.log(`  - With year: ${winners.filter((w) => w.year > 0).length}`);
	console.log(`  - Without year: ${winners.filter((w) => w.year === 0).length}`);
	await sleep(RATE_LIMIT_MS);

	// Fetch all nominees (may not have year)
	console.log('Fetching all nominees...');
	const nomineesQuery = `
		SELECT DISTINCT ?recipient ?recipientLabel ?category ?categoryLabel ?year WHERE {
			?category wdt:P279* wd:Q41254 .
			?recipient p:P1411 ?nominationStatement .
			?nominationStatement ps:P1411 ?category .
			OPTIONAL {
				?nominationStatement pq:P585 ?date .
				BIND(YEAR(?date) AS ?year)
			}
			SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
		}
		ORDER BY DESC(?year) ?categoryLabel
		LIMIT 10000
	`;

	const nomineeResults = await sparqlQuery<{
		recipient: { value: string };
		recipientLabel: { value: string };
		category: { value: string };
		categoryLabel: { value: string };
		year?: { value: string };
	}>(nomineesQuery);

	const nominees = nomineeResults.map((r) => ({
		recipientId: r.recipient.value.replace('http://www.wikidata.org/entity/', ''),
		recipientLabel: r.recipientLabel.value,
		categoryId: r.category.value.replace('http://www.wikidata.org/entity/', ''),
		categoryLabel: r.categoryLabel.value,
		year: r.year ? parseInt(r.year.value, 10) : 0,
		isWinner: false
	}));

	console.log(`Found ${nominees.length} nominees total`);
	console.log(`  - With year: ${nominees.filter((n) => n.year > 0).length}`);
	console.log(`  - Without year: ${nominees.filter((n) => n.year === 0).length}`);

	return { winners, nominees };
}

/**
 * Fetch Grammy ceremony editions and their details
 * Grammy ceremonies are instances of "Grammy Awards ceremony" (Q27410846)
 */
async function fetchGrammyCeremonies(): Promise<Map<number, string>> {
	console.log('Fetching Grammy ceremony editions...');

	const query = `
		SELECT ?ceremony ?ceremonyLabel ?year ?edition WHERE {
			?ceremony wdt:P31 wd:Q27410846 .
			OPTIONAL { ?ceremony wdt:P585 ?date . BIND(YEAR(?date) AS ?year) }
			OPTIONAL { ?ceremony wdt:P393 ?edition . }
			SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
		}
		ORDER BY DESC(?year)
	`;

	const results = await sparqlQuery<{
		ceremony: { value: string };
		ceremonyLabel: { value: string };
		year?: { value: string };
		edition?: { value: string };
	}>(query);

	const ceremonies = new Map<number, string>();

	for (const r of results) {
		if (r.year) {
			const year = parseInt(r.year.value, 10);
			const id = r.ceremony.value.replace('http://www.wikidata.org/entity/', '');
			ceremonies.set(year, id);
		}
	}

	console.log(`Found ${ceremonies.size} Grammy ceremonies with year data`);
	return ceremonies;
}

/**
 * Transform raw Grammy data into the standard award event format
 */
function transformToAwardFormat(
	winners: GrammyRecipient[],
	nominees: GrammyRecipient[]
): AwardEvent {
	const result: AwardEvent = {};

	// Process winners
	for (const winner of winners) {
		const yearKey = String(winner.year);

		if (!result[yearKey]) {
			result[yearKey] = {};
		}
		if (!result[yearKey]['grammy']) {
			result[yearKey]['grammy'] = {};
		}

		const categoryKey = normalizeCategory(winner.categoryLabel);

		if (!result[yearKey]['grammy'][categoryKey]) {
			result[yearKey]['grammy'][categoryKey] = { nominee: [], winner: [] };
		}

		if (!result[yearKey]['grammy'][categoryKey].winner.includes(winner.recipientId)) {
			result[yearKey]['grammy'][categoryKey].winner.push(winner.recipientId);
		}
	}

	// Process nominees
	for (const nominee of nominees) {
		const yearKey = String(nominee.year);

		if (!result[yearKey]) {
			result[yearKey] = {};
		}
		if (!result[yearKey]['grammy']) {
			result[yearKey]['grammy'] = {};
		}

		const categoryKey = normalizeCategory(nominee.categoryLabel);

		if (!result[yearKey]['grammy'][categoryKey]) {
			result[yearKey]['grammy'][categoryKey] = { nominee: [], winner: [] };
		}

		if (!result[yearKey]['grammy'][categoryKey].nominee.includes(nominee.recipientId)) {
			result[yearKey]['grammy'][categoryKey].nominee.push(nominee.recipientId);
		}
	}

	// Sort years in descending order
	const sortedResult: AwardEvent = {};
	const sortedYears = Object.keys(result).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

	for (const year of sortedYears) {
		sortedResult[year] = result[year];
	}

	return sortedResult;
}

/**
 * Normalize category name for consistent keys
 */
function normalizeCategory(category: string): string {
	return category
		.toLowerCase()
		.replace(/grammy award for /i, '')
		.replace(/grammy /i, '')
		.trim();
}

/**
 * Create a human-readable mapping file
 */
function createReadableMapping(
	winners: GrammyRecipient[],
	nominees: GrammyRecipient[]
): Record<string, { label: string; categories: string[] }> {
	const mapping: Record<string, { label: string; categories: string[] }> = {};

	const allRecipients = [...winners, ...nominees];

	for (const r of allRecipients) {
		if (!mapping[r.recipientId]) {
			mapping[r.recipientId] = {
				label: r.recipientLabel,
				categories: []
			};
		}

		const categoryInfo = `${r.categoryLabel} (${r.year}${r.isWinner ? ' - WINNER' : ''})`;
		if (!mapping[r.recipientId].categories.includes(categoryInfo)) {
			mapping[r.recipientId].categories.push(categoryInfo);
		}
	}

	return mapping;
}

/**
 * Main execution
 */
async function main() {
	const args = process.argv.slice(2);

	// Parse arguments
	let startYear = 2020;
	let endYear = new Date().getFullYear();
	let outputFile = 'src/data/awards/grammy.json';
	let createMapping = false;
	let fetchAll = false;
	let listCeremonies = false;

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case '--start':
			case '-s':
				startYear = parseInt(args[++i], 10);
				break;
			case '--end':
			case '-e':
				endYear = parseInt(args[++i], 10);
				break;
			case '--output':
			case '-o':
				outputFile = args[++i];
				break;
			case '--with-mapping':
			case '-m':
				createMapping = true;
				break;
			case '--all':
			case '-a':
				fetchAll = true;
				break;
			case '--ceremonies':
			case '-c':
				listCeremonies = true;
				break;
			case '--help':
			case '-h':
				console.log(`
Grammy Awards Wikidata Fetcher

Usage: npx tsx scripts/content/fetch-grammy-awards.ts [options]

Options:
  -s, --start <year>     Start year (default: 2020)
  -e, --end <year>       End year (default: current year)
  -o, --output <file>    Output JSON file (default: src/data/awards/grammy.json)
  -m, --with-mapping     Also create a mapping file with human-readable labels
  -a, --all              Fetch ALL data without year filter (shows coverage)
  -c, --ceremonies       List Grammy ceremonies in Wikidata
  -h, --help             Show this help message

Examples:
  npx tsx scripts/content/fetch-grammy-awards.ts
  npx tsx scripts/content/fetch-grammy-awards.ts -s 2015 -e 2024
  npx tsx scripts/content/fetch-grammy-awards.ts -s 2020 -e 2024 -m
  npx tsx scripts/content/fetch-grammy-awards.ts --all -m
  npx tsx scripts/content/fetch-grammy-awards.ts --ceremonies

Note: This script queries the Wikidata SPARQL endpoint. Large date ranges may
take longer due to rate limiting and query complexity.

IMPORTANT: Wikidata's Grammy Award data coverage is incomplete. Many winners
and nominees lack year qualifiers (P585). Use --all to see total coverage.

Data source: Wikidata (https://www.wikidata.org)
Properties used:
  - P166: award received (winners)
  - P1411: nominated for (nominees)
  - P585: point in time (year)
  - P279: subclass of (Grammy categories)
`);
				process.exit(0);
		}
	}

	console.log('='.repeat(60));
	console.log('Grammy Awards Wikidata Fetcher');
	console.log('='.repeat(60));

	if (listCeremonies) {
		try {
			const ceremonies = await fetchGrammyCeremonies();
			console.log('\nGrammy Ceremonies in Wikidata:');
			const sortedYears = Array.from(ceremonies.keys()).sort((a, b) => b - a);
			for (const year of sortedYears) {
				console.log(`  ${year}: ${ceremonies.get(year)}`);
			}
			return;
		} catch (error) {
			console.error('Error:', error);
			process.exit(1);
		}
	}

	if (fetchAll) {
		console.log('Mode: Fetch ALL (no year filter)');
	} else {
		console.log(`Date range: ${startYear} - ${endYear}`);
	}
	console.log(`Output file: ${outputFile}`);
	console.log('');

	try {
		// Fetch data
		const { winners, nominees } = fetchAll
			? await fetchAllGrammyDataNoYearFilter()
			: await fetchAllGrammyData(startYear, endYear);

		console.log('');
		console.log('Transforming data...');

		// Transform to award format
		const awardData = transformToAwardFormat(winners, nominees);

		// Count statistics
		const years = Object.keys(awardData);
		let totalCategories = 0;
		let totalWinners = 0;
		let totalNominees = 0;

		for (const year of years) {
			const categories = Object.keys(awardData[year]['grammy'] || {});
			totalCategories += categories.length;

			for (const cat of categories) {
				totalWinners += awardData[year]['grammy'][cat].winner.length;
				totalNominees += awardData[year]['grammy'][cat].nominee.length;
			}
		}

		console.log('');
		console.log('Statistics:');
		console.log(`  Years: ${years.length}`);
		console.log(`  Total categories: ${totalCategories}`);
		console.log(`  Total winners: ${totalWinners}`);
		console.log(`  Total nominees: ${totalNominees}`);

		// Write output
		const fs = await import('fs');
		const path = await import('path');

		// Ensure directory exists
		const outputDir = path.dirname(outputFile);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		fs.writeFileSync(outputFile, JSON.stringify(awardData, null, 2));
		console.log('');
		console.log(`Written to: ${outputFile}`);

		// Create mapping file if requested
		if (createMapping) {
			const mapping = createReadableMapping(winners, nominees);
			const mappingFile = outputFile.replace('.json', '-mapping.json');
			fs.writeFileSync(mappingFile, JSON.stringify(mapping, null, 2));
			console.log(`Mapping written to: ${mappingFile}`);
		}

		console.log('');
		console.log('Done!');
	} catch (error) {
		console.error('Error:', error);
		process.exit(1);
	}
}

main();
