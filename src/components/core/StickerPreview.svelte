<script lang="ts">
	import classNames from 'classnames';
	import type { Sticker } from '$types/sticker.type';
	import type { Rarity } from '$types/rarity.type';
	import type { StickerTypeEntity } from '$types/sticker-type-entity.type';
	import type { Source } from '$types/source.type';
	import type { Tag } from '$types/tag.type';

	interface Props {
		sticker: Sticker;
		rarity?: Rarity | null;
		stickerType?: StickerTypeEntity | null;
		source?: Source | null;
		tags?: Tag[];
		classes?: string;
	}

	let { sticker, rarity = null, stickerType = null, source = null, tags = [], classes = '' }: Props = $props();

	// Fallback image as data URI
	const fallbackImage =
		'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23374151" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%239CA3AF" font-size="16">?</text></svg>';

	function handleImageError(e: Event) {
		(e.target as HTMLImageElement).src = fallbackImage;
	}

	let computedClasses = $derived(classNames('card bg-base-200', classes));

	let gradientStyle = $derived(
		rarity
			? `background: linear-gradient(135deg, ${rarity.colorFrom} 0%, ${rarity.colorTo} 100%)`
			: undefined
	);
</script>

<div class={computedClasses}>
	<div class="card-body p-4">
		<!-- Header with image and basic info -->
		<div class="flex gap-4">
			<!-- Image preview -->
			<div class="shrink-0">
				<div
					class="w-32 h-44 rounded-lg overflow-hidden border border-base-300"
					style={gradientStyle}
				>
					<img
						src={sticker.image}
						alt={sticker.name}
						class="w-full h-full object-cover"
						onerror={handleImageError}
					/>
				</div>
			</div>

			<!-- Basic info -->
			<div class="flex-1 min-w-0">
				<h3 class="card-title text-lg truncate" title={sticker.name}>
					{sticker.name}
				</h3>

				<!-- Badges row -->
				<div class="flex flex-wrap gap-2 mt-2">
					{#if stickerType}
						<span class={classNames('badge badge-sm', stickerType.badgeColor)}>
							{stickerType.name}
						</span>
					{/if}
					{#if rarity}
						<span
							class="badge badge-sm text-white"
							style="background: linear-gradient(135deg, {rarity.colorFrom} 0%, {rarity.colorTo} 100%)"
						>
							{rarity.name}
						</span>
					{/if}
					{#if sticker.imageSource}
						<span class="badge badge-sm badge-ghost">
							{sticker.imageSource}
						</span>
					{/if}
				</div>

				<!-- Source info -->
				{#if source}
					<div class="mt-3 text-sm">
						<span class="text-base-content/60">Source:</span>
						<span class="font-medium ml-1">{source.title}</span>
						<span class="badge badge-xs badge-outline ml-2">{source.sourceType}</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Divider -->
		<div class="divider my-2"></div>

		<!-- Metadata tables -->
		<div class="space-y-4">
			<!-- Sticker Type details table -->
			{#if stickerType}
				<div>
					<h4 class="text-xs font-semibold text-base-content/60 uppercase tracking-wide mb-2">Sticker Type</h4>
					<table class="table table-xs table-zebra w-full">
						<tbody>
							<tr>
								<td class="text-base-content/50 w-32">Name</td>
								<td>{stickerType.name}</td>
							</tr>
							<tr>
								<td class="text-base-content/50">Category</td>
								<td>{stickerType.category}</td>
							</tr>
							{#if stickerType.description}
								<tr>
									<td class="text-base-content/50">Description</td>
									<td>{stickerType.description}</td>
								</tr>
							{/if}
							{#if stickerType.sourceType}
								<tr>
									<td class="text-base-content/50">Source Type</td>
									<td>{stickerType.sourceType}</td>
								</tr>
							{/if}
						</tbody>
					</table>
				</div>
			{/if}

			<!-- Rarity details table -->
			{#if rarity}
				<div>
					<h4 class="text-xs font-semibold text-base-content/60 uppercase tracking-wide mb-2">Rarity</h4>
					<table class="table table-xs table-zebra w-full">
						<tbody>
							<tr>
								<td class="text-base-content/50 w-32">Name</td>
								<td>{rarity.name}</td>
							</tr>
							<tr>
								<td class="text-base-content/50">Sort Order</td>
								<td>{rarity.sortOrder}</td>
							</tr>
							<tr>
								<td class="text-base-content/50">Colors</td>
								<td>
									<div class="flex items-center gap-2">
										<div
											class="w-4 h-4 rounded border border-base-300"
											style="background-color: {rarity.colorFrom}"
											title={rarity.colorFrom}
										></div>
										<span class="font-mono text-xs">{rarity.colorFrom}</span>
										<span class="text-base-content/40">→</span>
										<div
											class="w-4 h-4 rounded border border-base-300"
											style="background-color: {rarity.colorTo}"
											title={rarity.colorTo}
										></div>
										<span class="font-mono text-xs">{rarity.colorTo}</span>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			{/if}

			<!-- Source details table -->
			{#if source}
				<div>
					<h4 class="text-xs font-semibold text-base-content/60 uppercase tracking-wide mb-2">Source</h4>
					<table class="table table-xs table-zebra w-full">
						<tbody>
							<tr>
								<td class="text-base-content/50 w-32">Title</td>
								<td>{source.title}</td>
							</tr>
							<tr>
								<td class="text-base-content/50">Type</td>
								<td>{source.sourceType}</td>
							</tr>
							{#if source.description}
								<tr>
									<td class="text-base-content/50">Description</td>
									<td class="line-clamp-2">{source.description}</td>
								</tr>
							{/if}
							{#if source.imdbId}
								<tr>
									<td class="text-base-content/50">IMDb</td>
									<td class="font-mono">{source.imdbId}</td>
								</tr>
							{/if}
							{#if source.tmdbId}
								<tr>
									<td class="text-base-content/50">TMDB</td>
									<td class="font-mono">{source.tmdbId}</td>
								</tr>
							{/if}
							{#if source.igdbId}
								<tr>
									<td class="text-base-content/50">IGDB</td>
									<td class="font-mono">{source.igdbId}</td>
								</tr>
							{/if}
							{#if source.anilistId}
								<tr>
									<td class="text-base-content/50">AniList</td>
									<td class="font-mono">{source.anilistId}</td>
								</tr>
							{/if}
							{#if source.malId}
								<tr>
									<td class="text-base-content/50">MAL</td>
									<td class="font-mono">{source.malId}</td>
								</tr>
							{/if}
						</tbody>
					</table>
				</div>
			{/if}

			<!-- Tags table -->
			{#if tags.length > 0}
				<div>
					<h4 class="text-xs font-semibold text-base-content/60 uppercase tracking-wide mb-2">Tags</h4>
					<table class="table table-xs table-zebra w-full">
						<thead>
							<tr>
								<th class="text-base-content/50 w-32">Key</th>
								<th class="text-base-content/50">Value</th>
							</tr>
						</thead>
						<tbody>
							{#each tags as tag (tag.id)}
								<tr>
									<td class="font-mono">{tag.key}</td>
									<td>{tag.value}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
</div>
