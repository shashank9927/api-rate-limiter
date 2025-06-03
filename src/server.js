require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cron = require('node-cron');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const { cleanupExpiredBlacklists } = require('./utils/blacklistCleanup');
const {connectdb} = require('./config/database.js')

const PORT = process.env.PORT;

const app = express();


app.use(express.json());

// Routes configuration
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes); // mount admin routes at /admin
app.use('/user', userRoutes); // mount user routes at /user


// Root route for testing
app.get('/', (req, res) => {
  res.status(200).json({ message: 'API is working' });
});

// Catch-all route for unhandled paths - add at end of all routes
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `The requested resource (${req.originalUrl}) was not found`,
    availableEndpoints: {
      generalApi: {
        root: '/ - API status',
        api: '/api - General API information'
      },
      userEndpoints: {
        usage: '/user/usage - Get API usage statistics',
        apiKeys: '/user/api-keys - Generate new API key (POST)',
        protected: '/user/protected - Rate-limited endpoint',
        blacklistStatus: '/user/blacklist-status - Check if key is blacklisted'
      },
      adminEndpoints: {
        root: '/admin - Admin dashboard information',
        apiStatus: '/admin/api-status - Admin API status',
        blacklistedKeys: '/admin/blacklisted-keys - View blacklisted keys',
        cleanupBlacklists: '/admin/cleanup-blacklists - Clean expired blacklists (POST)'
      }
    }
  });
});


connectdb()
    .then(()=>{
        console.log('Connected to database successfully');
        app.listen(PORT,()=>{
            console.log(`Connected to PORT: ${PORT} successfully`);
            //schedule task to clean up expired blacklists every hour
            cron.schedule('0 * * * *', async () => 
                {
                console.log('Running scheduled task: Cleaning up expired blacklists');
                try 
                    {
                    const cleanedCount = await cleanupExpiredBlacklists();
                    if (cleanedCount > 0) 
                        {
                            console.log(`Successfully cleaned ${cleanedCount} expired blacklists`);
                        } 
                        else 
                        {
                            console.log('No expired blacklists found');
                        }
                    } 
                catch (error) 
                    {
                        console.error('Error running scheduled blacklist cleanup:', error);
                    }
                });
                
                // Run an initial cleanup on server start
                console.log('Running initial blacklist cleanup on server start...');
                cleanupExpiredBlacklists()
                    .then(count => {
                    if (count > 0) {
                        console.log(`Initial cleanup: Removed ${count} expired blacklists`);
                    } else {
                        console.log('Initial cleanup: No expired blacklists found');
                    }
                    })
                    .catch(error => {
                    console.error('Error during initial blacklist cleanup:', error);
                    });
                });
            })

        .catch((error)=>{
            console.log(`Unable to connect to database.\n Error: ${error.message}`);
            process.exit(1);
        });

// Error handler middleware (should be after all routes)
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.stack}`);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});