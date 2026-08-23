
function bool() {
    document.getElementById("bool_output").innerHTML = Math.random() > 0.5;
}
function number() {
    document.getElementById("number_output").innerHTML = Math.floor(Math.random() * 10) + 1;
}
function number_choice() {
    var min = document.getElementById("number_choice_input1").value;
    var max = document.getElementById("number_choice_input2").value;
    document.getElementById("number_choice_output").innerHTML = Math.floor(Math.random() * (max - min)) + Number(min);
}

function random_letter() {
    document.getElementById("random_letter_output").innerHTML = String.fromCharCode(Math.floor(Math.random() * 26) + 65);
}

function random_color() {
    var r = Math.floor(Math.random() * 256);
    var g = Math.floor(Math.random() * 256);
    var b = Math.floor(Math.random() * 256);
    document.getElementById("random_color_output").style.backgroundColor = "rgb(" + r + ", " + g + ", " + b + ")";
}

function random_word(){
    fetch("./word-list/words.txt")
        .then((res) => res.text())
        .then((text) => {
            var words = text.split("\n");
            document.getElementById("random_word_output").innerHTML = words[Math.floor(Math.random() * words.length)];
           })
        .catch((e) => console.error(e));
}

function random_image() {
    document.getElementById("random_image_output").src = "https://picsum.photos/id/" + Math.floor(Math.random() * 100) + "/200/300";
}

function wait(secs) {
    var start = Date.now(),
        now = start;
    while (now - start < secs * 1000) {
      now = Date.now();
    }
}