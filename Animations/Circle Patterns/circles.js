var increasing = [true, true, true, true, true, true, true, true, true];
var circles = document.getElementsByClassName("circle");
var running = true;
var i_tracker = 0;
function updateCircles() {
    for (var i = 0; i < circles.length; i++) {
        for (var j = 0; j < circles.length; j++) {
            if (i < j) {
                break;
            }
            var circle = circles[j];
            var height = Number(circle.style.height.split("px")[0]);
            if (height < 1) {
                increasing[j] = true;
            } else if (height > 700) {
                increasing[j] = false;
            }
            circle.style.height = (height + (increasing[j] ? 1 : -1)) + "px";
        }
    }
}

setInterval(function() {
    if (running) {
        updateCircles();
        i_tracker++;
    }
}, 30);