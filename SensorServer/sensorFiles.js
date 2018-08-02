'use strict';

var fs = require('fs');

const MaximumLineSize = 201;
const rootPath = "/srv/dht";

var sensorDirectorys = 0;

exports.getLatestFileName = function(directoryName) {
    var fileNames = fs.readdirSync(directoryName);
    var latestFileName = "";
    var latestTime = 0;

    for(var i = 0; i< fileNames.length;i++) {
        var fileName = fileNames[i];
        var stat = fs.statSync(directoryName+"/"+fileName);
        if(stat.isFile()) {

            var fileDate = new Date(stat.mtime);
            if (fileDate.getTime() > latestTime) {
                latestTime = fileDate.getTime();
                latestFileName = fileName;
            }
        }
    }
    return latestFileName;
};

exports.getLatestValues = function(index) {
    var directoryName = exports.getName(index);
    var latestFile = exports.getLatestFileName(rootPath+"/"+directoryName);
    var stat = fs.statSync(rootPath+"/"+directoryName+"/"+latestFile);
    var fd = fs.openSync(rootPath+"/"+directoryName+"/"+latestFile, "r");

    var buffer = Buffer.alloc(MaximumLineSize + 1);
    fs.readSync(fd,buffer, 0, MaximumLineSize, stat.size - MaximumLineSize);
    fs.closeSync(fd);

    var lines = buffer.toString().split('\n');
    var lastLine = lines[lines.length-2];

    var values = lastLine.split(',');
    var readings = {};
    readings.readingTime = values[0];
    readings.fileDate = new Date(stat.mtime);
    readings.index = index;
    readings.temperature = values[2];
    readings.humidity = values[1];
    return readings;
};

fs.readdir(rootPath, function(err,items) {
    sensorDirectorys = items;
});

exports.count =  function() {
    return sensorDirectorys.length;
};

exports.getName = function(index) {
    return sensorDirectorys[index];
};

exports.getFileNameForDate = function(directoryName, date) {
    return rootPath + directoryName +"/" + date.getDate().toString().padStart(2,"0")+(date.getMonth()+1).toString().padStart(2,"0")+date.getFullYear().toString().padStart(2,"0")+".csv";
};

