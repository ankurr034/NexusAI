import express from 'express';
import User from '../models/User.js';
import mongoose from 'mongoose';

const router = express.Router();

router.post('/update', async (req, res) => {
  const { user_id } = req.query;
  const { account_mode } = req.body;

  if (!user_id) {
    return res.status(400).json({ detail: 'Missing user_id' });
  }

  // If it's a mock user from frontend, skip DB query and return success
  if (user_id === 'mock_web2_user' || user_id === 'nexus-sim-user') {
    return res.json({ success: true, account_mode, message: 'Mock update successful' });
  }

  try {
    let query = null;
    if (mongoose.Types.ObjectId.isValid(user_id)) {
      query = { _id: user_id };
    } else {
      query = { walletAddress: user_id.toLowerCase() };
    }

    const user = await User.findOne(query);

    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    if (account_mode === 'demo' || account_mode === 'live') {
      user.account_mode = account_mode;
    }

    await user.save();
    
    res.json({ 
      success: true, 
      account_mode: user.account_mode,
      message: 'Profile updated successfully' 
    });
  } catch (error) {
    console.error('Live mode switch error:', error);
    res.status(500).json({ detail: 'Internal server error while updating mode' });
  }
});

export default router;
