# Portfolio

A single-page portfolio with live 3D scenes, built for GitHub Pages. No build step: it is plain HTML, CSS and JavaScript modules. Three.js, GSAP and Lenis load from CDNs.

## What's on the page

| Section | 3D / effect | File |
| --- | --- | --- |
| Hero | Shader-drawn black sun (wavy corona, spotted sky, cursor ripples). Scrolling lets the sun swallow the screen. | `js/sun.js` |
| 01 Chore Score | Low-poly four-room house. Scrolling lifts the roof and pulls the rooms apart; chore and bill cards orbit it and coins rise out of it. Drag to spin. | `js/house.js` |
| 02 Fishing Map | Dotted globe with fishing hotspots that glow and pulse along the coasts, schools of fish circling it, and region buttons that fly the camera to that region. | `js/globe.js` |
| 03 Black Sun | The three Blender renders as a pinned full-screen sequence. Each shot gives way to the next through an expanding black sun with a corona edge, plus a flickering lantern, rippling puddles and a pulsing corona. | `js/story.js` |

`js/main.js` handles smooth scrolling, pinning, the text reveals, the custom cursor, magnetic buttons and the tilting screenshot frames.

Fallbacks: touch screens get auto-rotating scenes (dragging is disabled so the page still scrolls). If a visitor has reduced motion turned on, or WebGL isn't available, the animation stops and the story section becomes a plain stack of images.

## Run it locally

Browsers block ES modules on `file://`, so serve the folder:

```powershell
python -m http.server 8137
```

Then open http://localhost:8137.

## Deploy to GitHub Pages

1. Create a repo named **`jaddison123.github.io`**. The site will then be live at `https://jaddison123.github.io`. Any other repo name works too; the site is then at `https://jaddison123.github.io/<repo-name>/`.
2. Push this folder to it:
   ```powershell
   git init
   git add .
   git commit -m "Portfolio site"
   git branch -M main
   git remote add origin https://github.com/jaddison123/jaddison123.github.io.git
   git push -u origin main
   ```
3. On GitHub, open the repo's **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then **main** / **(root)**, and click **Save**. It goes live in about a minute.

`.nojekyll` is included so GitHub serves the files exactly as they are. You can delete the `.claude/` folder; it only holds the local preview config.

## To do

- Contact links: LinkedIn and GitHub are in the footer; add an email button there too if you want one.
- Intro line: change `Web apps, data maps & 3D worlds.` in the hero if you want different wording.
- Chore Score screenshot: `assets/img/chore-score.webp` is the start screen. A shot of a filled-in house (chores, bills, chat) would show off more.

## Visitor stats (GoatCounter)

The site is wired for [GoatCounter](https://www.goatcounter.com): free, no cookies, so no consent banner is needed. To turn it on:

1. Sign up at goatcounter.com and pick a site code, for example `jaddison`. Your dashboard will be `https://jaddison.goatcounter.com`.
2. In `js/main.js`, set `const GOATCOUNTER_CODE = 'jaddison';` (your code), then commit and push.

It only counts visits on `github.io`, so your local testing doesn't skew the numbers. Clicks on the "Try it live", GitHub and LinkedIn buttons are tracked as events (`chore-score-live`, `fishing-map-github`, `footer-linkedin` and so on).

## Other features

- **Loading intro:** an eclipse forms while the fonts and 3D load, then opens into the hero. It hides itself after 9 seconds even if a script fails.
- **Live status badges:** each app's badge pings it on page load and shows "Live now" or "Waking up · about 30s". The ping also starts waking the Render app.
- **Link previews:** `assets/img/og-image.jpg` (1200×627) is what LinkedIn, X and messaging apps show when the link is shared.
