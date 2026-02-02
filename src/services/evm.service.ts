import { invoke } from '@tauri-apps/api/core';
import type {
	WalletInfo,
	ExecutionResult,
	ChainState,
	Block,
	Transaction,
	TransactionReceipt
} from '$types/evm.type';

/**
 * EVM Service - Wrapper around Tauri commands for EVM operations
 */
export const evmService = {
	// ==================== Wallet Management ====================

	/**
	 * Create a new wallet
	 * @param name Optional name for the wallet
	 * @returns The new wallet address
	 */
	async createWallet(name?: string): Promise<string> {
		return await invoke('evm_create_wallet', { name });
	},

	/**
	 * List all wallets
	 */
	async listWallets(): Promise<WalletInfo[]> {
		return await invoke('evm_list_wallets');
	},

	/**
	 * Get wallet private key (use with caution)
	 * @param address Wallet address
	 * @returns Private key as hex string
	 */
	async getWalletPrivateKey(address: string): Promise<string> {
		return await invoke('evm_get_wallet_private_key', { address });
	},

	// ==================== Account Queries ====================

	/**
	 * Get account balance
	 * @param address Account address
	 * @returns Balance as decimal string
	 */
	async getBalance(address: string): Promise<string> {
		return await invoke('evm_get_balance', { address });
	},

	/**
	 * Get account nonce
	 * @param address Account address
	 */
	async getNonce(address: string): Promise<number> {
		return await invoke('evm_get_nonce', { address });
	},

	/**
	 * Set account balance (faucet functionality)
	 * @param address Account address
	 * @param balance New balance as decimal string
	 */
	async setBalance(address: string, balance: string): Promise<void> {
		return await invoke('evm_set_balance', { address, balance });
	},

	// ==================== Transactions ====================

	/**
	 * Send a transaction
	 * @param from Sender address
	 * @param to Recipient address (null for contract creation)
	 * @param value Amount to send as decimal string
	 * @param data Optional calldata as hex string
	 * @returns Execution result
	 */
	async sendTransaction(
		from: string,
		to: string | null,
		value: string,
		data?: string
	): Promise<ExecutionResult> {
		return await invoke('evm_send_transaction', { from, to, value, data });
	},

	/**
	 * Call a contract (read-only, no state changes)
	 * @param from Caller address
	 * @param to Contract address
	 * @param data Calldata as hex string
	 * @returns Output as hex string
	 */
	async call(from: string, to: string, data: string): Promise<string> {
		return await invoke('evm_call', { from, to, data });
	},

	/**
	 * Deploy a contract
	 * @param from Deployer address
	 * @param bytecode Contract bytecode as hex string
	 * @returns Execution result with contract address
	 */
	async deployContract(from: string, bytecode: string): Promise<ExecutionResult> {
		return await invoke('evm_deploy_contract', { from, bytecode });
	},

	// ==================== Contract Queries ====================

	/**
	 * Get contract code
	 * @param address Contract address
	 * @returns Bytecode as hex string, or null if not a contract
	 */
	async getCode(address: string): Promise<string | null> {
		return await invoke('evm_get_code', { address });
	},

	// ==================== Chain State ====================

	/**
	 * Get chain state summary
	 */
	async getChainState(): Promise<ChainState> {
		return await invoke('evm_get_chain_state');
	},

	// ==================== Block Queries ====================

	/**
	 * Get block by number
	 * @param number Block number
	 */
	async getBlock(number: number): Promise<Block | null> {
		return await invoke('evm_get_block', { number });
	},

	/**
	 * Get latest blocks (paginated)
	 * @param limit Max number of blocks to return (default 20, max 100)
	 * @param offset Pagination offset
	 */
	async getBlocks(limit?: number, offset?: number): Promise<Block[]> {
		return await invoke('evm_get_blocks', { limit, offset });
	},

	/**
	 * Get transactions in a block
	 * @param blockNumber Block number
	 */
	async getBlockTransactions(blockNumber: number): Promise<Transaction[]> {
		return await invoke('evm_get_block_transactions', { blockNumber });
	},

	// ==================== Transaction Queries ====================

	/**
	 * Get transaction by hash
	 * @param hash Transaction hash
	 */
	async getTransaction(hash: string): Promise<Transaction | null> {
		return await invoke('evm_get_transaction', { hash });
	},

	/**
	 * Get transactions (paginated, optionally filtered by address)
	 * @param address Optional address to filter by
	 * @param limit Max number of transactions to return (default 20, max 100)
	 * @param offset Pagination offset
	 */
	async getTransactions(address?: string, limit?: number, offset?: number): Promise<Transaction[]> {
		return await invoke('evm_get_transactions', { address, limit, offset });
	},

	/**
	 * Get transaction receipt
	 * @param hash Transaction hash
	 */
	async getReceipt(hash: string): Promise<TransactionReceipt | null> {
		return await invoke('evm_get_receipt', { hash });
	}
};
