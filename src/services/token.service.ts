import {
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
    getAssociatedTokenAddress,
    getMint,
} from '@solana/spl-token';
import { walletService } from './wallet.service';
import { connectionService } from './connection.service';
import { transactionService } from './transaction.service';
import { PriorityFeeOptions } from '../config/types';

export class TokenService {
    public async transferSol(
        destination: string,
        amountSol: number,
        priorityFeeOptions?: PriorityFeeOptions
    ): Promise<string> {
        if (amountSol <= 0) {
            throw new Error('Amount must be greater than zero');
        }

        const keypair = walletService.getActiveKeypair();
        if (!keypair) {
            throw new Error('No active wallet found');
        }

        const destinationPubkey = new PublicKey(destination);
        const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
        if (lamports <= 0) {
            throw new Error('Amount is too small to transfer');
        }

        const tx = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: keypair.publicKey,
                toPubkey: destinationPubkey,
                lamports,
            })
        );

        await transactionService.applyPriorityFee(tx, priorityFeeOptions);
        const connection = connectionService.getConnection();
        return sendAndConfirmTransaction(connection, tx, [keypair], {
            commitment: 'confirmed',
        });
    }

    public async transferSplToken(options: {
        mint: string;
        amount: number;
        destination: string;
        decimals?: number;
        priorityFeeOptions?: PriorityFeeOptions;
    }): Promise<string> {
        if (options.amount <= 0) {
            throw new Error('Amount must be greater than zero');
        }

        const keypair = walletService.getActiveKeypair();
        if (!keypair) {
            throw new Error('No active wallet found');
        }

        const connection = connectionService.getConnection();
        const mint = new PublicKey(options.mint);
        const destination = new PublicKey(options.destination);
        const decimals = typeof options.decimals === 'number'
            ? options.decimals
            : (await getMint(connection, mint)).decimals;

        const multiplier = Math.pow(10, decimals);
        const rawAmount = BigInt(Math.round(options.amount * multiplier));
        if (rawAmount <= 0n) {
            throw new Error('Amount is too small to transfer');
        }

        const sourceAta = await getAssociatedTokenAddress(mint, keypair.publicKey);
        const destinationAta = await getAssociatedTokenAddress(mint, destination);

        const tx = new Transaction();
        const destinationAccount = await connection.getAccountInfo(destinationAta);
        if (!destinationAccount) {
            tx.add(
                createAssociatedTokenAccountInstruction(
                    keypair.publicKey,
                    destinationAta,
                    destination,
                    mint
                )
            );
        }

        tx.add(
            createTransferInstruction(
                sourceAta,
                destinationAta,
                keypair.publicKey,
                rawAmount
            )
        );

        await transactionService.applyPriorityFee(tx, options.priorityFeeOptions);

        return sendAndConfirmTransaction(connection, tx, [keypair], {
            commitment: 'confirmed',
        });
    }
}

export const tokenService = new TokenService();
