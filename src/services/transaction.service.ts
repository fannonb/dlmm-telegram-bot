import { ComputeBudgetProgram, Transaction } from '@solana/web3.js';
import { configManager } from '../config/config.manager';
import { DEFAULT_CONFIG } from '../config/constants';
import { PriorityFeeOptions, TransactionConfig } from '../config/types';
import { connectionService } from './connection.service';

class TransactionService {
    public getTransactionConfig(): TransactionConfig {
        const config = configManager.getConfig();
        return config.transaction;
    }

    public updateTransactionConfig(partial: Partial<TransactionConfig>): void {
        const config = configManager.getConfig();
        configManager.updateConfig({
            transaction: {
                ...config.transaction,
                ...partial,
            },
        });
    }

    public async applyPriorityFee(
        transaction: Transaction,
        override?: PriorityFeeOptions
    ): Promise<void> {
        const microLamports = await this.resolvePriorityFeeMicroLamports(override);
        if (!microLamports || microLamports <= 0) {
            return;
        }

        transaction.instructions.unshift(
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports })
        );
    }

    public async resolvePriorityFeeMicroLamports(
        override?: PriorityFeeOptions
    ): Promise<number | null> {
        const transactionConfig = this.getTransactionConfig();
        const mode = override?.mode ?? transactionConfig.priorityFee ?? 'dynamic';

        if (mode === 'fixed') {
            const microLamports = override?.microLamports ?? transactionConfig.priorityFeeAmount;
            return typeof microLamports === 'number' && microLamports > 0
                ? Math.floor(microLamports)
                : null;
        }

        try {
            const multiplier = override?.multiplier
                ?? transactionConfig.priorityFeeMultiplier
                ?? DEFAULT_CONFIG.PRIORITY_FEE_MULTIPLIER;

            const connection = connectionService.getConnection();
            const fees = await connection.getRecentPrioritizationFees();
            if (!fees || fees.length === 0) {
                return null;
            }

            const sorted = [...fees].sort(
                (a, b) => a.prioritizationFee - b.prioritizationFee
            );
            const median = sorted[Math.floor(sorted.length / 2)].prioritizationFee;
            const computed = Math.floor(median * Math.max(multiplier, 0));
            return computed > 0 ? computed : null;
        } catch (error) {
            console.warn('Unable to fetch dynamic priority fees:', error);
            return null;
        }
    }
}

export const transactionService = new TransactionService();
