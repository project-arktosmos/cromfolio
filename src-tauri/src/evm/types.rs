use alloy_primitives::{Address, Bytes, B256, U256};
use serde::{Deserialize, Serialize};

/// Account information stored in the database
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub address: Address,
    pub balance: U256,
    pub nonce: u64,
    pub code_hash: Option<B256>,
}

/// Unsigned transaction (before signing)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsignedTransaction {
    pub from: Address,
    pub to: Option<Address>,
    pub value: U256,
    pub input: Bytes,
    pub nonce: u64,
}

/// Signed transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub hash: B256,
    pub from: Address,
    pub to: Option<Address>,
    pub value: U256,
    pub input: Bytes,
    pub nonce: u64,
    pub signature: Bytes,
    pub block_number: Option<u64>,
    pub status: TxStatus,
}

/// Transaction status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TxStatus {
    Pending,
    Success,
    Failed,
}

impl TxStatus {
    pub fn as_i32(&self) -> i32 {
        match self {
            TxStatus::Pending => 0,
            TxStatus::Success => 1,
            TxStatus::Failed => 2,
        }
    }

    pub fn from_i32(val: i32) -> Self {
        match val {
            1 => TxStatus::Success,
            2 => TxStatus::Failed,
            _ => TxStatus::Pending,
        }
    }
}

/// Block header
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Block {
    pub number: u64,
    pub hash: B256,
    pub parent_hash: B256,
    pub state_root: B256,
    pub transactions_root: B256,
    pub timestamp: u64,
    pub proposer: String,
    pub signature: Option<Bytes>,
}

/// Transaction receipt
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionReceipt {
    pub tx_hash: B256,
    pub block_number: u64,
    pub contract_address: Option<Address>,
    pub status: bool,
    pub gas_used: u64,
    pub logs: Vec<Log>,
}

/// Event log
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Log {
    pub address: Address,
    pub topics: Vec<B256>,
    pub data: Bytes,
    pub log_index: u64,
}

/// Wallet info (without private key)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletInfo {
    pub address: Address,
    pub name: Option<String>,
    pub created_at: String,
}

/// Execution result returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionResult {
    pub success: bool,
    pub output: Option<Bytes>,
    pub contract_address: Option<Address>,
    pub gas_used: u64,
    pub logs: Vec<Log>,
    pub error: Option<String>,
}

/// Chain state summary
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChainState {
    pub latest_block: u64,
    pub pending_tx_count: u64,
    pub total_accounts: u64,
    pub total_contracts: u64,
}
