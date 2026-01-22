<script lang="ts">
	import { onMount } from 'svelte';
	import classNames from 'classnames';
	import { evmService } from '$services/evm.service';
	import type { Block, Transaction, TransactionReceipt } from '$types/evm.type';

	type Tab = 'blocks' | 'transactions';

	let activeTab: Tab = $state('blocks');
	let blocks: Block[] = $state([]);
	let transactions: Transaction[] = $state([]);
	let isLoading = $state(false);

	// Block detail view
	let selectedBlock: Block | null = $state(null);
	let blockTransactions: Transaction[] = $state([]);
	let isLoadingBlockDetail = $state(false);

	// Transaction detail view
	let selectedTx: Transaction | null = $state(null);
	let selectedReceipt: TransactionReceipt | null = $state(null);
	let isLoadingTxDetail = $state(false);

	// Search
	let searchInput = $state('');

	onMount(() => {
		loadData();
	});

	async function loadData() {
		isLoading = true;
		try {
			const [blocksResult, txResult] = await Promise.all([
				evmService.getBlocks(20),
				evmService.getTransactions(undefined, 20)
			]);
			blocks = blocksResult;
			transactions = txResult;
		} catch (err) {
			console.error('Failed to load explorer data:', err);
		} finally {
			isLoading = false;
		}
	}

	async function viewBlock(block: Block) {
		selectedBlock = block;
		selectedTx = null;
		isLoadingBlockDetail = true;
		try {
			blockTransactions = await evmService.getBlockTransactions(block.number);
		} catch (err) {
			console.error('Failed to load block transactions:', err);
			blockTransactions = [];
		} finally {
			isLoadingBlockDetail = false;
		}
	}

	async function viewTransaction(tx: Transaction) {
		selectedTx = tx;
		selectedBlock = null;
		isLoadingTxDetail = true;
		try {
			selectedReceipt = await evmService.getReceipt(tx.hash);
		} catch (err) {
			console.error('Failed to load receipt:', err);
			selectedReceipt = null;
		} finally {
			isLoadingTxDetail = false;
		}
	}

	function closeDetail() {
		selectedBlock = null;
		selectedTx = null;
		blockTransactions = [];
		selectedReceipt = null;
	}

	async function handleSearch() {
		if (!searchInput.trim()) return;

		const query = searchInput.trim();

		// Check if it's a number (block number)
		if (/^\d+$/.test(query)) {
			const blockNum = parseInt(query, 10);
			const block = await evmService.getBlock(blockNum);
			if (block) {
				viewBlock(block);
				return;
			}
		}

		// Check if it's a hash (transaction or block hash)
		if (query.startsWith('0x') && query.length === 66) {
			// Try as transaction hash
			const tx = await evmService.getTransaction(query);
			if (tx) {
				viewTransaction(tx);
				return;
			}
		}

		alert('Not found: ' + query);
	}

	function formatTimestamp(ts: number): string {
		return new Date(ts * 1000).toLocaleString();
	}

	function formatAddress(addr: string): string {
		if (!addr) return '-';
		return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
	}

	function formatHash(hash: string): string {
		if (!hash) return '-';
		return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
	}

	function formatValue(value: string): string {
		const wei = BigInt(value || '0');
		const eth = Number(wei) / 1e18;
		return eth.toFixed(4) + ' ETH';
	}

	function getStatusBadge(status: string): string {
		switch (status) {
			case 'success':
				return 'badge-success';
			case 'failed':
				return 'badge-error';
			default:
				return 'badge-warning';
		}
	}
</script>

<div class="container mx-auto p-6 space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Block Explorer</h1>
		<a href="/admin/evm" class="btn btn-ghost btn-sm">&larr; Back to Dashboard</a>
	</div>

	<!-- Search Bar -->
	<div class="card bg-base-200">
		<div class="card-body py-4">
			<div class="join w-full max-w-xl">
				<input
					type="text"
					class="input input-bordered join-item flex-1 font-mono text-sm"
					placeholder="Search by block number or transaction hash..."
					bind:value={searchInput}
					onkeydown={(e) => e.key === 'Enter' && handleSearch()}
				/>
				<button class="btn btn-primary join-item" onclick={handleSearch}>Search</button>
			</div>
		</div>
	</div>

	<!-- Detail View Modal -->
	{#if selectedBlock || selectedTx}
		<div class="card bg-base-200">
			<div class="card-body">
				<div class="flex items-center justify-between">
					<h2 class="card-title">
						{#if selectedBlock}
							Block #{selectedBlock.number}
						{:else if selectedTx}
							Transaction Details
						{/if}
					</h2>
					<button class="btn btn-ghost btn-sm" onclick={closeDetail}>&times; Close</button>
				</div>

				{#if selectedBlock}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
						<div>
							<p class="text-sm text-base-content/60">Block Hash</p>
							<p class="font-mono text-sm break-all">{selectedBlock.hash}</p>
						</div>
						<div>
							<p class="text-sm text-base-content/60">Parent Hash</p>
							<p class="font-mono text-sm break-all">{selectedBlock.parentHash}</p>
						</div>
						<div>
							<p class="text-sm text-base-content/60">Timestamp</p>
							<p>{formatTimestamp(selectedBlock.timestamp)}</p>
						</div>
						<div>
							<p class="text-sm text-base-content/60">Proposer</p>
							<p class="font-mono text-sm">{formatAddress(selectedBlock.proposer)}</p>
						</div>
						<div>
							<p class="text-sm text-base-content/60">State Root</p>
							<p class="font-mono text-sm break-all">{selectedBlock.stateRoot}</p>
						</div>
						<div>
							<p class="text-sm text-base-content/60">Transactions Root</p>
							<p class="font-mono text-sm break-all">{selectedBlock.transactionsRoot}</p>
						</div>
					</div>

					<div class="divider"></div>

					<h3 class="font-semibold">Transactions in Block ({blockTransactions.length})</h3>

					{#if isLoadingBlockDetail}
						<div class="flex justify-center py-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if blockTransactions.length === 0}
						<p class="text-base-content/60">No transactions in this block</p>
					{:else}
						<div class="overflow-x-auto">
							<table class="table table-sm">
								<thead>
									<tr>
										<th>Hash</th>
										<th>From</th>
										<th>To</th>
										<th>Value</th>
										<th>Status</th>
									</tr>
								</thead>
								<tbody>
									{#each blockTransactions as tx}
										<tr
											class="hover:bg-base-100 cursor-pointer"
											onclick={() => viewTransaction(tx)}
										>
											<td class="font-mono text-xs">{formatHash(tx.hash)}</td>
											<td class="font-mono text-xs">{formatAddress(tx.from)}</td>
											<td class="font-mono text-xs">{tx.to ? formatAddress(tx.to) : 'Contract'}</td>
											<td class="text-xs">{formatValue(tx.value)}</td>
											<td>
												<span class={classNames('badge badge-sm', getStatusBadge(tx.status))}>
													{tx.status}
												</span>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				{/if}

				{#if selectedTx}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
						<div class="md:col-span-2">
							<p class="text-sm text-base-content/60">Transaction Hash</p>
							<p class="font-mono text-sm break-all">{selectedTx.hash}</p>
						</div>
						<div>
							<p class="text-sm text-base-content/60">Status</p>
							<span class={classNames('badge', getStatusBadge(selectedTx.status))}>
								{selectedTx.status}
							</span>
						</div>
						<div>
							<p class="text-sm text-base-content/60">Block</p>
							{#if selectedTx.blockNumber !== null}
								<button
									class="link link-primary"
									onclick={async () => {
										const block = await evmService.getBlock(selectedTx!.blockNumber!);
										if (block) viewBlock(block);
									}}
								>
									#{selectedTx.blockNumber}
								</button>
							{:else}
								<span class="text-warning">Pending</span>
							{/if}
						</div>
						<div>
							<p class="text-sm text-base-content/60">From</p>
							<p class="font-mono text-sm break-all">{selectedTx.from}</p>
						</div>
						<div>
							<p class="text-sm text-base-content/60">To</p>
							<p class="font-mono text-sm break-all">
								{selectedTx.to || '(Contract Creation)'}
							</p>
						</div>
						<div>
							<p class="text-sm text-base-content/60">Value</p>
							<p>{formatValue(selectedTx.value)}</p>
						</div>
						<div>
							<p class="text-sm text-base-content/60">Nonce</p>
							<p>{selectedTx.nonce}</p>
						</div>
						{#if selectedTx.input && selectedTx.input !== '0x'}
							<div class="md:col-span-2">
								<p class="text-sm text-base-content/60">Input Data</p>
								<div class="bg-base-100 p-2 rounded mt-1 max-h-32 overflow-auto">
									<code class="text-xs break-all">{selectedTx.input}</code>
								</div>
							</div>
						{/if}
					</div>

					{#if selectedReceipt}
						<div class="divider"></div>
						<h3 class="font-semibold">Receipt</h3>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<p class="text-sm text-base-content/60">Gas Used</p>
								<p>{selectedReceipt.gasUsed.toLocaleString()}</p>
							</div>
							{#if selectedReceipt.contractAddress}
								<div>
									<p class="text-sm text-base-content/60">Contract Created</p>
									<p class="font-mono text-sm break-all">{selectedReceipt.contractAddress}</p>
								</div>
							{/if}
							{#if selectedReceipt.logs.length > 0}
								<div class="md:col-span-2">
									<p class="text-sm text-base-content/60">
										Event Logs ({selectedReceipt.logs.length})
									</p>
									<div class="space-y-2 mt-2">
										{#each selectedReceipt.logs as log, i}
											<div class="bg-base-100 p-2 rounded text-xs">
												<p>
													<strong>#{i}</strong> from
													<code>{formatAddress(log.address)}</code>
												</p>
												<p class="text-base-content/60">
													Topics: {log.topics.length}
												</p>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{:else if isLoadingTxDetail}
						<div class="flex justify-center py-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	{/if}

	<!-- Tabs -->
	<div class="tabs tabs-boxed w-fit">
		<button
			class={classNames('tab', { 'tab-active': activeTab === 'blocks' })}
			onclick={() => (activeTab = 'blocks')}
		>
			Blocks
		</button>
		<button
			class={classNames('tab', { 'tab-active': activeTab === 'transactions' })}
			onclick={() => (activeTab = 'transactions')}
		>
			Transactions
		</button>
	</div>

	<!-- Content -->
	{#if isLoading}
		<div class="flex justify-center py-8">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if activeTab === 'blocks'}
		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title">Latest Blocks</h2>

				{#if blocks.length === 0}
					<p class="text-base-content/60">No blocks yet. The network needs to produce blocks.</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="table">
							<thead>
								<tr>
									<th>Block</th>
									<th>Hash</th>
									<th>Proposer</th>
									<th>Timestamp</th>
								</tr>
							</thead>
							<tbody>
								{#each blocks as block}
									<tr class="hover:bg-base-100 cursor-pointer" onclick={() => viewBlock(block)}>
										<td class="font-semibold">#{block.number}</td>
										<td class="font-mono text-sm">{formatHash(block.hash)}</td>
										<td class="font-mono text-sm">{formatAddress(block.proposer)}</td>
										<td class="text-sm">{formatTimestamp(block.timestamp)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title">Latest Transactions</h2>

				{#if transactions.length === 0}
					<p class="text-base-content/60">No transactions yet.</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="table">
							<thead>
								<tr>
									<th>Hash</th>
									<th>Block</th>
									<th>From</th>
									<th>To</th>
									<th>Value</th>
									<th>Status</th>
								</tr>
							</thead>
							<tbody>
								{#each transactions as tx}
									<tr
										class="hover:bg-base-100 cursor-pointer"
										onclick={() => viewTransaction(tx)}
									>
										<td class="font-mono text-sm">{formatHash(tx.hash)}</td>
										<td>
											{#if tx.blockNumber !== null}
												#{tx.blockNumber}
											{:else}
												<span class="badge badge-warning badge-sm">Pending</span>
											{/if}
										</td>
										<td class="font-mono text-sm">{formatAddress(tx.from)}</td>
										<td class="font-mono text-sm">
											{tx.to ? formatAddress(tx.to) : 'Contract'}
										</td>
										<td class="text-sm">{formatValue(tx.value)}</td>
										<td>
											<span class={classNames('badge badge-sm', getStatusBadge(tx.status))}>
												{tx.status}
											</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Refresh Button -->
	<div class="flex justify-center">
		<button class="btn btn-ghost" onclick={loadData} disabled={isLoading}>
			{isLoading ? 'Loading...' : 'Refresh'}
		</button>
	</div>
</div>
