import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress, TokenAccountNotFoundError } from '@solana/spl-token';

export interface WalletBalances {
  solBalance: number;
  tokenXBalance: number;
  tokenYBalance: number;
}

export interface BalanceValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Calculate rent-exempt minimum for an account
 * Solana rent formula: (128 + data_size) * 6960 lamports/byte
 * Source: https://solana.com/docs/core/fees#rent
 */
export function calculateRentExemptMinimum(accountSizeBytes: number): number {
  const LAMPORTS_PER_SOL = 1_000_000_000;
  const LAMPORTS_PER_BYTE_YEAR = 3480; // Base rate
  const YEARS_FOR_EXEMPTION = 2; // Need 2 years worth
  const ACCOUNT_OVERHEAD = 128; // Every account has 128 byte overhead

  const totalBytes = accountSizeBytes + ACCOUNT_OVERHEAD;
  const lamports = totalBytes * LAMPORTS_PER_BYTE_YEAR * YEARS_FOR_EXEMPTION;

  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Get wallet balances for SOL and two specific tokens
 */
export async function getWalletBalances(
  connection: Connection,
  walletPublicKey: PublicKey,
  tokenXMint: PublicKey,
  tokenYMint: PublicKey
): Promise<WalletBalances> {
  try {
    // Get SOL balance
    const solBalance = await connection.getBalance(walletPublicKey);
    const solAmount = solBalance / 1e9;

    const SOL_MINT = 'So11111111111111111111111111111111111111112';

    // Get Token X balance
    let tokenXBalance = 0;
    if (tokenXMint.toBase58() === SOL_MINT) {
      tokenXBalance = solAmount;
    } else {
      try {
        const tokenXAta = await getAssociatedTokenAddress(tokenXMint, walletPublicKey);
        const tokenXAccount = await getAccount(connection, tokenXAta);
        // Get mint info to determine decimals
        const mintInfo = await connection.getParsedAccountInfo(tokenXMint);
        const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 6;
        tokenXBalance = Number(tokenXAccount.amount) / Math.pow(10, decimals);
      } catch (error) {
        if (error instanceof TokenAccountNotFoundError) {
          tokenXBalance = 0;
        } else {
          throw error;
        }
      }
    }

    // Get Token Y balance
    let tokenYBalance = 0;
    if (tokenYMint.toBase58() === SOL_MINT) {
      tokenYBalance = solAmount;
    } else {
      try {
        const tokenYAta = await getAssociatedTokenAddress(tokenYMint, walletPublicKey);
        const tokenYAccount = await getAccount(connection, tokenYAta);
        // Get mint info to determine decimals
        const mintInfo = await connection.getParsedAccountInfo(tokenYMint);
        const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 6;
        tokenYBalance = Number(tokenYAccount.amount) / Math.pow(10, decimals);
      } catch (error) {
        if (error instanceof TokenAccountNotFoundError) {
          tokenYBalance = 0;
        } else {
          throw error;
        }
      }
    }

    return {
      solBalance: solAmount,
      tokenXBalance,
      tokenYBalance,
    };
  } catch (error) {
    console.error('Error fetching wallet balances:', error);
    throw new Error(`Failed to fetch wallet balances: ${error}`);
  }
}

/**
 * Validate wallet has sufficient balance for position creation
 * Uses proper rent calculation based on DLMM position account size (~680 bytes)
 */
export async function validateWalletBalance(
  connection: Connection,
  walletPublicKey: PublicKey,
  tokenXMint: PublicKey,
  tokenYMint: PublicKey,
  requiredTokenX: number,
  requiredTokenY: number
): Promise<BalanceValidationResult> {
  try {
    const balances = await getWalletBalances(connection, walletPublicKey, tokenXMint, tokenYMint);

    const errors: string[] = [];
    const warnings: string[] = [];

    // Calculate proper rent for DLMM position account
    // DLMM Position account is ~680 bytes (varies slightly by number of bins)
    // This results in ~0.0047 SOL rent-exempt minimum
    const DLMM_POSITION_ACCOUNT_SIZE = 680;
    const rentExemptMinimum = calculateRentExemptMinimum(DLMM_POSITION_ACCOUNT_SIZE);

    // Transaction fees: ~0.00005 SOL per signature (typically 2-3 signatures)
    const transactionFees = 0.00015; // 3 signatures worst case

    // Safety buffer for compute fees and potential retries
    const safetyBuffer = 0.001;

    // Total SOL overhead for position creation
    const positionCreationOverhead = rentExemptMinimum + transactionFees + safetyBuffer;

    // SOL validation: include overhead plus whichever side of the pair is SOL
    const solMint = 'So11111111111111111111111111111111111111112';
    const tokenXIsSol = tokenXMint.toBase58() === solMint;
    const tokenYIsSol = tokenYMint.toBase58() === solMint;
    const solForLiquidity = (tokenXIsSol ? requiredTokenX : 0) + (tokenYIsSol ? requiredTokenY : 0);
    const totalSolRequired = solForLiquidity + positionCreationOverhead;

    if (balances.solBalance < totalSolRequired) {
      errors.push(`Insufficient SOL: have ${balances.solBalance.toFixed(4)}, need ${totalSolRequired.toFixed(4)} (${solForLiquidity.toFixed(4)} for liquidity + ${positionCreationOverhead.toFixed(4)} for rent/fees)`);
    }

    // Token X validation
    if (!tokenXIsSol && balances.tokenXBalance < requiredTokenX) {
      errors.push(`Insufficient Token X: have ${balances.tokenXBalance.toFixed(4)}, need ${requiredTokenX.toFixed(4)}`);
    }

    // Token Y validation
    if (!tokenYIsSol && balances.tokenYBalance < requiredTokenY) {
      errors.push(`Insufficient Token Y: have ${balances.tokenYBalance.toFixed(4)}, need ${requiredTokenY.toFixed(4)}`);
    }

    // Warnings for small amounts
    if (requiredTokenX < 0.01 || requiredTokenY < 0.01) {
      warnings.push('⚠️  Position size is very small (<0.01). Consider increasing for better price discovery.');
    }

    if (balances.solBalance < 0.05 && balances.solBalance >= positionCreationOverhead) {
      warnings.push(`⚠️  SOL balance is low (${balances.solBalance.toFixed(4)}). Consider adding more SOL for future transactions.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    console.error('Error validating wallet balance:', error);
    return {
      isValid: false,
      errors: [`Error validating balance: ${error}`],
      warnings: [],
    };
  }
}
