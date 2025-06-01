require('dotenv').config()
const mongoose = require('mongoose')

const connectdb = async (req,res) => {
    await mongoose.connect(process.env.MONGODB_URI)
}

module.exports = {connectdb}