<script lang="ts">
	import classNames from 'classnames';
	import type { StampPack, Stamp } from '$types/stamp-pack.type';
	import {
		getStampImagePath,
		isVideoStamp,
		handleImageError as onImageError,
		STAMP_FALLBACK_IMAGE
	} from '$utils/stamp-image';

	interface Props {
		pack: StampPack;
		stamps: Stamp[];
		stampsDataDir: string;
		position: { x: number };
		classes?: string;
		onstampselect?: (stamp: Stamp) => void;
		onpanelenter?: () => void;
		onpanelleave?: () => void;
	}

	let {
		pack,
		stamps,
		stampsDataDir,
		position,
		classes = '',
		onstampselect,
		onpanelenter,
		onpanelleave
	}: Props = $props();

	function handleImageError(e: Event) {
		onImageError(e, STAMP_FALLBACK_IMAGE);
	}

	let computedClasses = $derived(
		classNames('fixed z-50 bg-base-200 rounded-lg shadow-xl p-3 max-w-xs', classes)
	);

	// Clamp position to stay within viewport
	let clampedX = $derived(Math.max(16, Math.min(position.x - 120, window.innerWidth - 280)));
</script>

<div
	class={computedClasses}
	style="left: {clampedX}px; bottom: 100px;"
	onmouseenter={() => onpanelenter?.()}
	onmouseleave={() => onpanelleave?.()}
	role="region"
	aria-label="Stamp selection panel"
>
	<h3 class="mb-2 truncate text-sm font-bold" title={pack.name}>{pack.name}</h3>
	<div class="grid max-h-64 grid-cols-4 gap-1.5 overflow-y-auto">
		{#each stamps as stamp (stamp.id)}
			<button
				class="bg-base-300 h-14 w-14 cursor-pointer overflow-hidden rounded-md transition-transform hover:scale-110"
				onclick={() => onstampselect?.(stamp)}
				title={stamp.emojis || 'Stamp'}
			>
				{#if isVideoStamp(stamp)}
					<video
						src={getStampImagePath(stamp, stampsDataDir)}
						class="h-full w-full object-contain"
						autoplay
						loop
						muted
						playsinline
					></video>
				{:else}
					<img
						src={getStampImagePath(stamp, stampsDataDir)}
						alt={stamp.emojis || 'Stamp'}
						class="h-full w-full object-contain"
						onerror={handleImageError}
					/>
				{/if}
			</button>
		{/each}
	</div>
	{#if stamps.length === 0}
		<div class="text-base-content/50 py-2 text-center text-sm">No stamps in this pack</div>
	{/if}
</div>
