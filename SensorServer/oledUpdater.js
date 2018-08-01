var sensors = require('./sensors');
var oled = require('./oledDisplay');
var oledContent = require('./oledContent');

const numberOfTimesToUpdateCurrentSensor = 3;

var currentSensor = 0;
var timesCurrentSensorUpdated = 0;

var updateOled = function()
{
    var latestReadings = sensors.getLatestReadings(currentSensor);
    oled.showBitmap(oledContent.getOledImageData(sensors.getName(currentSensor), latestReadings));
    var sensorCount = sensors.count();
    ++timesCurrentSensorUpdated;
    if(timesCurrentSensorUpdated > numberOfTimesToUpdateCurrentSensor) {
        timesCurrentSensorUpdated = 0;
        ++currentSensor;
        if(currentSensor >= sensorCount) {
            currentSensor = 0;
        }
    }
};


exports.startOledUpdateTimer = function () {
    setInterval(updateOled, 5000);
};
