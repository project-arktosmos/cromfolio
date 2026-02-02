<script lang="ts">
	import classNames from 'classnames';
	import { onMount } from 'svelte';
	import { checkLlmServer, getLlmModels, chatLlm, getLlmDefaults } from '$services/llm.service';
	import type { LlmModel, LlmProvider, ChatMessage, LlmDefaults } from '$types/llm.type';
	import { DEFAULT_URLS } from '$types/llm.type';

	// Defaults from backend (.env configuration)
	let defaults = $state<LlmDefaults | null>(null);

	// Server state
	let currentProvider = $state<LlmProvider>('ollama');
	let currentBaseUrl = $state('');
	let serverOnline = $state(false);
	let isCheckingServer = $state(true);

	// Models state
	let models: LlmModel[] = $state([]);
	let selectedModel = $state<LlmModel | null>(null);
	let isLoadingModels = $state(false);

	// Chat state
	let messages: ChatMessage[] = $state([]);
	let inputMessage = $state('');
	let isSendingMessage = $state(false);

	// Provider labels
	const providerLabels: Record<LlmProvider, string> = {
		lmstudio: 'LM Studio',
		ollama: 'Ollama'
	};

	// Get default URL for a provider (from backend defaults, with fallback)
	function getDefaultUrl(provider: LlmProvider): string {
		if (defaults) {
			return provider === 'ollama' ? defaults.ollamaBaseUrl : defaults.lmstudioBaseUrl;
		}
		return DEFAULT_URLS[provider];
	}

	onMount(async () => {
		// Fetch defaults from backend
		defaults = await getLlmDefaults();
		// Set the current base URL for Ollama (default provider)
		currentBaseUrl = getDefaultUrl('ollama');
		// Auto-connect to the server
		await connectToServer();
	});

	// Connect to the current server and fetch models
	async function connectToServer() {
		isCheckingServer = true;
		serverOnline = await checkLlmServer(currentBaseUrl, currentProvider);
		isCheckingServer = false;

		if (serverOnline) {
			await loadModels();
		} else {
			models = [];
			selectedModel = null;
		}
	}

	// Load models from server
	async function loadModels() {
		isLoadingModels = true;
		models = await getLlmModels(currentBaseUrl, currentProvider);
		isLoadingModels = false;
	}

	// Switch provider
	async function switchProvider(provider: LlmProvider) {
		if (provider === currentProvider) return;
		currentProvider = provider;
		currentBaseUrl = getDefaultUrl(provider);
		selectedModel = null;
		messages = [];
		await connectToServer();
	}

	// Select a model
	function selectModel(model: LlmModel) {
		if (selectedModel?.id === model.id) {
			selectedModel = null;
			messages = [];
		} else {
			selectedModel = model;
			messages = [];
		}
	}

	// Send a chat message
	async function sendMessage() {
		if (!selectedModel || !inputMessage.trim() || isSendingMessage) return;

		const userMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'user',
			content: inputMessage.trim(),
			timestamp: new Date().toISOString()
		};

		messages = [...messages, userMessage];
		inputMessage = '';
		isSendingMessage = true;

		// Build message history for API
		const apiMessages = messages.map((m) => ({
			role: m.role,
			content: m.content
		}));

		const response = await chatLlm(currentBaseUrl, currentProvider, selectedModel.id, apiMessages);

		if (response) {
			const assistantMessage: ChatMessage = {
				id: crypto.randomUUID(),
				role: 'assistant',
				content: response,
				timestamp: new Date().toISOString()
			};
			messages = [...messages, assistantMessage];
		} else {
			const errorMessage: ChatMessage = {
				id: crypto.randomUUID(),
				role: 'assistant',
				content:
					'Error: Failed to get response from the model. Please check if the server is running and the model is loaded.',
				timestamp: new Date().toISOString()
			};
			messages = [...messages, errorMessage];
		}

		isSendingMessage = false;
	}

	// Handle Enter key in chat input
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	// Clear chat history
	function clearChat() {
		messages = [];
	}

	// Format file size
	function formatSize(bytes?: number): string {
		if (!bytes) return '';
		const gb = bytes / (1024 * 1024 * 1024);
		return `${gb.toFixed(1)} GB`;
	}
</script>

<div class="flex h-full flex-col">
	<div class="mb-4 flex items-center justify-between">
		<h1 class="text-2xl font-bold">LLM Chat</h1>
		<div class="flex items-center gap-2">
			<!-- Provider Toggle -->
			<div class="join">
				<button
					class={classNames('join-item btn btn-sm', {
						'btn-primary': currentProvider === 'ollama',
						'btn-ghost': currentProvider !== 'ollama'
					})}
					onclick={() => switchProvider('ollama')}
				>
					Ollama
				</button>
				<button
					class={classNames('join-item btn btn-sm', {
						'btn-primary': currentProvider === 'lmstudio',
						'btn-ghost': currentProvider !== 'lmstudio'
					})}
					onclick={() => switchProvider('lmstudio')}
				>
					LM Studio
				</button>
			</div>
			<!-- Server Status -->
			<div class="flex items-center gap-2">
				{#if isCheckingServer}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<span
						class={classNames('badge badge-sm', {
							'badge-success': serverOnline,
							'badge-error': !serverOnline
						})}
					>
						{serverOnline ? 'Online' : 'Offline'}
					</span>
				{/if}
				<button class="btn btn-ghost btn-xs" onclick={connectToServer} title="Refresh"> 🔄 </button>
			</div>
			<span class="text-base-content/60 text-xs">{currentBaseUrl}</span>
		</div>
	</div>

	<div class="grid min-h-0 flex-1 grid-cols-3 gap-4">
		<!-- Column 1: Models List -->
		<div class="card bg-base-200 flex flex-col overflow-hidden">
			<div class="card-body flex h-full flex-col p-4">
				<h2 class="card-title mb-2 text-lg">Models</h2>

				<div class="flex-1 overflow-y-auto">
					{#if isCheckingServer || isLoadingModels}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if !serverOnline}
						<div class="text-base-content/60 p-4 text-center">
							<p>Server is offline.</p>
							<p class="mt-1 text-sm">
								Make sure {providerLabels[currentProvider]} is running at {currentBaseUrl}
							</p>
						</div>
					{:else if models.length === 0}
						<div class="text-base-content/60 p-4 text-center">
							<p>No models available.</p>
							<p class="mt-1 text-sm">Load a model in {providerLabels[currentProvider]} first.</p>
						</div>
					{:else}
						<div class="space-y-1">
							{#each models as model (model.id)}
								<div
									class={classNames(
										'w-full cursor-pointer rounded-lg p-3 text-left transition-colors',
										'hover:bg-base-300',
										{
											'bg-primary/20 ring-primary ring-2': selectedModel?.id === model.id,
											'bg-base-100': selectedModel?.id !== model.id
										}
									)}
									onclick={() => selectModel(model)}
									onkeydown={(e) => e.key === 'Enter' && selectModel(model)}
									role="button"
									tabindex="0"
								>
									<div class="text-sm font-medium">{model.name}</div>
									<div class="text-base-content/60 mt-1 flex flex-wrap gap-1 text-xs">
										{#if model.parameterSize}
											<span class="badge badge-xs badge-ghost">{model.parameterSize}</span>
										{/if}
										{#if model.family}
											<span class="badge badge-xs badge-ghost">{model.family}</span>
										{/if}
										{#if model.quantizationLevel}
											<span class="badge badge-xs badge-ghost">{model.quantizationLevel}</span>
										{/if}
										{#if model.size}
											<span class="badge badge-xs badge-ghost">{formatSize(model.size)}</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				{#if serverOnline}
					<div class="text-base-content/60 border-base-300 mt-2 border-t pt-2 text-xs">
						{models.length} model{models.length !== 1 ? 's' : ''} available
					</div>
				{/if}
			</div>
		</div>

		<!-- Columns 2-3: Chat Interface -->
		<div class="card bg-base-200 col-span-2 flex flex-col overflow-hidden">
			<div class="card-body flex h-full flex-col p-4">
				<div class="mb-2 flex items-center justify-between">
					<h2 class="card-title text-lg">
						Chat
						{#if selectedModel}
							<span class="text-base-content/60 text-sm font-normal">
								with {selectedModel.name}
							</span>
						{/if}
					</h2>
					{#if messages.length > 0}
						<button class="btn btn-ghost btn-xs" onclick={clearChat}> Clear </button>
					{/if}
				</div>

				<!-- Messages -->
				<div class="mb-4 flex-1 overflow-y-auto">
					{#if !selectedModel}
						<div class="text-base-content/60 p-4 text-center">
							<p>Select a model to start chatting.</p>
						</div>
					{:else if messages.length === 0}
						<div class="text-base-content/60 p-4 text-center">
							<p>No messages yet.</p>
							<p class="mt-1 text-sm">Send a message to start the conversation.</p>
						</div>
					{:else}
						<div class="space-y-4">
							{#each messages as message (message.id)}
								<div
									class={classNames('flex', {
										'justify-end': message.role === 'user',
										'justify-start': message.role === 'assistant'
									})}
								>
									<div
										class={classNames('max-w-[85%] rounded-lg p-3', {
											'bg-primary text-primary-content': message.role === 'user',
											'bg-base-100': message.role === 'assistant'
										})}
									>
										<div class="whitespace-pre-wrap text-sm">{message.content}</div>
									</div>
								</div>
							{/each}
							{#if isSendingMessage}
								<div class="flex justify-start">
									<div class="bg-base-100 rounded-lg p-3">
										<span class="loading loading-dots loading-sm"></span>
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Input -->
				{#if selectedModel}
					<div class="border-base-300 border-t pt-4">
						<div class="flex gap-2">
							<textarea
								placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
								class="textarea textarea-bordered flex-1 resize-none"
								rows="2"
								bind:value={inputMessage}
								onkeydown={handleKeydown}
								disabled={isSendingMessage}
							></textarea>
							<button
								class="btn btn-primary self-end"
								onclick={sendMessage}
								disabled={!inputMessage.trim() || isSendingMessage}
							>
								{#if isSendingMessage}
									<span class="loading loading-spinner loading-sm"></span>
								{:else}
									Send
								{/if}
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
