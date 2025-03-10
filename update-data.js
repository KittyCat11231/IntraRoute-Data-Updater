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

async function connectToMongo() {
    try {
        await client.connect();
        console.log('MongoDB connection successful.');
    } catch (error) {
        console.error('Error connecting to MongoDB.');
        console.error(error);
    }
}

async function getDataFromOneSheet(company, modeAndType) {
    try {
        if (company === 'intra') {
            const spreadsheetId = spreadsheets.intraRoute;

            let response = await googleSheets.spreadsheets.values.get({
                'spreadsheetId': spreadsheetId,
                'range': modeAndType
            })

            return response.data.values;

        } else if (company === 'blu'){
            //
        }
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function getRouteData(company, mode) {
    try {
        let modeAndType;

        if (company === 'intra') {
            if (mode === 'rail') {
                modeAndType = 'rail routes'
            }
        }

        const data = await getDataFromOneSheet(company, modeAndType);

        class Route {
            stops = [];
            constructor(id, type, num, name, destinationId) {
                this.id = id;
                this.type = type;
                this.num = num;
                this.name = name;
                this.destinationId = destinationId;
            }
        }

        class RouteStop {
            constructor(id, meta1, meta2, displayFullDestName, skipTo) {
                this.id = id;
                this.meta1 = meta1;
                this.meta2 = meta2;
                this.displayFullDestName = displayFullDestName;
                this.skipTo = skipTo;
            }
        }

        let routes = [];

        for (const row of data) {
            if (row[0] === 'ID' || !row[5]) {
                continue;
            }

            let id = helpers.nullify(row[0]);
            let type = helpers.nullify(row[1]);
            let num = helpers.nullify(row[2]);
            let name = helpers.nullify(row[3]);
            let destinationId = helpers.nullify(row[4]);

            if (id) {
                routes.push(new Route(id, type, num, name, destinationId));
            }

            let lastIndex = routes.length - 1;

            let stopId = helpers.nullify(row[5]);
            let meta1 = helpers.nullify(row[6]);
            let meta2 = helpers.nullify(row[7]);
            let displayFullDestName;
            if (row[8] === 'yes') {
                displayFullDestName = true;
            } else {
                displayFullDestName = false;
            }
            let skipTo = helpers.nullify(row[9]);

            routes[lastIndex].stops.push(new RouteStop(stopId, meta1, meta2, displayFullDestName, skipTo));
        }

        return routes;

    } catch (error) {
        console.error(error);
        return null;
    }
}

async function getStopData(company, mode) {
    try {
        let modeAndType;

        if (company === 'intra') {
            if (mode === 'rail') {
                modeAndType = 'rail stops'
            }
        }

        const data = await getDataFromOneSheet(company, modeAndType);

        class Stop {
            routes = [];
            connections = [];
            constructor(id, code, city, stopName, keywords) {
                this.id = id;
                this.code = code;
                this.city = city;
                this.stopName = stopName;
                this.keywords = keywords;
            }
        }

        class Connection {
            constructor(id, routes, cost) {
                this.id = id;
                this.routes = routes;
                this.cost = cost;
            }
        }

        let stops = [];

        for (const row of data) {
            if (row[0] === 'ID' || !row[4]) {
                continue;
            }

            let id = helpers.nullify(row[0]);
            let code = helpers.nullify(row[1]);
            let city = helpers.nullify(row[2]);
            let stopName = helpers.nullify(row[3]);
            let keywords = helpers.nullify(row[7]);

            if (id) {
                stops.push(new Stop(id, code, city, stopName, keywords));
            }

            let lastIndex = stops.length - 1;

            let adjStopId = helpers.nullify(row[4]);
            let routes = [helpers.nullify(row[5])];
            let cost = helpers.nullify(row[6]);

            if (adjStopId) {
                stops[lastIndex].connections.push(new Connection(adjStopId, routes, cost));
            }
        }

        return stops;

    } catch (error) {
        console.error(error);
        return null;
    }
}

async function postToDatabase(data, company, collectionName) {
    try {
        let dbName;
        if (company === 'intra') {
            dbName = 'intraRoute';
        } else if (company === 'blu') {
            dbName = 'bluTransit';
        }
    
        let collection = client.db(dbName).collection(collectionName);
    
        const dropResult = await collection.drop();
        const insertResult = await collection.insertMany(data);

        return insertResult;
    } catch (error) {
        console.error(error);
    }
}

async function updateModeData(company, mode) {
    try {
        if (company === 'intra') {
            // rail, bus, air, sail, omega
            const routes = await getRouteData(company, mode).then(console.log('ding 1!'));
            const stops = await getStopData(company, mode).then(console.log('ding 2!'));
    
            let routeCollectionName;
            let stopCollectionName;
    
            if (mode === 'rail') {
                routeCollectionName = 'intraRailRoutes'
                stopCollectionName = 'intraRailStops'
            }
    
            await postToDatabase(routes, company, routeCollectionName)
            .then(console.log(`Updated ${routeCollectionName} data.`)).then();
    
            await postToDatabase(stops, company, stopCollectionName)
            .then(console.log(`Updated ${stopCollectionName} data.`));
        }
    } catch (error) {
        console.error(error);
    }
}

async function updateData(company) {
    try {
        await connectToMongo();
        if (company === 'intra') {
            await updateModeData('intra', 'rail');
            // add more modes later
        } else if (company === 'blu') {
            // add modes later
        }
    } catch (error) {
        console.error(error);
    }
}

module.exports = { updateData, postToDatabase }