require('dotenv').config();

const { MongoClient } = require('mongodb');
const uri = require('./atlas_uri');
const client = new MongoClient(uri);

const { google } = require('googleapis');

const { spreadsheets } = require('./spreadsheet-ids.json');

const googleSheets = google.sheets({
    version: 'v4',
    auth: process.env.GOOGLE_SHEETS_API_KEY
})

const { postToDatabase } = require('./update-data.js');

async function connectToMongo() {
    try {
        await client.connect();
        console.log('MongoDB connection successful.');
    } catch (error) {
        console.error('Error connecting to MongoDB.');
        console.error(error);
    }
}

async function getCollectionData(company, collectionName) {
    try {
        let dbName;
        if (company === 'intra') {
            dbName = 'intraRoute';
        } else if (company === 'blu') {
            dbName = 'bluTransit';
        }
    
        let collection = client.db(dbName).collection(collectionName);
    
        return await collection.find().toArray();
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function getRouteData(company, mode) {
    try {
        let collectionName;
    
        if (company === 'intra') {
            if (mode === 'rail') {
                collectionName = 'intraRailRoutes';
            }
        }

        return await getCollectionData(company, collectionName);
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function getStopData(company, mode) {
    try {
        let collectionName;
    
        if (company === 'intra'){
            if (mode === 'rail') {
                collectionName = 'intraRailStops';
            }
        }
    
        return await getCollectionData(company, collectionName);
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function updateStopData(company) {
    try {
        let routes = [];
        let stops = [];

        if (company === 'intra') {
            let railStops = await getStopData(company, 'rail');
            // add all modes

            stops = stops.concat(railStops);

            let railRoutes = await getStopData(company, 'rail');
            // add all modes

            routes = routes.concat(railRoutes);
        }

        let stopsMap = new Map();

        for (let stop of stops) {
            stopsMap.set(stop.id, stop);
        }

        class Connection {
            constructor(id, routes, cost) {
                this.id = id;
                this.routes = routes;
                this.cost = cost;
            }
        }

        for (let route of routes) {
            let stopIds = [];
            for (let stop of route.stops) {
                stopIds.push(stop.id);
            }

            for (let id of stopIds) {
                let stop = stopsMap.get(id);
                stop.routes.push(route.id);
            }
        }
    }
}

async function master() {
    console.log(await getCollectionData('intra', 'intraRailRoutes'));
}

master();