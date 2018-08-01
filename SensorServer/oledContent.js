// Generates the bitmap to display on the OLED display

exports.getOledImageData = function(name, latestReadings) {

    var canvas = new Canvas(128,64);
    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = "rgba(1, 0, 0, 255)";
    ctx.lineWidth = 1.01;
    ctx.strokeStyle = "rgba(1, 0, 0, 255)";
    // Draw some lines..
    ctx.beginPath();
    ctx.moveTo(0,40);
    ctx.lineTo(128,40);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(64,16);
    ctx.lineTo(64,40);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(32,40);
    ctx.lineTo(32,64);
    ctx.stroke();


    ctx.font='16px';
    ctx.fillText(name,1,14);

    ctx.font = "14px Arial Narrow";
    ctx.fillText(latestReadings.temperature + " °C",5, 32);
    ctx.fillText(latestReadings.humidity + " %",71, 32);

    var stateChar = '✔';

    if(latestReadings.temperatureState === "cold"){
        stateChar = '☀'
    }
    else if(latestReadings.temperatureState === "warm"){
        stateChar = '❄';
    }
    ctx.font = "26px Arial";
    ctx.fillText(stateChar,2, 64);

    // Showing time is well its ok. but why... show the avg temp or trend or better has been cold / warm warnings... need to pass in the stats also.. cache these and only update once in aa while as they are heavy at the mo
    // And the time is DST + 1... so I guess the dht is recording at local time and the server is assuming UTC...
    ctx.font = "20px Arial";
    ctx.fillText(latestReadings.readingTime, 50, 64);

    return  ctx.getImageData(0,0,128,64);
};

