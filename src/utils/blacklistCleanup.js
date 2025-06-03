const rateLimitModel = require('../models/api.js');

// This function finds all API Keys with expired blacklist periods and then removes their blacklist status

const cleanupExpiredBlacklists = async () => {
    try{
        const now = new Date();

        const result = await rateLimitModel.updateMany(
            {
                isBlacklisted: true,
                blacklistedUntil: {$lte: now} //checks if blacklisted time has finished
            },
            {
                $set: {
                    isBlacklisted: false,
                    blacklistedUntil: null,
                    excessiveRequestCount: 0

                }
            }
        );
        if(result.modifiedCount > 0){
            console.log(`Cleaned up ${result.modifiedCount} expired blacklists`);
        }

        return result.modifiedCount;
    }
    catch(error){
        console.log('Error cleaning up expired blacklists: ',error);
        throw error;
    }
};

module.exports = {cleanupExpiredBlacklists};