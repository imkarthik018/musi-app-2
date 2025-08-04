const cursor = document.getElementById("cursor");
const dot = cursor.querySelector(".dot");
const svg = cursor.querySelector("svg");
const hoverTargets = document.querySelectorAll(".cover");

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

window.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

function animateCursor() {
  cursor.style.left = `${mouseX}px`;
  cursor.style.top = `${mouseY}px`;
  requestAnimationFrame(animateCursor);
}
animateCursor();

hoverTargets.forEach((el) => {
  el.addEventListener("mouseenter", () => {
    cursor.classList.add("play-mode");
  });
  el.addEventListener("mouseleave", () => {
    cursor.classList.remove("play-mode");
  });
});

window.addEventListener("mousedown", () => {
  cursor.style.transform = "translate(-50%, -50%) scale(0.6)";
});
window.addEventListener("mouseup", () => {
  cursor.style.transform = "translate(-50%, -50%) scale(1)";
});