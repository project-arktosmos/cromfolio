<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import StickerItem from '$components/core/StickerItem.svelte';
	import type { Sticker } from '$types/sticker.type';
	import type { Rarity } from '$types/rarity.type';

	interface OwnedStickerGroup {
		stickerId: string;
		rarityId: string;
		count: number;
		sticker: Sticker;
		rarity: Rarity | null;
		sourceId: string;
	}

	interface Props {
		group: OwnedStickerGroup;
		isPlaced: boolean;
		canMix: boolean;
		nextRarity: Rarity | null;
		isMixing: boolean;
		placementCount: number;
		totalCopies: number;
	}

	let { group, isPlaced, canMix, nextRarity, isMixing, placementCount, totalCopies }: Props =
		$props();

	const dispatch = createEventDispatcher<{
		mix: OwnedStickerGroup;
	}>();

	let allPlaced = $derived(placementCount >= totalCopies);
</script>

<div class="relative">
	<!-- Sticker Card -->
	<div
		class={classNames(
			'card bg-base-200 overflow-hidden shadow-sm transition-shadow hover:shadow-md',
			{ 'ring-success ring-2': isPlaced },
			{ 'ring-accent ring-2': canMix && !isPlaced }
		)}
	>
		<div class="aspect-[3/4] p-2">
			<StickerItem
				sticker={group.sticker}
				bgColor={group.rarity?.colorFrom ?? '#6B7280'}
				borderColor={group.rarity?.colorTo}
				classes="w-full h-full"
			/>
		</div>
		<div class="card-body gap-2 p-3 pt-0">
			<p class="truncate text-center text-xs font-medium" title={group.sticker.name}>
				{group.sticker.name}
			</p>
			{#if group.rarity}
				<div
					class="badge badge-sm w-full justify-center"
					style="background: linear-gradient(135deg, {group.rarity.colorFrom}, {group.rarity
						.colorTo}); color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.3);"
				>
					{group.rarity.name}
				</div>
			{:else}
				<div class="badge badge-sm badge-ghost w-full justify-center">No Rarity</div>
			{/if}
			{#if canMix && nextRarity}
				<button
					class="btn btn-xs btn-accent w-full gap-1"
					onclick={() => dispatch('mix', group)}
					disabled={isMixing}
				>
					{#if isMixing}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-3 w-3"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 10l7-7m0 0l7 7m-7-7v18"
							/>
						</svg>
					{/if}
					Mix to {nextRarity.name}
				</button>
			{/if}
		</div>
	</div>

	<!-- Copy Count Badge -->
	{#if group.count > 1}
		<div
			class={classNames(
				'badge badge-sm absolute right-1 top-1 font-bold',
				canMix ? 'badge-accent' : 'badge-primary'
			)}
		>
			x{group.count}
		</div>
	{/if}

	<!-- Placed Indicator -->
	{#if isPlaced}
		<div
			class={classNames(
				'badge badge-sm absolute left-1 top-1 gap-1',
				allPlaced ? 'badge-success' : 'badge-warning'
			)}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-3 w-3"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
			</svg>
			{placementCount}/{totalCopies}
		</div>
	{/if}
</div>
