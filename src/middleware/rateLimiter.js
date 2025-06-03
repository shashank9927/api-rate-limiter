const rateLimitModel = require('./models/api.js')
const mongoose = require('mongoose')

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
        const apiKeyDoc = await rateLimitModel.findOne({key: apiKey});

        if(!apiKeyDoc){
            return res.status(401).json({
                error: 'Invalid API Key'
            });
        }

        //check if provided API Key is blacklisted
        if(apiKeyDoc.isBlacklisted && apiKeyDoc.blacklistedUntil > now){
            const remainingTimeMs = apiKeyDoc.blacklistedUntil - now;
            const remainingTimeHours = Math.ceil(remainingTimeMs/(1000*60*60));

            return res.status(403).json({
                error: 'API Key is blacklisted due to excessive use',
                blacklistedUntil: apiKeyDoc.blacklistedUntil,
                remainingTimeHours: remainingTimeHours,
                message: `Please try again after ${remainingTimeHours} hours`
            });
        }

        //check if blacklist period has expired and remove blacklist in needed
        
        if(apiKeyDoc.isBlacklisted && apiKeyDoc.blacklistedUntil <= now){
            await rateLimitModel.updateOne({
                key: apiKey
            },
            {
               $set: {
                isBlacklisted: false,
                blacklistedUntil: null,
                excessiveRequestCount: 0 // now reset excessive request counter
               } 
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

                //return rate limit error
                return res.status(429).json(
                    {
                        error: 'rate limit exceeded',
                        limit: apiKeyDoc.limits.requestsPerMinute,
                        requestCount: apiKeyDoc.requestCount,
                        windowStart: apiKeyDoc.windowStart,
                        timeRemaining: windowSizeMs - (now - apiKeyDoc.windowStart)
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

module.exports = {rateLimiter};

