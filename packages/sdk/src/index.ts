import { Contract, ContractRunner, ethers } from "ethers";

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

export const ARC_FACTORY_ABI = [
  "function createSplit(string name, address[] recipients, uint32[] shares) returns (address)",
  "function allSplits(uint256) view returns (address)",
  "function totalSplitsCount() view returns (uint256)",
  "function getSplitsByCreator(address creator) view returns (address[])",
  "function getSplitsByRecipient(address recipient) view returns (address[])",
  "function getSplits(uint256 offset, uint256 limit) view returns (address[])",
  "event SplitCreated(address indexed splitAddress, address indexed creator, string name, address[] recipients, uint32[] shares)"
];

export interface SplitMetadata {
  address: string;
  name: string;
  creator: string;
  recipients: Array<{
    address: string;
    shareBps: number;
    sharePercent: number;
    releasableUSDC: string;
    releasedUSDC: string;
  }>;
  totalReceivedUSDC: string;
  totalReleasedUSDC: string;
  balanceUSDC: string;
}

export class ArcSplitsClient {
  public factoryAddress: string;
  public runner: ContractRunner;
  public factory: Contract;

  constructor(factoryAddress: string, runner: ContractRunner) {
    this.factoryAddress = factoryAddress;
    this.runner = runner;
    this.factory = new Contract(factoryAddress, ARC_FACTORY_ABI, runner);
  }

  async createSplit(
    name: string,
    recipients: string[],
    sharesBps: number[]
  ): Promise<string> {
    const tx = await (this.factory as any).createSplit(name, recipients, sharesBps);
    const receipt = await tx.wait();
    const event = receipt.logs
      .map((log: any) => {
        try {
          return this.factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e: any) => e && e.name === "SplitCreated");

    return event ? event.args.splitAddress : "";
  }

  async getSplitMetadata(splitAddress: string): Promise<SplitMetadata> {
    const contract = new Contract(splitAddress, ARC_SPLITTER_ABI, this.runner);
    const [name, creator, recipients, totalReceivedWei, totalReleasedWei] = await Promise.all([
      contract.name(),
      contract.creator(),
      contract.getRecipients(),
      contract.totalReceived(),
      contract.totalReleased()
    ]);

    const recipientDetails = await Promise.all(
      recipients.map(async (rec: string) => {
        const [shareBps, releasableWei, releasedWei] = await Promise.all([
          contract.shareOf(rec),
          contract.releasable(rec),
          contract.released(rec)
        ]);

        return {
          address: rec,
          shareBps: Number(shareBps),
          sharePercent: Number(shareBps) / 100,
          releasableUSDC: ethers.formatEther(releasableWei),
          releasedUSDC: ethers.formatEther(releasedWei)
        };
      })
    );

    const balanceWei = totalReceivedWei - totalReleasedWei;

    return {
      address: splitAddress,
      name,
      creator,
      recipients: recipientDetails,
      totalReceivedUSDC: ethers.formatEther(totalReceivedWei),
      totalReleasedUSDC: ethers.formatEther(totalReleasedWei),
      balanceUSDC: ethers.formatEther(balanceWei)
    };
  }

  async distributeAll(splitAddress: string): Promise<any> {
    const contract = new Contract(splitAddress, ARC_SPLITTER_ABI, this.runner);
    return await (contract as any).distributeAll();
  }

  async release(splitAddress: string, recipientAddress: string): Promise<any> {
    const contract = new Contract(splitAddress, ARC_SPLITTER_ABI, this.runner);
    return await (contract as any).release(recipientAddress);
  }
}
