const express = require('express');
const rateLimitModel = require('../models/api.js');
const rateLimiter = require('../middleware/rateLimiter.js');
const { generateApiKey } = require('../utils/apiKeyGenerator.js');
const { checkAndFixBlacklist } = require('../utils/blackListHelper.js');

const router = express.Router();

// Get usage statistics for the current API key
router.get('/usage', async (req, res) => {
  try {
        const apiKey = req.header('x-api-key');
        if (!apiKey) 
            {
                return res.status(401).json({ error: 'API key is required' });
            }
        const apiKeyDoc = await ApiKey.findOne({ key: apiKey });
        
        if (!apiKeyDoc) 
            {
                return res.status(401).json({ error: 'Invalid API key' }); 
            }   
            
        const now = new Date();
        const windowStart = new Date(apiKeyDoc.windowStart);
        const windowSizeMs = 60 * 1000;    const timeRemainingMs = Math.max(0, windowSizeMs - (now - windowStart));
        
        // Use the blacklist helper to check and fix if needed
        const { isBlacklisted, apiKeyDoc: updatedApiKeyDoc } = await checkAndFixBlacklist(apiKey);
        apiKeyDoc = updatedApiKeyDoc; // Use the updated document
        
        return res.status(200).json({
        requestCount: apiKeyDoc.requestCount,
        requestsPerMinute: apiKeyDoc.limits.requestsPerMinute,
        windowStart: apiKeyDoc.windowStart,
        timeRemaining: Math.ceil(timeRemainingMs / 1000),
        isBlacklisted,
        blacklistInfo: isBlacklisted ? {
            until: apiKeyDoc.blacklistedUntil,
            timeRemaining: Math.ceil((apiKeyDoc.blacklistedUntil - now) / 1000) + ' seconds'
        } : null,
        excessiveRequestCount: apiKeyDoc.excessiveRequestCount,
        currentTime: now
        });
    } 
    catch (error) 
    {
        console.error('Error retrieving usage:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Generate a new API key
router.post('/api-keys', async (req, res) => {
  try {
        const { userId, requestsPerMinute = 60 } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId is required' });
        const key = generateApiKey();
        const apiKey = new ApiKey({ key, userId, limits: { requestsPerMinute }, windowStart: new Date(), requestCount: 0 });
        await apiKey.save();
        return res.status(201).json({ key, userId, limits: apiKey.limits });
       } 
    catch (error) 
    {
        console.error('Error creating API key:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Protected route (uses rate limiter middleware)
router.get('/protected', rateLimiter, (req, res) => {
  res.status(200).json({ message: 'This is a protected route' });
});


// Check blacklist status of an API key
router.get('/blacklist-status', async (req, res) => {

    try 
    {
        const apiKey = req.header('x-api-key');
        if (!apiKey) 
            {
                return res.status(401).json({ error: 'API key is required' });
            }

        const apiKeyDoc = await ApiKey.findOne({ key: apiKey });
        if (!apiKeyDoc) 
            {
                return res.status(401).json({ error: 'Invalid API key' });
            }    
            
        const now = new Date();
        
        // Use the blacklist helper to check and fix if needed
        const { isBlacklisted, apiKeyDoc: updatedApiKeyDoc } = await checkAndFixBlacklist(apiKey);
        apiKeyDoc = updatedApiKeyDoc; // Use the updated document
        
        return res.status(200).json(
            {
                status: isBlacklisted ? 'blacklisted' : 'active',
                excessiveRequestCount: apiKeyDoc.excessiveRequestCount,
                blacklist: {
                    isBlacklisted,
                    until: isBlacklisted ? apiKeyDoc.blacklistedUntil : null,
                    timeRemaining: isBlacklisted ? Math.ceil((apiKeyDoc.blacklistedUntil - now) / 1000) + ' seconds' : null,
                },
                currentTime: now
            });
    } 
    
    catch (error) 
    {
        console.error('Error checking blacklist status:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
