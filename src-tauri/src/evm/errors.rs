use thiserror::Error;

#[derive(Error, Debug)]
pub enum EvmError {
    #[error("Database error: {0}")]
    Database(String),

    #[error("Execution error: {0}")]
    Execution(String),

    #[error("Invalid address: {0}")]
    InvalidAddress(String),

    #[error("Invalid transaction: {0}")]
    InvalidTransaction(String),

    #[error("Account not found: {0}")]
    AccountNotFound(String),

    #[error("Insufficient balance")]
    InsufficientBalance,

    #[error("Nonce mismatch: expected {expected}, got {got}")]
    NonceMismatch { expected: u64, got: u64 },

    #[error("Contract creation failed: {0}")]
    ContractCreationFailed(String),

    #[error("Signature error: {0}")]
    SignatureError(String),

    #[error("Wallet not found: {0}")]
    WalletNotFound(String),

    #[error("Decryption error: {0}")]
    DecryptionError(String),

    #[error("Block not found: {0}")]
    BlockNotFound(u64),

    #[error("Transaction not found: {0}")]
    TransactionNotFound(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),
}

impl From<EvmError> for String {
    fn from(err: EvmError) -> String {
        err.to_string()
    }
}

impl From<rusqlite::Error> for EvmError {
    fn from(err: rusqlite::Error) -> Self {
        EvmError::Database(err.to_string())
    }
}
