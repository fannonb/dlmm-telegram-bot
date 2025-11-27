# 🖥️ DLMM CLI - Interactive Testing Interface

## 🚀 **Getting Started**

The DLMM CLI provides an interactive terminal interface to test and manage all implemented wallet functionalities. No more running individual test scripts - everything is accessible through beautiful menus!

## 📋 **Available Commands**

### Quick Launch Commands
```bash
# Start interactive CLI (main menu)
npm run cli

# Direct access to interactive mode
npm run cli:interactive

# Quick access to wallet management
npm run cli:wallet

# Legacy test scripts (still available)
npm run test:wallet
npm run test:config
```

### Development Commands
```bash
# Compile TypeScript
npm run build

# Run development mode
npm run dev

# Clean build files
npm run clean
```

## 🎯 **CLI Features Overview**

### 🔑 **Wallet Management**
- **Create New Wallet**: Generate wallet with secure mnemonic
- **Import from Mnemonic**: Import existing wallet using 12-word phrase
- **Import from Private Key**: Import using base58 private key
- **List All Wallets**: View all stored wallets with details
- **Set Active Wallet**: Switch between multiple wallets
- **Export Private Key**: Securely export private keys
- **Delete Wallet**: Remove wallets with smart active management

### 📊 **System Status**
- **Configuration View**: Current settings and preferences
- **System Health**: Check all components status
- **Feature Status**: Implementation progress tracker
- **Statistics**: Wallet counts, dates, and system info

### 🔗 **Connection Settings**
- **RPC Management**: Switch between endpoints
- **Commitment Levels**: Configure transaction commitment
- **Network Selection**: Mainnet/Devnet switching
- *(Available after Phase 2.2 implementation)*

### ⚙️ **Configuration**
- **Settings Overview**: View all configuration values
- **Automation Settings**: Rebalancing and compounding config
- **Transaction Settings**: Slippage, fees, and simulation
- **User Preferences**: Display and notification settings

## 🎨 **User Interface Features**

### Visual Elements
- **Colorized Output**: Green for success, red for errors, blue for info
- **Status Indicators**: ⭐ for active wallets, ✅ for success, ❌ for errors
- **Progress Indicators**: Real-time feedback during operations
- **Clear Navigation**: Intuitive menu structure with breadcrumbs

### User Experience
- **Input Validation**: All inputs are validated before processing
- **Confirmation Prompts**: Important operations require confirmation
- **Error Handling**: Graceful error messages with helpful suggestions
- **Help Text**: Context-sensitive help and warnings

## 📖 **Step-by-Step Usage Examples**

### Example 1: Creating Your First Wallet

1. **Start CLI**:
   ```bash
   npm run cli
   ```

2. **Navigation**:
   - Select `🔑 Wallet Management`
   - Choose `➕ Create New Wallet`

3. **Wallet Creation**:
   - Enter wallet name: `My Trading Wallet`
   - CLI generates secure mnemonic
   - Wallet becomes active automatically

4. **Result**:
   ```
   ✅ WALLET CREATED SUCCESSFULLY!
   
   📋 Wallet Details:
      Name: My Trading Wallet
      Public Key: 7xKjRm9LpqW3...
      Status: ⭐ ACTIVE
   
   🔐 IMPORTANT - SAVE YOUR RECOVERY PHRASE:
      abandon ability able about above absent absorb abstract absurd abuse access accident
   ```

### Example 2: Managing Multiple Wallets

1. **Create Multiple Wallets**:
   - Create `Primary Wallet`
   - Create `Backup Wallet`
   - Import `External Wallet`

2. **Switch Active Wallet**:
   - Go to Wallet Management
   - Select `🎯 Set Active Wallet`
   - Choose from list of wallets

3. **View All Wallets**:
   - Select `📋 List All Wallets`
   - See detailed information for each wallet

### Example 3: Safe Wallet Deletion

1. **Navigate to Delete**:
   - Wallet Management → `🗑️ Delete Wallet`

2. **Select Target**:
   - Choose wallet from list
   - System shows warnings if deleting active wallet

3. **Confirmation**:
   - Confirm deletion (double-check required)
   - System automatically manages active wallet reassignment

## 🔒 **Security Features**

### Encryption
- **AES-256 Encryption**: All private keys encrypted at rest
- **Environment Variables**: Encryption key stored securely
- **No Plaintext Storage**: Keys never stored in plaintext

### Warnings and Confirmations
- **Export Warnings**: Clear warnings when exporting private keys
- **Deletion Confirmations**: Multiple confirmations for destructive actions
- **Active Wallet Notifications**: Clear indication of active wallet changes

### Best Practices
- **Mnemonic Backup**: Always save recovery phrases securely
- **Private Key Security**: Never share exported private keys
- **Regular Backups**: Export and backup important wallets

## 🛠️ **Troubleshooting**

### Common Issues

**Q: "ENCRYPTION_KEY not found" error?**
A: Check your `.env` file contains `ENCRYPTION_KEY` with 32+ characters

**Q: CLI won't start?**
A: Run `npm run build` first, then try `npm run cli`

**Q: Can't import wallet?**
A: Verify mnemonic has exactly 12 words or private key is valid base58

**Q: Wallet disappeared?**
A: Check `data/config.json` - wallets are persisted there

### Debug Commands
```bash
# Test CLI startup
npx ts-node tests/test-cli-startup.ts

# Test wallet functionality
npm run test:wallet

# Check configuration
npm run test:config

# Compile and check for errors
npm run build
```

## 🎯 **What's Next?**

The CLI will be continuously enhanced as new phases are implemented:

- **Phase 2.2**: Connection management with RPC testing
- **Phase 2.3**: Swap service integration and testing  
- **Phase 2.4**: Pool discovery and management
- **Phase 3**: Position creation and management
- **Phase 4**: Fee claiming and compounding
- **Phase 5**: Automated rebalancing
- **Phase 6**: Full automation engine

Each phase will add new menus and testing capabilities to the CLI!

## 🎉 **Ready to Test!**

Your interactive DLMM CLI is ready for comprehensive wallet testing. Launch it now and explore all the features:

```bash
npm run cli
```

Happy testing! 🚀
