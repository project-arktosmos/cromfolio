<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import StickerItem from '$components/core/StickerItem.svelte';
	import type { Collection } from '$types/collection.type';
	import type { Sticker } from '$types/sticker.type';
	import type { Rarity } from '$types/rarity.type';

	interface Props {
		collection: Collection | null;
		stickers: Sticker[];
		raritiesMap: Map<string, Rarity>;
		stickerRarityMap: Map<string, string>;
	}

	let { collection, stickers, raritiesMap, stickerRarityMap }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	function getStickerRarity(sticker: Sticker): Rarity | null {
		const rarityId = stickerRarityMap.get(String(sticker.id));
		if (!rarityId) return null;
		return raritiesMap.get(rarityId) ?? null;
	}
</script>

<div class="card bg-base-200 mb-6">
	<div class="card-body">
		<div class="mb-4 flex items-center justify-between">
			<div>
				<h3 class="text-xl font-bold">Booster Pack Opened!</h3>
				{#if collection}
					<p class="text-base-content/70">{collection.title}</p>
				{/if}
			</div>
			<button class="btn btn-sm btn-ghost" onclick={() => dispatch('close')} aria-label="Close booster pack">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>

		<div class="mb-4 grid grid-cols-5 gap-3">
			{#each stickers as sticker, index (sticker.id + '-' + index)}
				{@const rarity = getStickerRarity(sticker)}
				{@const displaySticker = { ...sticker, sourceName: collection?.title }}
				<div class="ring-primary aspect-[3/4] rounded-lg ring-2">
					<div class="flex h-full flex-col p-2">
						<StickerItem
							sticker={displaySticker}
							bgColor={rarity?.colorFrom ?? '#6B7280'}
							borderColor={rarity?.colorTo}
							classes="w-full flex-1"
						/>
						<p class="mt-1 truncate text-center text-xs" title={sticker.name}>
							{sticker.name}
						</p>
					</div>
				</div>
			{/each}
		</div>

		<div class="flex justify-end">
			<button class="btn btn-primary btn-sm" onclick={() => dispatch('close')}> Done </button>
		</div>
	</div>
</div>
