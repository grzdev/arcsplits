export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  factoryAddress: string;
  defaultSplit: string;
}

export const ARC_NETWORKS: Record<string, NetworkConfig> = {
  arcMainnet: {
    name: "Arc Mainnet",
    chainId: 5042,
    rpcUrl: "https://rpc.mainnet.arc.io",
    explorerUrl: "https://explorer.arc.io",
    nativeCurrency: {
      name: "USD Coin",
      symbol: "USDC",
      decimals: 18,
    },
    factoryAddress: "0x90348F9A58a95d1f81b7Be6AFD874Cb4b6879D36", // Will update upon mainnet broadcast
    defaultSplit: "0x3a6a2168034Bfa6de1B8236Abe862CB2E9CAFBE7",
  },
  arcTestnet: {
    name: "Arc Testnet",
    chainId: 5042002,
    rpcUrl: "https://rpc.testnet.arc.network",
    explorerUrl: "https://testnet.arcscan.app",
    nativeCurrency: {
      name: "USD Coin",
      symbol: "USDC",
      decimals: 18,
    },
    factoryAddress: "0x90348F9A58a95d1f81b7Be6AFD874Cb4b6879D36",
    defaultSplit: "0x3a6a2168034Bfa6de1B8236Abe862CB2E9CAFBE7",
  },
};

export const ARC_FACTORY_ABI = [
  "function createSplit(string name, address[] recipients, uint32[] shares) returns (address)",
  "function allSplits(uint256) view returns (address)",
  "function totalSplitsCount() view returns (uint256)",
  "function getSplitsByCreator(address creator) view returns (address[])",
  "function getSplitsByRecipient(address recipient) view returns (address[])",
  "function getSplits(uint256 offset, uint256 limit) view returns (address[])",
  "event SplitCreated(address indexed splitAddress, address indexed creator, string name, address[] recipients, uint32[] shares)"
];

export const ARC_SPLITTER_ABI = [
  "function name() view returns (string)",
  "function creator() view returns (address)",
  "function factory() view returns (address)",
  "function getRecipients() view returns (address[])",
  "function recipientCount() view returns (uint256)",
  "function shareOf(address recipient) view returns (uint32)",
  "function releasable(address recipient) view returns (uint256)",
  "function released(address recipient) view returns (uint256)",
  "function totalReceived() view returns (uint256)",
  "function totalReleased() view returns (uint256)",
  "function release(address recipient)",
  "function distributeAll()",
  "event PaymentReceived(address indexed from, uint256 amount)",
  "event PaymentReleased(address indexed to, uint256 amount)"
];
