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

const { getCollectionData, getRouteData, getStopData, getMap, getAllCompanyRoutes } = require('./add-stop-routes.js');

async function connectToMongo() {
    try {
        await client.connect();
        console.log('MongoDB connection successful.');
    } catch (error) {
        console.error('Error connecting to MongoDB.');
        console.error(error);
    }
}

class Connection {
    constructor(id, cost) {
        this.id = id;
        this.cost = cost;
    }
    routes = []
}

async function addConnectionsFromRoute(routeId, routes, stops) {
    try {
        let routesMap = await getMap(routes);
        let stopsMap = await getMap(stops);

        let route = routesMap.get(routeId);

        let i = 0;

        for (let stop of route.stops) {
            let stopObj = stopsMap.get(stop.id);

            for (let j = i + 1; j < route.stops.length; j++) {
                let newStopId = route.stops[j].id;
                let cost =  j - i;

                let existingConnection = stopObj.connections.find(e => e.id === newStopId);

                if (existingConnection) {
                    existingConnection.routes.push(routeId);

                    if (cost < existingConnection.cost) {
                        existingConnection.cost = cost;
                    }
                } else {
                    let connection = new Connection(newStopId, cost);
                    connection.routes.push(routeId);
                    stopObj.connections.push(connection);
                }
            }

            i++;
        }

        console.log('ping');
        return stops;

    } catch (error) {
        console.error(error);
        return null;
    }
}

async function getAllCompanyStops(company) {
    try {
        let stops = [];
        if (company === 'intra') {
            stops = stops.concat(await getStopData('intra', 'rail'));
            // other modes
        }
        return stops;
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function loopThroughModeRoutes(company, mode) {
    try {
        let routes = await getRouteData(company, mode);
        let stops = await getStopData(company, mode);

        for (let route of routes) {
            stops = addConnectionsFromRoute(route.id, routes, stops);
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

async function addConnections(company) {
    try {
        await connectToMongo();

        if (company === 'intra') {
            await loopThroughModeRoutes(company, 'rail');
            // add other modes
        }
    } catch (error) {
        console.error(error);
        return null;
    }
}

addConnections('intra');

module.exports = { addConnections };