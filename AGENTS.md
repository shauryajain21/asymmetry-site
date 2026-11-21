# asymmetry.so: notes for coding agents

The public website for Asymmetry. Static HTML: every page is a complete document, `assets/` holds the stylesheet, scripts and fonts. No build step, no package manager.

## Hard rules

- **`main` is production.** GitHub Pages publishes straight from `main` to https://asymmetry.so, so never push to it. Branch, open a PR, and let a human merge.
- **This repo is public.** Never copy product code, evals, the playground, API keys or anything else from the private `shauryajain21/things.ai` repo into it. Marketing copy only.
- Don't change `CNAME` or `.nojekyll`.
- The contact form posts to a Google Form; its entry IDs live in `assets/fx.js`. Don't rename or remove them.

## Checking a change

- Preview with `python3 -m http.server 8000` and open the pages you touched.
- Check them at phone width (375px) as well as desktop, and check every link you added.
- Put screenshots of changed pages in the PR description.

## Conventions

- Reuse the classes and tokens already in `assets/`; don't add a CSS framework or a build tool.
- Commit subjects: `site: what changed` in plain lowercase words.
