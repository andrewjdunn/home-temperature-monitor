var http = require('http');
var url = require('url');
var sensors = require('./sensors');
var sensorOverview = require('./sensorOverview');
var oledUpdater = require('./oledUpdater');
var sensorDataWatcher = require('./sensorDataWatcher');
Canvas = require('canvas');

var server = http.createServer(function(req,res) {

    var url_parts = url.parse(req.url,true);
    var pathName = url_parts.pathname;
    console.log("URL = "+req.url);

    if(pathName === '/') {
        res.writeHead(200, {'Content-Type' : 'text/html'});
        var sensorOverviewFile = fs.readFileSync("client/sensorOverview.html");
        var tableRows = sensorOverview.getSensorOverviewTableRows();
        // Insert the table rows
        var html = sensorOverviewFile.toString().replace("<tr/>", tableRows);
        res.write(html, 'binary');

    }
    // TODO: Maybe this is too open - allows all files to be read...
    else if(url_parts.query.id === undefined) {
        console.log("Serving out file "+pathName);
        if(fs.existsSync(pathName.substr(1))) {
            // This check to clear the css plain text warning.. bit crappy
            if(pathName.indexOf(".css" > 0))
            {
                 res.writeHead(200, {'Content-Type' : 'text/css'});
            }
            var file = fs.readFileSync(pathName.substr(1));
            res.write(file, 'binary');
        } else {
            console.log("I dont have a "+pathName);
        }
    }

    res.end();

}).listen(8080);

oledUpdater.startOledUpdateTimer();

var io = require('socket.io')(server);
var clientCount = 0;
io.on('connection', function (socket) {
    sensorDataWatcher.watchForSensorDataChanges(io, socket);
    ++clientCount;
    console.log('Client connected now '+clientCount+' connected');

    socket.on('disconnect', function(reason) {
        --clientCount;
        console.log('Client disconnected now '+clientCount+' left on');
        if(clientCount === 0) {
            sensorDataWatcher.stopWatchingForSensorDataChanges();
        }
    });

});
