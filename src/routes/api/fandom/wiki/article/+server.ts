import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getArticleSections, getArticleContent } from '$services/fandom.service';

export const GET: RequestHandler = async ({ url }) => {
	const wiki = url.searchParams.get('wiki');
	const title = url.searchParams.get('title');
	const section = url.searchParams.get('section');
	const sectionsOnly = url.searchParams.get('sectionsOnly') === 'true';

	if (!wiki) {
		return json({ error: 'Wiki parameter is required' }, { status: 400 });
	}

	if (!title) {
		return json({ error: 'Title parameter is required' }, { status: 400 });
	}

	try {
		const sections = await getArticleSections(wiki, title);

		let content: string | null = null;
		if (!sectionsOnly) {
			content = await getArticleContent(wiki, title, section || undefined);
		}

		return json({
			title,
			url: `https://${wiki}.fandom.com/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
			sections,
			content,
			fromCache: false
		});
	} catch (error) {
		console.error('[api/fandom/wiki/article] Error:', error);
		return json({ error: 'Failed to get article' }, { status: 500 });
	}
};
