const rateLimitModel = require('./models/api.js');
const mongoose = require('mongoose');
const { checkAndFixBlacklist } = require('../utils/blackListHelper.js');

//check if request is within the limit for the provided API Key

const rateLimiter = async(req,res,next) => {
    try{
        //extract API Key from the request Header
        const apiKey = req.header('x-api-key');

        //check if API Key is not present in Header
        if(!apiKey){
            return res.status(401).json({
                error: 'API Key is required'
            });
        }

        const now = new Date();
        const windowSizeMs = 60 * 1000; // set windowSizeMs to 1 minute in milliseconds
        const oneMinuteAgo = new Date(now.getTime() - windowSizeMs);

        //use findOne to get current state
        let apiKeyDoc = await rateLimitModel.findOne({key: apiKey});

        if(!apiKeyDoc){
            return res.status(401).json({
                error: 'Invalid API Key'
            });
        }

        //check if provided API Key is blacklisted using helper function
        const { isBlacklisted, apiKeyDoc: updatedApiKeyDoc } = await checkAndFixBlacklist(apiKey);
        apiKeyDoc = updatedApiKeyDoc; // Use the updated document

        //check if black listed and return appropriate response
        if (isBlacklisted) {
            const remainingTimeMs = apiKeyDoc.blacklistedUntil - now;
            return res.status(403).json(
                { 
                error: 'API key is blacklisted due to excessive use',
                blacklistedUntil: apiKeyDoc.blacklistedUntil.toISOString(),
                timeRemaining: `${Math.ceil(remainingTimeMs / 1000)} seconds`,
                message: 'Please try again after the blacklist period expires'
                }
                );
        }
        //check if window is expired 

        const windowExpired = !apiKeyDoc.windowStart || apiKeyDoc.windowStart < oneMinuteAgo;

        if(windowExpired){
            // if window is expired reset counter 
            await rateLimitModel.updateOne(
                {
                    key: apiKey,
                },
                {
                    $set: {
                        windowStart: now,
                        requestCount: 1,
                        excessiveRequestCount: Math.max(0, (apiKeyDoc.excessiveRequestCount || 0 ) - 1)
                    }
                }
            );
            next();
        } 
        
        else {
            // If window still active then check if it is over limit
            if(apiKeyDoc.requestCount >= apiKeyDoc.limits.requestsPerMinute) {
                //Already limit is over so increase excessive counter
                const excessiveCount = (apiKeyDoc.excessiveRequestCount || 0) + 1;
                //set blacklist threshold to 4 times the allowed request per minute
                const blacklistThreshold = apiKeyDoc.limits.requestsPerMinute * 4;

                await rateLimitModel.updateOne(
                    {
                        key: apiKey,
                    },
                    {
                        $inc: {excessiveRequestCount: 1}
                    }
                );

                //check if the API Key should be blacklisted
                if(excessiveCount >= blacklistThreshold){
                    // black list the API Key for 24 Hours
                    const blacklistExpiration = new Date(now.getTime() + (24 * 60 * 60 * 1000 ));

                    await rateLimitModel.updateOne(
                        {
                            key: apiKey
                        },
                        {
                            $set:{
                                isBlacklisted: true,
                                blacklistedUntil: blacklistExpiration
                            }
                        }
                );

                return res.status(403).json(
                    {
                        error: 'API Key has been black listed due to excessive use',
                        blacklistedUntil: blacklistExpiration,
                        message: 'Your API key has been blacklisted for 24 hours due to excessive use' 
                    }
                    );
                }
                const timeRemainingMs = windowSizeMs - (now - apiKeyDoc.windowStart);
                const resetTime = new Date(now.getTime() + timeRemainingMs);
                //return rate limit error
                return res.status(429).json(
                    {
                        error: 'rate limit exceeded',
                        limit: apiKeyDoc.limits.requestsPerMinute,
                        requestCount: apiKeyDoc.requestCount,
                        windowStart: apiKeyDoc.windowStart,
                        timeRemaining: Math.ceil(timeRemainingMs / 1000),
                        resetAt: resetTime,
                        message: 'Rate limit exceeded'
                    }
                );
            }

            // if not over the limit increment the counter
            await rateLimitModel.updateOne(
                {
                    key: apiKey
                },
                {
                    $inc: {
                        requestCount: 1
                    }
                }
            );
            next();
        }

    } 
    catch(error){
        console.error('Rate limit error: ',error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
};

module.exports = rateLimiter;