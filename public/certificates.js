(() => {
  document.querySelectorAll('[data-image-gallery]').forEach(initializeGallery);

  function initializeGallery(section) {
  const carousel = section.querySelector('[data-gallery-carousel]');
  const track = section.querySelector('[data-gallery-track]');
  const slides = Array.from(track.children);
  const dotsContainer = section.querySelector('[data-gallery-dots]');
  const status = section.querySelector('[data-gallery-status]');
  const dialog = document.getElementById(section.dataset.galleryDialog);
  const previewImage = dialog.querySelector('.certificate-dialog-image, .gallery-preview-image');
  const prefix = section.dataset.galleryPrefix;
  const step = Number(section.dataset.galleryStep) || 1;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let currentIndex = 0;
  let previewIndex = 0;
  let pointerStart = null;
  let suppressClick = false;
  let previousOverflow = '';

  slides.forEach((slide, index) => {
    slide.setAttribute('aria-haspopup', 'dialog');
    slide.addEventListener('click', () => {
      if (suppressClick) return;
      previewIndex = index;
      updatePreview();
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      dialog.showModal();
    });
  });

  const dots = Array.from({ length: Math.ceil(slides.length / step) }, (_, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = section.dataset.galleryDotClass || 'certificate-dot';
    dot.addEventListener('click', () => showSlide(index * step));
    dotsContainer.append(dot);
    return dot;
  });

  function visibleCount() {
    return Number(section.dataset.galleryCount) || (window.innerWidth <= 560 ? 1 : window.innerWidth <= 1000 ? 2 : 3);
  }

  function updateLabels() {
    dots.forEach((dot, index) => {
      dot.setAttribute('aria-label', `${t(`${prefix}.photo`)} ${index * step + 1} ${t(`${prefix}.of`)} ${slides.length}`);
      dot.title = dot.getAttribute('aria-label');
      dot.setAttribute('aria-pressed', String(index * step === currentIndex));
    });
    carousel.querySelectorAll('.certificate-arrow').forEach(button => {
      button.title = button.getAttribute('aria-label');
    });
    dialog.querySelectorAll('button').forEach(button => {
      button.title = button.getAttribute('aria-label');
    });
    slides.forEach((slide, index) => {
      const offset = (index - currentIndex + slides.length) % slides.length;
      const hidden = offset >= visibleCount();
      slide.tabIndex = hidden ? -1 : 0;
      slide.setAttribute('aria-hidden', String(hidden));
    });
    status.textContent = `${t(`${prefix}.photo`)} ${currentIndex + 1} ${t(`${prefix}.of`)} ${slides.length}`;
    if (dialog.open) updatePreview();
  }

  function showSlide(index, animate = true) {
    const nextIndex = (index + slides.length) % slides.length;
    const changed = nextIndex !== currentIndex;
    currentIndex = nextIndex;
    // Reorder original slides so the final position wraps without blank slots.
    track.append(...slides.slice(currentIndex), ...slides.slice(0, currentIndex));
    updateLabels();
    track.getAnimations().forEach(animation => animation.cancel());
    if (animate && changed && !reducedMotion.matches) {
      track.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 180 });
    }
  }

  function updatePreview() {
    const slide = slides[previewIndex];
    previewImage.src = slide.querySelector('img').src;
    previewImage.alt = slide.getAttribute('aria-label');
  }

  function movePreview(direction) {
    previewIndex = (previewIndex + direction + slides.length) % slides.length;
    updatePreview();
  }

  carousel.querySelector('[data-certificates-previous], [data-gallery-previous]').addEventListener('click', () => showSlide(currentIndex - step));
  carousel.querySelector('[data-certificates-next], [data-gallery-next]').addEventListener('click', () => showSlide(currentIndex + step));
  carousel.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    carousel.focus({ preventScroll: true });
    showSlide(currentIndex + (event.key === 'ArrowRight' ? step : -step));
  });

  carousel.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('.certificate-arrow')) return;
    pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    suppressClick = false;
  });
  carousel.addEventListener('pointerup', event => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    suppressClick = true;
    showSlide(currentIndex + (dx < 0 ? step : -step));
    window.setTimeout(() => { suppressClick = false; }, 0);
  });
  carousel.addEventListener('pointercancel', () => { pointerStart = null; });

  function closePreview() {
    dialog.close();
    document.body.style.overflow = previousOverflow;
  }

  dialog.querySelector('[data-certificate-close], [data-gallery-close]').addEventListener('click', closePreview);
  dialog.querySelector('[data-certificate-preview-previous], [data-gallery-preview-previous]').addEventListener('click', () => movePreview(-1));
  dialog.querySelector('[data-certificate-preview-next], [data-gallery-preview-next]').addEventListener('click', () => movePreview(1));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      movePreview(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) closePreview();
  });
  dialog.addEventListener('cancel', () => { document.body.style.overflow = previousOverflow; });
  dialog.addEventListener('close', () => {
    if (!dialog.open) document.body.style.overflow = previousOverflow;
  });

  document.addEventListener('site-language-change', updateLabels);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) track.getAnimations().forEach(animation => animation.cancel());
  });
  window.addEventListener('resize', updateLabels);
  showSlide(0, false);
  }
})();
