<script lang="ts">
	import { onMount } from 'svelte';
	import classNames from 'classnames';
	import { tauriApiService } from '$services/tauri-api.service';
	import type { Item } from '$types/admin.type';

	let items = $state<Item[]>([]);
	let isLoading = $state(true);
	let searchQuery = $state('');

	// Modal state
	let showModal = $state(false);
	let isEditing = $state(false);
	let isSaving = $state(false);

	// Form state
	let editingItem = $state<Partial<Item>>({
		id: '',
		name: '',
		description: '',
		category: 'general'
	});

	// Delete confirmation
	let showDeleteConfirm = $state(false);
	let itemToDelete = $state<Item | null>(null);

	let filteredItems = $derived(
		items.filter(
			(item) =>
				item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.category.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	onMount(async () => {
		await fetchItems();
	});

	async function fetchItems() {
		isLoading = true;
		items = await tauriApiService.getAll<Item>('items');
		isLoading = false;
	}

	function openCreateModal() {
		isEditing = false;
		editingItem = {
			id: '',
			name: '',
			description: '',
			category: 'general'
		};
		showModal = true;
	}

	function openEditModal(item: Item) {
		isEditing = true;
		editingItem = { ...item };
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		editingItem = {
			id: '',
			name: '',
			description: '',
			category: 'general'
		};
	}

	async function handleSave() {
		isSaving = true;

		if (isEditing && editingItem.id) {
			const updated = await tauriApiService.update<Item>('items', editingItem.id, editingItem);
			if (updated) {
				await fetchItems();
				closeModal();
			}
		} else {
			const created = await tauriApiService.create<Item>('items', editingItem);
			if (created) {
				await fetchItems();
				closeModal();
			}
		}

		isSaving = false;
	}

	function confirmDelete(item: Item) {
		itemToDelete = item;
		showDeleteConfirm = true;
	}

	async function handleDelete() {
		if (!itemToDelete) return;

		const deleted = await tauriApiService.delete('items', itemToDelete.id);
		if (deleted) {
			await fetchItems();
		}

		showDeleteConfirm = false;
		itemToDelete = null;
	}
</script>

<div class="flex items-center justify-between mb-6">
	<div class="prose">
		<h1 class="mb-0">Items</h1>
	</div>
	<button class="btn btn-primary" onclick={openCreateModal}>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
		</svg>
		Add Item
	</button>
</div>

<div class="mb-4">
	<input
		type="text"
		class="input input-bordered w-full max-w-md"
		placeholder="Search items..."
		bind:value={searchQuery}
	/>
</div>

{#if isLoading}
	<div class="flex items-center justify-center py-12">
		<span class="loading loading-spinner loading-lg"></span>
	</div>
{:else if filteredItems.length === 0}
	<div class="text-center py-12 text-base-content/70">
		{#if searchQuery}
			No items match your search.
		{:else}
			No items yet. Create one to get started.
		{/if}
	</div>
{:else}
	<div class="overflow-x-auto">
		<table class="table table-zebra">
			<thead>
				<tr>
					<th>Name</th>
					<th>Description</th>
					<th>Category</th>
					<th>Updated</th>
					<th class="w-24">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each filteredItems as item (item.id)}
					<tr>
						<td class="font-medium">{item.name}</td>
						<td class="max-w-xs truncate">{item.description}</td>
						<td>
							<span class="badge badge-ghost">{item.category}</span>
						</td>
						<td class="text-sm text-base-content/70">
							{new Date(item.updatedAt).toLocaleDateString()}
						</td>
						<td>
							<div class="flex gap-1">
								<button
									class="btn btn-ghost btn-xs"
									onclick={() => openEditModal(item)}
									title="Edit"
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
									</svg>
								</button>
								<button
									class="btn btn-ghost btn-xs text-error"
									onclick={() => confirmDelete(item)}
									title="Delete"
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
									</svg>
								</button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<!-- Create/Edit Modal -->
<dialog class={classNames('modal', { 'modal-open': showModal })}>
	<div class="modal-box">
		<h3 class="font-bold text-lg mb-4">
			{isEditing ? 'Edit Item' : 'Create Item'}
		</h3>

		<div class="form-control">
			<label class="label" for="itemName">
				<span class="label-text">Name</span>
			</label>
			<input
				id="itemName"
				type="text"
				class="input input-bordered"
				bind:value={editingItem.name}
				placeholder="Enter item name"
			/>
		</div>

		<div class="form-control mt-4">
			<label class="label" for="itemDescription">
				<span class="label-text">Description</span>
			</label>
			<textarea
				id="itemDescription"
				class="textarea textarea-bordered"
				bind:value={editingItem.description}
				placeholder="Enter description"
				rows="3"
			></textarea>
		</div>

		<div class="form-control mt-4">
			<label class="label" for="itemCategory">
				<span class="label-text">Category</span>
			</label>
			<select id="itemCategory" class="select select-bordered" bind:value={editingItem.category}>
				<option value="general">General</option>
				<option value="featured">Featured</option>
				<option value="archived">Archived</option>
			</select>
		</div>

		<div class="modal-action">
			<button class="btn btn-ghost" onclick={closeModal}>Cancel</button>
			<button class="btn btn-primary" onclick={handleSave} disabled={isSaving || !editingItem.name}>
				{#if isSaving}
					<span class="loading loading-spinner loading-sm"></span>
				{/if}
				{isEditing ? 'Update' : 'Create'}
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button onclick={closeModal}>close</button>
	</form>
</dialog>

<!-- Delete Confirmation Modal -->
<dialog class={classNames('modal', { 'modal-open': showDeleteConfirm })}>
	<div class="modal-box">
		<h3 class="font-bold text-lg">Confirm Delete</h3>
		<p class="py-4">
			Are you sure you want to delete "{itemToDelete?.name}"? This action cannot be undone.
		</p>
		<div class="modal-action">
			<button class="btn btn-ghost" onclick={() => (showDeleteConfirm = false)}>Cancel</button>
			<button class="btn btn-error" onclick={handleDelete}>Delete</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button onclick={() => (showDeleteConfirm = false)}>close</button>
	</form>
</dialog>
