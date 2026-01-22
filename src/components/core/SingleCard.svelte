<script lang="ts">
	import classNames from 'classnames';
	import type { Card } from '$types/card.type';
	import type { Rarity } from '$types/rarity.type';

	// Props
	interface Props {
		card: Card;
		rarity?: Rarity | null;
		owned?: boolean;
		copyCount?: number;
		interactive?: boolean;
		classes?: string;
		onclick?: () => void;
		onkeydown?: (e: KeyboardEvent) => void;
	}

	let {
		card,
		rarity = null,
		owned = false,
		copyCount = 0,
		interactive = true,
		classes = '',
		onclick,
		onkeydown
	}: Props = $props();

	// Default gradient colors when no rarity is provided
	const defaultColorFrom = '#6B7280';
	const defaultColorTo = '#9CA3AF';

	// Compute gradient style from rarity or defaults
	let gradientStyle = $derived(
		`background: linear-gradient(to bottom, ${rarity?.colorFrom ?? defaultColorFrom}, ${rarity?.colorTo ?? defaultColorTo})`
	);

	// Fallback image as data URI
	const fallbackImage =
		'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23374151" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%239CA3AF" font-size="16">?</text></svg>';

	function handleImageError(e: Event) {
		(e.target as HTMLImageElement).src = fallbackImage;
	}

	let computedClasses = $derived(
		classNames(
			'w-full overflow-hidden transition-all',
			{
				'cursor-pointer hover:shadow-lg hover:scale-[1.02]': interactive,
				'ring-2 ring-primary': owned,
				'opacity-50 grayscale': !owned && interactive
			},
			classes
		)
	);
</script>

<div
	class={computedClasses}
	role={interactive ? 'button' : undefined}
	tabindex={interactive ? 0 : undefined}
	onclick={onclick}
	onkeydown={onkeydown}
>
	<div class="relative w-full flex flex-col" style={gradientStyle}>
		<!-- Image container with padding to show gradient border -->
		<div class="relative p-2 pb-0">
			<img
				src={card.image}
				alt={card.name}
				class="w-full block"
				onerror={handleImageError}
			/>
			{#if owned && copyCount > 0}
				<div class="absolute top-3 right-3 badge badge-primary badge-sm z-10">
					x{copyCount}
				</div>
			{/if}
		</div>
		<div class="p-2">
			<h3 class="text-xs font-medium text-white drop-shadow-md text-center leading-tight">{card.name}</h3>
		</div>
	</div>
</div>
