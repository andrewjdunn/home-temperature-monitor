// Common configuration items
'use strict';

const roomType = {
    Bedroom : "Bedroom",
    LivingRoom : "LivingRoom",
    Kitchen : "Kitchen",
    Outhouse : "Outhouse"
};

exports.RoomType = roomType;

exports.getHighTemperature = function(RoomType) {
    // TODO: Ignoring the room type for now... will need values for other than berooms
    return 22;
};

exports.getLowTemperature = function(RoomType) {
    return 15.5;
};