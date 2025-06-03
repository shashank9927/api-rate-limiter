const express = require('express');
const rateLimitModel = require('../models/api.js');
const { cleanupExpiredBlacklists } = require('../utils/blacklistCleanup');
const { checkAndFixBlacklist } = require('../utils/blackListHelper');

const router = express.Router();

// Admin root route for serving admin dashboard information
router.get('/', (req, res) => {
  // Return admin dashboard data as JSON instead of serving HTML
  res.status(200).json({ 
    message: 'Admin Dashboard API',
    endpoints: {
      apiStatus: '/admin/api-status',
      blacklistedKeys: '/admin/blacklisted-keys',
      cleanupBlacklists: '/admin/cleanup-blacklists (POST)'
    }
  });
});

//Admin API status route for testing
router.get('/api-status', (req, res) => {
  res.status(200).json({ message: 'Admin API is working' });
});


// Admin route to view all blacklisted API keys

router.get('/blacklisted-keys', async (req, res) => {
  try {
    // Will implement admin authentication here

    console.log('Admin blacklisted keys route accessed');
    
    const now = new Date();
      // Clean up any expired blacklists before listing current ones
    const cleanedCount = await cleanupExpiredBlacklists();
    if (cleanedCount > 0) {
      console.log(`Fixed ${cleanedCount} expired blacklists`);
    }
    
    // Then get the actual valid blacklisted keys
    const blacklistedKeys = await ApiKey.find(
        { 
            isBlacklisted: true,
            blacklistedUntil: { $gt: now }
        }).select('key userId blacklistedUntil excessiveRequestCount');      
        
        return res.status(200).json(
            {
                count: blacklistedKeys.length,
                currentTime: now.toISOString(),
                blacklistedKeys: blacklistedKeys.map(key => ({
                    key: key.key,
                    userId: key.userId,        
                    blacklistInfo: 
                    {
                        until: key.blacklistedUntil.toISOString(),
                        timeRemaining: Math.ceil((key.blacklistedUntil - now) / 1000) + ' seconds'
                    },
                    excessiveRequestCount: key.excessiveRequestCount
                }))
            });
        } 
        catch (error) 
            {
                console.error('Error retrieving blacklisted keys:', error);
                return res.status(500).json({ error: 'Internal server error' });
            }
});

module.exports = router;
