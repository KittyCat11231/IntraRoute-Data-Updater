require('dotenv').config();

const { google } = require('googleapis');

const { MongoClient } = require('mongodb');
const uri = require('./atlas_uri');