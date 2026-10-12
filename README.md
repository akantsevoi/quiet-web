# Quiet Web — Hide Distractions (Firefox)

A lightweight Firefox WebExtension that removes UI clutter locally in your browser.

- **Built-in presets:** LinkedIn feed, LinkedIn news, YouTube homepage recommendations, related/watch-page videos, Shorts entry points, and comments.
- **Click-to-hide:** Pick any element on a regular website and hide it for that specific hostname.
- **Easy undo:** Open the toolbar popup and click **Show** for any custom rule.
- **Controls:** Toggle a preset, pause the extension on an individual website, or disable it globally.
- **Private:** No analytics, servers, external dependencies, or browsing data transmission. Settings are stored using `browser.storage.local` on your machine.
- **Dynamic sites:** Works with most client-side navigation and elements loaded later.

## Try it in Firefox (temporary installation)

1. Download/extract the project (or clone it).
2. In Firefox open `about:debugging` and select **This Firefox**.
3. Select **Load Temporary Add-on** and choose `manifest.json` in this project.
4. Open or reload a LinkedIn/YouTube tab, then use the **Quiet Web** toolbar icon.
5. Click **Hide an element**, move your cursor over the unwanted part of a page, and click to hide it. Press `Esc` to cancel.

**Important:** Temporary add-ons are removed when Firefox restarts. To install persistently, the extension must be signed via Mozilla Add-ons (AMO). This repository includes the Firefox Manifest V3 Gecko ID and the required no-data-collection declaration for distribution.

## Presets (initial state)

| Site | Filter | Default |
| --- | --- | --- |
| LinkedIn `/feed` | Main feed | On |
| LinkedIn | News widget | Off |
| YouTube `/` | Home recommendations | On |
| YouTube `/watch` | Related videos / end-screen suggestions | On |
| YouTube | Shorts entry points | Off |
| YouTube `/watch` | Comments | Off |

Presets are URL-scoped. You can toggle them in the extension popup on the corresponding website. They are CSS selector rules and may need updates after LinkedIn or YouTube redesigns.

## How element picking works

The extension generates a CSS selector for the clicked element, scoped to the current hostname, and stores that rule locally. A style sheet applies that selector with `display: none !important`. The selector may become outdated if the site changes its markup, and highly dynamic/repeating elements can be difficult to target precisely. Click **Show** to remove a custom rule; you can also disable the site in the popup.

The picker suppresses the click used for selection, so it should not activate links or buttons. It does not block requests, ads at the network level, or all content within iframes/shadow DOM. Firefox blocks content scripts on its internal pages and other privileged domains.

## Project layout

```text
manifest.json      Firefox MV3 manifest
src/shared.js      Site presets, settings defaults, selector validation
src/content.js     CSS hiding, SPA URL handling, click-to-hide picker
src/popup.html     Toolbar interface
src/popup.css      Toolbar styles
src/popup.js       Settings and toggles
icons/icon.svg     Toolbar icon
tests/             Node.js unit tests
```

## Tests

Run `node --test tests/*.test.cjs` with Node.js 18 or later. These tests cover matching and settings behavior; final interactive behavior still needs manual testing in Firefox.

## Source code

Clone the project from [akantsevoi/quiet-web](https://github.com/akantsevoi/quiet-web):

```sh
git clone https://github.com/akantsevoi/quiet-web.git
```

## License

MIT. See [LICENSE](LICENSE).
