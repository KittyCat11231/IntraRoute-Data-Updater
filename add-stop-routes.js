require('dotenv').config();

const { MongoClient } = require('mongodb');
const uri = require('./atlas_uri');
const client = new MongoClient(uri);

const { helpers } = require('@kyle11231/helper-functions');

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

async function getAllCompanyRoutes(company) {
    try {
        let routes = [];
        if (company === 'intra') {
            routes = routes.concat(await getRouteData('intra', 'rail'));
            // other modes
        }
        return routes;
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function getMap(array) {
    try {
        let map = new Map();
        for (let item of array) {
            map.set(item.id, item);
        }
        return map;
    } catch (error) {
        console.error(error);
        return null;
    }
}

class Route {
    constructor(id, meta1, meta2) {
        this.id = id;
        this.meta1 = meta1;
        this.meta2 = meta2;
    }
}

async function addRoutesForModeStops(company, mode) {
    try {
        let routes = await getAllCompanyRoutes(company);
        let stops = await getStopData(company, mode);

        let stopsMap = await getMap(stops);

        for (let route of routes) {
            for (let stop of route.stops) {
                let stopObj = stopsMap.get(stop.id);

                let id = route.id;
                let meta1 = route.meta1;
                let meta2 = route.meta2;

                stopObj.routes = stopObj.routes.concat(new Route(id, meta1, meta2));
            }
        }

        let collectionName;

        if (company === 'intra') {
            if (mode === 'rail') {
                collectionName = 'intraRailStops';
            }
        }

        await postToDatabase(stops, company, collectionName);
        console.log(`Updated ${collectionName} data.`)

    } catch (error) {
        console.error(error);
        return null;
    }
}

async function addRoutes(company) {
    try {
        await connectToMongo();

        if (company === 'intra') {
            await addRoutesForModeStops(company, 'rail');
            // add other modes
        }
    } catch (error) {
        console.error(error);
        null;
    }
}

module.exports = { addRoutes };