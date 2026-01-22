<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import SingleCard from '$components/core/SingleCard.svelte';
	import SingleAlbum from '$components/core/SingleAlbum.svelte';
	import SingleBoosterPack from '$components/core/SingleBoosterPack.svelte';
	import { getCardCollection } from '$services/cards.service';
	import { getAlbumCollection } from '$services/albums.service';
	import { getRarityCollection, getRarity } from '$services/rarities.service';
	import type { Card, CardType } from '$types/card.type';
	import type { Rarity } from '$types/rarity.type';
	import type { Album } from '$types/album.type';

	// Card data from database
	let cards: Card[] = $state([]);
	let rarities: Rarity[] = $state([]);
	let albums: Album[] = $state([]);
	let selectedCard: Card | null = $state(null);
	let selectedRarity: Rarity | null = $state(null);
	let selectedAlbum: Album | null = $state(null);
	let isLoading = $state(true);

	// Editable props for SingleCard
	let propOwned = $state(true);
	let propCopyCount = $state(3);
	let propInteractive = $state(true);

	// Editable props for SingleAlbum
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

	// Selected component for detail view
	let selectedComponent = $state<string>('SingleCard');

	// Component list for sidebar navigation
	const components = [
		{ id: 'SingleCard', name: 'SingleCard', description: 'Collectible card display' },
		{ id: 'SingleAlbum', name: 'SingleAlbum', description: '3D album book display' },
		{ id: 'SingleBoosterPack', name: 'SingleBoosterPack', description: '3D booster pack display' }
	];

	onMount(async () => {
		[cards, rarities, albums] = await Promise.all([
			getCardCollection(),
			getRarityCollection(),
			getAlbumCollection()
		]);
		if (cards.length > 0) {
			selectedCard = cards[0];
			// If the card has a rarityId, load that rarity
			if (selectedCard.rarityId) {
				selectedRarity = await getRarity(selectedCard.rarityId);
			}
		}
		if (albums.length > 0) {
			selectedAlbum = albums[0];
		}
		isLoading = false;
	});

	async function selectCard(card: Card) {
		selectedCard = card;
		// Load the card's rarity if it has one
		if (card.rarityId) {
			selectedRarity = await getRarity(card.rarityId);
		} else {
			selectedRarity = null;
		}
	}

	function selectRarity(rarityId: string) {
		if (rarityId === '') {
			selectedRarity = null;
		} else {
			selectedRarity = rarities.find((r) => String(r.id) === rarityId) ?? null;
		}
	}

	function selectAlbum(albumId: string) {
		selectedAlbum = albums.find((a) => String(a.id) === albumId) ?? null;
	}

	// Compute card counts by type for selected album
	let selectedAlbumCardCounts = $derived.by(() => {
		if (!selectedAlbum) return {};
		const albumCards = cards.filter((c) => c.albumId === selectedAlbum.id);
		const counts: Partial<Record<CardType, number>> = {};
		for (const card of albumCards) {
			const cardType = card.cardType || 'other';
			counts[cardType] = (counts[cardType] || 0) + 1;
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
					{#if selectedComponent === 'SingleCard'}
						<h2 class="card-title">SingleCard</h2>
						<p class="text-sm text-base-content/70 mb-4">
							Displays a collectible card with MTG aspect ratio (63:88), ownership state, copy count badge, and image fallback handling.
						</p>

						{#if isLoading}
							<div class="flex justify-center p-8">
								<span class="loading loading-spinner loading-lg"></span>
							</div>
						{:else if cards.length === 0}
							<div class="alert alert-warning">
								<span>No cards in database. Add cards in the Card admin panel first.</span>
							</div>
						{:else}
							<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
								<!-- Left: Card Preview -->
								<div class="space-y-4">
									<h3 class="font-semibold">Preview</h3>

									<!-- Source Image and Rendered Card side by side -->
									<div class="flex gap-4 items-start justify-center">
										<!-- Source Image -->
										{#if selectedCard}
											<div class="space-y-2">
												<div class="text-xs text-base-content/60 text-center">Source Image</div>
												<img
													src={selectedCard.image}
													alt="Source"
													class="max-w-48 max-h-64 object-contain border border-base-300 bg-base-100"
												/>
											</div>
										{/if}

										<!-- Rendered Card -->
										<div class="space-y-2">
											<div class="text-xs text-base-content/60 text-center">SingleCard Output</div>
											<div class="w-48">
												{#if selectedCard}
													<SingleCard
														card={selectedCard}
														rarity={selectedRarity}
														owned={propOwned}
														copyCount={propCopyCount}
														interactive={propInteractive}
													/>
												{/if}
											</div>
										</div>
									</div>

									<!-- Card Selector -->
									<div class="form-control">
										<label class="label" for="card-select">
											<span class="label-text font-medium">Source Card</span>
										</label>
										<select
											id="card-select"
											class="select select-bordered select-sm w-full"
											onchange={(e) => {
												const card = cards.find(c => String(c.id) === e.currentTarget.value);
												if (card) selectCard(card);
											}}
										>
											{#each cards as card (card.id)}
												<option value={String(card.id)} selected={selectedCard?.id === card.id}>
													{card.name}
												</option>
											{/each}
										</select>
									</div>

									<!-- Card Data Display -->
									{#if selectedCard}
										<div class="bg-base-100 rounded-lg p-3">
											<h4 class="text-xs font-semibold text-base-content/60 mb-2">Card Data</h4>
											<div class="text-xs space-y-1 font-mono">
												<div><span class="text-base-content/50">id:</span> {selectedCard.id}</div>
												<div><span class="text-base-content/50">name:</span> {selectedCard.name}</div>
												<div><span class="text-base-content/50">albumId:</span> {selectedCard.albumId}</div>
												<div class="truncate" title={selectedCard.image}>
													<span class="text-base-content/50">image:</span> {selectedCard.image}
												</div>
												{#if selectedCard.releaseYear}
													<div><span class="text-base-content/50">releaseYear:</span> {selectedCard.releaseYear}</div>
												{/if}
												{#if selectedCard.releaseType}
													<div><span class="text-base-content/50">releaseType:</span> {selectedCard.releaseType}</div>
												{/if}
												{#if selectedCard.imageType}
													<div><span class="text-base-content/50">imageType:</span> {selectedCard.imageType}</div>
												{/if}
												{#if selectedCard.imageSource}
													<div><span class="text-base-content/50">imageSource:</span> {selectedCard.imageSource}</div>
												{/if}
												{#if selectedCard.castMemberName}
													<div><span class="text-base-content/50">castMemberName:</span> {selectedCard.castMemberName}</div>
												{/if}
												{#if selectedCard.characterName}
													<div><span class="text-base-content/50">characterName:</span> {selectedCard.characterName}</div>
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
												<!-- card (read-only) -->
												<tr>
													<td><code>card</code></td>
													<td><code class="text-xs">Card</code></td>
													<td>
														<span class="badge badge-ghost badge-sm">from selector</span>
													</td>
												</tr>

												<!-- rarity -->
												<tr>
													<td><code>rarity</code></td>
													<td><code class="text-xs">Rarity | null</code></td>
													<td>
														<select
															class="select select-bordered select-sm w-full max-w-40"
															onchange={(e) => selectRarity(e.currentTarget.value)}
														>
															<option value="" selected={!selectedRarity}>None (default)</option>
															{#each rarities as rarity (rarity.id)}
																<option value={String(rarity.id)} selected={selectedRarity?.id === rarity.id}>
																	{rarity.name}
																</option>
															{/each}
														</select>
													</td>
												</tr>

												<!-- owned -->
												<tr>
													<td><code>owned</code></td>
													<td><code class="text-xs">boolean</code></td>
													<td>
														<input
															type="checkbox"
															class="toggle toggle-primary toggle-sm"
															checked={propOwned}
															onchange={(e) => (propOwned = e.currentTarget.checked)}
														/>
													</td>
												</tr>

												<!-- copyCount -->
												<tr>
													<td><code>copyCount</code></td>
													<td><code class="text-xs">number</code></td>
													<td>
														<input
															type="number"
															class="input input-bordered input-sm w-20"
															min="0"
															max="99"
															value={propCopyCount}
															oninput={(e) => (propCopyCount = parseInt(e.currentTarget.value) || 0)}
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
															checked={propInteractive}
															onchange={(e) => (propInteractive = e.currentTarget.checked)}
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
												<span class="font-medium">card</span>
												<span class="text-base-content/60"> - Card data object (required)</span>
											</div>
											<div>
												<span class="font-medium">rarity</span>
												<span class="text-base-content/60"> - Rarity object for gradient colors (optional)</span>
											</div>
											<div>
												<span class="font-medium">owned</span>
												<span class="text-base-content/60"> - Shows primary ring when true</span>
											</div>
											<div>
												<span class="font-medium">copyCount</span>
												<span class="text-base-content/60"> - Shows badge when owned and count > 0</span>
											</div>
											<div>
												<span class="font-medium">interactive</span>
												<span class="text-base-content/60"> - Enables hover effects and click handling</span>
											</div>
											<div>
												<span class="font-medium">classes</span>
												<span class="text-base-content/60"> - Additional Tailwind classes to apply</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						{/if}
					{:else if selectedComponent === 'SingleAlbum'}
						<h2 class="card-title">SingleAlbum</h2>
						<p class="text-sm text-base-content/70 mb-4">
							Displays an album as a 3D book using Three.js. The album cover image is rendered as the front cover of the book. Supports mouse drag rotation and auto-rotation.
						</p>

						{#if isLoading}
							<div class="flex justify-center p-8">
								<span class="loading loading-spinner loading-lg"></span>
							</div>
						{:else if albums.length === 0}
							<div class="alert alert-warning">
								<span>No albums in database. Add albums in the Album admin panel first.</span>
							</div>
						{:else}
							<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
								<!-- Left: Album Preview -->
								<div class="space-y-4">
									<h3 class="font-semibold">Preview</h3>

									<!-- 3D Book Preview -->
									<div class="flex justify-center bg-base-300 rounded-lg p-4">
										{#if selectedAlbum}
											{#key `${selectedAlbum.id}-${albumPropWidth}-${albumPropHeight}`}
												<SingleAlbum
													album={selectedAlbum}
													cardCountsByType={selectedAlbumCardCounts}
													width={albumPropWidth}
													height={albumPropHeight}
													interactive={albumPropInteractive}
													autoRotate={albumPropAutoRotate}
												/>
											{/key}
										{/if}
									</div>

									<!-- Album Selector -->
									<div class="form-control">
										<label class="label" for="album-select">
											<span class="label-text font-medium">Source Album</span>
										</label>
										<select
											id="album-select"
											class="select select-bordered select-sm w-full"
											onchange={(e) => selectAlbum(e.currentTarget.value)}
										>
											{#each albums as album (album.id)}
												<option value={String(album.id)} selected={selectedAlbum?.id === album.id}>
													{album.title}
												</option>
											{/each}
										</select>
									</div>

									<!-- Album Data Display -->
									{#if selectedAlbum}
										<div class="bg-base-100 rounded-lg p-3">
											<h4 class="text-xs font-semibold text-base-content/60 mb-2">Album Data</h4>
											<div class="text-xs space-y-1 font-mono">
												<div><span class="text-base-content/50">id:</span> {selectedAlbum.id}</div>
												<div><span class="text-base-content/50">title:</span> {selectedAlbum.title}</div>
												<div><span class="text-base-content/50">albumType:</span> {selectedAlbum.albumType}</div>
												<div class="truncate" title={selectedAlbum.description}>
													<span class="text-base-content/50">description:</span> {selectedAlbum.description}
												</div>
												{#if selectedAlbum.coverImage}
													<div class="truncate" title={selectedAlbum.coverImage}>
														<span class="text-base-content/50">coverImage:</span> {selectedAlbum.coverImage}
													</div>
												{/if}
												{#if selectedAlbum.imdbId}
													<div><span class="text-base-content/50">imdbId:</span> {selectedAlbum.imdbId}</div>
												{/if}
												{#if selectedAlbum.tmdbId}
													<div><span class="text-base-content/50">tmdbId:</span> {selectedAlbum.tmdbId}</div>
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
												<!-- album (read-only) -->
												<tr>
													<td><code>album</code></td>
													<td><code class="text-xs">Album</code></td>
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
												<span class="font-medium">album</span>
												<span class="text-base-content/60"> - Album data object (required)</span>
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
											<p>The component renders a 3D book using Three.js with the album's cover image as the front cover.</p>
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
							Displays an album as a 3D booster pack using Three.js. The album cover image is rendered as the front of the pack with metallic/foil effects. Supports mouse drag rotation and auto-rotation.
						</p>

						{#if isLoading}
							<div class="flex justify-center p-8">
								<span class="loading loading-spinner loading-lg"></span>
							</div>
						{:else if albums.length === 0}
							<div class="alert alert-warning">
								<span>No albums in database. Add albums in the Album admin panel first.</span>
							</div>
						{:else}
							<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
								<!-- Left: Booster Pack Preview -->
								<div class="space-y-4">
									<h3 class="font-semibold">Preview</h3>

									<!-- 3D Booster Pack Preview -->
									<div class="flex justify-center bg-base-300 rounded-lg p-4">
										{#if selectedAlbum}
											{#key `${selectedAlbum.id}-${boosterPropWidth}-${boosterPropHeight}-${boosterPropCardCount}-${boosterPropWrapperColor}`}
												<SingleBoosterPack
													album={selectedAlbum}
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

									<!-- Album Selector -->
									<div class="form-control">
										<label class="label" for="booster-album-select">
											<span class="label-text font-medium">Source Album</span>
										</label>
										<select
											id="booster-album-select"
											class="select select-bordered select-sm w-full"
											onchange={(e) => selectAlbum(e.currentTarget.value)}
										>
											{#each albums as album (album.id)}
												<option value={String(album.id)} selected={selectedAlbum?.id === album.id}>
													{album.title}
												</option>
											{/each}
										</select>
									</div>

									<!-- Album Data Display -->
									{#if selectedAlbum}
										<div class="bg-base-100 rounded-lg p-3">
											<h4 class="text-xs font-semibold text-base-content/60 mb-2">Album Data</h4>
											<div class="text-xs space-y-1 font-mono">
												<div><span class="text-base-content/50">id:</span> {selectedAlbum.id}</div>
												<div><span class="text-base-content/50">title:</span> {selectedAlbum.title}</div>
												<div><span class="text-base-content/50">albumType:</span> {selectedAlbum.albumType}</div>
												{#if selectedAlbum.coverImage}
													<div class="truncate" title={selectedAlbum.coverImage}>
														<span class="text-base-content/50">coverImage:</span> {selectedAlbum.coverImage}
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
												<!-- album (read-only) -->
												<tr>
													<td><code>album</code></td>
													<td><code class="text-xs">Album</code></td>
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
												<span class="font-medium">album</span>
												<span class="text-base-content/60"> - Album data object (required)</span>
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
											<p>The component renders a 3D booster pack using Three.js with the album's cover image as the front.</p>
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
