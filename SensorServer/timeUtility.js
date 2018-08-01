
exports.millisecondsToTimeString = function(milliSeconds) {
    var hours = Math.floor(milliSeconds / (1000 * 60 * 60));
    var minutes = Math.floor((milliSeconds - (hours * 1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((milliSeconds - (((hours * 60)+minutes) * 60 * 1000)) / 1000);
    var timeString = "";
    if(hours > 0) {
        timeString = hours +" h ";
    }
    if(minutes > 0) {
        timeString += minutes+" m ";
    }
    if(seconds > 0) {
        timeString += seconds+" s ";
    }
    return timeString;
};
