// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ArcSplitter.sol";

/**
 * @title ArcSplitFactory
 * @notice Factory and registry for deploying and querying ArcSplitter instances on Arc L1.
 */
contract ArcSplitFactory {
    address[] public allSplits;
    mapping(address => address[]) private _splitsByCreator;
    mapping(address => address[]) private _splitsByRecipient;

    event SplitCreated(
        address indexed splitAddress,
        address indexed creator,
        string name,
        address[] recipients,
        uint32[] shares
    );

    /**
     * @notice Deploy a new ArcSplitter contract
     * @param name Name / description of the split
     * @param recipients Array of recipient addresses
     * @param shares Basis point allocations summing to 10,000 (e.g. 5000 = 50%)
     * @return splitAddress The address of the freshly deployed ArcSplitter
     */
    function createSplit(
        string memory name,
        address[] memory recipients,
        uint32[] memory shares
    ) external returns (address splitAddress) {
        ArcSplitter split = new ArcSplitter(name, msg.sender, recipients, shares);
        splitAddress = address(split);

        allSplits.push(splitAddress);
        _splitsByCreator[msg.sender].push(splitAddress);

        for (uint256 i = 0; i < recipients.length; i++) {
            _splitsByRecipient[recipients[i]].push(splitAddress);
        }

        emit SplitCreated(splitAddress, msg.sender, name, recipients, shares);
    }

    /**
     * @notice Total number of splits deployed through this factory
     */
    function totalSplitsCount() external view returns (uint256) {
        return allSplits.length;
    }

    /**
     * @notice Get all splits created by a specific user
     */
    function getSplitsByCreator(address creator) external view returns (address[] memory) {
        return _splitsByCreator[creator];
    }

    /**
     * @notice Get all splits where a specific address is a beneficiary
     */
    function getSplitsByRecipient(address recipient) external view returns (address[] memory) {
        return _splitsByRecipient[recipient];
    }

    /**
     * @notice Fetch paginated list of all deployed splits
     */
    function getSplits(uint256 offset, uint256 limit) external view returns (address[] memory) {
        uint256 total = allSplits.length;
        if (offset >= total) {
            return new address[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 size = end - offset;
        address[] memory batch = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            batch[i] = allSplits[offset + i];
        }
        return batch;
    }
}
