<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface TableColumn {
		cid: number;
		name: string;
		columnType: string;
		notnull: boolean;
		pk: boolean;
	}

	interface TableData {
		columns: TableColumn[];
		rows: (string | number | null)[][];
		totalCount: number;
	}

	// State
	let tables: string[] = $state([]);
	let selectedTable = $state<string | null>(null);
	let tableData = $state<TableData | null>(null);
	let isLoading = $state(true);
	let isLoadingData = $state(false);
	let error = $state<string | null>(null);

	// Pagination
	let currentPage = $state(1);
	let pageSize = $state(50);
	$effect(() => {
		// Reset page when table changes
		if (selectedTable) {
			currentPage = 1;
		}
	});

	onMount(async () => {
		try {
			tables = await invoke<string[]>('get_database_tables');
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			isLoading = false;
		}
	});

	async function selectTable(tableName: string) {
		if (selectedTable === tableName) {
			selectedTable = null;
			tableData = null;
			return;
		}

		selectedTable = tableName;
		currentPage = 1;
		await loadTableData();
	}

	async function loadTableData() {
		if (!selectedTable) return;

		isLoadingData = true;
		error = null;

		try {
			const offset = (currentPage - 1) * pageSize;
			tableData = await invoke<TableData>('get_table_data', {
				tableName: selectedTable,
				limit: pageSize,
				offset
			});
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			tableData = null;
		} finally {
			isLoadingData = false;
		}
	}

	function formatValue(value: unknown): string {
		if (value === null || value === undefined) {
			return 'NULL';
		}
		if (typeof value === 'string' && value.length > 100) {
			return value.substring(0, 100) + '...';
		}
		return String(value);
	}

	function getColumnTypeClass(colType: string): string {
		const type = colType.toUpperCase();
		if (type.includes('INT')) return 'badge-info';
		if (type.includes('TEXT') || type.includes('VARCHAR')) return 'badge-success';
		if (type.includes('REAL') || type.includes('FLOAT')) return 'badge-warning';
		if (type.includes('BLOB')) return 'badge-error';
		return 'badge-ghost';
	}

	// Pagination helpers
	$effect(() => {
		if (selectedTable && currentPage) {
			loadTableData();
		}
	});

	function totalPages(): number {
		if (!tableData) return 1;
		return Math.ceil(tableData.totalCount / pageSize);
	}

	function goToPage(page: number) {
		if (page < 1 || page > totalPages()) return;
		currentPage = page;
	}
</script>

<div class="flex flex-col h-full">
	<h1 class="text-2xl font-bold mb-4">Database Browser</h1>

	{#if error}
		<div class="alert alert-error mb-4">
			<span>{error}</span>
		</div>
	{/if}

	<div class="flex gap-4 flex-1 min-h-0">
		<!-- Left sidebar: Tables list -->
		<div class="card bg-base-200 w-64 flex-shrink-0 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				<h2 class="card-title text-lg mb-2">Tables</h2>

				<div class="flex-1 overflow-y-auto">
					{#if isLoading}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if tables.length === 0}
						<div class="text-center text-base-content/60 p-4">
							<p>No tables found.</p>
						</div>
					{:else}
						<div class="space-y-1">
							{#each tables as table (table)}
								<button
									class={classNames(
										'w-full text-left px-3 py-2 rounded-lg transition-colors',
										'hover:bg-base-300 text-sm font-mono',
										{
											'bg-primary/20 ring-2 ring-primary': selectedTable === table,
											'bg-base-100': selectedTable !== table
										}
									)}
									onclick={() => selectTable(table)}
								>
									{table}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<div class="mt-2 pt-2 border-t border-base-300">
					<span class="text-xs text-base-content/50">{tables.length} tables</span>
				</div>
			</div>
		</div>

		<!-- Main content: Table data -->
		<div class="card bg-base-200 flex-1 overflow-hidden flex flex-col">
			<div class="card-body p-4 flex flex-col h-full">
				{#if !selectedTable}
					<div class="flex-1 flex items-center justify-center text-base-content/60">
						<p>Select a table to view its contents</p>
					</div>
				{:else}
					<div class="flex items-center justify-between mb-4">
						<h2 class="card-title text-lg font-mono">{selectedTable}</h2>
						{#if tableData}
							<span class="text-sm text-base-content/60">
								{tableData.totalCount} row{tableData.totalCount === 1 ? '' : 's'}
							</span>
						{/if}
					</div>

					{#if isLoadingData}
						<div class="flex-1 flex items-center justify-center">
							<span class="loading loading-spinner loading-lg"></span>
						</div>
					{:else if tableData}
						<!-- Column schema -->
						<div class="mb-4 flex flex-wrap gap-2">
							{#each tableData.columns as col (col.cid)}
								<div
									class={classNames('badge gap-1', getColumnTypeClass(col.columnType))}
									title={`${col.name}: ${col.columnType}${col.pk ? ' (PK)' : ''}${col.notnull ? ' NOT NULL' : ''}`}
								>
									{#if col.pk}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-3 w-3"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path
												fill-rule="evenodd"
												d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z"
												clip-rule="evenodd"
											/>
										</svg>
									{/if}
									<span class="font-mono text-xs">{col.name}</span>
								</div>
							{/each}
						</div>

						<!-- Data table -->
						<div class="flex-1 overflow-auto">
							<table class="table table-xs table-pin-rows">
								<thead>
									<tr>
										{#each tableData.columns as col (col.cid)}
											<th class="font-mono bg-base-300">
												{col.name}
												<span class="font-normal text-base-content/50 ml-1">
													({col.columnType || 'ANY'})
												</span>
											</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each tableData.rows as row, rowIndex (rowIndex)}
										<tr class="hover">
											{#each row as cell, cellIndex (cellIndex)}
												<td
													class={classNames('font-mono text-xs max-w-xs truncate', {
														'text-base-content/40 italic': cell === null
													})}
													title={formatValue(cell)}
												>
													{formatValue(cell)}
												</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>

							{#if tableData.rows.length === 0}
								<div class="text-center text-base-content/60 p-8">
									<p>No data in this table.</p>
								</div>
							{/if}
						</div>

						<!-- Pagination -->
						{#if tableData.totalCount > pageSize}
							<div class="flex items-center justify-between mt-4 pt-4 border-t border-base-300">
								<div class="text-sm text-base-content/60">
									Showing {(currentPage - 1) * pageSize + 1} -
									{Math.min(currentPage * pageSize, tableData.totalCount)} of {tableData.totalCount}
								</div>
								<div class="join">
									<button
										class="join-item btn btn-sm"
										disabled={currentPage === 1}
										onclick={() => goToPage(1)}
									>
										&laquo;
									</button>
									<button
										class="join-item btn btn-sm"
										disabled={currentPage === 1}
										onclick={() => goToPage(currentPage - 1)}
									>
										&lsaquo;
									</button>
									<span class="join-item btn btn-sm no-animation">
										Page {currentPage} of {totalPages()}
									</span>
									<button
										class="join-item btn btn-sm"
										disabled={currentPage === totalPages()}
										onclick={() => goToPage(currentPage + 1)}
									>
										&rsaquo;
									</button>
									<button
										class="join-item btn btn-sm"
										disabled={currentPage === totalPages()}
										onclick={() => goToPage(totalPages())}
									>
										&raquo;
									</button>
								</div>
							</div>
						{/if}
					{/if}
				{/if}
			</div>
		</div>
	</div>
</div>
