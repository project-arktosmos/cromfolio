<script lang="ts">
	import classNames from 'classnames';
	import type { Sticker, FragmentPosition } from '$types/sticker.type';

	interface Props {
		sticker: Sticker;
		bgColor?: string;
		borderColor?: string;
		classes?: string;
	}

	let { sticker, bgColor = '#8b5cf6', borderColor, classes = '' }: Props = $props();

	// Fallback image as data URI
	const fallbackImage =
		'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23374151" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%239CA3AF" font-size="16">?</text></svg>';

	function handleImageError(e: Event) {
		(e.target as HTMLImageElement).src = fallbackImage;
	}

	let bgStyle = $derived(
		borderColor
			? `background-color: ${bgColor}; border: 1px solid ${borderColor}`
			: `background-color: ${bgColor}`
	);

	// Check if this is a fragment sticker
	let isFragment = $derived(sticker.fragmentPosition != null);

	// Get the CSS style for each fragment quadrant
	// The image is scaled 2x from a corner, and the container clips the overflow
	function getFragmentStyle(position: FragmentPosition): string {
		switch (position) {
			case 1: // top-left: scale from top-left corner
				return 'transform-origin: 0 0; transform: scale(2);';
			case 2: // top-right: scale from top-right corner
				return 'transform-origin: 100% 0; transform: scale(2);';
			case 3: // bottom-left: scale from bottom-left corner
				return 'transform-origin: 0 100%; transform: scale(2);';
			case 4: // bottom-right: scale from bottom-right corner
				return 'transform-origin: 100% 100%; transform: scale(2);';
			default:
				return '';
		}
	}

	let fragmentStyle = $derived(
		sticker.fragmentPosition ? getFragmentStyle(sticker.fragmentPosition) : ''
	);
</script>

<div class={classNames('w-full h-full p-2', classes)} style={bgStyle}>
	{#if isFragment}
		<!-- Fragment sticker: show only one quadrant of the image -->
		<div class="w-full h-full overflow-hidden">
			<img
				src={sticker.image}
				alt={sticker.name}
				class="w-full h-full object-cover"
				style={fragmentStyle}
				onerror={handleImageError}
			/>
		</div>
	{:else}
		<!-- Normal sticker: show full image -->
		<img
			src={sticker.image}
			alt={sticker.name}
			class="w-full h-full object-contain"
			onerror={handleImageError}
		/>
	{/if}
</div>
