const crypto = require('node:crypto')

//generate api key of length 32

const generateApiKey = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

module.exports = {
  generateApiKey
};
