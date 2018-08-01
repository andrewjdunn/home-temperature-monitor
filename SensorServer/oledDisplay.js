'use strict';

var fs = require('fs');
var ioctl = require('ioctl');

// Accepts a monochrome 128 x 64 bitmap and converts it into a 256 bytes to display on the oled 8 bytes per column

const i2cAddress = 0x3C;
const deviceName = "//dev/i2c-1";
const initSequence = new Uint8Array([0x00,0xAE,0xA8,0x3F,0xD3,0x00,0x40,0xA1,0xC8,0xDA,0x12,0x81,0x7F,0xA4,0xA6,0xD5,0x80,0x8D,0x14,0xD9,0x22,0xD8,0x30,0x20,0x00,0xAF]);
const setFullRange = new Uint8Array([0x00,0x21,0x00,0x7F,0x22,0x00,0x07]);
var displayBuffer = new Uint8Array(1025);

var oledHasBeenInitalised = false;

var initialiseOled = function(){
    oledHasBeenInitalised = true;
    writeI2C(initSequence);
    writeI2C(setFullRange);
    console.log('Oled initialised');
};

var writeI2C = function(bytes) {
    var i2cHandle;
    if ((i2cHandle = fs.openSync(deviceName, 'w')) >= 0) {
        if(
            ioctl(i2cHandle, 0x0703, i2cAddress)>=0) {
            fs.writeSync(i2cHandle, bytes);
        }
    }
    // Close the i2c device bus
    fs.closeSync(i2cHandle);
};

exports.showBitmap = function(imageData){
    if(!oledHasBeenInitalised) {
        initialiseOled();
    }

    for(var index = 1;index < displayBuffer.length;index++){
        displayBuffer[index] = 0;
    }
    displayBuffer[0] = 0x40;


    var bytecount = 0;

    for(var x = 0;x < 128;x++) {
        for(var y = 0;y <= 64;y = y + 8) {

            ++bytecount;
            var b1 = imageData.data[getImageDataPosition(x,y)] === 1 ? 1 : 0;
            var b2 = imageData.data[getImageDataPosition(x,y+1)] === 1 ? 1 : 0;
            var b3 = imageData.data[getImageDataPosition(x,y+2)] === 1 ? 1 : 0;
            var b4 = imageData.data[getImageDataPosition(x,y+3)] === 1 ? 1 : 0;
            var b5 = imageData.data[getImageDataPosition(x,y+4)] === 1 ? 1 : 0;
            var b6 = imageData.data[getImageDataPosition(x,y+5)] === 1 ? 1 : 0;
            var b7 = imageData.data[getImageDataPosition(x,y+6)] === 1 ? 1 : 0;
            var b8 = imageData.data[getImageDataPosition(x,y+7)] === 1 ? 1 : 0;

            var oledBufferPosition = ( y / 8 * 128) + x + 1;
            displayBuffer[oledBufferPosition ] = b1 | (b2 << 1) | (b3 << 2) | (b4 << 3) | (b5 << 4) | (b6 << 5) | (b7 << 6) | (b8 <<7);
        }
    }

    writeI2C(displayBuffer);
};

var getImageDataPosition = function(x,y){
    return (x + (y * 128)) * 4;
};
