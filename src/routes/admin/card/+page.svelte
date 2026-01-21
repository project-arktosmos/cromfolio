<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { albumsService } from '$services/albums.service';
	import { cardsService, getCardsByAlbum } from '$services/cards.service';
	import type { Album } from '$types/album.type';
	import type { Card } from '$types/card.type';

	// Collection state
	let albums: Album[] = $state([]);
	let cards: Card[] = $state([]);
	let isLoading = $state(true);
	let selectedAlbum = $state<Album | null>(null);
	let selectedCard = $state<Card | null>(null);

	// Form state
	let isEditing = $state(false);
	let formName = $state('');
	let formImage = $state('');

	onMount(() => {
		albums = albumsService.all();
		isLoading = false;
	});

	// Reset form
	function resetForm() {
		formName = '';
		formImage = '';
		isEditing = false;
		selectedCard = null;
	}

	// Select an album to view its cards
	function selectAlbum(album: Album) {
		if (selectedAlbum?.id === album.id) {
			selectedAlbum = null;
			cards = [];
			resetForm();
		} else {
			selectedAlbum = album;
			cards = getCardsByAlbum(album.id);
			resetForm();
		}
	}

	// Add a new card
	function addCard() {
		if (!selectedAlbum || !formName.trim() || !formImage.trim()) return;

		const card: Card = {
			id: crypto.randomUUID(),
			albumId: selectedAlbum.id,
			name: formName.trim(),
			image: formImage.trim(),
			addedAt: new Date().toISOString()
		};

		cardsService.add(card);
		cards = getCardsByAlbum(selectedAlbum.id);
		resetForm();
	}

	// Update an existing card
	function updateCard() {
		if (!selectedCard || !formName.trim() || !formImage.trim()) return;

		const updatedCard: Card = {
			...selectedCard,
			name: formName.trim(),
			image: formImage.trim()
		};

		cardsService.update(updatedCard);
		if (selectedAlbum) {
			cards = getCardsByAlbum(selectedAlbum.id);
		}
		resetForm();
	}

	// Remove a card
	function removeCard(card: Card, event: MouseEvent) {
		event.stopPropagation();
		cardsService.remove(card);
		if (selectedAlbum) {
			cards = getCardsByAlbum(selectedAlbum.id);
		}

		if (selectedCard?.id === card.id) {
			resetForm();
		}
	}

	// Select a card for editing
	function selectCard(card: Card) {
		if (selectedCard?.id === card.id && !isEditing) {
			resetForm();
		} else {
			selectedCard = card;
			formName = card.name;
			formImage = card.image;
			isEditing = true;
		}
	}

	// Handle form submission
	function handleSubmit() {
		if (isEditing) {
			updateCard();
		} else {
			addCard();
		}
	}
</script>

<div class="flex flex-col h-full">
	<h1 class="text-2xl font-bold mb-4">Card Manager</h1>

	<div class="grid grid-cols-3 gap-4 flex-1 min-h-0">
		<!-- Column 1: Albums List -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">Albums</h2>

				<div class="flex-1 overflow-y-auto">
					{#if isLoading}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if albums.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No albums created yet.</p>
							<p class="text-sm mt-1">Create albums in the Album Manager first.</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each albums as album (album.id)}
								<div
									class={classNames(
										'w-full text-left p-3 rounded-lg transition-colors cursor-pointer',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedAlbum?.id === album.id,
											'bg-base-100': selectedAlbum?.id !== album.id
										}
									)}
									onclick={() => selectAlbum(album)}
									onkeydown={(e) => e.key === 'Enter' && selectAlbum(album)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-start gap-3">
										{#if album.coverImage}
											<img
												src={album.coverImage}
												alt={album.title}
												class="w-10 h-14 object-cover rounded"
											/>
										{:else}
											<div
												class="w-10 h-14 bg-base-300 rounded flex items-center justify-center text-base-content/30"
											>
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
														d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
													/>
												</svg>
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<span class="font-medium truncate block">{album.title}</span>
											<span class="text-xs text-base-content/60">
												{getCardsByAlbum(album.id).length} cards
											</span>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Column 2: Cards List -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">
					{#if selectedAlbum}
						Cards in "{selectedAlbum.title}"
					{:else}
						Cards
					{/if}
				</h2>

				<div class="flex-1 overflow-y-auto">
					{#if !selectedAlbum}
						<div class="text-center text-base-content/60 p-4">
							<p>Select an album to view its cards.</p>
						</div>
					{:else if cards.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No cards in this album yet.</p>
							<p class="text-sm mt-1">Add cards using the form on the right.</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each cards as card (card.id)}
								<div
									class={classNames(
										'w-full text-left p-3 rounded-lg transition-colors cursor-pointer',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedCard?.id === card.id,
											'bg-base-100': selectedCard?.id !== card.id
										}
									)}
									onclick={() => selectCard(card)}
									onkeydown={(e) => e.key === 'Enter' && selectCard(card)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-start gap-3">
										<img
											src={card.image}
											alt={card.name}
											class="w-12 h-16 object-cover rounded"
											onerror={(e) => {
												(e.target as HTMLImageElement).src =
													'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="64" viewBox="0 0 48 64"><rect fill="%23374151" width="48" height="64"/><text x="24" y="36" text-anchor="middle" fill="%239CA3AF" font-size="8">?</text></svg>';
											}}
										/>
										<div class="flex-1 min-w-0">
											<div class="flex items-center justify-between">
												<span class="font-medium truncate">{card.name}</span>
												<button
													class="btn btn-ghost btn-xs text-error"
													onclick={(e) => removeCard(card, e)}
													title="Remove card"
												>
													✕
												</button>
											</div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Column 3: Card Form -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<div class="flex items-center justify-between mb-2">
					<h2 class="card-title text-lg">
						{isEditing ? 'Edit Card' : 'Add Card'}
					</h2>
					{#if isEditing}
						<button class="btn btn-ghost btn-sm" onclick={resetForm}> Cancel </button>
					{/if}
				</div>

				<div class="flex-1 overflow-y-auto">
					{#if !selectedAlbum}
						<div class="text-center text-base-content/60 p-4">
							<p>Select an album first to add cards.</p>
						</div>
					{:else}
						<div class="space-y-4">
							<!-- Name -->
							<div class="form-control">
								<label class="label" for="card-name">
									<span class="label-text">Name *</span>
								</label>
								<input
									id="card-name"
									type="text"
									placeholder="Enter card name..."
									class="input input-bordered w-full"
									bind:value={formName}
								/>
							</div>

							<!-- Image URL -->
							<div class="form-control">
								<label class="label" for="card-image">
									<span class="label-text">Image URL *</span>
								</label>
								<input
									id="card-image"
									type="text"
									placeholder="https://example.com/card.jpg"
									class="input input-bordered w-full"
									bind:value={formImage}
								/>
								{#if formImage}
									<div class="mt-2">
										<img
											src={formImage}
											alt="Card preview"
											class="w-24 h-32 object-cover rounded"
											onerror={(e) => {
												(e.target as HTMLImageElement).style.display = 'none';
											}}
										/>
									</div>
								{/if}
							</div>

							<!-- Submit button -->
							<button
								class="btn btn-primary w-full"
								onclick={handleSubmit}
								disabled={!formName.trim() || !formImage.trim()}
							>
								{isEditing ? 'Update Card' : 'Add Card'}
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
