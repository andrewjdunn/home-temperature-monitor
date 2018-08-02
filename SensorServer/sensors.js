'use strict';

// For sure instead of scanning the files every time this data is requested it should be held in memory and updated -
// So each senors holds it's current temp and humidity and the high and low over the (whatever the current period is)
// The low and high .. if the new temp just recorded is higher (or lower).. use that.. if the current low/high reading expires (older thean 24 hours or whatver) then scan?
/// The trouble with the above is that even if nothing is watching - each time the extreme temp expires we scan again... maybe if the extreme expires - null it - and scan when requested?
// Should be using objects,,, and prototypes maybe - I've never got much practive - might need to read up on prototypes etc..

var fs = require('fs');
var sensorFiles = require('./sensorFiles');
var sensorConfiguration = require('./sensorConfiguration');
var timeUtility = require('./timeUtility');

exports.getLatestReadings = function(index) {
    var readings = sensorFiles.getLatestValues(index);
    var fileDate = readings.fileDate;
    var readingTimeParts = readings.readingTime.split(':');

    var date = new Date(Date.UTC(
        fileDate.getFullYear(),
        fileDate.getMonth(),
        fileDate.getDate(),
        Number(readingTimeParts[0]),
        Number(readingTimeParts[1]),
        Number(readingTimeParts[2])));

    readings.readingTime = date.toLocaleTimeString();

    var tooWarm = readings.temperature > sensorConfiguration.getHighTemperature(sensorConfiguration.RoomType.Bedroom);
    var tooCold = readings.temperature < sensorConfiguration.getLowTemperature(sensorConfiguration.RoomType.Bedroom);
    readings.temperatureState = tooCold ? "cold" : tooWarm ? "warm" : "normal";
    return readings;
};

// TODO: Also add time periods - Yesterday, last week etc -
exports.TimePeriod = { Minute : "Minute", Hour : "Hour ", Day : "Day", Week : "Week", Month : "Month", Year : "Year"};


// Kinda slow this function - maybe reading a byte at a time is not a great idea :-)
exports.getExtremeTemperatures = function(index, timePeriod) {
    // Get the minimum temperature for this 'timePeriod'
    // So if you pick - Hour - its the minimum value in the last 60 minutes
    var nowDate = new Date();
    var milliSecondsToStart;

    // Probably a much smarter way to do this??!
    switch(timePeriod) {
        case exports.TimePeriod.Minute:
            milliSecondsToStart = 60 * 1000;
            break;
        case exports.TimePeriod.Hour:
            milliSecondsToStart = 60 * 60 * 1000;
            break;
        case exports.TimePeriod.Day:
            milliSecondsToStart = 24 * 60 * 60 * 1000;
            break;
        case exports.TimePeriod.Week:
            milliSecondsToStart = 7 * 24 * 60 * 60 * 1000;
            break;
        case exports.TimePeriod.Month:
            // All months are 31 days long right?
            milliSecondsToStart = 31 * 7 * 24 * 60 * 60 * 1000;
            break;
        case exports.TimePeriod.Year:
            // All years are 365 days long right?
            milliSecondsToStart = 365 * 7 * 24 * 60 * 60 * 1000;
            break;
    }
    var startDate = new Date(nowDate.getTime() - milliSecondsToStart);
    var directoryName = sensorFiles.getName(index);
    var currentDate = new Date(startDate);

    var bufferSize = 1024  * 10;
    var buffer = Buffer.alloc(bufferSize);
    var bytesRead=1;
    var extremeTemperatures = {};
    var lastLinesTime;

    do {

        var fileForCurrentDate = sensorFiles.getFileNameForDate("/"+directoryName, currentDate);

        // Get the min temp from fileForCurrentDate (if currentTDate == NowTime - stop at the time not the whole day)
        if(fs.existsSync(fileForCurrentDate)) {
            var fd = fs.openSync(fileForCurrentDate, "r");

            bytesRead = 1;
            var bufferPosition = 0;
            while (bytesRead > 0) {

                buffer.fill(0);
                bytesRead = fs.readSync(fd, buffer, 0, bufferSize, bufferPosition);
                if (bytesRead > 0) {
                    bufferPosition += bytesRead;

                    // If not finished reading - wind the buffer size back to just after the last 0xa
                    if (buffer[bytesRead - 1] !== 10) {
                        for (var bufferIndex = bytesRead - 2; bufferIndex > 0; bufferIndex--) {
                            if (buffer[bufferIndex] === 10) {
                                bufferPosition -= ((bytesRead - bufferIndex) - 1);
                                break;
                            }
                        }
                    }
                }

                var lines = buffer.toString().split('\n');

                for (var line in lines) {
                    var values = lines[line].split(',');
                    if (values.length === 3) {

                        var timeBits = values[0].split(":");
                        var thisLinesTime = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), Number(timeBits[0]), Number(timeBits[1]), Number(timeBits[2])));

                        if (thisLinesTime >= startDate && thisLinesTime <= nowDate) {

                            var thisTemp = values[2];
                            var thisTempNumber = parseFloat(thisTemp);
                            if (extremeTemperatures.lowestTemperature === undefined || thisTempNumber < extremeTemperatures.lowestTemperature) {
                                extremeTemperatures.lowestTemperature = thisTempNumber;
                                extremeTemperatures.lowestTemperatureTime = thisLinesTime.toLocaleTimeString();
                            }

                            if (extremeTemperatures.highestTemperature === undefined || thisTempNumber > extremeTemperatures.highestTemperature) {
                                extremeTemperatures.highestTemperature = thisTempNumber;
                                extremeTemperatures.highestTemperatureTime = thisLinesTime.toLocaleTimeString();
                            }

                            var timeInMillisecondsSinceLastReading = 0;
                            if (lastLinesTime !== undefined) {
                                timeInMillisecondsSinceLastReading = thisLinesTime.getTime() - lastLinesTime.getTime();
                            }

                            if (thisTempNumber < sensorConfiguration.getLowTemperature(sensorConfiguration.Bedroom)) {
                                var timeSpentTooCold = extremeTemperatures.toColdForTime === undefined ? 0 : extremeTemperatures.tooColdForTime;
                                extremeTemperatures.tooColdForTime = timeInMillisecondsSinceLastReading + timeSpentTooCold;
                            }

                            if (thisTempNumber > sensorConfiguration.getHighTemperature(sensorConfiguration.Bedroom)) {
                                var timeSpentTooWarm = extremeTemperatures.tooWarmForTime === undefined ? 0 : extremeTemperatures.tooWarmForTime;
                                extremeTemperatures.tooWarmForTime = timeInMillisecondsSinceLastReading + timeSpentTooWarm;
                            }
                        }

                        lastLinesTime = thisLinesTime;
                    }
                }
            }

            // TODO: ALso check the currentDate+lastReadTime < nowTime


            fs.closeSync(fd);
        }

        // Get the file for the next day
        currentDate.setTime(currentDate.getTime() + 24 * 60 * 60 * 1000);
    }
    while(currentDate <= nowDate);

    // Convert the too xx for times to a meaningful string

    extremeTemperatures.hasBeenTooCold = extremeTemperatures.tooColdForTime > 0;
    extremeTemperatures.hasBeenTooWarm = extremeTemperatures.tooWarmForTime > 0;

    if(extremeTemperatures.tooWarmForTime !== undefined && extremeTemperatures.tooWarmForTime > 0)
    {
        extremeTemperatures.tooWarmForTime = timeUtility.millisecondsToTimeString(extremeTemperatures.tooWarmForTime);
    }

    if(extremeTemperatures.tooColdForTime !== undefined && extremeTemperatures.tooColdForTime > 0)
    {
        extremeTemperatures.tooColdForTime = timeUtility.millisecondsToTimeString(extremeTemperatures.tooColdForTime);
    }
    return extremeTemperatures;
};

