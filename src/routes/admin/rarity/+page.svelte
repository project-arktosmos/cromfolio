<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import {
		getRarityCollection,
		addRarity as addRarityService,
		updateRarity as updateRarityService,
		removeRarity as removeRarityService
	} from '$services/rarities.service';
	import type { Rarity } from '$types/rarity.type';

	// Collection state
	let rarities: Rarity[] = $state([]);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let selectedRarity = $state<Rarity | null>(null);

	// Form state
	let isEditing = $state(false);
	let formName = $state('');
	let formColorFrom = $state('#808080');
	let formColorTo = $state('#A0A0A0');
	let formSortOrder = $state(0);

	onMount(async () => {
		rarities = await getRarityCollection();
		isLoading = false;
	});

	// Reset form
	function resetForm() {
		formName = '';
		formColorFrom = '#808080';
		formColorTo = '#A0A0A0';
		formSortOrder = rarities.length;
		isEditing = false;
		selectedRarity = null;
	}

	// Add a new rarity
	async function addRarity() {
		if (!formName.trim() || isSaving) return;

		isSaving = true;
		const rarity: Rarity = {
			id: crypto.randomUUID(),
			name: formName.trim(),
			colorFrom: formColorFrom,
			colorTo: formColorTo,
			sortOrder: formSortOrder
		};

		const result = await addRarityService(rarity);
		if (result) {
			rarities = await getRarityCollection();
			resetForm();
		}
		isSaving = false;
	}

	// Update an existing rarity
	async function updateRarity() {
		if (!selectedRarity || !formName.trim() || isSaving) return;

		isSaving = true;
		const updatedRarity: Rarity = {
			...selectedRarity,
			name: formName.trim(),
			colorFrom: formColorFrom,
			colorTo: formColorTo,
			sortOrder: formSortOrder
		};

		const result = await updateRarityService(updatedRarity);
		if (result) {
			rarities = await getRarityCollection();
			resetForm();
		}
		isSaving = false;
	}

	// Remove a rarity
	async function removeRarity(rarity: Rarity, event: MouseEvent) {
		event.stopPropagation();
		const success = await removeRarityService(rarity);
		if (success) {
			rarities = await getRarityCollection();
			if (selectedRarity?.id === rarity.id) {
				resetForm();
			}
		}
	}

	// Select a rarity for editing
	function selectRarity(rarity: Rarity) {
		if (selectedRarity?.id === rarity.id && !isEditing) {
			resetForm();
		} else {
			selectedRarity = rarity;
			formName = rarity.name;
			formColorFrom = rarity.colorFrom;
			formColorTo = rarity.colorTo;
			formSortOrder = rarity.sortOrder;
			isEditing = true;
		}
	}

	// Handle form submission
	function handleSubmit() {
		if (isEditing) {
			updateRarity();
		} else {
			addRarity();
		}
	}

	// Generate gradient style
	function getGradientStyle(colorFrom: string, colorTo: string): string {
		return `background: linear-gradient(135deg, ${colorFrom} 0%, ${colorTo} 100%)`;
	}
</script>

<div class="flex flex-col h-full">
	<h1 class="text-2xl font-bold mb-4">Rarity Manager</h1>

	<div class="grid grid-cols-2 gap-4 flex-1 min-h-0">
		<!-- Column 1: Rarities List -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">Rarities</h2>

				<div class="flex-1 overflow-y-auto">
					{#if isLoading}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if rarities.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No rarities defined yet.</p>
							<p class="text-sm mt-1">Create rarities using the form on the right.</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each rarities as rarity (rarity.id)}
								<div
									class={classNames(
										'w-full text-left p-3 rounded-lg transition-colors cursor-pointer',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-2 ring-primary': selectedRarity?.id === rarity.id,
											'bg-base-100': selectedRarity?.id !== rarity.id
										}
									)}
									onclick={() => selectRarity(rarity)}
									onkeydown={(e) => e.key === 'Enter' && selectRarity(rarity)}
									role="button"
									tabindex="0"
								>
									<div class="flex items-center gap-3">
										<div
											class="w-12 h-8 rounded shadow-sm"
											style={getGradientStyle(rarity.colorFrom, rarity.colorTo)}
										></div>
										<div class="flex-1 min-w-0">
											<div class="flex items-center justify-between">
												<span class="font-medium">{rarity.name}</span>
												<div class="flex items-center gap-2">
													<span class="text-xs text-base-content/60">
														Order: {rarity.sortOrder}
													</span>
													<button
														class="btn btn-ghost btn-xs text-error"
														onclick={(e) => removeRarity(rarity, e)}
														title="Remove rarity"
													>
														✕
													</button>
												</div>
											</div>
											<div class="text-xs text-base-content/60 mt-1">
												{rarity.colorFrom} → {rarity.colorTo}
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

		<!-- Column 2: Rarity Form -->
		<div class="card bg-base-200 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<div class="flex items-center justify-between mb-2">
					<h2 class="card-title text-lg">
						{isEditing ? 'Edit Rarity' : 'Add Rarity'}
					</h2>
					{#if isEditing}
						<button class="btn btn-ghost btn-sm" onclick={resetForm}> Cancel </button>
					{/if}
				</div>

				<div class="flex-1 overflow-y-auto">
					<div class="space-y-4">
						<!-- Name -->
						<div class="form-control">
							<label class="label" for="rarity-name">
								<span class="label-text">Name *</span>
							</label>
							<input
								id="rarity-name"
								type="text"
								placeholder="e.g., Common, Rare, Legendary..."
								class="input input-bordered w-full"
								bind:value={formName}
							/>
						</div>

						<!-- Colors -->
						<div class="grid grid-cols-2 gap-4">
							<div class="form-control">
								<label class="label" for="color-from">
									<span class="label-text">Color From</span>
								</label>
								<div class="flex gap-2">
									<input
										id="color-from"
										type="color"
										class="w-12 h-10 rounded cursor-pointer"
										bind:value={formColorFrom}
									/>
									<input
										type="text"
										class="input input-bordered flex-1"
										bind:value={formColorFrom}
										placeholder="#808080"
									/>
								</div>
							</div>
							<div class="form-control">
								<label class="label" for="color-to">
									<span class="label-text">Color To</span>
								</label>
								<div class="flex gap-2">
									<input
										id="color-to"
										type="color"
										class="w-12 h-10 rounded cursor-pointer"
										bind:value={formColorTo}
									/>
									<input
										type="text"
										class="input input-bordered flex-1"
										bind:value={formColorTo}
										placeholder="#A0A0A0"
									/>
								</div>
							</div>
						</div>

						<!-- Gradient Preview -->
						<div class="form-control">
							<label class="label">
								<span class="label-text">Gradient Preview</span>
							</label>
							<div
								class="w-full h-16 rounded-lg shadow-inner"
								style={getGradientStyle(formColorFrom, formColorTo)}
							></div>
						</div>

						<!-- Sort Order -->
						<div class="form-control">
							<label class="label" for="sort-order">
								<span class="label-text">Sort Order</span>
							</label>
							<input
								id="sort-order"
								type="number"
								class="input input-bordered w-full"
								bind:value={formSortOrder}
								min="0"
							/>
							<label class="label">
								<span class="label-text-alt">Lower values appear first (more common rarities)</span>
							</label>
						</div>

						<!-- Submit button -->
						<button
							class="btn btn-primary w-full"
							onclick={handleSubmit}
							disabled={!formName.trim() || isSaving}
						>
							{#if isSaving}
								<span class="loading loading-spinner loading-sm"></span>
								Saving...
							{:else}
								{isEditing ? 'Update Rarity' : 'Add Rarity'}
							{/if}
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
