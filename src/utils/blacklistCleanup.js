const rateLimitModel = require('../models/api.js');

// This function finds all API Keys with expired blacklist periods and then removes their blacklist status

const cleanupExpiredBlacklists = async () => {
    try{
        const now = new Date();

        console.log(`Cleaning up blacklists expired before ${now}`);

        //count expired blacklists before clean up

        const expiredCount = await rateLimitModel.countDocuments({
            isBlacklisted: true,
            blacklistedUntil: {$lte : now}

        });

        console.log(`Found ${expiredCount} expired blacklisted keys`);

        // Only perform the update if there are expired keys
        if (expiredCount === 0) {
            return 0;
        }

        //update all API Keys with expired blacklists in a single operation
        const result = await rateLimitModel.updateMany(
            {
                isBlacklisted: true,
                blacklistedUntil: { $lte: now},

            },
            {
                $set: {
                    isBlacklisted: false,
                    blacklistedUntil: null,
                    excessiveRequestCount: 0,
                }
            }
        );

        if(result.modifiedCount > 0){
            console.log(`Cleaned up ${result.modifiedCount} expired blacklists`);
        }

        return result.modifiedCount;
    }
    catch (error) {
        console.error('Error cleaning up expired blacklists:', error);
        throw error;
    }

};

module.exports = { cleanupExpiredBlacklists };