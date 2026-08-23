// replaced implementation with a robust per-circle state + rAF loop

(function() {
  const MAIN = document.getElementById("main_container");
  if (!MAIN) return;

  // ensure a .circles-grid exists
  let grid = MAIN.querySelector(".circles-grid");
  if (!grid) {
    grid = document.createElement("div");
    grid.className = "circles-grid";
    MAIN.appendChild(grid);
  }

  // create circles if none exist
  const EXISTING = Array.from(grid.getElementsByClassName("circle"));
  const COUNT = 23;
  if (EXISTING.length < COUNT) {
    for (let i = EXISTING.length; i < COUNT; i++) {
      const d = document.createElement("div");
      d.className = "circle";
      d.id = "circle" + (i + 1);
      grid.appendChild(d);
    }
  }

  const circles = Array.from(grid.getElementsByClassName("circle"));
  if (!circles.length) return;

  // constants (keep in sync with CSS)
  const CIRCLE_W = 36;    // fixed circle width in px (matches CSS .circle width)
  const GAP = 4;          // gap in px (matches CSS .circles-grid gap)
  const PAD_X = 18;       // main_container horizontal padding
  const PAD_Y = 18;       // main_container vertical padding
  const BORDER = 6;       // main_container border width

  // compute available inner height (viewport-first, reliable)
  const viewportH = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
  // use a viewport fraction so sizing doesn't depend on prior layout
  const preferredInner = Math.floor(viewportH * 0.55); // ~55% of viewport height
  // enforce a sensible minimum so the box is never tiny
  const minInner = Math.max(CIRCLE_W * 4, 160);
  const mainInnerHeight = Math.max(minInner, preferredInner) - (PAD_Y * 2) - (BORDER * 2);

  // simple additive speed: leftmost slowest, each next slightly faster
  const BASE_SPEED = 0.4;
  const SPEED_STEP = 0.09;

  const state = circles.map((el, i) => {
    // start height equal to width so circles are perfect circles initially
    const base = CIRCLE_W;
    el.style.width = CIRCLE_W + "px";
    el.style.height = base + "px";
    el.style.transition = "height .12s linear";

    // max height is the container inner height so circle will touch top/bottom and reverse
    const maxH = Math.max(base + 2, mainInnerHeight);

    return {
      el,
      height: base,
      min: Math.max(12, base * 0.35),
      max: maxH,
      dir: 1, // start expanding
      speed: BASE_SPEED + (i * SPEED_STEP)
    };
  });

  // compute container width/height so box spans leftmost->rightmost circle
  const totalWidth = (COUNT * CIRCLE_W) + ((COUNT - 1) * GAP) + (PAD_X * 2) + (BORDER * 2);
  const totalHeight = Math.ceil(mainInnerHeight) + (PAD_Y * 2) + (BORDER * 2);

  MAIN.style.width = totalWidth + "px";
  // set a reliable height based on viewport-derived inner height
  MAIN.style.height = totalHeight + "px";
  MAIN.style.maxWidth = "100%";
  MAIN.style.overflowX = "auto";
  MAIN.style.boxSizing = "border-box";

  let last = performance.now();

  function frame(now) {
    const dt = Math.min(40, now - last);
    last = now;
    for (let s of state) {
      s.height += s.dir * s.speed * (dt / 16);
      // reverse immediately when hitting min or max (max now equals container inner height)
      if (s.height <= s.min) { s.height = s.min; s.dir = 1; }
      if (s.height >= s.max) { s.height = s.max; s.dir = -1; }
      s.el.style.height = Math.round(s.height) + "px";
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();