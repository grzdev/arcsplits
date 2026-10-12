# ⚡ ArcSplits

> **Composable Native USDC Revenue Splitting & Payout Primitive for Circle's Arc L1 Blockchain.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Network](https://img.shields.io/badge/Network-Arc%20L1%20(5042%20%2F%205042002)-0A84FF.svg)](https://docs.arc.io)
[![Native Gas](https://img.shields.io/badge/Gas%20Token-Native%20USDC-emerald.svg)](https://docs.arc.io)
[![Tests](https://img.shields.io/badge/Tests-13%20Passing-brightgreen.svg)](#smart-contracts)

---

## 📖 Overview

**ArcSplits** is an open-source, trustless infrastructure primitive built specifically for the **Arc Layer 1 blockchain** (Circle's stablecoin-native chain where USDC is the native gas token).

On standard blockchains, revenue splitting requires wrapping ETH into WETH or dealing with complex ERC-20 allowances. On Arc, **USDC is the native gas and balance currency**, meaning transactions directly accept, transfer, and distribute real USDC with zero intermediate wrappers and ultra-low predictable gas fees (~20 Gwei).

### Key Features
* 🛡️ **Non-Custodial & Immutable**: Allocations are locked in basis points ($10,000 \text{ BPS} = 100.00\%$) upon creation. No rugpulls, no central custody.
* ⚡ **Pure Native USDC Transfers**: Directly accepts incoming native 18-decimal USDC payments via `receive()`.
* 🪙 **Dual Token Support**: Simultaneously routes native USDC and ERC-20 stablecoins (such as ERC-20 USDC `0x3600...0000` or EURC).
* 🔄 **Pull & Push Distribution**:
  * **Pull**: Beneficiaries can individually claim accrued funds via `release()`.
  * **Push**: Anyone can permissionlessly trigger `distributeAll()` in a single transaction to disburse all accumulated balances.
* 📦 **Modular SDK**: Includes `@arcsplits/sdk` so other Arc builders can integrate splits into e-commerce checkouts (`arc-commerce`) or creator flows in 3 lines of code.

---

## 🎯 Answers for the Arc Showcase Reviewers

### 1. What primitives are you exposing that other builders could find useful?
We expose **`ArcSplitter.sol`**, **`ArcSplitFactory.sol`**, and the **`@arcsplits/sdk`** TypeScript library. Together, they provide a standardized, reusable primitive for multi-party revenue routing on Arc. Any developer building an e-commerce platform, digital goods store, DAO treasury, or agentic task marketplace can fork or import this primitive instead of building custom escrow/splitting logic from scratch.

### 2. Compared to existing reference code (`circlefin/arc-*`), what tools and flows do you add?
Reference codebases like [`circlefin/arc-commerce`](https://github.com/circlefin/arc-commerce) and [`circlefin/arc-p2p-payments`](https://github.com/circlefin/arc-p2p-payments) handle strictly **1-to-1 payments** ($Customer \rightarrow Merchant$). 

ArcSplits introduces **1-to-N automated settlement**, enabling:
* **Marketplace platform take-rates** (e.g., 95% creator / 5% platform).
* **Affiliate & referral commissions** calculated on-chain at sub-second finality.
* **Co-founder & contributor payroll distribution** without intermediate token wrapping.

---

## 📍 Deployed Contracts

### Arc Testnet (Chain ID: `5042002`)
* **`ArcSplitFactory`**: [`0x90348F9A58a95d1f81b7Be6AFD874Cb4b6879D36`](https://testnet.arcscan.app/address/0x90348F9A58a95d1f81b7Be6AFD874Cb4b6879D36)
* **Showcase Split**: [`0x3a6a2168034Bfa6de1B8236Abe862CB2E9CAFBE7`](https://testnet.arcscan.app/address/0x3a6a2168034Bfa6de1B8236Abe862CB2E9CAFBE7)

### Arc Mainnet (Chain ID: `5042`)
* *Deployment in progress — verified on Arc Blockscout explorer.*

---

## 📂 Repository Structure

```
arcsplits/
├── packages/
│   ├── contracts/     # Solidity smart contracts, Hardhat tests & deployment scripts
│   ├── sdk/           # Standalone @arcsplits/sdk TypeScript package
│   └── web/           # Modern Next.js 14 interactive dashboard & split builder
├── docs/
│   ├── ARCHITECTURE.md # In-depth technical specification
│   └── INTEGRATION.md  # Step-by-step guide for integrating with arc-commerce
└── README.md
```

---

## 🚀 Quick Start

### 1. Smart Contracts
```bash
cd packages/contracts
npm install
npm test            # Run 13 unit tests covering allocations, math, and reentrancy
```

### 2. SDK Usage
```typescript
import { ArcSplitsClient } from "@arcsplits/sdk";

const client = new ArcSplitsClient(factoryAddress, signer);

// Create a 70/30 split between two collaborators
const splitAddress = await client.createSplit(
  "Collab Split",
  ["0xAlice...", "0xBob..."],
  [7000, 3000] // 70.0% and 30.0%
);
```

### 3. Web Dashboard
```bash
cd packages/web
npm install
npm run dev         # Runs interactive UI at http://localhost:3000
```

---

## 📄 License
MIT © [Dami Oyeniyi](https://github.com/grzdev)
