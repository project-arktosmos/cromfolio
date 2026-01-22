use alloy_primitives::{Address, Bytes, B256, U256};
use revm::{
    db::CacheDB,
    primitives::{
        AccountInfo, ExecutionResult as RevmExecutionResult, Output, SpecId, TxKind,
        KECCAK_EMPTY,
    },
    Evm,
};
use rusqlite::Connection;
use sha2::{Digest, Sha256};
use std::sync::{Arc, Mutex};

use crate::evm::{
    errors::EvmError,
    state::SqliteState,
    types::{ExecutionResult, Log},
};

/// EVM executor that runs transactions with zero gas
pub struct EvmExecutor {
    state: SqliteState,
}

impl EvmExecutor {
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self {
            state: SqliteState::new(conn),
        }
    }

    /// Execute a transaction and commit state changes
    pub fn execute(
        &self,
        from: Address,
        to: Option<Address>,
        value: U256,
        input: Bytes,
    ) -> Result<ExecutionResult, EvmError> {
        // Create cache DB wrapping our SQLite state
        let mut cache_db = CacheDB::new(&self.state);

        // Ensure sender account exists with sufficient balance
        self.ensure_account_exists(&mut cache_db, &from)?;

        // Build EVM with zero gas configuration
        let mut evm = Evm::builder()
            .with_db(&mut cache_db)
            .with_spec_id(SpecId::CANCUN)
            .modify_block_env(|block| {
                block.basefee = U256::ZERO;
                block.timestamp = U256::from(
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs(),
                );
            })
            .modify_tx_env(|tx| {
                tx.caller = from;
                tx.transact_to = match to {
                    Some(addr) => TxKind::Call(addr),
                    None => TxKind::Create,
                };
                tx.value = value;
                tx.data = input;
                tx.gas_limit = u64::MAX;
                tx.gas_price = U256::ZERO;
            })
            .build();

        // Execute transaction
        let result = evm.transact_commit().map_err(|e| EvmError::Execution(e.to_string()))?;

        // Drop EVM to release mutable borrow of cache_db
        drop(evm);

        // Convert result and commit state changes
        let execution_result = self.process_result(result)?;

        // Persist state changes to SQLite
        self.commit_cache_to_db(&cache_db)?;

        Ok(execution_result)
    }

    /// Call a contract (read-only, no state changes)
    pub fn call(
        &self,
        from: Address,
        to: Address,
        input: Bytes,
    ) -> Result<Bytes, EvmError> {
        let mut cache_db = CacheDB::new(&self.state);

        let mut evm = Evm::builder()
            .with_db(&mut cache_db)
            .with_spec_id(SpecId::CANCUN)
            .modify_block_env(|block| {
                block.basefee = U256::ZERO;
            })
            .modify_tx_env(|tx| {
                tx.caller = from;
                tx.transact_to = TxKind::Call(to);
                tx.data = input;
                tx.gas_limit = u64::MAX;
                tx.gas_price = U256::ZERO;
            })
            .build();

        let result = evm.transact().map_err(|e| EvmError::Execution(e.to_string()))?;

        match result.result {
            RevmExecutionResult::Success { output, .. } => match output {
                Output::Call(data) => Ok(data),
                Output::Create(data, _) => Ok(data),
            },
            RevmExecutionResult::Revert { output, .. } => {
                Err(EvmError::Execution(format!("Reverted: 0x{}", hex::encode(output))))
            }
            RevmExecutionResult::Halt { reason, .. } => {
                Err(EvmError::Execution(format!("Halted: {:?}", reason)))
            }
        }
    }

    /// Deploy a contract
    pub fn deploy(
        &self,
        from: Address,
        bytecode: Bytes,
    ) -> Result<(Address, ExecutionResult), EvmError> {
        let result = self.execute(from, None, U256::ZERO, bytecode)?;

        let contract_address = result
            .contract_address
            .ok_or_else(|| EvmError::ContractCreationFailed("No address returned".into()))?;

        Ok((contract_address, result))
    }

    /// Ensure an account exists (for senders)
    fn ensure_account_exists(
        &self,
        cache_db: &mut CacheDB<&SqliteState>,
        address: &Address,
    ) -> Result<(), EvmError> {
        // Check if account exists in cache or DB
        if cache_db.accounts.get(address).is_none() {
            // Check DB
            if self.state.get_account(address)?.is_none() {
                // Create account with zero balance
                let info = AccountInfo {
                    balance: U256::ZERO,
                    nonce: 0,
                    code_hash: KECCAK_EMPTY,
                    code: None,
                };
                self.state.save_account(address, &info)?;
            }
        }
        Ok(())
    }

    /// Process revm execution result into our format
    fn process_result(&self, result: RevmExecutionResult) -> Result<ExecutionResult, EvmError> {
        match result {
            RevmExecutionResult::Success {
                output,
                gas_used,
                logs,
                ..
            } => {
                let (output_bytes, contract_address) = match output {
                    Output::Call(data) => (Some(data), None),
                    Output::Create(data, addr) => (Some(data), addr),
                };

                let converted_logs: Vec<Log> = logs
                    .into_iter()
                    .enumerate()
                    .map(|(i, log)| Log {
                        address: log.address,
                        topics: log.topics().to_vec(),
                        data: log.data.data.clone(),
                        log_index: i as u64,
                    })
                    .collect();

                Ok(ExecutionResult {
                    success: true,
                    output: output_bytes,
                    contract_address,
                    gas_used,
                    logs: converted_logs,
                    error: None,
                })
            }
            RevmExecutionResult::Revert { output, gas_used, .. } => Ok(ExecutionResult {
                success: false,
                output: Some(output),
                contract_address: None,
                gas_used,
                logs: vec![],
                error: Some("Transaction reverted".into()),
            }),
            RevmExecutionResult::Halt { reason, gas_used } => Ok(ExecutionResult {
                success: false,
                output: None,
                contract_address: None,
                gas_used,
                logs: vec![],
                error: Some(format!("Execution halted: {:?}", reason)),
            }),
        }
    }

    /// Commit cached state changes to SQLite
    fn commit_cache_to_db(&self, cache_db: &CacheDB<&SqliteState>) -> Result<(), EvmError> {
        for (address, account) in cache_db.accounts.iter() {
            // Save account info
            self.state.save_account(address, &account.info)?;

            // Save bytecode if present
            if let Some(ref code) = account.info.code {
                if account.info.code_hash != KECCAK_EMPTY {
                    self.state
                        .save_code(&account.info.code_hash, code.bytecode())?;
                }
            }

            // Save storage changes
            for (slot, value) in account.storage.iter() {
                self.state.save_storage(address, slot, value)?;
            }
        }

        Ok(())
    }

    /// Get account balance
    pub fn get_balance(&self, address: &Address) -> Result<U256, EvmError> {
        match self.state.get_account(address)? {
            Some(info) => Ok(info.balance),
            None => Ok(U256::ZERO),
        }
    }

    /// Get account nonce
    pub fn get_nonce(&self, address: &Address) -> Result<u64, EvmError> {
        match self.state.get_account(address)? {
            Some(info) => Ok(info.nonce),
            None => Ok(0),
        }
    }

    /// Get contract code
    pub fn get_code(&self, address: &Address) -> Result<Option<Bytes>, EvmError> {
        match self.state.get_account(address)? {
            Some(info) => {
                if info.code_hash == KECCAK_EMPTY {
                    Ok(None)
                } else if let Some(code) = info.code {
                    Ok(Some(Bytes::from(code.bytecode().to_vec())))
                } else {
                    Ok(None)
                }
            }
            None => Ok(None),
        }
    }

    /// Compute transaction hash
    pub fn compute_tx_hash(
        from: &Address,
        to: &Option<Address>,
        value: &U256,
        input: &Bytes,
        nonce: u64,
    ) -> B256 {
        let mut hasher = Sha256::new();
        hasher.update(from.as_slice());
        if let Some(to_addr) = to {
            hasher.update(to_addr.as_slice());
        }
        hasher.update(&value.to_be_bytes::<32>());
        hasher.update(input.as_ref());
        hasher.update(&nonce.to_be_bytes());

        let result = hasher.finalize();
        B256::from_slice(&result)
    }

    /// Set account balance (for testing/faucet)
    pub fn set_balance(&self, address: &Address, balance: U256) -> Result<(), EvmError> {
        let info = match self.state.get_account(address)? {
            Some(mut existing) => {
                existing.balance = balance;
                existing
            }
            None => AccountInfo {
                balance,
                nonce: 0,
                code_hash: KECCAK_EMPTY,
                code: None,
            },
        };

        self.state.save_account(address, &info)
    }
}
