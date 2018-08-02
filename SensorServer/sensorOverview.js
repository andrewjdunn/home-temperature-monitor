// Generates HTML showing the temperatures of all connected sensors

var sensorFiles = require('./sensorFiles');
fs = require("fs");

var getSensorOverviewTableRow = function(i) {
    var file = fs.readFileSync("client/singleSensorOverview.html");
    return file.toString().replace(/CURRENT_ID/g,i);
};

exports.getSensorOverviewTableRows = function() {

    var sensorCount = sensorFiles.count();
    var tableRows = "";
    for (var i = 0; i < sensorCount; i++) {
        tableRows = tableRows.concat(getSensorOverviewTableRow(i));
    }
    return tableRows;
};


