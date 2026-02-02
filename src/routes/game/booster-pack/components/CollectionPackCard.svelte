<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import type { Collection } from '$types/collection.type';
	import type { Rarity } from '$types/rarity.type';

	interface CollectionStats {
		total: number;
		owned: number;
		rarityBreakdown: Map<string, number>;
	}

	interface Props {
		collection: Collection;
		stats: CollectionStats;
		rarities: Rarity[];
		hasStickers: boolean;
		isOpening: boolean;
	}

	let { collection, stats, rarities, hasStickers, isOpening }: Props = $props();

	const dispatch = createEventDispatcher<{
		openPack: Collection;
	}>();

	let isComplete = $derived(stats.total > 0 && stats.owned === stats.total);
	let percent = $derived(stats.total > 0 ? Math.round((stats.owned / stats.total) * 100) : 0);
</script>

<div
	class={classNames('card bg-base-200 shadow-md transition-shadow hover:shadow-lg', {
		'ring-success ring-2': isComplete
	})}
>
	<figure class="px-4 pt-4">
		{#if collection.coverImage}
			<img
				src={collection.coverImage}
				alt={collection.title}
				class="h-32 w-full rounded-lg object-cover"
			/>
		{:else}
			<div
				class="bg-base-300 text-base-content/30 flex h-32 w-full items-center justify-center rounded-lg"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-12 w-12"
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
		{/if}
	</figure>
	<div class="card-body">
		<div class="flex items-center gap-2">
			<h2 class="card-title truncate text-base">{collection.title}</h2>
			{#if isComplete}
				<span class="badge badge-success badge-sm">Complete</span>
			{/if}
		</div>

		<!-- Rarity breakdown -->
		{#if stats.rarityBreakdown.size > 0}
			<div class="flex flex-wrap gap-1">
				{#each rarities.toSorted((a, b) => b.sortOrder - a.sortOrder) as rarity (rarity.id)}
					{@const count = stats.rarityBreakdown.get(String(rarity.id)) ?? 0}
					{#if count > 0}
						<span
							class="rounded px-1.5 py-0.5 text-xs font-medium"
							style="background: linear-gradient(135deg, {rarity.colorFrom}, {rarity.colorTo}); color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.3);"
							title="{rarity.name}: {count}"
						>
							{count}
						</span>
					{/if}
				{/each}
			</div>
		{:else if stats.owned === 0}
			<div class="text-base-content/40 text-sm">No stickers yet</div>
		{/if}

		<!-- Progress bar -->
		{#if stats.total > 0}
			<div class="flex items-center gap-2">
				<progress
					class={classNames('progress h-2 flex-1', {
						'progress-success': percent === 100,
						'progress-warning': percent >= 50 && percent < 100,
						'progress-primary': percent < 50
					})}
					value={stats.owned}
					max={stats.total}
				></progress>
				<span class="text-base-content/60 w-12 text-right font-mono text-xs"
					>{stats.owned}/{stats.total}</span
				>
			</div>
		{/if}

		<div class="card-actions mt-2 justify-end">
			<button
				class="btn btn-primary btn-sm"
				onclick={() => dispatch('openPack', collection)}
				disabled={!hasStickers || isOpening}
			>
				{#if isOpening}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					Open Pack
				{/if}
			</button>
		</div>
	</div>
</div>
