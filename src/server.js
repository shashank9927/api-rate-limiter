require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const {connectdb} = require('./config/database.js')

const PORT = process.env.PORT;

const app = express()

connectdb()
        .then(()=>{
            console.log('Connected to database successfully');
            app.listen(PORT,()=>{
                console.log(`Connected to PORT: ${PORT} successfully`);
            });
        })
        .catch((error)=>{
            console.log(`Unable to connect to database.\n Error: ${error.message}`)
        })

        