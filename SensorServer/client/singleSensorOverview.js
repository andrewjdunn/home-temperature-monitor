
function listenForUpdates() {

    console.log("Listening for updates on updateLatestReadings");

    socket.on('updateLatestReadings', function (data) {
        var latestReadings = data.message;
        var id = latestReadings.index;
        var sensorRow = $('.sensorRow[id='+id+']');
        sensorRow.find(' .latestTemperature').html(latestReadings.temperature);
        sensorRow.find(' .latestTemperature').attr('title',latestReadings.readingTime);
        sensorRow.find(' .latestHumidity').html(latestReadings.humidity);
        sensorRow.find(' .temperatureState').html(latestReadings.temperatureState);
    });

    socket.on('updateName', function (data) {
        var count = data.message.sensorCount;
        for(var id = 0;id < count;id++) {
            $('.sensorRow[id='+id+']').find(' .sensorName').html(data.message[id]);
        }
    });

    socket.on('updateStats', function (data) {
        var id = data.index;
        var stats = data.message;

        var sensorRow = $('.sensorRow[id='+id+']');
        sensorRow.find(' .highestTemperature').html(stats.highestTemperature);
        sensorRow.find(' .lowestTemperature').html(stats.lowestTemperature);
        sensorRow.find(' .highestTemperatureTime').html(stats.highestTemperatureTime);
        sensorRow.find(' .lowestTemperatureTime').html(stats.lowestTemperatureTime);

        sensorRow.find(' .tooColdForTime').html(stats.tooColdForTime);
        sensorRow.find(' .tooWarmForTime').html(stats.tooWarmForTime);
        setVisibility(sensorRow.find(' .tooWarmForInfo'),stats.hasBeenTooWarm);
        setVisibility(sensorRow.find(' .tooColdForInfo'),stats.hasBeenTooCold);
    });
}

var setVisibility = function(element, visible){
    if(visible === true){
        element.show();
    }
    else {
        element.hide();
    }
};
