// The job of this script is to monitor each of the current sensor files for changes - looking for new readings
var sensorFiles = require('./sensorFiles');
var sensors = require('./sensors');

var latestReadingsTimout = null;
var statsTimeout = null;
var io;


var updateLatestReadings = function() {
    var sensorCount = sensorFiles.count();
    for(var index = 0;index <sensorCount;index++){
        var latestReadings = sensors.getLatestReadings(index);
        io.emit('updateLatestReadings', {
            message: latestReadings
        });
    }
};

var updateStats = function() {
    var sensorCount = sensorFiles.count();
    for(var index = 0;index <sensorCount;index++){
        var stats = sensors.getExtremeTemperatures(index, sensors.TimePeriod.Day);
        io.emit('updateStats', {
            index: index,
            message: stats
        });
    }
};

exports.stopWatchingForSensorDataChanges = function () {
    console.log("Stop Watching for changes for socket ");
    clearInterval(latestReadingsTimout);
    clearInterval(statsTimeout);
    latestReadingsTimout = null;
    statsTimeout = null;
};

exports.watchForSensorDataChanges = function(theSingleIo, clientSocket){
    // Watch for changes to the sensor files and gather stats / and send updates as needed.
    io = theSingleIo;

    console.log("Watching for changes for socket ");
    // TODO: For now just polling the data.. Watch for changes in any of todays files (and also at the change over at midnight)
    if(latestReadingsTimout == null) {
        latestReadingsTimout = setInterval(updateLatestReadings, 3 * 1000);
    }
    if(statsTimeout == null) {
        statsTimeout = setInterval(updateStats, 60 * 1000);
    }

    // Send the names now
    var sensorCount = sensorFiles.count();
    var allNames = {};
    allNames.sensorCount = sensorCount;
    for(var index = 0;index <sensorCount;index++){
        allNames[index] = sensorFiles.getName(index);
    }
    clientSocket.emit('updateName', {
        message: allNames
    });

    // Update the stats now - will update all clients not just the newly connected one.. could pass in the clientSocket..?
    updateStats();
};
