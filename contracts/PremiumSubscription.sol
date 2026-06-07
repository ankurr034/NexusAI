// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PremiumSubscription {
    address public owner;

    struct Subscription {
        bool isActive;
        uint256 expiryTimestamp;
    }

    mapping(address => Subscription) public subscriptions;

    event SubscriptionActivated(address indexed user, uint256 expiryTimestamp);
    event PaymentVerified(address indexed user, string paymentId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // The backend (admin) can grant subscription after verifying Razorpay payment
    function grantSubscription(address _user, uint256 _durationInDays, string calldata _paymentId) external onlyOwner {
        uint256 currentExpiry = subscriptions[_user].expiryTimestamp;
        uint256 startTime = currentExpiry > block.timestamp ? currentExpiry : block.timestamp;
        uint256 newExpiry = startTime + (_durationInDays * 1 days);
        
        subscriptions[_user] = Subscription({
            isActive: true,
            expiryTimestamp: newExpiry
        });

        emit PaymentVerified(_user, _paymentId);
        emit SubscriptionActivated(_user, newExpiry);
    }

    function isPremium(address _user) external view returns (bool) {
        return subscriptions[_user].isActive && subscriptions[_user].expiryTimestamp > block.timestamp;
    }

    function getExpiry(address _user) external view returns (uint256) {
        return subscriptions[_user].expiryTimestamp;
    }
}
