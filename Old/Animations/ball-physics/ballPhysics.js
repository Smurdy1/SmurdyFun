var velocities = [];
var positions = []; 

var bounce = 1;
var circlesCount = 100;
var speed = 2;
var color = 0xe00000;

const body = document.getElementById("body");

function removeGui() {
  document.getElementById("gui").remove();
}

function updateBounce() {
    bounce = (5 - Number(document.getElementById("bounce_slider").value) / 2);
    document.getElementById("bounce_label").innerHTML = "Bounciness: " + (5 - bounce) + "/5";
}

function updateSpeed() {
    speed = Number(document.getElementById("speed_slider").value);
    document.getElementById("speed_label").innerHTML = "Speed: " + speed + "/10";
}

function updateBallCount() {
    circlesCount = Number(document.getElementById("ball_count_slider").value);
    document.getElementById("ball_count_label").innerHTML = "                Ball Count: " + circlesCount + "/100                ";
}

function updateColor() {
    color = document.getElementById("color_picker").value;
}

function updateProperties() {
  updateBounce();
  updateSpeed();
  updateBallCount();

  console.log("updated properties");
}

function createFirstCircle() {
  var tempCircle = document.createElement("div");

  tempCircle.id = "1";
  tempCircle.className = "circle";

  tempCircle.moveSpeed = speed;

  body.appendChild(tempCircle);

  console.log("created first circle");
}

function createCircle(index) {
  var node = document.getElementById(String(index + 1));
  var clone = node.cloneNode(true);

  clone.id = String(index + 2);
  clone.moveSpeed = speed + index * speed;

  body.appendChild(clone);
}

function createCircles() {
  createFirstCircle();

  for (var i = 0; i < circlesCount - 1; i++)
  {
    createCircle(i);
  }

  console.log("created all circles");
}

function removeCircles() {
  for (var i = 1; i < document.querySelectorAll('.circle').length; i++)
  {
      document.getElementById(String(i)).remove();
  }
}

function initializeCircle(circle) {
  circle.style.top = `250px`;
  circle.style.left = `${window.innerWidth / circlesCount * Number(circle.id)}px`;
  
  circle.style.backgroundColor = color;

  const moveSpeed = circle.getAttribute('moveSpeed');
  
  velocities[Number(circle.id) - 1] = [Math.random() * speed * 6 - (speed * 6 / 2), Math.random() * speed * 12 - (speed * 12 / 2)];
  positions[Number(circle.id) - 1] = [window.innerWidth / circlesCount * Number(circle.id), 250];
  
  setInterval(() => {
    moveCircle(circle.id);
  }, moveSpeed);
}

function moveCircle(name) {
  var circle = document.getElementById(name);

  var top = Number(circle.style.top.substring(0, circle.style.top.length - 2));
  var left = Number(circle.style.left.substring(0, circle.style.left.length - 2));

  var velocity = velocities[Number(name) - 1];

  var newY = top - velocity[0];
  var newX = left + velocity[1];

  if (top >= window.innerHeight) {
    circle.style.top = `${window.innerHeight - 30}px`;
    circle.settled = true;
  }

  if (circle.settled) {
    return;
  }
  
  if (top >= window.innerHeight - 30 && velocity[0] < 0)
  {
    velocity[0] *= -1;
    velocity[0] -= bounce * 2;
  }

  if (left <= 8 && velocity[1] < 0)
  {
    velocity[1] *= -1;
    if (velocity[1] > bounce)
    {
      velocity[1] -= bounce;
    }
  }
  else if (left >= window.innerWidth - 30 && velocity[1] > 0)
  {
    velocity[1] *= -1;
    if (velocity[1] < -1 * bounce)
    {
      velocity[1] += bounce * 2;
    }
  }

  if (top <= window.innerHeight - 30 || Math.abs(velocity[0]) > 0.9)
  {
    circle.style.top = `${newY}px`;
    velocity[0] -= 0.1;
  }

  circle.style.left = `${newX}px`;

  velocity[1] -= 0.02 * (Math.abs(velocity[1]) / velocity[1]);

  positions[Number(name) - 1] = [newX, newY];
}

function start() {
  console.log("started simulation");

  updateProperties();

  speed /= 3;

  removeCircles();
  createCircles();

  const circles = document.querySelectorAll('.circle');

  circles.forEach(circle => {
    initializeCircle(circle);
  });

  removeGui();
}