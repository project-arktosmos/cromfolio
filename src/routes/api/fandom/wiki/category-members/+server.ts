import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCategoryMembers } from '$services/fandom.service';

export const GET: RequestHandler = async ({ url }) => {
	const wiki = url.searchParams.get('wiki');
	const category = url.searchParams.get('category');
	const limit = parseInt(url.searchParams.get('limit') || '50', 10);

	if (!wiki) {
		return json({ error: 'Wiki parameter is required' }, { status: 400 });
	}

	if (!category) {
		return json({ error: 'Category parameter is required' }, { status: 400 });
	}

	try {
		const members = await getCategoryMembers(wiki, category, limit);
		return json({
			members,
			fromCache: false
		});
	} catch (error) {
		console.error('[api/fandom/wiki/category-members] Error:', error);
		return json({ error: 'Failed to get category members' }, { status: 500 });
	}
};
