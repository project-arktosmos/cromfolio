<script lang="ts">
	import classNames from 'classnames';
	import type { Card } from '$types/card.type';
	import type { Rarity } from '$types/rarity.type';
	import type { CardTypeEntity } from '$types/card-type-entity.type';

	// Props
	interface Props {
		card: Card;
		rarity?: Rarity | null;
		cardType?: CardTypeEntity | null;
		owned?: boolean;
		copyCount?: number;
		interactive?: boolean;
		showCheckbox?: boolean;
		checked?: boolean;
		classes?: string;
		onclick?: () => void;
		onkeydown?: (e: KeyboardEvent) => void;
		onCheckboxChange?: (checked: boolean) => void;
	}

	let {
		card,
		rarity = null,
		cardType = null,
		owned = false,
		copyCount = 0,
		interactive = true,
		showCheckbox = false,
		checked = false,
		classes = '',
		onclick,
		onkeydown,
		onCheckboxChange
	}: Props = $props();

	function handleCheckboxClick(e: Event) {
		e.stopPropagation();
		onCheckboxChange?.(!checked);
	}

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
				'ring-2 ring-primary': showCheckbox ? checked : owned,
				'opacity-50 grayscale': showCheckbox ? !checked : !owned && interactive
			},
			classes
		)
	);
</script>

<div
	class={computedClasses}
	role={interactive ? 'button' : undefined}
	tabindex={interactive ? 0 : undefined}
	{onclick}
	{onkeydown}
>
	<div class="relative flex w-full flex-col" style={gradientStyle}>
		<!-- Image container with padding to show gradient border -->
		<div class="relative p-2 pb-0">
			<img src={card.image} alt={card.name} class="block w-full" onerror={handleImageError} />
			{#if showCheckbox}
				<div class="absolute left-3 top-3 z-10">
					<input
						type="checkbox"
						class="checkbox checkbox-primary checkbox-sm bg-base-100"
						{checked}
						onclick={handleCheckboxClick}
					/>
				</div>
			{/if}
			{#if owned && copyCount > 0}
				<div class="badge badge-primary badge-sm absolute right-3 top-3 z-10">
					x{copyCount}
				</div>
			{/if}
		</div>
		<div class="p-2">
			{#if cardType}
				<div class="mb-1 flex justify-center">
					<span class={classNames('badge badge-xs', cardType.badgeColor)}>{cardType.name}</span>
				</div>
			{/if}
			<h3 class="text-center text-xs font-medium leading-tight text-white drop-shadow-md">
				{card.name}
			</h3>
		</div>
	</div>
</div>
