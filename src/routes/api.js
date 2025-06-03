const express = require('express');
const router = express.Router();

// General API status route
router.get('/', (req, res) => {
  res.status(200).json({ message: 'API is working' });
});

module.exports = router;
