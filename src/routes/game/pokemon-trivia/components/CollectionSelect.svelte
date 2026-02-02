<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import type { Collection } from '$types/collection.type';

	interface Props {
		collections: Collection[];
		collectionStickerCounts: Map<string, number>;
		hasTemplates: boolean;
	}

	let { collections, collectionStickerCounts, hasTemplates }: Props = $props();

	const dispatch = createEventDispatcher<{
		select: Collection;
	}>();

	function getStickerCount(collectionId: string | number): number {
		return collectionStickerCounts.get(String(collectionId)) ?? 0;
	}

	function canPlayCollection(collectionId: string | number): boolean {
		return getStickerCount(collectionId) >= 4 && hasTemplates;
	}

	function handleSelect(collection: Collection) {
		if (canPlayCollection(collection.id)) {
			dispatch('select', collection);
		}
	}
</script>

{#if !hasTemplates}
	<div class="alert alert-warning">
		<span>No active trivia templates found. Create templates in the admin panel first.</span>
	</div>
{/if}

{#if collections.length === 0}
	<div class="alert alert-info">
		<span>No collections available. Create collections in the admin panel first.</span>
	</div>
{:else}
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#each collections as collection (collection.id)}
			{@const stickerCount = getStickerCount(collection.id)}
			{@const canPlay = canPlayCollection(collection.id)}
			<div
				class={classNames('card bg-base-200 transition-all', {
					'cursor-pointer hover:scale-[1.02] hover:shadow-lg': canPlay,
					'cursor-not-allowed opacity-50': !canPlay
				})}
				onclick={() => handleSelect(collection)}
				onkeydown={(e) => e.key === 'Enter' && handleSelect(collection)}
				role="button"
				tabindex={canPlay ? 0 : -1}
			>
				{#if collection.coverImage}
					<figure class="relative">
						<img
							src={collection.coverImage}
							alt={collection.title}
							class="h-48 w-full object-cover"
						/>
					</figure>
				{:else}
					<figure class="bg-base-300 relative flex h-48 items-center justify-center">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="text-base-content/30 h-16 w-16"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
							/>
						</svg>
					</figure>
				{/if}
				<div class="card-body p-4">
					<h2 class="card-title text-lg">{collection.title}</h2>
					<p class="text-base-content/60 text-sm">{stickerCount} Pokemon</p>
					{#if !canPlay}
						<p class="text-error text-xs">
							{stickerCount < 4 ? 'Need at least 4 Pokemon' : 'No active trivia templates'}
						</p>
					{/if}
					<div class="card-actions mt-2 justify-end">
						<button
							class={classNames('btn btn-sm', {
								'btn-primary': canPlay,
								'btn-disabled': !canPlay
							})}
							disabled={!canPlay}
						>
							Play
						</button>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
