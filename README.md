# Word Castle

A small browser game project with two playable pages:

- Word Castle: a typing-defense game built for desktop and mobile play.
- Cursor Run: a cursor-based survival challenge.

## Project structure

- `index.html` — main game landing page and Word Castle game screen
- `cursor.html` — Cursor Run page
- `src/css/` — styles for both games
- `src/js/` — gameplay logic for both games
- `package.json` — local serving scripts

## Run locally

```bash
npm install
npm start
```

Then open the local server URL in the browser.

## Notes

- The Word Castle input logic is mobile-ready with a virtual keyboard.
- Invalid characters are ignored so backspace only removes the last valid typed character.