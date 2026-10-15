(() => {
  const footer = document.querySelector('.site-footer');

  function safeUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value, window.location.href);
      return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  function setOptionalLink(element, value) {
    const href = safeUrl(value);
    element.hidden = !href;
    if (href) element.href = href;
    else element.removeAttribute('href');
    return Boolean(href);
  }

  function renderFooter() {
    const content = window.footerContent;
    const language = document.documentElement.lang;
    const text = content.text[language] || content.text.uk;
    const translate = key => text[key] || content.text.uk[key] || '';

    footer.querySelectorAll('[data-footer-text]').forEach(element => {
      element.textContent = translate(element.dataset.footerText);
    });
    footer.querySelectorAll('[data-footer-aria]').forEach(element => {
      element.setAttribute('aria-label', translate(element.dataset.footerAria));
    });
    footer.querySelector('[data-footer-brand]').textContent = content.brand;
    const year = new Date().getFullYear();
    footer.querySelector('[data-footer-copyright]').textContent = translate('copyright')
      .replace('{year}', String(year)).replace('{owner}', content.copyrightOwner || content.brand);

    const username = String(content.telegramUsername || '').replace(/^@/, '');
    const telegramUrl = /^[a-zA-Z0-9_]{5,32}$/.test(username) ? `https://t.me/${username}` : null;
    footer.querySelectorAll('[data-footer-telegram]').forEach(element => {
      setOptionalLink(element, telegramUrl);
    });
    footer.querySelector('[data-footer-handle]').textContent = `@${username}`;
    footer.querySelector('.footer-telegram-button').title = translate('telegramButton');
    footer.querySelector('.footer-back-top').title = translate('backTop');

    const navigation = footer.querySelector('[data-footer-navigation]');
    navigation.replaceChildren();
    content.navigation.forEach(item => {
      const href = safeUrl(item.href);
      if (!href) return;
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = href;
      link.textContent = translate(item.text);
      li.append(link);
      navigation.append(li);
    });

    const privacyVisible = setOptionalLink(footer.querySelector('[data-footer-privacy]'), content.privacyUrl);
    const termsVisible = setOptionalLink(footer.querySelector('[data-footer-terms]'), content.termsUrl);
    footer.querySelector('[data-footer-legal]').hidden = !privacyVisible && !termsVisible;
    const details = footer.querySelector('[data-footer-owner-details]');
    details.textContent = content.ownerDetails || '';
    details.hidden = !details.textContent.trim();

    const extraContacts = footer.querySelector('[data-footer-extra-contacts]');
    extraContacts.replaceChildren();
    content.extraContacts.forEach(contact => {
      const href = safeUrl(contact.href);
      if (!href) return;
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = href;
      link.textContent = contact.label;
      li.append(link);
      extraContacts.append(li);
    });
    extraContacts.hidden = !extraContacts.children.length;

    const divider = footer.querySelector('[data-footer-divider]');
    const dividerUrl = safeUrl(content.dividerImage);
    divider.hidden = !dividerUrl;
    if (dividerUrl) divider.src = dividerUrl;
  }

  document.addEventListener('site-language-change', renderFooter);
  renderFooter();
})();
