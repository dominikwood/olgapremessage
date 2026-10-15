(() => {
  const cards = Array.from(document.querySelectorAll('.review-video'));
  const dialog = document.querySelector('#review-dialog');
  const zoomButton = dialog.querySelector('.review-zoom-button');

  function updateLabels() {
    cards.forEach(card => {
      const poster = card.querySelector('.review-video-poster');
      poster.title = poster.getAttribute('aria-label');
      const video = card.querySelector('video');
      if (video) video.setAttribute('aria-label', t(card.dataset.videoTitle));
    });
    const zoomKey = dialog.classList.contains('is-zoomed') ? 'reviews.zoomOut' : 'reviews.zoomIn';
    zoomButton.dataset.i18nAriaLabel = zoomKey;
    zoomButton.setAttribute('aria-label', t(zoomKey));
    zoomButton.title = t(zoomKey);
    zoomButton.querySelector('img').src = dialog.classList.contains('is-zoomed') ? '/assets/zoom-out.svg' : '/assets/zoom-in.svg';
  }

  function showError(card) {
    card.dataset.videoState = 'error';
    card.querySelector('.review-video-loading').hidden = true;
    card.querySelector('.review-video-error').hidden = false;
    card.querySelector('.review-video-poster').hidden = false;
  }

  function createVideo(card) {
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'none';
    video.src = card.dataset.videoSrc;
    video.setAttribute('aria-label', t(card.dataset.videoTitle));
    video.addEventListener('play', () => {
      cards.forEach(other => {
        if (other !== card) other.querySelector('video')?.pause();
      });
    });
    video.addEventListener('playing', () => {
      card.dataset.videoState = 'playing';
      card.querySelector('.review-video-loading').hidden = true;
    });
    video.addEventListener('pause', () => { card.dataset.videoState = 'paused'; });
    video.addEventListener('ended', () => { card.dataset.videoState = 'ended'; });
    video.addEventListener('error', () => showError(card));
    card.append(video);
    return video;
  }

  cards.forEach(card => {
    card.querySelector('.review-video-poster').addEventListener('click', () => {
      if (card.dataset.videoState === 'loading') return;
      const video = card.querySelector('video') || createVideo(card);
      if (video.error) video.load();
      card.dataset.videoState = 'loading';
      card.querySelector('.review-video-poster').hidden = true;
      card.querySelector('.review-video-error').hidden = true;
      card.querySelector('.review-video-loading').hidden = false;
      video.play().catch(() => showError(card));
    });
  });

  zoomButton.addEventListener('click', () => {
    dialog.classList.toggle('is-zoomed');
    zoomButton.setAttribute('aria-pressed', String(dialog.classList.contains('is-zoomed')));
    updateLabels();
    if (dialog.classList.contains('is-zoomed')) {
      const scroll = dialog.querySelector('.review-preview-scroll');
      scroll.scrollLeft = (scroll.scrollWidth - scroll.clientWidth) / 2;
    }
  });
  dialog.addEventListener('close', () => {
    dialog.classList.remove('is-zoomed');
    zoomButton.setAttribute('aria-pressed', 'false');
    dialog.querySelector('.review-preview-scroll').scrollTo(0, 0);
    updateLabels();
  });
  document.addEventListener('site-language-change', updateLabels);
  updateLabels();
})();
