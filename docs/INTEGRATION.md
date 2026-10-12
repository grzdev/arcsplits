# ArcSplits Integration Guide for Arc Builders

This guide shows how other Arc developers can integrate **ArcSplits** directly into their applications, contracts, and checkouts.

---

## 1. Integrating with `arc-commerce` (Merchant Checkouts)

In standard [`arc-commerce`](https://github.com/circlefin/arc-commerce), orders settle 100% of payment into a single merchant address:

```typescript
// Standard arc-commerce single-merchant flow:
const paymentTx = {
  to: MERCHANT_WALLET,
  value: parseEther("25.00"), // $25 native USDC
};
```

To automatically route marketplace platform fees, affiliate commissions, or co-founder shares, simply point the order's recipient address to an `ArcSplitter` contract:

```typescript
// ArcSplits-powered multi-party checkout flow:
const SPLIT_ADDRESS = "0x3a6a2168034Bfa6de1B8236Abe862CB2E9CAFBE7";

// Customer pays exact USDC directly to the split:
const tx = await signer.sendTransaction({
  to: SPLIT_ADDRESS,
  value: parseEther("25.00"),
});
await tx.wait();

// Settlement is instant on Arc L1:
// - Merchant receives 70% ($17.50 USDC)
// - Platform fee / Affiliate receives 30% ($7.50 USDC)
// No ERC-20 approval or wrapping required!
```

---

## 2. Programmatic Creation with `@arcsplits/sdk`

Install the SDK in your project:

```bash
npm install @arcsplits/sdk ethers
```

Create new splits programmatically from your backend or frontend:

```typescript
import { ArcSplitsClient, ARC_NETWORKS } from "@arcsplits/sdk";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://rpc.mainnet.arc.io");
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

const factoryAddress = "0x90348F9A58a95d1f81b7Be6AFD874Cb4b6879D36";
const client = new ArcSplitsClient(factoryAddress, signer);

// Deploy a split with 85% creator, 10% co-host, 5% platform fee
const splitAddress = await client.createSplit(
  "Podcast Episode #42 Revenue",
  [
    "0xCreatorAddress...",
    "0xCoHostAddress...",
    "0xPlatformFeeAddress..."
  ],
  [8500, 1000, 500] // Basis points summing to 10000
);

console.log("New split deployed at:", splitAddress);
```

---

## 3. Direct Solidity Contract Integration

If your smart contract sells goods, tickets, or mints NFTs on Arc, you can send funds straight to an `ArcSplitter`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IArcSplitter {
    function distributeAll() external;
}

contract TicketLaunchpad {
    address payable public immutable splitRecipient;

    constructor(address payable splitAddress) {
        splitRecipient = splitAddress;
    }

    function buyTicket() external payable {
        require(msg.value == 10 ether, "Ticket costs 10 USDC");

        // Forward native USDC directly to the split contract
        (bool success, ) = splitRecipient.call{value: msg.value}("");
        require(success, "Payment forwarding failed");
    }
}
```

---

## 4. Querying Split Status & Distributing

```typescript
const metadata = await client.getSplitMetadata(splitAddress);
console.log(`Balance available in split: ${metadata.balanceUSDC} USDC`);

// Distribute all accumulated funds in one atomic transaction:
await client.distributeAll(splitAddress);
```
