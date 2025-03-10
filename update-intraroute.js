const { updateData } = require('./update-data');
const { addRoutes } = require('./add-stop-routes');

async function master() {
    await updateData('intra');
    await addRoutes('intra');
}

master();