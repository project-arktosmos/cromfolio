/**
 * Wikiquote Service
 * Fetches quotes from Wikiquote using the MediaWiki API
 * No API key required - fully open and free
 */

const WIKIQUOTE_API_URL = 'https://en.wikiquote.org/w/api.php';

export interface WikiquoteSearchResult {
	pageid: number;
	title: string;
	snippet?: string;
}

export interface ParsedQuote {
	text: string;
	speaker?: string;
	context?: string; // Episode, chapter, scene, etc.
	section?: string; // Section heading the quote was found under
}

/**
 * Search for pages on Wikiquote
 */
export async function searchWikiquote(query: string, limit = 10): Promise<WikiquoteSearchResult[]> {
	try {
		const params = new URLSearchParams({
			action: 'query',
			list: 'search',
			srsearch: query,
			srlimit: limit.toString(),
			format: 'json',
			origin: '*'
		});

		const response = await fetch(`${WIKIQUOTE_API_URL}?${params}`);

		if (!response.ok) {
			throw new Error(`Wikiquote API error: ${response.status}`);
		}

		const data = await response.json();
		return data.query?.search || [];
	} catch (error) {
		console.error('[wikiquote.service] searchWikiquote error:', error);
		return [];
	}
}

/**
 * Get the HTML content of a Wikiquote page
 */
export async function getPageContent(title: string): Promise<string | null> {
	try {
		const params = new URLSearchParams({
			action: 'parse',
			page: title,
			prop: 'text|sections',
			format: 'json',
			origin: '*'
		});

		const response = await fetch(`${WIKIQUOTE_API_URL}?${params}`);

		if (!response.ok) {
			throw new Error(`Wikiquote API error: ${response.status}`);
		}

		const data = await response.json();
		return data.parse?.text?.['*'] || null;
	} catch (error) {
		console.error('[wikiquote.service] getPageContent error:', error);
		return null;
	}
}

/**
 * Clean HTML entities and tags from text
 */
function cleanText(text: string): string {
	return text
		.replace(/<[^>]+>/g, '')
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.replace(/\[\d+\]/g, '') // Remove citation markers [1], [2], etc.
		.replace(/\[edit\]/gi, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Check if text looks like metadata rather than a quote
 */
function isMetadata(text: string): boolean {
	const metaPatterns = [
		/^(episode|chapter|season|ep\.|ch\.|vol\.)/i,
		/^(scene|act|part)\s*\d/i,
		/^\d+\.\s*"/,
		/^note:/i,
		/^source:/i,
		/^attributed/i,
		/^(said|spoken)\s+(by|to|in)/i
	];
	return metaPatterns.some((p) => p.test(text));
}

/**
 * Check if text looks like a speaker attribution
 */
function isSpeakerAttribution(text: string): boolean {
	// Common patterns: "Light:", "Light Yagami:", "~ Light", "— Light"
	return /^[A-Z][^:]{0,50}:/.test(text) || /^[~—–-]\s*[A-Z]/.test(text);
}

/**
 * Extract speaker from text if present
 */
function extractSpeaker(text: string): { speaker?: string; cleanedText: string } {
	// Pattern: "Speaker: Quote text"
	const colonMatch = text.match(/^([A-Z][^:]{0,50}):\s*(.+)$/s);
	if (colonMatch) {
		return { speaker: colonMatch[1].trim(), cleanedText: colonMatch[2].trim() };
	}

	// Pattern: "Quote text ~ Speaker" or "Quote text — Speaker"
	const suffixMatch = text.match(/^(.+?)\s*[~—–-]\s*([A-Z][A-Za-z\s]{1,50})$/s);
	if (suffixMatch && suffixMatch[2].length < 50) {
		return { speaker: suffixMatch[2].trim(), cleanedText: suffixMatch[1].trim() };
	}

	return { cleanedText: text };
}

/**
 * Parse quotes from Wikiquote HTML content
 * Wikiquote structure:
 * - <h2>/<h3> Section headings (episodes, chapters, etc.)
 * - <ul><li> Quote text
 *   - <ul><li> Attribution/context (speaker, episode info, etc.)
 */
export function parseQuotesFromHtml(html: string): ParsedQuote[] {
	const quotes: ParsedQuote[] = [];

	// Track current section
	let currentSection = '';

	// Split by sections (h2, h3 headings)
	const sectionRegex = /<h([23])[^>]*>.*?<span[^>]*>([^<]+)<\/span>.*?<\/h\1>/gi;
	const sections: { heading: string; startIndex: number }[] = [];

	let sectionMatch;
	while ((sectionMatch = sectionRegex.exec(html)) !== null) {
		const heading = cleanText(sectionMatch[2]);
		if (
			heading &&
			!heading.toLowerCase().includes('see also') &&
			!heading.toLowerCase().includes('external links') &&
			!heading.toLowerCase().includes('references')
		) {
			sections.push({ heading, startIndex: sectionMatch.index });
		}
	}

	// Find all top-level list items (quotes)
	// Match <li> that contains text and possibly nested <ul>
	const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
	let liMatch;

	while ((liMatch = liRegex.exec(html)) !== null) {
		const fullContent = liMatch[1];
		const matchIndex = liMatch.index;

		// Determine current section
		for (let i = sections.length - 1; i >= 0; i--) {
			if (matchIndex > sections[i].startIndex) {
				currentSection = sections[i].heading;
				break;
			}
		}

		// Skip TOC and navigation items
		if (
			fullContent.includes('class="toc') ||
			fullContent.includes('id="toc') ||
			fullContent.includes('mw-') ||
			fullContent.includes('class="nav')
		) {
			continue;
		}

		// Split into main quote and nested content (attribution)
		const nestedUlMatch = fullContent.match(/^([\s\S]*?)<ul[^>]*>([\s\S]*?)<\/ul>/i);

		let quoteText: string;
		let nestedContent: string | null = null;

		if (nestedUlMatch) {
			quoteText = cleanText(nestedUlMatch[1]);
			nestedContent = nestedUlMatch[2];
		} else {
			quoteText = cleanText(fullContent);
		}

		// Skip if too short or looks like navigation
		if (quoteText.length < 15 || quoteText.length > 2000) {
			continue;
		}

		// Skip meta content
		if (
			quoteText.startsWith('Main article') ||
			quoteText.startsWith('See also') ||
			quoteText.startsWith('External links') ||
			quoteText.includes('Retrieved from') ||
			quoteText.startsWith('For other uses') ||
			quoteText.startsWith('Wikipedia has')
		) {
			continue;
		}

		// Extract speaker from quote text
		const { speaker: speakerFromText, cleanedText } = extractSpeaker(quoteText);
		quoteText = cleanedText;

		// Parse nested content for additional metadata
		let speaker = speakerFromText;
		let context: string | undefined;

		if (nestedContent) {
			// Extract nested <li> items
			const nestedLiRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
			let nestedLiMatch;

			while ((nestedLiMatch = nestedLiRegex.exec(nestedContent)) !== null) {
				const nestedText = cleanText(nestedLiMatch[1]);

				if (!nestedText || nestedText.length < 2) continue;

				// Check if it's a speaker attribution
				if (!speaker && isSpeakerAttribution(nestedText)) {
					const extracted = extractSpeaker(nestedText);
					if (extracted.speaker) {
						speaker = extracted.speaker;
						continue;
					}
				}

				// Check if it's context/metadata (episode, chapter, etc.)
				if (isMetadata(nestedText)) {
					context = context ? `${context}; ${nestedText}` : nestedText;
					continue;
				}

				// Otherwise might be additional context
				if (nestedText.length < 100 && !context) {
					context = nestedText;
				}
			}
		}

		// Use section as context if no other context found
		if (!context && currentSection) {
			context = currentSection;
		}

		quotes.push({
			text: quoteText,
			speaker,
			context,
			section: currentSection || undefined
		});
	}

	return quotes;
}

/**
 * Search and get quotes for a person/topic
 */
export async function getQuotes(
	query: string,
	limit = 20
): Promise<{ quotes: ParsedQuote[]; pageTitle: string | null }> {
	// First search for the page
	const searchResults = await searchWikiquote(query, 5);

	if (searchResults.length === 0) {
		return { quotes: [], pageTitle: null };
	}

	// Get the first result's content
	const pageTitle = searchResults[0].title;
	const html = await getPageContent(pageTitle);

	if (!html) {
		return { quotes: [], pageTitle };
	}

	const allQuotes = parseQuotesFromHtml(html);
	return {
		quotes: allQuotes.slice(0, limit),
		pageTitle
	};
}
