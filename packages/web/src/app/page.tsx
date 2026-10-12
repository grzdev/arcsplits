"use client";

import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  Zap,
  ArrowRight,
  Copy,
  Check,
  ExternalLink,
  Plus,
  Trash2,
  RefreshCw,
  Wallet,
  Code,
  ShieldCheck,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { ARC_NETWORKS, ARC_SPLITTER_ABI, ARC_FACTORY_ABI } from "../config/arc";

interface RecipientRow {
  address: string;
  percent: string;
}

export default function Home() {
  const [networkKey, setNetworkKey] = useState<string>("arcTestnet");
  const network = ARC_NETWORKS[networkKey];

  // Wallet State
  const [account, setAccount] = useState<string>("");
  const [balance, setBalance] = useState<string>("0");
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Active Split View
  const [splitAddress, setSplitAddress] = useState<string>(network.defaultSplit);
  const [splitData, setSplitData] = useState<any>(null);
  const [isLoadingSplit, setIsLoadingSplit] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Interactive Actions
  const [depositAmount, setDepositAmount] = useState<string>("1.0");
  const [isDepositing, setIsDepositing] = useState<boolean>(false);
  const [isDistributing, setIsDistributing] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string>("");

  // Tab
  const [activeTab, setActiveTab] = useState<"manage" | "create" | "sdk">("manage");

  // Create Form
  const [formName, setFormName] = useState<string>("My Platform Split");
  const [recipients, setRecipients] = useState<RecipientRow[]>([
    { address: "", percent: "70" },
    { address: "", percent: "30" },
  ]);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Connect Wallet
  async function connectWallet() {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("Please install an EVM wallet (MetaMask, Rabby, etc.) to connect.");
      return;
    }
    try {
      setIsConnecting(true);
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        const bal = await provider.getBalance(accounts[0]);
        setBalance(Number(ethers.formatEther(bal)).toFixed(4));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsConnecting(false);
    }
  }

  // Fetch Split Data
  async function loadSplit(addressToLoad = splitAddress) {
    if (!ethers.isAddress(addressToLoad)) return;
    try {
      setIsLoadingSplit(true);
      const provider = new ethers.JsonRpcProvider(network.rpcUrl);
      const contract = new ethers.Contract(addressToLoad, ARC_SPLITTER_ABI, provider);

      const [name, creator, recs, totalRec, totalRel] = await Promise.all([
        contract.name(),
        contract.creator(),
        contract.getRecipients(),
        contract.totalReceived(),
        contract.totalReleased(),
      ]);

      const recDetails = await Promise.all(
        recs.map(async (rec: string) => {
          const [share, releasableWei, releasedWei] = await Promise.all([
            contract.shareOf(rec),
            contract.releasable(rec),
            contract.released(rec),
          ]);
          return {
            address: rec,
            bps: Number(share),
            percent: Number(share) / 100,
            releasable: ethers.formatEther(releasableWei),
            released: ethers.formatEther(releasedWei),
          };
        })
      );

      const balWei = totalRec - totalRel;

      setSplitData({
        address: addressToLoad,
        name,
        creator,
        totalReceived: ethers.formatEther(totalRec),
        totalReleased: ethers.formatEther(totalRel),
        balance: ethers.formatEther(balWei),
        recipients: recDetails,
      });
    } catch (e: any) {
      console.error("Error loading split:", e);
    } finally {
      setIsLoadingSplit(false);
    }
  }

  useEffect(() => {
    loadSplit();
  }, [networkKey]);

  function copyAddress(addr: string) {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Deposit native USDC
  async function handleDeposit() {
    if (!account) return connectWallet();
    try {
      setIsDepositing(true);
      setActionSuccess("");
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      const tx = await signer.sendTransaction({
        to: splitAddress,
        value: ethers.parseEther(depositAmount),
      });
      await tx.wait();
      setActionSuccess(`Successfully sent ${depositAmount} USDC to split!`);
      loadSplit();
    } catch (e: any) {
      alert("Transaction failed: " + (e.message || e));
    } finally {
      setIsDepositing(false);
    }
  }

  // Distribute All
  async function handleDistribute() {
    if (!account) return connectWallet();
    try {
      setIsDistributing(true);
      setActionSuccess("");
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(splitAddress, ARC_SPLITTER_ABI, signer);

      const tx = await contract.distributeAll();
      await tx.wait();
      setActionSuccess("All funds successfully distributed to recipients!");
      loadSplit();
    } catch (e: any) {
      alert("Distribution failed: " + (e.message || e));
    } finally {
      setIsDistributing(false);
    }
  }

  // Create Split Form Handlers
  function addRecipient() {
    setRecipients([...recipients, { address: "", percent: "0" }]);
  }

  function removeRecipient(idx: number) {
    setRecipients(recipients.filter((_, i) => i !== idx));
  }

  function updateRecipient(idx: number, field: "address" | "percent", val: string) {
    const updated = [...recipients];
    updated[idx][field] = val;
    setRecipients(updated);
  }

  const totalPercent = recipients.reduce((acc, r) => acc + (parseFloat(r.percent) || 0), 0);

  async function handleCreateSplit(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return connectWallet();
    if (Math.abs(totalPercent - 100) > 0.01) {
      alert("Allocations must total exactly 100%!");
      return;
    }

    try {
      setIsCreating(true);
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const factory = new ethers.Contract(network.factoryAddress, ARC_FACTORY_ABI, signer);

      const addrs = recipients.map((r) => r.address.trim());
      const sharesBps = recipients.map((r) => Math.round(parseFloat(r.percent) * 100));

      const tx = await factory.createSplit(formName, addrs, sharesBps);
      const receipt = await tx.wait();

      const event = receipt.logs
        .map((log: any) => {
          try {
            return factory.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((evt: any) => evt && evt.name === "SplitCreated");

      const newAddr = event?.args?.splitAddress;
      if (newAddr) {
        setSplitAddress(newAddr);
        setActiveTab("manage");
        loadSplit(newAddr);
        alert("Split successfully deployed at: " + newAddr);
      }
    } catch (e: any) {
      alert("Creation failed: " + (e.message || e));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#090B0E] text-[#E6E8EC]">
      {/* Top Navbar */}
      <header className="border-b border-[#1E232F] bg-[#0E1117]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#0A84FF]/10 border border-[#0A84FF]/30 flex items-center justify-center text-[#0A84FF]">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight">ArcSplits</span>
              <span className="ml-2 text-xs font-mono px-2 py-0.5 rounded bg-[#0A84FF]/10 text-[#0A84FF] border border-[#0A84FF]/20">
                L1 USDC Primitive
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Network Toggle */}
            <select
              value={networkKey}
              onChange={(e) => setNetworkKey(e.target.value)}
              className="bg-[#141822] border border-[#222838] text-xs font-mono rounded-lg px-3 py-2 text-[#A2AAB8] focus:outline-none focus:border-[#0A84FF]"
            >
              <option value="arcTestnet">Arc Testnet (5042002)</option>
              <option value="arcMainnet">Arc Mainnet (5042)</option>
            </select>

            {account ? (
              <div className="flex items-center gap-2 bg-[#141822] border border-[#222838] px-3 py-1.5 rounded-lg text-xs font-mono">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
                <span className="text-[#6C768A]">({balance} USDC)</span>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="flex items-center gap-2 bg-[#0A84FF] hover:bg-[#0070E0] text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
              >
                <Wallet className="h-3.5 w-3.5" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="py-12 border-b border-[#1A1F2C] bg-gradient-to-b from-[#0E121B] to-[#090B0E]">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Zero Token Wrapping · Pure Native USDC
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
            Composable Native USDC Revenue Splitting
          </h1>
          <p className="max-w-2xl mx-auto text-[#8F9BAE] text-sm md:text-base leading-relaxed mb-6">
            Deploy trustless, automated payment splitters for creator collaborations, marketplace fees, and platform royalties on Arc L1.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
            <div className="bg-[#121620] border border-[#1E2432] p-4 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-mono text-[#0A84FF] mb-1">
                <ShieldCheck className="h-4 w-4" /> Non-Custodial & Immutable
              </div>
              <p className="text-xs text-[#8F9BAE]">
                Recipients and shares are fixed at deployment. No rugpulls, no intermediary custody.
              </p>
            </div>
            <div className="bg-[#121620] border border-[#1E2432] p-4 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-1">
                <Zap className="h-4 w-4" /> Native Gas Settlement
              </div>
              <p className="text-xs text-[#8F9BAE]">
                Direct native 18-decimal USDC value transfers with sub-second finality and predictable fees.
              </p>
            </div>
            <div className="bg-[#121620] border border-[#1E2432] p-4 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-mono text-purple-400 mb-1">
                <Layers className="h-4 w-4" /> Dual Pull + Push Payouts
              </div>
              <p className="text-xs text-[#8F9BAE]">
                Recipients claim individually or anyone can trigger a batch distribute in one single transaction.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Interactive Workspace */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-[#1E2432] mb-8 pb-3">
          <button
            onClick={() => setActiveTab("manage")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
              activeTab === "manage"
                ? "bg-[#0A84FF] text-white"
                : "text-[#8F9BAE] hover:text-white hover:bg-[#141822]"
            }`}
          >
            <Layers className="h-4 w-4" /> Live Split Dashboard
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
              activeTab === "create"
                ? "bg-[#0A84FF] text-white"
                : "text-[#8F9BAE] hover:text-white hover:bg-[#141822]"
            }`}
          >
            <Plus className="h-4 w-4" /> Deploy New Split
          </button>
          <button
            onClick={() => setActiveTab("sdk")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
              activeTab === "sdk"
                ? "bg-[#0A84FF] text-white"
                : "text-[#8F9BAE] hover:text-white hover:bg-[#141822]"
            }`}
          >
            <Code className="h-4 w-4" /> SDK & Builder Integration
          </button>
        </div>

        {/* Tab 1: Live Split View */}
        {activeTab === "manage" && (
          <div className="space-y-6">
            {/* Split Search Bar */}
            <div className="bg-[#121620] border border-[#1E2432] p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="flex-1 w-full">
                <label className="block text-xs font-mono text-[#8F9BAE] mb-1">
                  Query Split Contract Address:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={splitAddress}
                    onChange={(e) => setSplitAddress(e.target.value)}
                    placeholder="0x..."
                    className="flex-1 bg-[#090B0E] border border-[#222838] px-3 py-2 rounded-lg font-mono text-xs text-[#E6E8EC] focus:outline-none focus:border-[#0A84FF]"
                  />
                  <button
                    onClick={() => loadSplit(splitAddress)}
                    disabled={isLoadingSplit}
                    className="px-4 py-2 bg-[#1B212D] hover:bg-[#232B3B] text-xs font-semibold rounded-lg flex items-center gap-2 transition"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingSplit ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            {splitData && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Overview Card */}
                <div className="lg:col-span-2 bg-[#121620] border border-[#1E2432] rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold">{splitData.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs text-[#8F9BAE]">
                          {splitData.address}
                        </span>
                        <button
                          onClick={() => copyAddress(splitData.address)}
                          className="text-[#8F9BAE] hover:text-white"
                        >
                          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <a
                          href={`${network.explorerUrl}/address/${splitData.address}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#0A84FF] hover:underline inline-flex items-center text-xs font-mono"
                        >
                          Explorer <ArrowUpRight className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Financial Metrics */}
                  <div className="grid grid-cols-3 gap-4 bg-[#090B0E] border border-[#1E2432] p-4 rounded-xl mb-6">
                    <div>
                      <span className="text-xs text-[#8F9BAE] block">Total Received</span>
                      <span className="text-lg font-bold font-mono text-emerald-400">
                        {Number(splitData.totalReceived).toFixed(4)} USDC
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-[#8F9BAE] block">Already Released</span>
                      <span className="text-lg font-bold font-mono text-[#0A84FF]">
                        {Number(splitData.totalReleased).toFixed(4)} USDC
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-[#8F9BAE] block">Available in Split</span>
                      <span className="text-lg font-bold font-mono text-white">
                        {Number(splitData.balance).toFixed(4)} USDC
                      </span>
                    </div>
                  </div>

                  {/* Beneficiaries Table */}
                  <h3 className="font-bold text-sm mb-3">Beneficiary Allocations</h3>
                  <div className="space-y-2">
                    {splitData.recipients.map((rec: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-[#090B0E] border border-[#1A1F2C] p-3 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-6 w-6 rounded bg-[#1B212D] flex items-center justify-center font-mono font-bold text-[#8F9BAE]">
                            #{idx + 1}
                          </div>
                          <div>
                            <span className="font-mono block text-[#E6E8EC]">
                              {rec.address}
                            </span>
                            <span className="text-[#6C768A]">
                              Share: <b className="text-white">{rec.percent}%</b> ({rec.bps} BPS)
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="block font-mono text-emerald-400 font-semibold">
                            {Number(rec.releasable).toFixed(4)} USDC Owed
                          </span>
                          <span className="text-[#6C768A] font-mono text-[11px]">
                            {Number(rec.released).toFixed(4)} USDC Claimed
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Actions Card */}
                <div className="space-y-6">
                  {/* Test Deposit Box */}
                  <div className="bg-[#121620] border border-[#1E2432] rounded-xl p-5">
                    <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-emerald-400" /> Deposit Native USDC
                    </h3>
                    <p className="text-xs text-[#8F9BAE] mb-4">
                      Send native USDC directly into this split contract. Funds are instantly split proportionally.
                    </p>

                    <div className="mb-4">
                      <label className="block text-xs font-mono text-[#8F9BAE] mb-1">
                        Amount (USDC):
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="w-full bg-[#090B0E] border border-[#222838] px-3 py-2 rounded-lg font-mono text-sm text-[#E6E8EC] focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <button
                      onClick={handleDeposit}
                      disabled={isDepositing}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2.5 rounded-lg transition"
                    >
                      {isDepositing ? "Broadcasting..." : `Deposit ${depositAmount} USDC`}
                    </button>
                  </div>

                  {/* Batch Distribution Box */}
                  <div className="bg-[#121620] border border-[#1E2432] rounded-xl p-5">
                    <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                      <Layers className="h-4 w-4 text-[#0A84FF]" /> Batch Distribute All
                    </h3>
                    <p className="text-xs text-[#8F9BAE] mb-4">
                      Anyone can call <code className="bg-[#090B0E] px-1 py-0.5 rounded text-[11px]">distributeAll()</code> to push all accrued balances to all beneficiaries in one atomic transaction.
                    </p>

                    <button
                      onClick={handleDistribute}
                      disabled={isDistributing || parseFloat(splitData.balance) <= 0}
                      className="w-full bg-[#0A84FF] hover:bg-[#0070E0] disabled:bg-gray-800 disabled:text-gray-500 text-white font-semibold text-xs py-2.5 rounded-lg transition"
                    >
                      {isDistributing ? "Distributing..." : "Execute Batch Distribution"}
                    </button>
                  </div>

                  {actionSuccess && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-mono">
                      ✓ {actionSuccess}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Create Split Form */}
        {activeTab === "create" && (
          <div className="max-w-2xl mx-auto bg-[#121620] border border-[#1E2432] rounded-xl p-6">
            <h2 className="text-xl font-bold mb-2">Deploy a New ArcSplit</h2>
            <p className="text-xs text-[#8F9BAE] mb-6">
              Create an immutable revenue split contract on {network.name}. Allocations must sum to 100%.
            </p>

            <form onSubmit={handleCreateSplit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-[#8F9BAE] mb-1">
                  Split Identifier / Name:
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#090B0E] border border-[#222838] px-3 py-2 rounded-lg font-mono text-sm text-[#E6E8EC] focus:outline-none focus:border-[#0A84FF]"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-mono text-[#8F9BAE]">
                    Beneficiary Recipients & Percentage Shares:
                  </label>
                  <span
                    className={`text-xs font-mono font-bold ${
                      Math.abs(totalPercent - 100) < 0.01 ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    Total: {totalPercent.toFixed(1)}% / 100%
                  </span>
                </div>

                <div className="space-y-2">
                  {recipients.map((rec, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="0xRecipientAddress..."
                        value={rec.address}
                        onChange={(e) => updateRecipient(idx, "address", e.target.value)}
                        className="flex-1 bg-[#090B0E] border border-[#222838] px-3 py-2 rounded-lg font-mono text-xs text-[#E6E8EC] focus:outline-none focus:border-[#0A84FF]"
                        required
                      />
                      <div className="w-24 relative">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="%"
                          value={rec.percent}
                          onChange={(e) => updateRecipient(idx, "percent", e.target.value)}
                          className="w-full bg-[#090B0E] border border-[#222838] px-3 py-2 rounded-lg font-mono text-xs text-[#E6E8EC] focus:outline-none focus:border-[#0A84FF]"
                          required
                        />
                        <span className="absolute right-3 top-2 text-xs text-[#6C768A]">%</span>
                      </div>
                      {recipients.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeRecipient(idx)}
                          className="text-[#6C768A] hover:text-red-400 p-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addRecipient}
                  className="mt-3 text-xs font-mono text-[#0A84FF] hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Another Recipient
                </button>
              </div>

              <div className="pt-4 border-t border-[#1E2432]">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full bg-[#0A84FF] hover:bg-[#0070E0] disabled:bg-gray-800 text-white font-semibold text-sm py-3 rounded-lg transition"
                >
                  {isCreating ? "Deploying on Arc..." : "Deploy Split Contract"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: SDK Integration Guide */}
        {activeTab === "sdk" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-[#121620] border border-[#1E2432] rounded-xl p-6">
              <h2 className="text-xl font-bold mb-2">Integrate ArcSplits Into Your App</h2>
              <p className="text-xs text-[#8F9BAE] mb-6">
                Are you building on Arc? Whether you're using <code className="bg-[#090B0E] px-1 py-0.5 rounded text-[#0A84FF]">arc-commerce</code>, an agent marketplace, or a creator platform, you can plug in ArcSplits in minutes.
              </p>

              <h3 className="font-mono text-xs text-white uppercase tracking-wider mb-2">
                1. Plug Into arc-commerce Checkout
              </h3>
              <p className="text-xs text-[#8F9BAE] mb-2">
                Set your store's payment destination directly to an ArcSplitter contract address to split checkout sales automatically:
              </p>
              <pre className="bg-[#090B0E] border border-[#1E2432] p-4 rounded-lg font-mono text-xs text-[#E6E8EC] overflow-x-auto mb-6">
{`// In your arc-commerce or e-commerce payment flow:
const splitAddress = "0x3a6a2168034Bfa6de1B8236Abe862CB2E9CAFBE7";

// Customer pays exact USDC directly to the split contract:
const tx = await customerSigner.sendTransaction({
  to: splitAddress,
  value: ethers.parseEther("50.00"), // $50 native USDC
});
await tx.wait();

// 70% ($35 USDC) is instantly credited to merchant
// 30% ($15 USDC) is instantly credited to protocol fee`}
              </pre>

              <h3 className="font-mono text-xs text-white uppercase tracking-wider mb-2">
                2. Programmatic Creation via @arcsplits/sdk
              </h3>
              <pre className="bg-[#090B0E] border border-[#1E2432] p-4 rounded-lg font-mono text-xs text-[#E6E8EC] overflow-x-auto">
{`import { ArcSplitsClient } from "@arcsplits/sdk";

const client = new ArcSplitsClient(factoryAddress, signer);

// Deploy a split dynamically for any customer or creator:
const splitAddress = await client.createSplit(
  "Marketplace Affiliate Split",
  ["0xCreator...", "0xPlatformFee..."],
  [9500, 500] // 95% to creator, 5% to platform
);`}
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1A1F2C] py-8 text-center text-xs text-[#6C768A]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            ArcSplits · Open Source Infrastructure for Circle's Arc L1 Blockchain
          </div>
          <div className="flex gap-4 font-mono">
            <a
              href="https://github.com/grzdev/arcsplits"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              GitHub Repo
            </a>
            <a
              href="https://arc-showcase.thecanteenapp.com/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              Canteen Showcase
            </a>
            <a
              href="https://docs.arc.io"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              Arc Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
