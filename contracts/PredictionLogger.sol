// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PredictionLogger {
    struct Prediction {
        string ticker;
        string predictionHash;
        uint256 timestamp;
        address author;
    }

    // Mapping from predictionHash to Prediction record
    mapping(string => Prediction) public predictions;
    
    // Array to keep track of all hashes (optional, for history)
    string[] public allHashes;

    event NewPrediction(
        string indexed ticker,
        string predictionHash,
        uint256 timestamp,
        address author
    );

    function logPrediction(string memory _ticker, string memory _predictionHash) external {
        require(predictions[_predictionHash].timestamp == 0, "Prediction already exists");

        Prediction memory newPrediction = Prediction({
            ticker: _ticker,
            predictionHash: _predictionHash,
            timestamp: block.timestamp,
            author: msg.sender
        });

        predictions[_predictionHash] = newPrediction;
        allHashes.push(_predictionHash);

        emit NewPrediction(_ticker, _predictionHash, block.timestamp, msg.sender);
    }

    function verifyPrediction(string memory _predictionHash) external view returns (bool, uint256, address) {
        Prediction memory p = predictions[_predictionHash];
        if (p.timestamp == 0) {
            return (false, 0, address(0));
        }
        return (true, p.timestamp, p.author);
    }

    function getTotalPredictions() external view returns (uint256) {
        return allHashes.length;
    }
}
