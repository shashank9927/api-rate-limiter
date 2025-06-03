const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
    key:{
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    userId:{
        type: String,
        required: true,
    },
    limits: {
        requestPerMinute: {
            type: Number,
            required: true,
            default: 60
        }
    },
    windowStart:{
        type: Date,
        default: Date.now
    },
    requestCount: {
        type: Number,
        default: 0,
    },
    excessiveRequestCount: {
        type: Number,
        default: 0
    },
    isBlackListed: {
        type: Boolean,
        default: false
    },
    blackListedUntil:{
        type: Date,
        default: null
    },

    },
    {
        timestamps:true        
    }
);

const rateLimitModel = mongoose.model('ApiKey',apiKeySchema)

module.exports = rateLimitModel