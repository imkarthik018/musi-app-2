(function(){
  const cursor = document.getElementById('glassCursor');
  if (!cursor) return;

  const svg = cursor.querySelector('svg');

  let mouseX = window.innerWidth/2;
  let mouseY = window.innerHeight/2;
  let ringX = mouseX;
  let ringY = mouseY;

  const ease = 0.15;

  window.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursor.style.top = (mouseY - cursor.offsetHeight/2) + 'px';
    cursor.style.left = (mouseX - cursor.offsetWidth/2) + 'px';
  });

  const lerp = (a, b, t) => a + (b - a) * t;

  function follow() {
    ringX = lerp(ringX, mouseX, ease);
    ringY = lerp(ringY, mouseY, ease);
    cursor.style.transform = `translate3d(calc(${ringX - cursor.offsetLeft}px),calc(${ringY - cursor.offsetTop}px),0) scale(1)`;
    requestAnimationFrame(follow);
  }
  cancelAnimationFrame();
  follow();

  document.addEventListener('mousedown', () => {
    cursor.classList.add('click-effect');
    setTimeout(() => cursor.classList.remove('click-effect'), 200);
  });

  function addHoverEffects() {
    document.querySelectorAll('.cursor-target').forEach(el => {
      if (el.dataset.hoverAdded) return;
      el.dataset.hoverAdded = 'true';

      el.addEventListener('mouseenter', () => {
        cursor.classList.add('play-icon');
      });
      el.addEventListener('mouseleave', () => {
        cursor.classList.remove('play-icon');
      });
    });

    document.querySelectorAll('a, button').forEach(el => {
      if (el.dataset.hoverAdded) return;
      el.dataset.hoverAdded = 'true';

      el.addEventListener('mouseenter', (e) => {
        if (el.classList.contains('cursor-target')) return;
        cursor.classList.add('hover-link');
      });
      el.addEventListener('mouseleave', () => {
        if (el.classList.contains('cursor-target')) return;
        cursor.classList.remove('hover-link');
      });
    });
  }

  addHoverEffects();

  const observer = new MutationObserver(() => {
    addHoverEffects();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  window.addEventListener('keydown', e => {
    if(e.key === 'Escape') {
      cursor.classList.add('hide');
    }
  });
})();