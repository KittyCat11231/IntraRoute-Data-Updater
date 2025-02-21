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

            let id = row[0];
            let type = row[1];
            let num = row[2];
            let name = row[3];
            let destinationId = row[4];

            if (num === 'null') {
                num = null;
            }
            if (name === 'null') {
                name = null;
            }

            if (id) {
                routes.push(new Route(id, type, num, name, destinationId));
            }

            let lastIndex = routes.length - 1;

            let stopId = row[5];
            let meta1 = row[6];
            let meta2 = row[7];
            let displayFullDestName;
            if (row[8] === 'yes') {
                displayFullDestName = true;
            } else {
                displayFullDestName = false;
            }
            let skipTo = row[9];

            if (meta1 === 'null') {
                meta1 = null;
            }
            if (meta2 === 'null') {
                meta2 = null;
            }
            if (skipTo === 'null') {
                skipTo = null; 
            }

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

            for (let cell of row) {
                if (cell = 'null') {
                    cell = null;
                }
            }

            let id = row[0];
            let code = row[1];
            let city = row[2];
            let stopName = row[3];
            let keywords = row[7];

            if (stopName === 'null') {
                stopName = null;
            }

            if (id) {
                stops.push(new Stop(id, code, city, stopName, keywords));
            }

            let lastIndex = stops.length - 1;

            let adjStopId = row[4];
            let routes = [row[5]];
            let cost = row[6];

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