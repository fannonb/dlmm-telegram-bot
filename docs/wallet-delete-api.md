# 🗑️ Wallet Delete Functionality - API Reference

## Overview

The DLMM CLI includes comprehensive wallet deletion capabilities that safely remove wallets while maintaining system integrity.

## API Method

```typescript
walletService.deleteWallet(publicKey: string): void
```

## Features

### ✅ Safe Deletion
- Removes wallet from configuration
- Automatically handles active wallet reassignment
- Maintains system integrity

### ✅ Smart Active Wallet Management
- If deleting a **non-active wallet**: Active wallet remains unchanged
- If deleting the **active wallet**: Automatically sets first remaining wallet as active
- If **no wallets remain**: Sets active wallet to `null`

### ✅ Error Resilience
- Gracefully handles attempts to delete non-existent wallets
- System remains functional after any deletion operation

## Usage Examples

### 1. Basic Wallet Deletion

```typescript
import { walletService } from './src/services/wallet.service';

// Get wallet to delete
const wallets = walletService.listWallets();
const walletToDelete = wallets[0];

// Delete the wallet
walletService.deleteWallet(walletToDelete.publicKey);

console.log('Wallet deleted successfully!');
```

### 2. Safe Active Wallet Deletion

```typescript
// Check if wallet is active before deletion
const activeWallet = walletService.getActiveWallet();
const walletToDelete = walletService.getWallet('some-public-key');

console.log(`Deleting: ${walletToDelete?.name}`);
console.log(`Was active: ${activeWallet?.publicKey === walletToDelete?.publicKey}`);

walletService.deleteWallet('some-public-key');

const newActiveWallet = walletService.getActiveWallet();
console.log(`New active wallet: ${newActiveWallet?.name || 'None'}`);
```

### 3. Complete Wallet Cleanup

```typescript
// Delete all wallets
const allWallets = walletService.listWallets();

allWallets.forEach(wallet => {
    console.log(`Deleting: ${wallet.name}`);
    walletService.deleteWallet(wallet.publicKey);
});

console.log(`Wallets remaining: ${walletService.listWallets().length}`);
console.log(`Active wallet: ${walletService.getActiveWallet() || 'None'}`);
```

### 4. Conditional Deletion with Verification

```typescript
function deleteWalletSafely(publicKey: string) {
    const wallet = walletService.getWallet(publicKey);
    
    if (!wallet) {
        console.log('Wallet not found');
        return false;
    }
    
    const isActive = walletService.getActiveWallet()?.publicKey === publicKey;
    const walletCount = walletService.listWallets().length;
    
    console.log(`Deleting ${wallet.name}`);
    console.log(`Is active: ${isActive}`);
    console.log(`Will have ${walletCount - 1} wallets remaining`);
    
    walletService.deleteWallet(publicKey);
    
    if (isActive && walletCount > 1) {
        const newActive = walletService.getActiveWallet();
        console.log(`New active wallet: ${newActive?.name}`);
    }
    
    return true;
}
```

## Behavior Summary

| Scenario | Behavior |
|----------|----------|
| **Delete non-active wallet** | ✅ Wallet removed, active wallet unchanged |
| **Delete active wallet (others exist)** | ✅ Wallet removed, first remaining wallet becomes active |
| **Delete last wallet** | ✅ Wallet removed, active wallet set to `null` |
| **Delete non-existent wallet** | ✅ Operation handled gracefully, no error |

## Integration with Configuration

The delete functionality automatically:
- Updates `config.json` file
- Removes wallet from `wallets` array
- Updates `activeWallet` field appropriately
- Maintains encrypted storage integrity

## CLI Integration (Future)

```bash
# Delete specific wallet
dlmm wallet delete <public-key>

# Delete wallet interactively
dlmm wallet delete --interactive

# Delete all wallets
dlmm wallet delete --all
```

## Security Notes

⚠️ **Important**: 
- Deletion is **permanent** - make sure to backup mnemonics/private keys
- Deleted wallets cannot be recovered from the application
- Always verify you have mnemonic backups before deletion
