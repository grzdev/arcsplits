// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title ArcSplitter
 * @notice Trustless, composable native USDC payment splitter for the Arc L1 blockchain.
 * @dev On Arc, native currency is 18-decimal USDC. This contract automatically distributes
 *      incoming native USDC (and optional ERC20 stablecoins) according to pre-configured basis points.
 */
contract ArcSplitter {
    uint32 public constant TOTAL_BPS = 10000; // 100.00%

    string public name;
    address public immutable factory;
    address public immutable creator;

    address[] private _recipients;
    mapping(address => uint32) private _shares; // BPS allocations
    mapping(address => uint256) private _releasedNative;
    mapping(address => mapping(address => uint256)) private _releasedERC20; // token => recipient => amount

    uint256 private _totalReleasedNative;
    mapping(address => uint256) private _totalReleasedERC20;

    event PaymentReceived(address indexed from, uint256 amount);
    event PaymentReleased(address indexed to, uint256 amount);
    event ERC20PaymentReleased(address indexed token, address indexed to, uint256 amount);

    error InvalidRecipientCount();
    error LengthMismatch();
    error ZeroAddress();
    error DuplicateRecipient(address recipient);
    error InvalidTotalAllocation(uint32 sum);
    error NoAllocation();
    error NoPaymentDue();
    error TransferFailed();

    /**
     * @notice Construct a new ArcSplitter
     * @param splitName Human readable identifier for this split
     * @param splitCreator The address that initiated creation via factory
     * @param recipientsArray Array of beneficiary addresses
     * @param sharesArray Array of basis point allocations (must sum to 10,000)
     */
    constructor(
        string memory splitName,
        address splitCreator,
        address[] memory recipientsArray,
        uint32[] memory sharesArray
    ) {
        if (recipientsArray.length == 0) revert InvalidRecipientCount();
        if (recipientsArray.length != sharesArray.length) revert LengthMismatch();

        name = splitName;
        factory = msg.sender;
        creator = splitCreator;

        uint32 totalBps = 0;
        for (uint256 i = 0; i < recipientsArray.length; i++) {
            address recipient = recipientsArray[i];
            uint32 share = sharesArray[i];

            if (recipient == address(0)) revert ZeroAddress();
            if (_shares[recipient] != 0) revert DuplicateRecipient(recipient);
            if (share == 0) revert NoAllocation();

            _recipients.push(recipient);
            _shares[recipient] = share;
            totalBps += share;
        }

        if (totalBps != TOTAL_BPS) revert InvalidTotalAllocation(totalBps);
    }

    /**
     * @notice Accepts incoming native USDC transfers and logs the event
     */
    receive() external payable {
        emit PaymentReceived(msg.sender, msg.value);
    }

    /**
     * @notice Fallback function to accept native USDC
     */
    fallback() external payable {
        emit PaymentReceived(msg.sender, msg.value);
    }

    // ==========================================
    // View Functions
    // ==========================================

    function getRecipients() external view returns (address[] memory) {
        return _recipients;
    }

    function recipientCount() external view returns (uint256) {
        return _recipients.length;
    }

    function shareOf(address recipient) external view returns (uint32) {
        return _shares[recipient];
    }

    function totalReleased() external view returns (uint256) {
        return _totalReleasedNative;
    }

    function released(address recipient) external view returns (uint256) {
        return _releasedNative[recipient];
    }

    function totalReceived() public view returns (uint256) {
        return address(this).balance + _totalReleasedNative;
    }

    /**
     * @notice Computes how much native USDC is currently claimable by a recipient
     */
    function releasable(address recipient) public view returns (uint256) {
        uint32 share = _shares[recipient];
        if (share == 0) return 0;

        uint256 total = totalReceived();
        uint256 totalAllocated = (total * share) / TOTAL_BPS;
        uint256 alreadyClaimed = _releasedNative[recipient];

        if (totalAllocated <= alreadyClaimed) return 0;
        return totalAllocated - alreadyClaimed;
    }

    // ERC20 views
    function totalReleasedERC20(address token) external view returns (uint256) {
        return _totalReleasedERC20[token];
    }

    function releasedERC20(address token, address recipient) external view returns (uint256) {
        return _releasedERC20[token][recipient];
    }

    function totalReceivedERC20(address token) public view returns (uint256) {
        return IERC20(token).balanceOf(address(this)) + _totalReleasedERC20[token];
    }

    function releasableERC20(address token, address recipient) public view returns (uint256) {
        uint32 share = _shares[recipient];
        if (share == 0) return 0;

        uint256 total = totalReceivedERC20(token);
        uint256 totalAllocated = (total * share) / TOTAL_BPS;
        uint256 alreadyClaimed = _releasedERC20[token][recipient];

        if (totalAllocated <= alreadyClaimed) return 0;
        return totalAllocated - alreadyClaimed;
    }

    // ==========================================
    // Distribution Actions
    // ==========================================

    /**
     * @notice Release owed native USDC to a specific recipient
     * @param recipient The address to pay out
     */
    function release(address payable recipient) public {
        uint256 payment = releasable(recipient);
        if (payment == 0) revert NoPaymentDue();

        _releasedNative[recipient] += payment;
        _totalReleasedNative += payment;

        (bool success, ) = recipient.call{value: payment}("");
        if (!success) revert TransferFailed();

        emit PaymentReleased(recipient, payment);
    }

    /**
     * @notice Permissionlessly distribute owed native USDC to ALL recipients in one transaction
     */
    function distributeAll() external {
        uint256 len = _recipients.length;
        for (uint256 i = 0; i < len; i++) {
            address payable rec = payable(_recipients[i]);
            if (releasable(rec) > 0) {
                release(rec);
            }
        }
    }

    /**
     * @notice Release owed ERC20 tokens to a specific recipient
     */
    function releaseERC20(IERC20 token, address recipient) public {
        uint256 payment = releasableERC20(address(token), recipient);
        if (payment == 0) revert NoPaymentDue();

        _releasedERC20[address(token)][recipient] += payment;
        _totalReleasedERC20[address(token)] += payment;

        bool success = token.transfer(recipient, payment);
        if (!success) revert TransferFailed();

        emit ERC20PaymentReleased(address(token), recipient, payment);
    }

    /**
     * @notice Distribute owed ERC20 tokens to all recipients in one transaction
     */
    function distributeAllERC20(IERC20 token) external {
        uint256 len = _recipients.length;
        for (uint256 i = 0; i < len; i++) {
            address rec = _recipients[i];
            if (releasableERC20(address(token), rec) > 0) {
                releaseERC20(token, rec);
            }
        }
    }
}
