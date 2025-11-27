import { PublicKey } from '@solana/web3.js';
import axios from 'axios';
import DLMM from '@meteora-ag/dlmm';
import { getMint } from '@solana/spl-token';
import { connectionService } from './connection.service';
import { PoolInfo } from '../config/types';
import { API_ENDPOINTS } from '../config/constants';

export class PoolService {
    private tokenDecimalsCache = new Map<string, number>();

    /**
     * Get DLMM instance for a pool
     * This is the gateway to all SDK operations
     */
    public async getDlmmInstance(poolAddress: string): Promise<DLMM> {
        try {
            const connection = connectionService.getConnection();
            return await DLMM.create(connection, new PublicKey(poolAddress));
        } catch (error: any) {
            const network = connectionService.getConfig().endpoint;
            const errorMsg = error?.message || String(error);

            if (errorMsg.includes('Invalid account discriminator') || errorMsg.includes('Account not found')) {
                throw new Error(`Failed to initialize DLMM pool ${poolAddress}. The address exists but is NOT a valid DLMM pool on ${network}. It might be a wallet address or a different program account.`);
            }

            throw new Error(`Failed to initialize DLMM instance for ${poolAddress} on ${network}. Error: ${errorMsg}`);
        }
    }

    /**
     * Get active bin details including X and Y amounts
     */
    public async getActiveBinDetails(poolAddress: string): Promise<{
        binId: number;
        xAmount: number;
        yAmount: number;
        price: number;
    }> {
        try {
            const dlmm = await this.getDlmmInstance(poolAddress);
            const activeBin = await dlmm.getActiveBin();

            const tokenXMint = dlmm.tokenX.publicKey.toBase58();
            const tokenYMint = dlmm.tokenY.publicKey.toBase58();
            const [xDecimals, yDecimals] = await Promise.all([
                this.getTokenDecimals(tokenXMint),
                this.getTokenDecimals(tokenYMint),
            ]);
            
            // Calculate decimals for proper amount display
            const adjustedXDecimals = xDecimals || 6;
            const adjustedYDecimals = yDecimals || 6;
            
            // Convert from BN to human-readable amounts
            const xAmount = activeBin.xAmount ? activeBin.xAmount.toNumber() / Math.pow(10, adjustedXDecimals) : 0;
            const yAmount = activeBin.yAmount ? activeBin.yAmount.toNumber() / Math.pow(10, adjustedYDecimals) : 0;
            
            // Calculate price from bin ID and bin step
            const price = this.calculateBinPrice(
                activeBin.binId,
                dlmm.lbPair.binStep,
                adjustedXDecimals,
                adjustedYDecimals
            );

            return {
                binId: activeBin.binId,
                xAmount,
                yAmount,
                price,
            };
        } catch (error) {
            // Silently throw - let caller handle error gracefully
            throw error;
        }
    }

    private async getTokenDecimals(mintAddress: string): Promise<number> {
        if (this.tokenDecimalsCache.has(mintAddress)) {
            return this.tokenDecimalsCache.get(mintAddress)!;
        }

        try {
            const connection = connectionService.getConnection();
            const mintInfo = await getMint(connection, new PublicKey(mintAddress));
            const decimals = mintInfo.decimals ?? 6;
            this.tokenDecimalsCache.set(mintAddress, decimals);
            return decimals;
        } catch (error) {
            console.warn(`⚠️  Failed to fetch token decimals for ${mintAddress}, defaulting to 6.`, error);
            this.tokenDecimalsCache.set(mintAddress, 6);
            return 6;
        }
    }

    /**
     * Helper to transform API pool data to PoolInfo
     */
    private transformPoolData(pool: any): PoolInfo {
        // Extract token symbols from name (e.g., "SOL-USDC" -> "SOL", "USDC")
        const symbols = pool.name ? pool.name.split('-') : ['UNKNOWN', 'UNKNOWN'];

        // Convert base_fee_percentage to basis points (e.g., "0.1" -> 10 bps)
        const feeBps = pool.base_fee_percentage
            ? parseFloat(pool.base_fee_percentage) * 100
            : 0;

        // Get TVL from liquidity field
        const tvl = pool.liquidity ? parseFloat(pool.liquidity) : 0;

        // Get 24h volume from trade_volume_24h
        const volume24h = pool.trade_volume_24h || 0;

        // Get APR (already in percentage format)
        const apr = pool.apr || 0;

        return {
            address: pool.address || '',
            tokenX: {
                mint: pool.mint_x || '',
                symbol: symbols[0] || 'UNKNOWN',
                decimals: 6, // Solana tokens typically use 6 decimals
            },
            tokenY: {
                mint: pool.mint_y || '',
                symbol: symbols[1] || 'UNKNOWN',
                decimals: 6, // Solana tokens typically use 6 decimals
            },
            binStep: pool.bin_step || 0,
            feeBps: Math.round(feeBps), // Convert to basis points
            activeBin: pool.active_id || 0,
            tvl: tvl,
            volume24h: volume24h,
            apr: apr,
            isActive: !pool.hide && !pool.is_blacklisted,
            lastUpdated: new Date().toISOString(),
            validationStatus: pool.is_verified ? 'valid' : 'warning',
        };
    }

    /**
     * Fetch all pools from Meteora API
     */
    public async fetchAllPools(): Promise<any[]> {
        try {
            const response = await axios.get(`${API_ENDPOINTS.METEORA_API}/pair/all`);
            return response.data || [];
        } catch (error) {
            throw new Error(`Failed to fetch pools: ${error}`);
        }
    }

    /**
     * Fetch a specific pool from Meteora API by address
     */
    public async fetchPoolByAddress(poolAddress: string): Promise<any> {
        try {
            const response = await axios.get(
                `${API_ENDPOINTS.METEORA_API}/pair/${poolAddress}`
            );
            return response.data;
        } catch (error) {
            throw new Error(`Failed to fetch pool ${poolAddress}: ${error}`);
        }
    }

    /**
     * Search for a pool by its address and return as PoolInfo
     * Enhanced: Fetches on-chain data to verify active bin
     */
    public async searchPoolByAddress(poolAddress: string): Promise<PoolInfo> {
        try {
            if (!poolAddress || poolAddress.trim().length === 0) {
                throw new Error('Pool address cannot be empty');
            }

            let poolInfo: PoolInfo;
            let dlmmInstance: DLMM | null = null;

            try {
                const poolData = await this.fetchPoolByAddress(poolAddress);
                poolInfo = this.transformPoolData(poolData);
            } catch (apiError: any) {
                console.warn(`⚠️ API fetch failed for ${poolAddress}, trying on-chain fallback...`);

                try {
                    dlmmInstance = await this.getDlmmInstance(poolAddress);
                    const activeBin = await dlmmInstance.getActiveBin();

                    const getSymbol = (mint: string, defaultSym: string) => {
                        if (mint === 'So11111111111111111111111111111111111111112') return 'SOL';
                        if (mint === '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU') return 'USDC';
                        return defaultSym;
                    };

                    poolInfo = {
                        address: poolAddress,
                        tokenX: {
                            mint: dlmmInstance.tokenX.publicKey.toBase58(),
                            symbol: getSymbol(dlmmInstance.tokenX.publicKey.toBase58(), 'TOKEN_X'),
                            decimals: 6,
                        },
                        tokenY: {
                            mint: dlmmInstance.tokenY.publicKey.toBase58(),
                            symbol: getSymbol(dlmmInstance.tokenY.publicKey.toBase58(), 'TOKEN_Y'),
                            decimals: 6,
                        },
                        binStep: dlmmInstance.lbPair.binStep,
                        feeBps: 0,
                        activeBin: activeBin.binId,
                        price: Number(activeBin.price),
                        tvl: 0,
                        volume24h: 0,
                        apr: 0,
                        isActive: true,
                        lastUpdated: new Date().toISOString(),
                        validationStatus: 'warning',
                    };
                } catch (onChainError) {
                    throw new Error(`Failed to fetch pool ${poolAddress}. API Error: ${apiError?.message}. On-chain Error: ${onChainError}`);
                }
            }

            try {
                const dlmm = dlmmInstance ?? await this.getDlmmInstance(poolAddress);
                dlmmInstance = dlmm;
                const activeBin = await dlmm.getActiveBin();

                const tokenXMint = dlmm.tokenX.publicKey.toBase58();
                const tokenYMint = dlmm.tokenY.publicKey.toBase58();
                const [tokenXDecimals, tokenYDecimals] = await Promise.all([
                    this.getTokenDecimals(tokenXMint),
                    this.getTokenDecimals(tokenYMint),
                ]);

                poolInfo.tokenX = {
                    mint: tokenXMint,
                    symbol: poolInfo.tokenX.symbol,
                    decimals: tokenXDecimals,
                };

                poolInfo.tokenY = {
                    mint: tokenYMint,
                    symbol: poolInfo.tokenY.symbol,
                    decimals: tokenYDecimals,
                };

                poolInfo.activeBin = activeBin.binId;
                poolInfo.price = this.calculateBinPrice(
                    activeBin.binId,
                    dlmm.lbPair.binStep,
                    tokenXDecimals,
                    tokenYDecimals
                );

            } catch (err) {
                console.warn(`⚠️ Failed to refresh on-chain data for ${poolAddress}: ${err}`);
                if ((!poolInfo.price || poolInfo.price === 0) && poolInfo.activeBin !== undefined && poolInfo.binStep) {
                    poolInfo.price = this.calculateBinPrice(
                        poolInfo.activeBin,
                        poolInfo.binStep,
                        poolInfo.tokenX.decimals,
                        poolInfo.tokenY.decimals
                    );
                }
            }

            return poolInfo;
        } catch (error) {
            throw new Error(`Failed to search pool by address: ${error}`);
        }
    }

    /**
     * Get pool information (Alias for searchPoolByAddress)
     */
    public async getPoolInfo(poolAddress: string): Promise<PoolInfo> {
        return this.searchPoolByAddress(poolAddress);
    }

    /**
     * Search pools by token symbols or names
     */
    public async searchPools(query: string): Promise<PoolInfo[]> {
        try {
            const allPools = await this.fetchAllPools();

            const filtered = allPools.filter((pool: any) => {
                const name = pool.name?.toLowerCase() || '';
                const queryLower = query.toLowerCase();
                return name.includes(queryLower);
            });

            return filtered.map((pool: any) => this.transformPoolData(pool));
        } catch (error) {
            throw new Error(`Failed to search pools: ${error}`);
        }
    }

    /**
     * Get top pools by TVL
     */
    public async getTopPoolsByTVL(limit: number = 10): Promise<PoolInfo[]> {
        try {
            const allPools = await this.fetchAllPools();

            const sorted = allPools.sort((a: any, b: any) => (b.tvl || 0) - (a.tvl || 0));
            const top = sorted.slice(0, limit);

            return top.map((pool: any) => this.transformPoolData(pool));
        } catch (error) {
            throw new Error(`Failed to get top pools: ${error}`);
        }
    }

    /**
     * Get top pools by APR
     */
    public async getTopPoolsByAPR(limit: number = 10): Promise<PoolInfo[]> {
        try {
            const allPools = await this.fetchAllPools();

            const sorted = allPools.sort((a: any, b: any) => (b.apr || 0) - (a.apr || 0));
            const top = sorted.slice(0, limit);

            return top.map((pool: any) => this.transformPoolData(pool));
        } catch (error) {
            throw new Error(`Failed to get top pools by APR: ${error}`);
        }
    }

    /**
     * Calculate bin price from bin ID
     */
    public calculateBinPrice(
        binId: number,
        binStep: number,
        tokenXDecimals: number = 6,
        tokenYDecimals: number = 6
    ): number {
        const rawPrice = Math.pow(1 + binStep / 10000, binId);
        const decimalAdjustment = Math.pow(10, tokenXDecimals - tokenYDecimals);
        return rawPrice * decimalAdjustment;
    }

    /**
     * Get price range for bins
     */
    public getPriceRange(
        minBinId: number,
        maxBinId: number,
        binStep: number,
        tokenXDecimals: number = 6,
        tokenYDecimals: number = 6
    ): {
        minPrice: number;
        maxPrice: number;
        centerPrice: number;
    } {
        return {
            minPrice: this.calculateBinPrice(minBinId, binStep, tokenXDecimals, tokenYDecimals),
            maxPrice: this.calculateBinPrice(maxBinId, binStep, tokenXDecimals, tokenYDecimals),
            centerPrice: this.calculateBinPrice(
                Math.floor((minBinId + maxBinId) / 2),
                binStep,
                tokenXDecimals,
                tokenYDecimals
            ),
        };
    }

    /**
     * Calculate APR from pool data
     */
    public calculateApr(fees24h: number, tvl: number): number {
        if (tvl === 0) return 0;
        return (fees24h * 365) / tvl * 100;
    }

    /**
     * Validate pool address
     */
    public async validatePool(poolAddress: string): Promise<boolean> {
        try {
            const pubkey = new PublicKey(poolAddress);
            await this.fetchPoolByAddress(poolAddress);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get pools by token pair
     */
    public async getPoolsByTokenPair(
        token1: string,
        token2: string
    ): Promise<PoolInfo[]> {
        try {
            const allPools = await this.fetchAllPools();

            const filtered = allPools.filter((pool: any) => {
                const name = pool.name?.toUpperCase() || '';
                const pair = `${token1.toUpperCase()}-${token2.toUpperCase()}`;
                const reversePair = `${token2.toUpperCase()}-${token1.toUpperCase()}`;
                return name === pair || name === reversePair;
            });

            return filtered.map((pool: any) => this.transformPoolData(pool));
        } catch (error) {
            throw new Error(`Failed to get pools by token pair: ${error}`);
        }
    }

    /**
     * Get pool statistics
     */
    public async getPoolStats(): Promise<{
        totalPools: number;
        totalTVL: number;
        averageAPR: number;
        topPoolByTVL: PoolInfo | null;
        topPoolByAPR: PoolInfo | null;
    }> {
        try {
            const allPools = await this.fetchAllPools();

            const totalPools = allPools.length;
            const totalTVL = allPools.reduce((sum: number, pool: any) => sum + (pool.tvl || 0), 0);
            const averageAPR = allPools.length > 0
                ? allPools.reduce((sum: number, pool: any) => sum + (pool.apr || 0), 0) / allPools.length
                : 0;

            const topByTVL = allPools.reduce((max: any, pool: any) =>
                (pool.tvl || 0) > (max.tvl || 0) ? pool : max, allPools[0] || null);

            const topByAPR = allPools.reduce((max: any, pool: any) =>
                (pool.apr || 0) > (max.apr || 0) ? pool : max, allPools[0] || null);

            const topPoolByTVL: PoolInfo | null = topByTVL ? this.transformPoolData(topByTVL) : null;
            const topPoolByAPR: PoolInfo | null = topByAPR ? this.transformPoolData(topByAPR) : null;

            return {
                totalPools,
                totalTVL,
                averageAPR,
                topPoolByTVL,
                topPoolByAPR,
            };
        } catch (error) {
            throw new Error(`Failed to get pool statistics: ${error}`);
        }
    }
}

// Export singleton instance
export const poolService = new PoolService();
