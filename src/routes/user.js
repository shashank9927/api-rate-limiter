const express = require('express');
const rateLimitModel = require('../models/api.js');
const {rateLimiter} = require('../middleware/rateLimiter.js');
const { generateApiKey } = require('../utils/apiKeyGenerator.js');
const { cleanupExpiredBlacklists } = require('../utils/blacklistCleanup.js');

const router = express.Router();

// Test route to check if the server is running 
router.get('/',(req,res)=>{
    res.status(200).json({
        message: 'API is working'
    });
});

//get usage statistics for the current API Key

router.get('/usage',async (req,res)=>{
    try{
        const apiKey = req.header('x-api-key');

        if(!apiKey){
            return res.status(401).json(
                {
                    error: 'API Key is required'
                }
            );
        }

        const apiKeyDoc = await rateLimitModel.findOne({key: apiKey});

        if(!apiKeyDoc){
            return res.status(401).json(
                {
                    error: 'Invalid API Key'
                }
            );
        }

        const now = new Date();
        const windowStart = new Date(apiKeyDoc.windowStart);
        const windowSizeMs = 60 * 1000; 
        const timeRemainingMs = Math.max(0, windowSizeMs - (now - windowStart));

        //check if API Key is blacklisted

        const isBlacklisted = apiKeyDoc.isBlacklisted && apiKeyDoc.blacklistedUntil > now;

        return res.status(200).json(
            {
                requestCount: apiKeyDoc.requestCount,
                requestsPerMinute: apiKeyDoc.limits.requestsPerMinute,
                windowStart: apiKeyDoc.windowStart,
                timeRemaining: timeRemainingMs,
                timeRemainingSeconds: Math.ceil(timeRemainingMs/1000),
                isBlacklisted: isBlacklisted,
                blacklistedUntil: apiKeyDoc.blacklistedUntil,
                excessiveRequestCount: apiKeyDoc.excessiveRequestCount,
                blacklistStatus: isBlacklisted ? {
                    until: apiKeyDoc.blacklistedUntil,
                    hoursRemaining: Math.ceil((apiKeyDoc.blacklistedUntil - now) / (1000 * 60 * 60))
                } : null

            }
        );
    }
    catch(error){
        console.error('Error retrieving usage: ',error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});


//generate a new API key for testing purpose

router.post('/api-keys', async(req,res) =>{
    try{
        const {userId, requestsPerMinute = 60} = req.body;

        if(!userId){
            return res.status(400).json({error: 'userId is required'});
        }

        const key = generateApiKey();

        const apiKey = new rateLimitModel(
            {
                key,
                userId,
                limits: {
                    requestsPerMinute
                },
                windowStart: new Date(),
                requestCount: 0
            }
        );
        await apiKey.save();
        return res.status(201).json(
            {
                key,
                userId,
                limits: apiKey.limits
            }
        );
    }
    catch(error){
        console.error('Error creating API Key: ',error);
        return res.status(500).json(
            {
                error: 'Internal server error'
            }
        );
    }
});

//Test protected routes. This uses rate limiter middleware

router.get('/protected',rateLimiter,(req,res)=>{
    res.status(200).json({message: 'This is a protected route'});
});

// check blacklist status of an API Key

router.get('/blacklist-status', async(req,res)=>{
    try{
        const apiKey = req.header('x-api-key');

        if(!apiKey){
            return res.status(401).json(
                {
                    error: 'API Key is needed'
                }
            );
        }

        const apiKeyDoc = await rateLimitModel.findOne({key: apiKey});

        if(!apiKeyDoc){
            return res.status(401).json(
                {
                    error: 'Invalid API Key'
                }
            );
        }

        const now = new Date();
        const isBlacklisted = apiKeyDoc.isBlacklisted && apiKeyDoc.blacklistedUntil > now;

        return res.status(200).json( 
            {
                isBlacklisted: isBlacklisted,
                blacklistedUntil: apiKeyDoc.blacklistedUntil,
                excessiveRequestCount: apiKeyDoc.excessiveRequestCount,
                 timeRemaining: isBlacklisted
                ? Math.ceil((apiKeyDoc.blacklistedUntil - now) / (1000 * 60 * 60)) + ' hours'
                : null,
                status: isBlacklisted ? 'blacklisted' : 'active',
            }
        );

    }
    catch(error){
        console.error('Error checking blacklist status: ',error);
        return res.status(500).json({error: 'Internal server error'});
    }
});

// admin route to view all blacklisted API keys

router.get('/admin/blacklisted-keys', async(req,res)=>{
    try{
        // will implement admin authentication here

        const now = new Date();
        const blacklistedKeys = await rateLimitModel.find(
            {
                isBlacklisted: true,
                blacklistedUntil: {$gt: now}
            }
        ).select('key userId blacklistedUntil excessiveRequestCount');

        return res.status(200).json(
            {
                count: blacklistedKeys.length,
                blacklistedKeys: blacklistedKeys.map( key => (
                    {
                        key: key.key,
                        userId: key.userId,
                        blacklistedUntil: key.blacklistedUntil,
                        hoursRemaining: Math.ceil((key.blacklistedUntil - now) / (1000*60*60)),
                        excessiveRequestCount: key.excessiveRequestCount

                    }))
            });
    } 
    catch (error) {
    console.error('Error retrieving blacklisted keys:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin route to manually clean up expired blacklists

router.post('/admin/cleanup-blacklists', async(req,res)=>{
    try{
        // will add admin authentication here

        const cleanedCount = await cleanupExpiredBlacklists();

        return res.status(200).json(
            {
                success: true,
                message: `Cleaned up ${cleanedCount} expired blacklists`,
                cleanedCount
            }
        );

    }catch(error){
        console.log('Error cleaning up blacklists: ',error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = {router};

