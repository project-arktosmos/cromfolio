<script lang="ts">
	import classNames from 'classnames';
	import type { Sticker, FragmentPosition } from '$types/sticker.type';
	import { handleImageError as onImageError, STICKER_FALLBACK_IMAGE } from '$utils/stamp-image';

	interface Props {
		sticker: Sticker;
		bgColor?: string;
		borderColor?: string;
		classes?: string;
	}

	let { sticker, bgColor = '#8b5cf6', borderColor, classes = '' }: Props = $props();

	function handleImageError(e: Event) {
		onImageError(e, STICKER_FALLBACK_IMAGE);
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

<div class={classNames('flex h-fit w-full flex-col', classes)} style={bgStyle}>
	<div class="bg-white/90">
		<span class="block truncate text-center text-[10px] font-medium leading-none text-black"
			>{sticker.name}</span
		>
	</div>
	<div class="overflow-hidden">
		{#if isFragment}
			<img
				src={sticker.image}
				alt={sticker.name}
				class="w-full"
				style={fragmentStyle}
				onerror={handleImageError}
			/>
		{:else}
			<img
				src={sticker.image}
				alt={sticker.name}
				class="w-full"
				onerror={handleImageError}
			/>
		{/if}
	</div>
	{#if sticker.sourceName}
		<div class="bg-white/90">
			<span class="block truncate text-center text-[8px] font-medium leading-none text-black"
				>{sticker.sourceName}</span
			>
		</div>
	{/if}
</div>
