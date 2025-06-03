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
      cleanupBlacklists: '/admin/cleanup-blacklists (POST)',
      freeApiKey: '/admin/free-api-key (POST) - Provide apiKey in request body or as query parameter (?apiKey=value)'
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
    const blacklistedKeys = await rateLimitModel.find(
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

// Add missing admin route to manually clean up blacklisted keys
router.post('/cleanup-blacklists', async (req, res) => {
  try {
    // Will implement admin authentication here
    
    console.log('Manual blacklist cleanup initiated');
    const cleanedCount = await cleanupExpiredBlacklists();
    
    return res.status(200).json({
      success: true,
      message: `Cleaned up ${cleanedCount} expired blacklists`,
      cleanedCount
    });
  } catch (error) {
    console.error('Error cleaning up blacklists:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin route to free (unblacklist) a specific API key
router.post('/free-api-key', async (req, res) => {
  try {
    // Will implement admin authentication here
    
    // Check if body exists and extract apiKey
    let apiKey = req.body && req.body.apiKey;
    
    // Handle case where apiKey might be a complex object (from PowerShell)
    if (apiKey && typeof apiKey === 'object' && apiKey.value) {
      apiKey = apiKey.value;
    }
    
    // Also check query parameters in case the API key is sent that way
    const queryApiKey = req.query.apiKey;

    // Use either body or query parameter
    const keyToFree = apiKey || queryApiKey;
    
    if (!keyToFree) {
      return res.status(400).json({
        success: false, 
        error: 'API key is required (send in request body as apiKey or as query parameter)'
      });
    }
      console.log(`Admin attempting to free API key from blacklist: ${keyToFree}`);
    
    // Find the API key document
    const apiKeyDoc = await rateLimitModel.findOne({ key: keyToFree });
    
    if (!apiKeyDoc) {
      return res.status(404).json({
        success: false, 
        error: 'API key not found'
      });
    }
    
    // Check if the key was blacklisted
    const wasBlacklisted = apiKeyDoc.isBlacklisted;
      // Update the document to remove blacklist status
    const result = await rateLimitModel.updateOne(
      { key: keyToFree },
      {
        $set: {
          isBlacklisted: false,
          blacklistedUntil: null,
          excessiveRequestCount: 0
        }
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false, 
        error: 'API key not found'
      });
    }
      return res.status(200).json({
      success: true,
      message: wasBlacklisted 
        ? `API key '${keyToFree}' has been freed from the blacklist` 
        : `API key '${keyToFree}' was not blacklisted`,
      apiKey: keyToFree,
      userId: apiKeyDoc.userId,
      wasBlacklisted,
      modifiedCount: result.modifiedCount
    });
    
  } catch (error) {
    console.error('Error freeing API key from blacklist:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

module.exports = router;
