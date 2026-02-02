<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Collection } from '$types/collection.type';
	import type { Sticker } from '$types/sticker.type';
	import type { Rarity } from '$types/rarity.type';
	import StickerItem from '$components/core/StickerItem.svelte';

	interface Props {
		show: boolean;
		collection: Collection | null;
		stickers: Sticker[];
		raritiesMap: Map<string, Rarity>;
		stickerRarityMap: Map<string, string>;
		isOpening: boolean;
	}

	let { show, collection, stickers, raritiesMap, stickerRarityMap, isOpening }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		claim: Sticker[];
	}>();

	function getStickerRarity(sticker: Sticker): Rarity | null {
		const rarityId = stickerRarityMap.get(String(sticker.id));
		if (!rarityId) return null;
		return raritiesMap.get(rarityId) ?? null;
	}
</script>

{#if show}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={() => dispatch('close')}
		role="dialog"
		aria-modal="true"
		aria-labelledby="booster-pack-title"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="bg-base-100 max-h-[80vh] w-full max-w-2xl overflow-auto rounded-xl p-6"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="mb-4 flex items-center justify-between">
				<h3 id="booster-pack-title" class="text-xl font-bold">
					{#if isOpening}
						Opening Pack...
					{:else}
						Booster Pack - {collection?.title ?? ''}
					{/if}
				</h3>
				<button
					class="btn btn-ghost btn-sm btn-circle"
					onclick={() => dispatch('close')}
					aria-label="Close"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
			</div>

			{#if isOpening}
				<div class="flex justify-center py-8">
					<span class="loading loading-spinner loading-lg"></span>
				</div>
			{:else if stickers.length > 0}
				<div class="grid grid-cols-3 gap-4 md:grid-cols-5">
					{#each stickers as sticker (sticker.id)}
						{@const rarity = getStickerRarity(sticker)}
						<div class="text-center">
							<StickerItem
								{sticker}
								bgColor={rarity?.colorFrom ?? '#8b5cf6'}
								borderColor={rarity?.colorTo}
							/>
							<p class="mt-1 truncate text-xs">{sticker.name}</p>
						</div>
					{/each}
				</div>
				<div class="mt-6 flex justify-center">
					<button class="btn btn-primary" onclick={() => dispatch('claim', stickers)}
						>Claim Stickers</button
					>
				</div>
			{:else}
				<div class="text-base-content/60 py-8 text-center">
					<p>No stickers available in this pack.</p>
				</div>
			{/if}
		</div>
	</div>
{/if}
