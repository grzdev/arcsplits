# ArcSplits Architecture Specification

## Overview

**ArcSplits** is an open-source, trustless, and composable revenue-splitting primitive built natively for **Arc L1** (Circle's stablecoin-native Layer 1 blockchain).

On standard EVM networks (like Ethereum, Base, or Arbitrum), value splitting requires wrapping ETH into WETH or relying on ERC-20 token approval gymnastics. On Arc, **USDC is the native gas and balance currency**, meaning transactions directly accept, transfer, and distribute real USDC with zero intermediate wrappers and ultra-low predictable gas fees (~20 Gwei).

```
                 Incoming Native USDC Payment
                   (e.g., Checkout / Tip / Fee)
                               │
                               ▼
               ┌───────────────────────────────┐
               │         ArcSplitter           │
               │  - Immutable Recipients       │
               │  - Immutable Basis Points     │
               └───────────────┬───────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
       ┌───────────────┐               ┌───────────────┐
       │  Recipient A  │               │  Recipient B  │
       │    (70.0%)    │               │    (30.0%)    │
       └───────────────┘               └───────────────┘
```

## Smart Contracts

### 1. `ArcSplitter.sol`
* **Basis Points System**: Allocations are defined in basis points ($10,000 \text{ BPS} = 100.00\%$).
* **Dual Payment Support**:
  * Native USDC (18 decimals): Delivered via `receive()` and distributed with `.call{value: amount}("")`.
  * ERC-20 Tokens (6 decimals): Supports ERC-20 USDC (`0x3600...0000`), EURC, and custom tokens.
* **Pull-over-Push Security**:
  * Individual recipients can claim their own accrued funds at any time using `release()`.
  * Prevents griefing from malicious recipient contracts attempting to revert batch transfers.
* **Permissionless Batch Distribution**:
  * `distributeAll()` allows anyone (e.g. bots, merchants, or any beneficiary) to push all currently owed funds to all recipients in a single transaction.

### 2. `ArcSplitFactory.sol`
* Serves as an on-chain deployment factory and decentralized registry.
* Indexes all created splits by creator and by beneficiary.
* Emits `SplitCreated` events containing the split address, creator, human-readable name, and recipient allocations.
* Exposes paginated views (`getSplits(offset, limit)`) to power frontends and indexers without subgraph dependencies.

## Security & Safety Guarantees

1. **Non-custodial & Immutable**: Once deployed, recipient allocations cannot be rugpulled or altered.
2. **Reentrancy Protection**: State updates (`_releasedNative[recipient] += payment`) are executed strictly prior to external value transfers, conforming to the Checks-Effects-Interactions pattern.
3. **Integer Precision**: Rounding errors are mathematically bounded and safely favor the pool, preventing any insolvency or overflow.
