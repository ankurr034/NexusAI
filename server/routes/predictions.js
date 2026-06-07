import express from 'express';
import { ethers } from 'ethers';
import crypto from 'crypto';

const router = express.Router();

// This should ideally come from env vars and the deployed contract address
const RPC_URL = process.env.POLYGON_RPC_URL || 'http://127.0.0.1:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY; // Requires admin private key with MATIC
const PREDICTION_LOGGER_ADDRESS = process.env.PREDICTION_LOGGER_ADDRESS;

// Minimal ABI for PredictionLogger
const abi = [
  "function logPrediction(string memory _ticker, string memory _predictionHash) external",
  "function verifyPrediction(string memory _predictionHash) external view returns (bool, uint256, address)"
];

const generateHash = (predictionData) => {
  return crypto.createHash('sha256').update(JSON.stringify(predictionData)).digest('hex');
};

router.post('/log', async (req, res) => {
  try {
    const { ticker, predictionText, targetPrice, timeframe } = req.body;
    
    if (!ticker || !predictionText) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const predictionData = { ticker, predictionText, targetPrice, timeframe, timestamp: Date.now() };
    const hash = generateHash(predictionData);

    if (!PRIVATE_KEY || !PREDICTION_LOGGER_ADDRESS) {
      // In development or if not fully configured, just return the hash
      return res.json({ success: true, hash, status: 'Simulated log (missing contract config)' });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(PREDICTION_LOGGER_ADDRESS, abi, wallet);

    // Call smart contract to log
    const tx = await contract.logPrediction(ticker, hash);
    await tx.wait();

    res.json({ success: true, hash, txHash: tx.hash, status: 'Logged on blockchain' });
  } catch (error) {
    console.error('Error logging prediction:', error);
    res.status(500).json({ error: 'Failed to log prediction' });
  }
});

router.get('/verify/:hash', async (req, res) => {
  try {
    const { hash } = req.params;

    if (!PREDICTION_LOGGER_ADDRESS) {
      return res.json({ error: 'Smart contract not configured' });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(PREDICTION_LOGGER_ADDRESS, abi, provider);

    const [exists, timestamp, author] = await contract.verifyPrediction(hash);
    
    if (exists) {
      res.json({ verified: true, timestamp: Number(timestamp), author });
    } else {
      res.json({ verified: false, error: 'Hash not found on blockchain' });
    }
  } catch (error) {
    console.error('Error verifying prediction:', error);
    res.status(500).json({ error: 'Failed to verify prediction' });
  }
});

export default router;
