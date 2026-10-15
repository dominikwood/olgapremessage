# Editable Footer

Preview: http://localhost:3000/?v=20261014-11#contact

## What the Footer Adds

- Brand name and a short description of the course.
- Links to the existing About, Course Program, Packages, Certificates and Reviews sections.
- A direct Telegram contact button for `@aromaprem_bot`, plus the visible username.
- A short note that requests are handled personally in Telegram.
- Copyright with an automatically updated year and a back-to-top control.
- Optional privacy/terms links and business details, hidden until you supply real content.

No invented email, phone number, address, reply-time promise, payment provider or additional social accounts are shown.

## Editing

Edit `public/footer-content.js`. The layout and behavior live separately in `public/styles.css` and `public/footer.js`.

| Setting | What it changes |
| --- | --- |
| `brand` | Footer brand name. |
| `copyrightOwner` | Name in the copyright line. |
| `telegramUsername` | Telegram destination and displayed handle. An initial `@` is optional. |
| `dividerImage` | Decorative separator image; an empty string hides it. |
| `text.uk` / `text.ru` | Ukrainian and Russian copy, labels and accessible descriptions. |
| `navigation` | Section links; each `text` value refers to a key in both language dictionaries. |
| `privacyUrl` / `termsUrl` | Links to your actual documents; empty strings keep them hidden. |
| `ownerDetails` | Optional real business/owner details. |
| `extraContacts` | Optional additional contacts; an empty array keeps the list hidden. |

Update both language dictionaries when changing a label. This file is public: do not put Telegram bot tokens, passwords or other secrets in it.

The footer button opens `https://t.me/aromaprem_bot`. It does not send messages, start the bot automatically, accept payment or change delivery of the existing enquiry forms.

Only add document URLs once those documents really exist. No privacy policy or terms have been invented. Because the site's existing enquiry form collects contact details, those documents are a sensible next content task; their substance depends on your actual business and data-handling process.

## Review of the Existing Page

This was a focused footer/enquiry-flow review, not a full-site legal or accessibility audit. Evidence was captured from the live local site during this task.

1. Course entry: clear course identity and an existing enquiry action. The footer reuses the same orange/navy/cream palette and leaf ornament. Evidence: `qa/footer-audit-01-entry.png`.
2. Package enquiry: the popup shows the selected package and contact fields. Existing form behavior is retained. Document-link slots are prepared rather than pretending documents are already available. Evidence: `qa/footer-audit-02-enquiry.png`.
3. Page ending: the page previously stopped after the reviews, with no footer and no direct Telegram links. The new footer supplies an enquiry route and useful return navigation. Evidence: `qa/footer-audit-03-page-end.png`.

## Verification

- UA/RU switching, all five section links and the back-to-top link checked.
- Telegram opens the intended destination in a new tab. The browser test intercepted that request; no bot was contacted and no enquiry was sent.
- Desktop, tablet and phone layouts checked at 1440, 1024, 768, 390 and 320 CSS px.
- Runtime edits to the content configuration checked, including optional document/contact fields and rejecting a JavaScript URL.
- Legal links and unknown business/contact details remain hidden by default.
- Screenshots: `qa/footer-desktop-uk.png`, `qa/footer-desktop-ru.png`, `qa/footer-768-ru.png`, `qa/footer-390-ru.png`.

Native Telegram/bot conversations, legal adequacy of future documents and physical mobile devices were not tested.
