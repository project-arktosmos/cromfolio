<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import type { Collection } from '$types/collection.type';
	import type { UserPlacedStamp } from '$types/user-placed-stamp.type';
	import type { UserPlacedIcon } from '$types/user-placed-icon.type';
	import type { Stamp } from '$types/stamp-pack.type';
	import PlacedStampOverlay from '$components/game/PlacedStampOverlay.svelte';
	import PlacedIconOverlay from '$components/game/PlacedIconOverlay.svelte';

	interface Props {
		collection: Collection;
		totalStickers: number;
		totalRegularPages: number;
		totalWinnerPages: number;
		placedStamps: UserPlacedStamp[];
		placedIcons: UserPlacedIcon[];
		stampImageCache: Map<string, Stamp>;
		stampsDataDir: string;
		isPlacementMode: boolean;
		isIconPlacementMode: boolean;
		pageAspectRatio: number;
	}

	let {
		collection,
		totalStickers,
		totalRegularPages,
		totalWinnerPages,
		placedStamps,
		placedIcons,
		stampImageCache,
		stampsDataDir,
		isPlacementMode,
		isIconPlacementMode,
		pageAspectRatio
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		pageClick: { event: MouseEvent; element: HTMLElement; pageIndex: number };
		stampRemove: UserPlacedStamp;
		iconRemove: UserPlacedIcon;
	}>();

	function handleClick(event: MouseEvent) {
		if (isPlacementMode || isIconPlacementMode) {
			dispatch('pageClick', { event, element: event.currentTarget as HTMLElement, pageIndex: -1 });
		}
	}
</script>

<div class="flex justify-center">
	<div
		class={classNames(
			'relative w-1/2 overflow-hidden rounded-lg bg-white text-gray-900 shadow-xl',
			{
				'cursor-crosshair': isPlacementMode || isIconPlacementMode
			}
		)}
		style="aspect-ratio: {pageAspectRatio};"
		onclick={handleClick}
		role={isPlacementMode || isIconPlacementMode ? 'button' : 'img'}
		tabindex={isPlacementMode || isIconPlacementMode ? 0 : -1}
	>
		<PlacedStampOverlay
			{placedStamps}
			stampImages={stampImageCache}
			{stampsDataDir}
			editable={!isPlacementMode && !isIconPlacementMode}
			onstampremove={(ps) => dispatch('stampRemove', ps)}
		/>
		<PlacedIconOverlay
			{placedIcons}
			editable={!isPlacementMode && !isIconPlacementMode}
			oniconremove={(pi) => dispatch('iconRemove', pi)}
		/>
		<div class="flex h-full flex-col">
			{#if collection.coverImage}
				<img
					src={collection.coverImage}
					alt={collection.title}
					class="h-full w-full object-cover"
				/>
			{:else}
				<div
					class="from-primary to-secondary flex h-full flex-col items-center justify-center bg-gradient-to-br p-8"
				>
					<div class="mb-6 text-6xl text-white/30">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-24 w-24"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
							/>
						</svg>
					</div>
					<h2 class="text-center text-3xl font-bold text-white drop-shadow-lg">
						{collection.title}
					</h2>
					{#if collection.description}
						<p class="mt-4 max-w-xs text-center text-white/80">{collection.description}</p>
					{/if}
					<div class="mt-8 text-sm text-white/60">
						{totalStickers} stickers · {totalRegularPages + totalWinnerPages} pages
						{#if totalWinnerPages > 0}
							<span class="ml-1"
								>(incl. {totalWinnerPages} winner{totalWinnerPages > 1 ? 's' : ''})</span
							>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
