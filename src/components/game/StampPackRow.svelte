<script lang="ts">
	import classNames from 'classnames';
	import type { StampPack } from '$types/stamp-pack.type';

	interface Props {
		stampPacks: StampPack[];
		coverUrls?: Map<string, string>;
		classes?: string;
		onpackhover?: (pack: StampPack, event: MouseEvent) => void;
		onpackleave?: () => void;
	}

	let {
		stampPacks,
		coverUrls = new Map(),
		classes = '',
		onpackhover,
		onpackleave
	}: Props = $props();

	// Fallback image
	const fallbackImage =
		'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect fill="%23374151" width="64" height="64" rx="8"/><text x="32" y="38" text-anchor="middle" fill="%239CA3AF" font-size="24">📦</text></svg>';

	function getCoverImage(pack: StampPack): string {
		// Use pre-computed cover URL if available
		const coverUrl = coverUrls.get(pack.id);
		if (coverUrl) return coverUrl;
		return fallbackImage;
	}

	function handleImageError(e: Event) {
		(e.target as HTMLImageElement).src = fallbackImage;
	}

	let computedClasses = $derived(
		classNames(
			'flex gap-2 overflow-x-auto py-2 px-1 scrollbar-thin scrollbar-thumb-base-300',
			classes
		)
	);
</script>

<div class={computedClasses}>
	{#each stampPacks as pack (pack.id)}
		<div
			class="bg-base-200 hover:ring-primary h-14 w-14 shrink-0 cursor-pointer rounded-lg transition-all hover:scale-105 hover:ring-2"
			onmouseenter={(e) => onpackhover?.(pack, e)}
			onmouseleave={() => onpackleave?.()}
			title={pack.name}
			role="img"
			aria-label={pack.name}
		>
			<img
				src={getCoverImage(pack)}
				alt={pack.name}
				class="h-full w-full rounded-lg object-cover"
				onerror={handleImageError}
			/>
		</div>
	{/each}
	{#if stampPacks.length === 0}
		<div class="text-base-content/50 py-2 text-sm">No stamp packs available</div>
	{/if}
</div>
