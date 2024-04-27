let active = false;
let milliseconds = 0, seconds = 0, minutes = 0, hours = 0;

function start() {
    active = true;
    updateClock();
}
function stop() {
    active = false;
}
function reset() {
    active = false;
    milliseconds = 0, seconds = 0, minutes = 0, hours = 0;
    document.getElementById("display").textContent = "00:00:00:00";
}
function updateClock() {
    intervalId = setInterval(() => {
        if (active) {
        milliseconds == 99 ? (milliseconds = 0, seconds++) : milliseconds++;
        if (seconds == 60) {
            seconds = 0;
            minutes++;
        };
        if (minutes == 60) {
            minutes = 0;
            hours++;
        };
        document.getElementById("display").textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(2, '0')}`;
        } else {
            clearInterval(intervalId);
        }
    }, 10);
}