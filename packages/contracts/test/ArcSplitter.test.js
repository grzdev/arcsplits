const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ArcSplits", function () {
  let owner;
  let alice;
  let bob;
  let charlie;
  let donor;

  let factory;
  let splitter;
  let mockUSDC;

  beforeEach(async function () {
    [owner, alice, bob, charlie, donor] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("ArcSplitFactory");
    factory = await Factory.deploy();
    await factory.waitForDeployment();

    const MockToken = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockToken.deploy();
    await mockUSDC.waitForDeployment();

    // Deploy standard 70/30 split between Alice and Bob
    const tx = await factory.connect(owner).createSplit(
      "Creator Split",
      [alice.address, bob.address],
      [7000, 3000] // 70% and 30%
    );
    await tx.wait();
    const splitAddress = await factory.allSplits(0);

    splitter = await ethers.getContractAt("ArcSplitter", splitAddress);
  });

  describe("Initialization & Validation", function () {
    it("should set metadata, creator, and allocations correctly", async function () {
      expect(await splitter.name()).to.equal("Creator Split");
      expect(await splitter.creator()).to.equal(owner.address);
      expect(await splitter.recipientCount()).to.equal(2n);
      expect(await splitter.shareOf(alice.address)).to.equal(7000);
      expect(await splitter.shareOf(bob.address)).to.equal(3000);
    });

    it("should reject creation if shares do not total 10000", async function () {
      await expect(
        factory.createSplit("Bad Split", [alice.address, bob.address], [5000, 4000])
      ).to.be.revertedWithCustomError(splitter, "InvalidTotalAllocation");
    });

    it("should reject empty recipients list", async function () {
      await expect(
        factory.createSplit("Empty Split", [], [])
      ).to.be.revertedWithCustomError(splitter, "InvalidRecipientCount");
    });

    it("should reject length mismatch", async function () {
      await expect(
        factory.createSplit("Mismatch", [alice.address], [5000, 5000])
      ).to.be.revertedWithCustomError(splitter, "LengthMismatch");
    });

    it("should reject duplicate recipients", async function () {
      await expect(
        factory.createSplit("Dup", [alice.address, alice.address], [5000, 5000])
      ).to.be.revertedWithCustomError(splitter, "DuplicateRecipient");
    });

    it("should reject zero address recipient", async function () {
      await expect(
        factory.createSplit("Zero", [ethers.ZeroAddress], [10000])
      ).to.be.revertedWithCustomError(splitter, "ZeroAddress");
    });
  });

  describe("Native USDC Payments & Splitting", function () {
    it("should receive native USDC and compute releasable correctly", async function () {
      const deposit = ethers.parseEther("10.0"); // 10 native USDC
      await donor.sendTransaction({
        to: await splitter.getAddress(),
        value: deposit,
      });

      expect(await ethers.provider.getBalance(await splitter.getAddress())).to.equal(deposit);
      expect(await splitter.releasable(alice.address)).to.equal(ethers.parseEther("7.0"));
      expect(await splitter.releasable(bob.address)).to.equal(ethers.parseEther("3.0"));
    });

    it("should release individual payments via pull pattern", async function () {
      const deposit = ethers.parseEther("10.0");
      await donor.sendTransaction({
        to: await splitter.getAddress(),
        value: deposit,
      });

      const aliceInitialBal = await ethers.provider.getBalance(alice.address);
      await splitter.release(alice.address);
      const aliceAfterBal = await ethers.provider.getBalance(alice.address);

      expect(aliceAfterBal - aliceInitialBal).to.equal(ethers.parseEther("7.0"));
      expect(await splitter.released(alice.address)).to.equal(ethers.parseEther("7.0"));
      expect(await splitter.releasable(alice.address)).to.equal(0n);
      expect(await splitter.releasable(bob.address)).to.equal(ethers.parseEther("3.0"));
    });

    it("should distribute all funds in a single batch transaction", async function () {
      const deposit = ethers.parseEther("100.0");
      await donor.sendTransaction({
        to: await splitter.getAddress(),
        value: deposit,
      });

      const aliceInit = await ethers.provider.getBalance(alice.address);
      const bobInit = await ethers.provider.getBalance(bob.address);

      await splitter.connect(charlie).distributeAll(); // anyone can call distributeAll!

      const aliceFinal = await ethers.provider.getBalance(alice.address);
      const bobFinal = await ethers.provider.getBalance(bob.address);

      expect(aliceFinal - aliceInit).to.equal(ethers.parseEther("70.0"));
      expect(bobFinal - bobInit).to.equal(ethers.parseEther("30.0"));
      expect(await ethers.provider.getBalance(await splitter.getAddress())).to.equal(0n);
    });

    it("should correctly handle incremental multi-step deposits", async function () {
      // First deposit 10 USDC
      await donor.sendTransaction({
        to: await splitter.getAddress(),
        value: ethers.parseEther("10.0"),
      });

      await splitter.release(alice.address);
      expect(await splitter.released(alice.address)).to.equal(ethers.parseEther("7.0"));

      // Second deposit 20 USDC
      await donor.sendTransaction({
        to: await splitter.getAddress(),
        value: ethers.parseEther("20.0"),
      });

      // Total received is now 30 USDC. Alice share is 70% of 30 = 21 USDC. Already got 7, so releasable = 14!
      expect(await splitter.releasable(alice.address)).to.equal(ethers.parseEther("14.0"));
      expect(await splitter.releasable(bob.address)).to.equal(ethers.parseEther("9.0")); // 30% of 30 = 9

      await splitter.distributeAll();
      expect(await splitter.released(alice.address)).to.equal(ethers.parseEther("21.0"));
      expect(await splitter.released(bob.address)).to.equal(ethers.parseEther("9.0"));
    });
  });

  describe("ERC20 Token Support", function () {
    it("should receive and split ERC20 stablecoins", async function () {
      const splitAddr = await splitter.getAddress();
      const amount = 1000n * 10n ** 6n; // 1,000 USDC (6 decimals)
      await mockUSDC.transfer(splitAddr, amount);

      expect(await splitter.releasableERC20(await mockUSDC.getAddress(), alice.address)).to.equal(
        700n * 10n ** 6n
      );
      expect(await splitter.releasableERC20(await mockUSDC.getAddress(), bob.address)).to.equal(
        300n * 10n ** 6n
      );

      await splitter.distributeAllERC20(await mockUSDC.getAddress());

      expect(await mockUSDC.balanceOf(alice.address)).to.equal(700n * 10n ** 6n);
      expect(await mockUSDC.balanceOf(bob.address)).to.equal(300n * 10n ** 6n);
    });
  });

  describe("Factory Registry", function () {
    it("should index splits by creator and recipient", async function () {
      const splitAddress = await splitter.getAddress();
      expect(await factory.totalSplitsCount()).to.equal(1n);

      const creatorSplits = await factory.getSplitsByCreator(owner.address);
      expect(creatorSplits).to.deep.equal([splitAddress]);

      const aliceSplits = await factory.getSplitsByRecipient(alice.address);
      expect(aliceSplits).to.deep.equal([splitAddress]);

      const bobSplits = await factory.getSplitsByRecipient(bob.address);
      expect(bobSplits).to.deep.equal([splitAddress]);

      const charsplits = await factory.getSplitsByRecipient(charlie.address);
      expect(charsplits).to.deep.equal([]);
    });

    it("should support pagination in getSplits", async function () {
      const batch = await factory.getSplits(0, 10);
      expect(batch.length).to.equal(1);
      expect(batch[0]).to.equal(await splitter.getAddress());
    });
  });
});
