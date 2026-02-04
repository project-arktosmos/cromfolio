<script lang="ts">
	import type { UserPlacedStamp } from '$types/user-placed-stamp.type';
	import type { Stamp } from '$types/stamp-pack.type';
	import {
		getStampImagePath,
		isVideoStamp,
		handleImageError as onImageError,
		STAMP_FALLBACK_IMAGE
	} from '$utils/stamp-image';
	import PlacedOverlay from './PlacedOverlay.svelte';

	interface Props {
		placedStamps: UserPlacedStamp[];
		stampImages: Map<string, Stamp>; // stampId -> Stamp for image lookup
		stampsDataDir: string;
		editable?: boolean;
		classes?: string;
		onstampclick?: (placedStamp: UserPlacedStamp) => void;
		onstampremove?: (placedStamp: UserPlacedStamp) => void;
	}

	let {
		placedStamps,
		stampImages,
		stampsDataDir,
		editable = false,
		classes = '',
		onstampclick,
		onstampremove
	}: Props = $props();

	function getImagePath(stampId: string): string {
		return getStampImagePath(stampImages.get(stampId), stampsDataDir);
	}

	function isVideo(stampId: string): boolean {
		return isVideoStamp(stampImages.get(stampId));
	}

	function handleImageError(e: Event) {
		onImageError(e, STAMP_FALLBACK_IMAGE);
	}
</script>

<PlacedOverlay
	items={placedStamps}
	{editable}
	{classes}
	onitemclick={onstampclick}
	onitemremove={onstampremove}
>
	{#snippet children(placedStamp)}
		{@const stamp = stampImages.get(String(placedStamp.stampId))}
		{@const stampId = String(placedStamp.stampId)}
		{#if isVideo(stampId)}
			<video
				src={getImagePath(stampId)}
				class="h-full w-full object-contain drop-shadow-md"
				autoplay
				loop
				muted
				playsinline
			></video>
		{:else}
			<img
				src={getImagePath(stampId)}
				alt={stamp?.emojis || 'Placed stamp'}
				class="h-full w-full object-contain drop-shadow-md"
				onerror={handleImageError}
			/>
		{/if}
	{/snippet}
</PlacedOverlay>
