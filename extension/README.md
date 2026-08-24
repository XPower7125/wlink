# wlink Chrome Extension

Shorten the page you're on with [wlink](https://wlink.vercel.app) straight from the toolbar.

## Setup

1. Load the extension:
   - Open `chrome://extensions`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked** and select this `extension/` folder
2. Get your token:
   - Sign in at wlink → **My Links → Chrome extension → Create token** → Copy
3. Open the extension's **Settings** (right-click the toolbar icon → Options) and paste the token.

## Usage

- Click the wlink icon on any page → **Shorten this page ✨**
- Copy the short URL, open it, or grab a QR code.
- Optional custom alias: not needed — slugs are generated automatically.

## Notes

- The token authenticates the extension as your wlink account (links you create
  are private by default and appear in My Links).
- Rate limit: 30 links/hour (60 for premium, unlimited for staff).
- Rotate the token anytime on the site; the old one stops working immediately.
- Advanced fields in Settings let you point the extension at a self-hosted
  wlink backend (Convex site URL + site origin).
