<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import StickerItem from '$components/core/StickerItem.svelte';
	import StickerPreview from '$components/core/StickerPreview.svelte';
	import SingleSource from '$components/core/SingleSource.svelte';
	import SingleBoosterPack from '$components/core/SingleBoosterPack.svelte';
	import { getStickerCollection } from '$services/stickers.service';
	import { getSourceCollection, sourceExists } from '$services/sources.service';
	import { getRarityCollection, getRarity } from '$services/rarities.service';
	import { getStickerTypeCollection, getStickerType } from '$services/sticker-types.service';
	import { getTagsBySticker } from '$services/tags.service';
	import type { Sticker } from '$types/sticker.type';
	import type { Rarity } from '$types/rarity.type';
	import type { Source } from '$types/source.type';
	import type { StickerTypeEntity } from '$types/sticker-type-entity.type';
	import type { Tag } from '$types/tag.type';

	// Sticker data from database
	let stickers: Sticker[] = $state([]);
	let rarities: Rarity[] = $state([]);
	let sources: Source[] = $state([]);
	let stickerTypes: StickerTypeEntity[] = $state([]);
	let selectedSticker: Sticker | null = $state(null);
	let selectedRarity: Rarity | null = $state(null);
	let selectedSource: Source | null = $state(null);
	let selectedStickerType: StickerTypeEntity | null = $state(null);
	let isLoading = $state(true);

	// Editable props for SingleSource
	let albumPropWidth = $state(400);
	let albumPropHeight = $state(400);
	let albumPropInteractive = $state(true);
	let albumPropAutoRotate = $state(true);

	// Editable props for SingleBoosterPack
	let boosterPropWidth = $state(300);
	let boosterPropHeight = $state(400);
	let boosterPropInteractive = $state(true);
	let boosterPropAutoRotate = $state(true);
	let boosterPropCardCount = $state(10);
	let boosterPropWrapperColor = $state('#c0c0c0');

	// Editable props for StickerItem
	let stickerItemRarity = $state<Rarity | null>(null);

	// State for StickerPreview
	let previewStickerSource = $state<Source | null>(null);
	let previewStickerTags = $state<Tag[]>([]);
	let previewShowRarity = $state(true);
	let previewShowType = $state(true);
	let previewShowSource = $state(true);
	let previewShowTags = $state(true);

	// Selected component for detail view
	let selectedComponent = $state<string>('StickerItem');

	// Component list for sidebar navigation
	const components = [
		{ id: 'StickerItem', name: 'StickerItem', description: 'Simple sticker image with background' },
		{ id: 'StickerPreview', name: 'StickerPreview', description: 'Panel showing all sticker metadata' },
		{ id: 'SingleSource', name: 'SingleSource', description: '3D source book display' },
		{ id: 'SingleBoosterPack', name: 'SingleBoosterPack', description: '3D booster pack display' }
	];

	onMount(async () => {
		[stickers, rarities, sources, stickerTypes] = await Promise.all([
			getStickerCollection(),
			getRarityCollection(),
			getSourceCollection(),
			getStickerTypeCollection()
		]);
		if (stickers.length > 0) {
			selectedSticker = stickers[0];
			// Stickers don't have inherent rarity - rarity is assigned when acquired
			selectedRarity = null;
			// If the sticker has a stickerTypeId, load that sticker type
			if (selectedSticker.stickerTypeId) {
				selectedStickerType = await getStickerType(selectedSticker.stickerTypeId);
			}
			// Load the sticker's source for preview
			if (selectedSticker.sourceId) {
				previewStickerSource = await sourceExists(selectedSticker.sourceId);
			}
			// Load tags for the sticker
			previewStickerTags = await getTagsBySticker(selectedSticker.id);
		}
		if (sources.length > 0) {
			selectedSource = sources[0];
		}
		isLoading = false;
	});

	async function selectSticker(sticker: Sticker) {
		selectedSticker = sticker;
		// Stickers don't have inherent rarity - rarity is assigned when acquired (user_stickers)
		selectedRarity = null;
		// Load the sticker's type if it has one
		if (sticker.stickerTypeId) {
			selectedStickerType = await getStickerType(sticker.stickerTypeId);
		} else {
			selectedStickerType = null;
		}
		// Load the sticker's source for preview
		if (sticker.sourceId) {
			previewStickerSource = await sourceExists(sticker.sourceId);
		} else {
			previewStickerSource = null;
		}
		// Load tags for the sticker
		previewStickerTags = await getTagsBySticker(sticker.id);
	}

	function selectRarity(rarityId: string) {
		if (rarityId === '') {
			selectedRarity = null;
		} else {
			selectedRarity = rarities.find((r) => String(r.id) === rarityId) ?? null;
		}
	}

	function selectSource(sourceId: string) {
		selectedSource = sources.find((a) => String(a.id) === sourceId) ?? null;
	}

	function selectStickerItemRarity(rarityId: string) {
		if (rarityId === '') {
			stickerItemRarity = null;
		} else {
			stickerItemRarity = rarities.find((r) => String(r.id) === rarityId) ?? null;
		}
	}

	// Compute sticker counts by type for selected source
	let selectedSourceStickerCounts = $derived.by(() => {
		const source = selectedSource;
		if (!source) return {};
		const sourceStickers = stickers.filter((t) => t.sourceId === source.id);
		const counts: Record<string, number> = {};
		for (const sticker of sourceStickers) {
			const stickerTypeId = sticker.stickerTypeId || 'other';
			counts[stickerTypeId] = (counts[stickerTypeId] || 0) + 1;
		}
		return counts;
	});
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold">Component Showcase</h1>
		<p class="text-base-content/70 mt-1">
			Debug and preview reusable components with live prop editing
		</p>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
		<!-- Component List -->
		<div class="lg:col-span-1">
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title text-lg">Components</h2>
					<div class="space-y-2">
						{#each components as component (component.id)}
							<button
								class={classNames(
									'w-full text-left p-3 rounded-lg transition-all',
									'hover:bg-base-300',
									{
										'bg-primary/20 ring-2 ring-primary': selectedComponent === component.id,
										'bg-base-100': selectedComponent !== component.id
									}
								)}
								onclick={() => (selectedComponent = component.id)}
							>
								<div class="font-medium">{component.name}</div>
								<div class="text-xs text-base-content/60">{component.description}</div>
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<!-- Component Preview -->
		<div class="lg:col-span-3">
			<div class="card bg-base-200">
				<div class="card-body">
					{#if selectedComponent === 'StickerItem'}
						<h2 class="card-title">StickerItem</h2>
						<p class="text-sm text-base-content/70 mb-4">
							Simple component that displays a sticker's image with a colored background and padding.
						</p>

						{#if isLoading}
							<div class="flex justify-center p-8">
								<span class="loading loading-spinner loading-lg"></span>
							</div>
						{:else if stickers.length === 0}
							<div class="alert alert-warning">
								<span>No stickers in database. Add stickers via the Sources admin panel first.</span>
							</div>
						{:else}
							<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
								<!-- Left: StickerItem Preview -->
								<div class="space-y-4">
									<h3 class="font-semibold">Preview</h3>

									<!-- Source Image and Rendered StickerItem side by side -->
									<div class="flex gap-4 items-start justify-center">
										<!-- Source Image -->
										{#if selectedSticker}
											<div class="space-y-2">
												<div class="text-xs text-base-content/60 text-center">Source Image</div>
												<img
													src={selectedSticker.image}
													alt="Source"
													class="max-w-48 max-h-64 object-contain border border-base-300 bg-base-100"
												/>
											</div>
										{/if}

										<!-- Rendered StickerItem -->
										<div class="space-y-2">
											<div class="text-xs text-base-content/60 text-center">StickerItem Output</div>
											<div class="w-48">
												{#if selectedSticker}
													<StickerItem
														sticker={selectedSticker}
														bgColor={stickerItemRarity?.colorFrom}
														borderColor={stickerItemRarity?.colorTo}
													/>
												{/if}
											</div>
										</div>
									</div>

									<!-- Sticker Selector -->
									<div class="form-control">
										<label class="label" for="sticker-item-select">
											<span class="label-text font-medium">Source Sticker</span>
										</label>
										<select
											id="sticker-item-select"
											class="select select-bordered select-sm w-full"
											onchange={(e) => {
												const sticker = stickers.find(t => String(t.id) === e.currentTarget.value);
												if (sticker) selectSticker(sticker);
											}}
										>
											{#each stickers as sticker (sticker.id)}
												<option value={String(sticker.id)} selected={selectedSticker?.id === sticker.id}>
													{sticker.name}
												</option>
											{/each}
										</select>
									</div>

									<!-- Sticker Data Display -->
									{#if selectedSticker}
										<div class="bg-base-100 rounded-lg p-3">
											<h4 class="text-xs font-semibold text-base-content/60 mb-2">Sticker Data</h4>
											<div class="text-xs space-y-1 font-mono">
												<div><span class="text-base-content/50">id:</span> {selectedSticker.id}</div>
												<div><span class="text-base-content/50">name:</span> {selectedSticker.name}</div>
												<div class="truncate" title={selectedSticker.image}>
													<span class="text-base-content/50">image:</span> {selectedSticker.image}
												</div>
											</div>
										</div>
									{/if}
								</div>

								<!-- Right: Props Editor -->
								<div class="space-y-4">
									<h3 class="font-semibold">Props Editor</h3>

									<div class="overflow-x-auto">
										<table class="table table-sm">
											<thead>
												<tr>
													<th>Prop</th>
													<th>Type</th>
													<th>Value</th>
												</tr>
											</thead>
											<tbody>
												<!-- sticker (read-only) -->
												<tr>
													<td><code>sticker</code></td>
													<td><code class="text-xs">Sticker</code></td>
													<td>
														<span class="badge badge-ghost badge-sm">from selector</span>
													</td>
												</tr>

												<!-- bgColor -->
												<tr>
													<td><code>bgColor</code></td>
													<td><code class="text-xs">string</code></td>
													<td>
														{#if stickerItemRarity}
															<div class="flex items-center gap-2">
																<div
																	class="w-8 h-8 rounded border border-base-300"
																	style="background-color: {stickerItemRarity.colorFrom}"
																></div>
																<span class="text-xs font-mono">{stickerItemRarity.colorFrom}</span>
															</div>
														{:else}
															<span class="text-xs text-base-content/50">Select rarity</span>
														{/if}
													</td>
												</tr>

												<!-- borderColor -->
												<tr>
													<td><code>borderColor</code></td>
													<td><code class="text-xs">string?</code></td>
													<td>
														{#if stickerItemRarity}
															<div class="flex items-center gap-2">
																<div
																	class="w-8 h-8 rounded border border-base-300"
																	style="background-color: {stickerItemRarity.colorTo}"
																></div>
																<span class="text-xs font-mono">{stickerItemRarity.colorTo}</span>
															</div>
														{:else}
															<span class="text-xs text-base-content/50">Select rarity</span>
														{/if}
													</td>
												</tr>

												<!-- classes (read-only info) -->
												<tr>
													<td><code>classes</code></td>
													<td><code class="text-xs">string</code></td>
													<td>
														<span class="text-xs text-base-content/50">Additional CSS classes</span>
													</td>
												</tr>
											</tbody>
										</table>
									</div>

									<!-- Rarity Selector -->
									<div class="bg-base-100 rounded-lg p-3">
										<h4 class="text-xs font-semibold text-base-content/60 mb-2">Rarity Colors</h4>
										<div class="form-control">
											<select
												class="select select-bordered select-sm w-full"
												onchange={(e) => selectStickerItemRarity(e.currentTarget.value)}
											>
												<option value="" selected={!stickerItemRarity}>Select a rarity...</option>
												{#each rarities as rarity (rarity.id)}
													<option value={String(rarity.id)} selected={stickerItemRarity?.id === rarity.id}>
														{rarity.name}
													</option>
												{/each}
											</select>
										</div>
										{#if stickerItemRarity}
											<div class="mt-3 space-y-2">
												<div class="flex items-center gap-3">
													<div
														class="w-8 h-8 rounded border border-base-300"
														style="background-color: {stickerItemRarity.colorFrom}"
													></div>
													<div class="text-xs">
														<div class="text-base-content/60">Color From</div>
														<div class="font-mono">{stickerItemRarity.colorFrom}</div>
													</div>
												</div>
												<div class="flex items-center gap-3">
													<div
														class="w-8 h-8 rounded border border-base-300"
														style="background-color: {stickerItemRarity.colorTo}"
													></div>
													<div class="text-xs">
														<div class="text-base-content/60">Color To</div>
														<div class="font-mono">{stickerItemRarity.colorTo}</div>
													</div>
												</div>
												<div class="mt-2">
													<div class="text-xs text-base-content/60 mb-1">Gradient Preview</div>
													<div
														class="h-6 rounded"
														style="background: linear-gradient(135deg, {stickerItemRarity.colorFrom} 0%, {stickerItemRarity.colorTo} 100%)"
													></div>
												</div>
											</div>
										{:else}
											<p class="text-xs text-base-content/50 mt-2">Select a rarity to see its colors</p>
										{/if}
									</div>

									<!-- Prop Descriptions -->
									<div class="bg-base-100 rounded-lg p-3">
										<h4 class="text-xs font-semibold text-base-content/60 mb-2">Prop Descriptions</h4>
										<div class="text-xs space-y-2">
											<div>
												<span class="font-medium">sticker</span>
												<span class="text-base-content/60"> - Sticker data object (required)</span>
											</div>
											<div>
												<span class="font-medium">bgColor</span>
												<span class="text-base-content/60"> - Background color hex (default: '#8b5cf6')</span>
											</div>
											<div>
												<span class="font-medium">borderColor</span>
												<span class="text-base-content/60"> - Border color hex (optional, adds 1px border)</span>
											</div>
											<div>
												<span class="font-medium">classes</span>
												<span class="text-base-content/60"> - Additional Tailwind classes to apply</span>
											</div>
										</div>
									</div>

									<!-- Usage Notes -->
									<div class="bg-base-100 rounded-lg p-3">
										<h4 class="text-xs font-semibold text-base-content/60 mb-2">Usage Notes</h4>
										<div class="text-xs space-y-2 text-base-content/70">
											<p>Displays a sticker image at 50% opacity with a solid colored background.</p>
											<p>The background has 8px padding around the image.</p>
										</div>
									</div>
								</div>
							</div>
						{/if}
					{:else if selectedComponent === 'StickerPreview'}
						<h2 class="card-title">StickerPreview</h2>
						<p class="text-sm text-base-content/70 mb-4">
							A panel component that displays all available metadata for a sticker, including related rarity, type, and source information.
						</p>

						{#if isLoading}
							<div class="flex justify-center p-8">
								<span class="loading loading-spinner loading-lg"></span>
							</div>
						{:else if stickers.length === 0}
							<div class="alert alert-warning">
								<span>No stickers in database. Add stickers via the Sources admin panel first.</span>
							</div>
						{:else}
							<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
								<!-- Left: StickerPreview Preview -->
								<div class="space-y-4">
									<h3 class="font-semibold">Preview</h3>

									<!-- Rendered StickerPreview -->
									<div class="bg-base-300 rounded-lg p-4">
										{#if selectedSticker}
											<StickerPreview
												sticker={selectedSticker}
												rarity={previewShowRarity ? selectedRarity : null}
												stickerType={previewShowType ? selectedStickerType : null}
												source={previewShowSource ? previewStickerSource : null}
												tags={previewShowTags ? previewStickerTags : []}
											/>
										{/if}
									</div>

									<!-- Sticker Selector -->
									<div class="form-control">
										<label class="label" for="preview-sticker-select">
											<span class="label-text font-medium">Source Sticker</span>
										</label>
										<select
											id="preview-sticker-select"
											class="select select-bordered select-sm w-full"
											onchange={(e) => {
												const sticker = stickers.find(t => String(t.id) === e.currentTarget.value);
												if (sticker) selectSticker(sticker);
											}}
										>
											{#each stickers as sticker (sticker.id)}
												<option value={String(sticker.id)} selected={selectedSticker?.id === sticker.id}>
													{sticker.name}
												</option>
											{/each}
										</select>
									</div>
								</div>

								<!-- Right: Props Editor -->
								<div class="space-y-4">
									<h3 class="font-semibold">Props Editor</h3>

									<div class="overflow-x-auto">
										<table class="table table-sm">
											<thead>
												<tr>
													<th>Prop</th>
													<th>Type</th>
													<th>Value</th>
												</tr>
											</thead>
											<tbody>
												<!-- sticker (read-only) -->
												<tr>
													<td><code>sticker</code></td>
													<td><code class="text-xs">Sticker</code></td>
													<td>
														<span class="badge badge-ghost badge-sm">from selector</span>
													</td>
												</tr>

												<!-- rarity -->
												<tr>
													<td><code>rarity</code></td>
													<td><code class="text-xs">Rarity | null</code></td>
													<td>
														<label class="flex items-center gap-2">
															<input
																type="checkbox"
																class="toggle toggle-primary toggle-sm"
																checked={previewShowRarity}
																onchange={(e) => (previewShowRarity = e.currentTarget.checked)}
															/>
															<span class="text-xs">
																{#if previewShowRarity && selectedRarity}
																	{selectedRarity.name}
																{:else}
																	null
																{/if}
															</span>
														</label>
													</td>
												</tr>

												<!-- stickerType -->
												<tr>
													<td><code>stickerType</code></td>
													<td><code class="text-xs">StickerTypeEntity | null</code></td>
													<td>
														<label class="flex items-center gap-2">
															<input
																type="checkbox"
																class="toggle toggle-primary toggle-sm"
																checked={previewShowType}
																onchange={(e) => (previewShowType = e.currentTarget.checked)}
															/>
															<span class="text-xs">
																{#if previewShowType && selectedStickerType}
																	{selectedStickerType.name}
																{:else}
																	null
																{/if}
															</span>
														</label>
													</td>
												</tr>

												<!-- source -->
												<tr>
													<td><code>source</code></td>
													<td><code class="text-xs">Source | null</code></td>
													<td>
														<label class="flex items-center gap-2">
															<input
																type="checkbox"
																class="toggle toggle-primary toggle-sm"
																checked={previewShowSource}
																onchange={(e) => (previewShowSource = e.currentTarget.checked)}
															/>
															<span class="text-xs">
																{#if previewShowSource && previewStickerSource}
																	{previewStickerSource.title}
																{:else}
																	null
																{/if}
															</span>
														</label>
													</td>
												</tr>

												<!-- tags -->
												<tr>
													<td><code>tags</code></td>
													<td><code class="text-xs">Tag[]</code></td>
													<td>
														<label class="flex items-center gap-2">
															<input
																type="checkbox"
																class="toggle toggle-primary toggle-sm"
																checked={previewShowTags}
																onchange={(e) => (previewShowTags = e.currentTarget.checked)}
															/>
															<span class="text-xs">
																{#if previewShowTags && previewStickerTags.length > 0}
																	{previewStickerTags.length} tag(s)
																{:else}
																	[]
																{/if}
															</span>
														</label>
													</td>
												</tr>

												<!-- classes (read-only info) -->
												<tr>
													<td><code>classes</code></td>
													<td><code class="text-xs">string</code></td>
													<td>
														<span class="text-xs text-base-content/50">Additional CSS classes</span>
													</td>
												</tr>
											</tbody>
										</table>
									</div>

									<!-- Prop Descriptions -->
									<div class="bg-base-100 rounded-lg p-3">
										<h4 class="text-xs font-semibold text-base-content/60 mb-2">Prop Descriptions</h4>
										<div class="text-xs space-y-2">
											<div>
												<span class="font-medium">sticker</span>
												<span class="text-base-content/60"> - Sticker data object (required)</span>
											</div>
											<div>
												<span class="font-medium">rarity</span>
												<span class="text-base-content/60"> - Rarity object to show gradient and details (optional)</span>
											</div>
											<div>
												<span class="font-medium">stickerType</span>
												<span class="text-base-content/60"> - Sticker type entity for badge and details (optional)</span>
											</div>
											<div>
												<span class="font-medium">source</span>
												<span class="text-base-content/60"> - Source object for source details section (optional)</span>
											</div>
											<div>
												<span class="font-medium">tags</span>
												<span class="text-base-content/60"> - Array of Tag objects for key-value metadata (optional)</span>
											</div>
											<div>
												<span class="font-medium">classes</span>
												<span class="text-base-content/60"> - Additional Tailwind classes to apply</span>
											</div>
										</div>
									</div>

									<!-- Usage Notes -->
									<div class="bg-base-100 rounded-lg p-3">
										<h4 class="text-xs font-semibold text-base-content/60 mb-2">Usage Notes</h4>
										<div class="text-xs space-y-2 text-base-content/70">
											<p>Displays a comprehensive panel showing all available metadata for a sticker.</p>
											<p>The panel includes the sticker image, badges for type and rarity, identifiers, timestamps, and related entity details.</p>
											<p>Toggle the optional props to see how the panel adapts when metadata is missing.</p>
										</div>
									</div>
								</div>
							</div>
						{/if}
					{:else if selectedComponent === 'SingleSource'}
						<h2 class="card-title">SingleSource</h2>
						<p class="text-sm text-base-content/70 mb-4">
							Displays an source as a 3D book using Three.js. The source cover image is rendered as the front cover of the book. Supports mouse drag rotation and auto-rotation.
						</p>

						{#if isLoading}
							<div class="flex justify-center p-8">
								<span class="loading loading-spinner loading-lg"></span>
							</div>
						{:else if sources.length === 0}
							<div class="alert alert-warning">
								<span>No sources in database. Add sources in the Source admin panel first.</span>
							</div>
						{:else}
							<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
								<!-- Left: Source Preview -->
								<div class="space-y-4">
									<h3 class="font-semibold">Preview</h3>

									<!-- 3D Book Preview -->
									<div class="flex justify-center bg-base-300 rounded-lg p-4">
										{#if selectedSource}
											{#key `${selectedSource.id}-${albumPropWidth}-${albumPropHeight}`}
												<SingleSource
													source={selectedSource}
													cardCountsByType={selectedSourceStickerCounts}
													width={albumPropWidth}
													height={albumPropHeight}
													interactive={albumPropInteractive}
													autoRotate={albumPropAutoRotate}
												/>
											{/key}
										{/if}
									</div>

									<!-- Source Selector -->
									<div class="form-control">
										<label class="label" for="source-select">
											<span class="label-text font-medium">Source Source</span>
										</label>
										<select
											id="source-select"
											class="select select-bordered select-sm w-full"
											onchange={(e) => selectSource(e.currentTarget.value)}
										>
											{#each sources as source (source.id)}
												<option value={String(source.id)} selected={selectedSource?.id === source.id}>
													{source.title}
												</option>
											{/each}
										</select>
									</div>

									<!-- Source Data Display -->
									{#if selectedSource}
										<div class="bg-base-100 rounded-lg p-3">
											<h4 class="text-xs font-semibold text-base-content/60 mb-2">Source Data</h4>
											<div class="text-xs space-y-1 font-mono">
												<div><span class="text-base-content/50">id:</span> {selectedSource.id}</div>
												<div><span class="text-base-content/50">title:</span> {selectedSource.title}</div>
												<div><span class="text-base-content/50">sourceType:</span> {selectedSource.sourceType}</div>
												<div class="truncate" title={selectedSource.description}>
													<span class="text-base-content/50">description:</span> {selectedSource.description}
												</div>
												{#if selectedSource.coverImage}
													<div class="truncate" title={selectedSource.coverImage}>
														<span class="text-base-content/50">coverImage:</span> {selectedSource.coverImage}
													</div>
												{/if}
												{#if selectedSource.imdbId}
													<div><span class="text-base-content/50">imdbId:</span> {selectedSource.imdbId}</div>
												{/if}
												{#if selectedSource.tmdbId}
													<div><span class="text-base-content/50">tmdbId:</span> {selectedSource.tmdbId}</div>
												{/if}
											</div>
										</div>
									{/if}
								</div>

								<!-- Right: Props Editor -->
								<div class="space-y-4">
									<h3 class="font-semibold">Props Editor</h3>

									<div class="overflow-x-auto">
										<table class="table table-sm">
											<thead>
												<tr>
													<th>Prop</th>
													<th>Type</th>
													<th>Value</th>
												</tr>
											</thead>
											<tbody>
												<!-- source (read-only) -->
												<tr>
													<td><code>source</code></td>
													<td><code class="text-xs">Source</code></td>
													<td>
														<span class="badge badge-ghost badge-sm">from selector</span>
													</td>
												</tr>

												<!-- width -->
												<tr>
													<td><code>width</code></td>
													<td><code class="text-xs">number</code></td>
													<td>
														<input
															type="number"
															class="input input-bordered input-sm w-24"
															min="200"
															max="800"
															step="50"
															value={albumPropWidth}
															oninput={(e) => (albumPropWidth = parseInt(e.currentTarget.value) || 400)}
														/>
													</td>
												</tr>

												<!-- height -->
												<tr>
													<td><code>height</code></td>
													<td><code class="text-xs">number</code></td>
													<td>
														<input
															type="number"
															class="input input-bordered input-sm w-24"
															min="200"
															max="800"
															step="50"
															value={albumPropHeight}
															oninput={(e) => (albumPropHeight = parseInt(e.currentTarget.value) || 400)}
														/>
													</td>
												</tr>

												<!-- interactive -->
												<tr>
													<td><code>interactive</code></td>
													<td><code class="text-xs">boolean</code></td>
													<td>
														<input
															type="checkbox"
															class="toggle toggle-primary toggle-sm"
															checked={albumPropInteractive}
															onchange={(e) => (albumPropInteractive = e.currentTarget.checked)}
														/>
													</td>
												</tr>

												<!-- autoRotate -->
												<tr>
													<td><code>autoRotate</code></td>
													<td><code class="text-xs">boolean</code></td>
													<td>
														<input
															type="checkbox"
															class="toggle toggle-primary toggle-sm"
															checked={albumPropAutoRotate}
															onchange={(e) => (albumPropAutoRotate = e.currentTarget.checked)}
														/>
													</td>
												</tr>

												<!-- classes (read-only info) -->
												<tr>
													<td><code>classes</code></td>
													<td><code class="text-xs">string</code></td>
													<td>
														<span class="text-xs text-base-content/50">Additional CSS classes</span>
													</td>
												</tr>
											</tbody>
										</table>
									</div>

									<!-- Prop Descriptions -->
									<div class="bg-base-100 rounded-lg p-3">
										<h4 class="text-xs font-semibold text-base-content/60 mb-2">Prop Descriptions</h4>
										<div class="text-xs space-y-2">
											<div>
												<span class="font-medium">source</span>
												<span class="text-base-content/60"> - Source data object (required)</span>
											</div>
											<div>
												<span class="font-medium">cardCountsByType</span>
												<span class="text-base-content/60"> - Card counts by type for back cover display</span>
											</div>
											<div>
												<span class="font-medium">width</span>
												<span class="text-base-content/60"> - Canvas width in pixels (default: 400)</span>
											</div>
											<div>
												<span class="font-medium">height</span>
												<span class="text-base-content/60"> - Canvas height in pixels (default: 400)</span>
											</div>
											<div>
												<span class="font-medium">interactive</span>
												<span class="text-base-content/60"> - Enables mouse drag rotation (default: true)</span>
											</div>
											<div>
												<span class="font-medium">autoRotate</span>
												<span class="text-base-content/60"> - Enables automatic rotation when not dragging (default: true)</span>
											</div>
											<div>
												<span class="font-medium">classes</span>
												<span class="text-base-content/60"> - Additional Tailwind classes to apply</span>
											</div>
										</div>
									</div>

									<!-- Usage Notes -->
									<div class="bg-base-100 rounded-lg p-3">
										<h4 class="text-xs font-semibold text-base-content/60 mb-2">Usage Notes</h4>
										<div class="text-xs space-y-2 text-base-content/70">
											<p>The component renders a 3D book using Three.js with the source's cover image as the front cover.</p>
											<p>Drag to rotate the book when interactive mode is enabled. Auto-rotation pauses during drag.</p>
											<p>Click the book icon button to open/close the book with animation.</p>
											<p>The book proportions are based on standard hardcover books (2.5:3.5:0.4 ratio).</p>
										</div>
									</div>
								</div>
							</div>
						{/if}
					{:else if selectedComponent === 'SingleBoosterPack'}
						<h2 class="card-title">SingleBoosterPack</h2>
						<p class="text-sm text-base-content/70 mb-4">
							Displays an source as a 3D booster pack using Three.js. The source cover image is rendered as the front of the pack with metallic/foil effects. Supports mouse drag rotation and auto-rotation.
						</p>

						{#if isLoading}
							<div class="flex justify-center p-8">
								<span class="loading loading-spinner loading-lg"></span>
							</div>
						{:else if sources.length === 0}
							<div class="alert alert-warning">
								<span>No sources in database. Add sources in the Source admin panel first.</span>
							</div>
						{:else}
							<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
								<!-- Left: Booster Pack Preview -->
								<div class="space-y-4">
									<h3 class="font-semibold">Preview</h3>

									<!-- 3D Booster Pack Preview -->
									<div class="flex justify-center bg-base-300 rounded-lg p-4">
										{#if selectedSource}
											{#key `${selectedSource.id}-${boosterPropWidth}-${boosterPropHeight}-${boosterPropCardCount}-${boosterPropWrapperColor}`}
												<SingleBoosterPack
													source={selectedSource}
													cardCount={boosterPropCardCount}
													wrapperColor={boosterPropWrapperColor}
													width={boosterPropWidth}
													height={boosterPropHeight}
													interactive={boosterPropInteractive}
													autoRotate={boosterPropAutoRotate}
												/>
											{/key}
										{/if}
									</div>

									<!-- Source Selector -->
									<div class="form-control">
										<label class="label" for="booster-source-select">
											<span class="label-text font-medium">Source Source</span>
										</label>
										<select
											id="booster-source-select"
											class="select select-bordered select-sm w-full"
											onchange={(e) => selectSource(e.currentTarget.value)}
										>
											{#each sources as source (source.id)}
												<option value={String(source.id)} selected={selectedSource?.id === source.id}>
													{source.title}
												</option>
											{/each}
										</select>
									</div>

									<!-- Source Data Display -->
									{#if selectedSource}
										<div class="bg-base-100 rounded-lg p-3">
											<h4 class="text-xs font-semibold text-base-content/60 mb-2">Source Data</h4>
											<div class="text-xs space-y-1 font-mono">
												<div><span class="text-base-content/50">id:</span> {selectedSource.id}</div>
												<div><span class="text-base-content/50">title:</span> {selectedSource.title}</div>
												<div><span class="text-base-content/50">sourceType:</span> {selectedSource.sourceType}</div>
												{#if selectedSource.coverImage}
													<div class="truncate" title={selectedSource.coverImage}>
														<span class="text-base-content/50">coverImage:</span> {selectedSource.coverImage}
													</div>
												{/if}
											</div>
										</div>
									{/if}
								</div>

								<!-- Right: Props Editor -->
								<div class="space-y-4">
									<h3 class="font-semibold">Props Editor</h3>

									<div class="overflow-x-auto">
										<table class="table table-sm">
											<thead>
												<tr>
													<th>Prop</th>
													<th>Type</th>
													<th>Value</th>
												</tr>
											</thead>
											<tbody>
												<!-- source (read-only) -->
												<tr>
													<td><code>source</code></td>
													<td><code class="text-xs">Source</code></td>
													<td>
														<span class="badge badge-ghost badge-sm">from selector</span>
													</td>
												</tr>

												<!-- cardCount -->
												<tr>
													<td><code>cardCount</code></td>
													<td><code class="text-xs">number</code></td>
													<td>
														<input
															type="number"
															class="input input-bordered input-sm w-20"
															min="1"
															max="50"
															value={boosterPropCardCount}
															oninput={(e) => (boosterPropCardCount = parseInt(e.currentTarget.value) || 10)}
														/>
													</td>
												</tr>

												<!-- wrapperColor -->
												<tr>
													<td><code>wrapperColor</code></td>
													<td><code class="text-xs">string</code></td>
													<td>
														<input
															type="color"
															class="w-12 h-8 cursor-pointer rounded border border-base-300"
															value={boosterPropWrapperColor}
															oninput={(e) => (boosterPropWrapperColor = e.currentTarget.value)}
														/>
													</td>
												</tr>

												<!-- width -->
												<tr>
													<td><code>width</code></td>
													<td><code class="text-xs">number</code></td>
													<td>
														<input
															type="number"
															class="input input-bordered input-sm w-24"
															min="150"
															max="600"
															step="50"
															value={boosterPropWidth}
															oninput={(e) => (boosterPropWidth = parseInt(e.currentTarget.value) || 300)}
														/>
													</td>
												</tr>

												<!-- height -->
												<tr>
													<td><code>height</code></td>
													<td><code class="text-xs">number</code></td>
													<td>
														<input
															type="number"
															class="input input-bordered input-sm w-24"
															min="200"
															max="800"
															step="50"
															value={boosterPropHeight}
															oninput={(e) => (boosterPropHeight = parseInt(e.currentTarget.value) || 400)}
														/>
													</td>
												</tr>

												<!-- interactive -->
												<tr>
													<td><code>interactive</code></td>
													<td><code class="text-xs">boolean</code></td>
													<td>
														<input
															type="checkbox"
															class="toggle toggle-primary toggle-sm"
															checked={boosterPropInteractive}
															onchange={(e) => (boosterPropInteractive = e.currentTarget.checked)}
														/>
													</td>
												</tr>

												<!-- autoRotate -->
												<tr>
													<td><code>autoRotate</code></td>
													<td><code class="text-xs">boolean</code></td>
													<td>
														<input
															type="checkbox"
															class="toggle toggle-primary toggle-sm"
															checked={boosterPropAutoRotate}
															onchange={(e) => (boosterPropAutoRotate = e.currentTarget.checked)}
														/>
													</td>
												</tr>

												<!-- classes (read-only info) -->
												<tr>
													<td><code>classes</code></td>
													<td><code class="text-xs">string</code></td>
													<td>
														<span class="text-xs text-base-content/50">Additional CSS classes</span>
													</td>
												</tr>
											</tbody>
										</table>
									</div>

									<!-- Prop Descriptions -->
									<div class="bg-base-100 rounded-lg p-3">
										<h4 class="text-xs font-semibold text-base-content/60 mb-2">Prop Descriptions</h4>
										<div class="text-xs space-y-2">
											<div>
												<span class="font-medium">source</span>
												<span class="text-base-content/60"> - Source data object (required)</span>
											</div>
											<div>
												<span class="font-medium">cardCount</span>
												<span class="text-base-content/60"> - Number of cards shown on back (default: 10)</span>
											</div>
											<div>
												<span class="font-medium">wrapperColor</span>
												<span class="text-base-content/60"> - Metallic wrapper color as hex (default: #c0c0c0)</span>
											</div>
											<div>
												<span class="font-medium">width</span>
												<span class="text-base-content/60"> - Canvas width in pixels (default: 300)</span>
											</div>
											<div>
												<span class="font-medium">height</span>
												<span class="text-base-content/60"> - Canvas height in pixels (default: 400)</span>
											</div>
											<div>
												<span class="font-medium">interactive</span>
												<span class="text-base-content/60"> - Enables mouse drag rotation (default: true)</span>
											</div>
											<div>
												<span class="font-medium">autoRotate</span>
												<span class="text-base-content/60"> - Enables automatic rotation when not dragging (default: true)</span>
											</div>
											<div>
												<span class="font-medium">classes</span>
												<span class="text-base-content/60"> - Additional Tailwind classes to apply</span>
											</div>
										</div>
									</div>

									<!-- Usage Notes -->
									<div class="bg-base-100 rounded-lg p-3">
										<h4 class="text-xs font-semibold text-base-content/60 mb-2">Usage Notes</h4>
										<div class="text-xs space-y-2 text-base-content/70">
											<p>The component renders a 3D booster pack using Three.js with the source's cover image as the front.</p>
											<p>Features metallic/foil effects on edges and a card count badge on the back.</p>
											<p>Drag to rotate the pack when interactive mode is enabled. Auto-rotation pauses during drag.</p>
											<p>Hovers with a subtle scale effect for interactivity feedback.</p>
										</div>
									</div>
								</div>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
