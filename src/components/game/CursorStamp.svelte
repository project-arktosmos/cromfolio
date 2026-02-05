<script lang="ts">
	import type { Stamp } from '$types/stamp-pack.type';
	import {
		getStampImagePath,
		isVideoStamp,
		handleImageError as onImageError,
		STAMP_FALLBACK_IMAGE
	} from '$utils/stamp-image';
	import CursorPlacement from '$components/game/CursorPlacement.svelte';

	interface Props {
		stamp: Stamp;
		stampsDataDir: string;
		mousePosition: { x: number; y: number };
		scale?: number;
	}

	let { stamp, stampsDataDir, mousePosition, scale = 1.0 }: Props = $props();

	const BASE_SIZE = 64;
	let size = $derived(BASE_SIZE * scale);

	let imagePath = $derived(getStampImagePath(stamp, stampsDataDir));
	let isVideo = $derived(isVideoStamp(stamp));

	function handleImageError(e: Event) {
		onImageError(e, STAMP_FALLBACK_IMAGE);
	}
</script>

<CursorPlacement {mousePosition} {size}>
	{#if isVideo}
		<video
			src={imagePath}
			class="h-full w-full object-contain opacity-80 drop-shadow-lg"
			autoplay
			loop
			muted
			playsinline
		></video>
	{:else}
		<img
			src={imagePath}
			alt="Placing stamp"
			class="h-full w-full object-contain opacity-80 drop-shadow-lg"
			onerror={handleImageError}
		/>
	{/if}
</CursorPlacement>
