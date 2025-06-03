require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cron = require('node-cron');
const {apiRoutes} = require('./routes/apiRoute.js');
const { cleanupExpiredBlacklists } = require('./utils/blacklistCleanup');
const {connectdb} = require('./config/database.js')

const PORT = process.env.PORT;

const app = express();

app.use(express.json());

//routes
app.use('/',apiRoutes);



connectdb()
        .then(()=>{
            console.log('Connected to database successfully');
            app.listen(PORT,()=>{
                console.log(`Connected to PORT: ${PORT} successfully`);
                //schedule task to clean up expired blacklists every hour
                cron.schedule('0 * * * *', async () => {
        console.log('Running scheduled task: Cleaning up expired blacklists');
        try {
          const cleanedCount = await cleanupExpiredBlacklists();
          if (cleanedCount > 0) {
            console.log(`Successfully cleaned ${cleanedCount} expired blacklists`);
          } else {
            console.log('No expired blacklists found');
          }
        } catch (error) {
          console.error('Error running scheduled blacklist cleanup:', error);
        }
      });
       // Run an initial cleanup on server start
      cleanupExpiredBlacklists()
        .then(count => {
          if (count > 0) {
            console.log(`Initial cleanup: Removed ${count} expired blacklists`);
          }
        })
        .catch(error => {
          console.error('Error during initial blacklist cleanup:', error);
        });

            });
        })
        .catch((error)=>{
            console.log(`Unable to connect to database.\n Error: ${error.message}`)
        });

