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

- Contact links: add email or LinkedIn in the footer (search for `TODO` in `index.html`).
- Intro line: change `Web apps, data maps & 3D worlds.` in the hero if you want different wording.
- Chore Score screenshot: `assets/img/chore-score.webp` is the start screen. A shot of a filled-in house (chores, bills, chat) would show off more.
