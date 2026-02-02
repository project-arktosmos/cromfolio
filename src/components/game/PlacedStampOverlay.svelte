<script lang="ts">
	import classNames from 'classnames';
	import { convertFileSrc } from '@tauri-apps/api/core';
	import type { UserPlacedStamp } from '$types/user-placed-stamp.type';
	import type { Stamp } from '$types/stamp-pack.type';

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

	// Fallback image
	const fallbackImage =
		'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect fill="%23374151" width="64" height="64" rx="4"/><text x="32" y="38" text-anchor="middle" fill="%239CA3AF" font-size="20">?</text></svg>';

	function getStampImagePath(stampId: string): string {
		const stamp = stampImages.get(stampId);
		if (!stamp?.imagePath) return fallbackImage;
		// Skip animated TGS files for now (they need lottie)
		if (stamp.imagePath.endsWith('.tgs')) return fallbackImage;
		const filePath = `${stampsDataDir}/${stamp.imagePath}`;
		return convertFileSrc(filePath);
	}

	function isVideoStamp(stampId: string): boolean {
		const stamp = stampImages.get(stampId);
		return stamp?.imagePath?.endsWith('.webm') ?? false;
	}

	function handleImageError(e: Event) {
		(e.target as HTMLImageElement).src = fallbackImage;
	}

	function handleRemoveClick(e: MouseEvent, placedStamp: UserPlacedStamp) {
		e.stopPropagation();
		onstampremove?.(placedStamp);
	}

	let computedClasses = $derived(classNames('absolute inset-0 overflow-hidden', classes));
</script>

<div class={computedClasses}>
	{#each placedStamps as placedStamp (placedStamp.id)}
		{@const stamp = stampImages.get(String(placedStamp.stampId))}
		{@const stampId = String(placedStamp.stampId)}
		<div
			class={classNames('absolute w-12 h-12 group', {
				'pointer-events-auto cursor-pointer hover:ring-2 hover:ring-primary rounded': editable
			})}
			style="
				left: {placedStamp.positionX}%;
				top: {placedStamp.positionY}%;
				transform: translate(-50%, -50%) scale({placedStamp.scale}) rotate({placedStamp.rotation}deg);
			"
			onclick={() => editable && onstampclick?.(placedStamp)}
			role={editable ? 'button' : 'img'}
			tabindex={editable ? 0 : -1}
		>
			{#if isVideoStamp(stampId)}
				<video
					src={getStampImagePath(stampId)}
					class="w-full h-full object-contain drop-shadow-md"
					autoplay
					loop
					muted
					playsinline
				></video>
			{:else}
				<img
					src={getStampImagePath(stampId)}
					alt={stamp?.emojis || 'Placed stamp'}
					class="w-full h-full object-contain drop-shadow-md"
					onerror={handleImageError}
				/>
			{/if}
			{#if editable}
				<button
					class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-error text-error-content rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
					onclick={(e) => handleRemoveClick(e, placedStamp)}
					title="Remove stamp"
				>
					×
				</button>
			{/if}
		</div>
	{/each}
</div>
