const rateLimitModel = require('../models/api.js');

// check if an API is blacklisted and auto fix if expired

const checkAndFixBlacklist = async (apiKey) => {
    try{
        //fetch API Key document
        const apiKeyDoc = await rateLimitModel.findOne({key: apiKey});
        if(!apiKeyDoc){
            throw new Error('Invalid API Key');
        }
    
        const now = new Date();

        // Use the correct field names (isBlacklisted instead of isBlackListed)
        const isBlacklisted = apiKeyDoc.isBlacklisted && apiKeyDoc.blacklistedUntil && apiKeyDoc.blacklistedUntil > now;

        //if marked blacklisted but date has expired, fix it immediately
        if(apiKeyDoc.isBlacklisted && (!apiKeyDoc.blacklistedUntil || apiKeyDoc.blacklistedUntil <= now)){
            console.log(`Auto fixing expired blacklist for the key: ${apiKey} `)

            await rateLimitModel.updateOne(
                {
                    key: apiKey
                },
                {
                    $set: {
                        isBlacklisted: false,
                        blacklistedUntil: null,
                        excessiveRequestCount: 0
                    }
                }
            );

            //update the document in database to reflect changes
            apiKeyDoc.isBlacklisted = false;
            apiKeyDoc.blacklistedUntil = null;
            apiKeyDoc.excessiveRequestCount = 0;

        }

        return { isBlacklisted, apiKeyDoc};

    } 
    catch(error){
        console.error('Error checking blacklist status: ',error);
        throw error;
    }
};

module.exports = {checkAndFixBlacklist};