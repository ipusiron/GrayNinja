# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GrayNinja is an educational tool for the Gray code (reflected binary code). It is a static single-page web app (vanilla JavaScript, HTML, CSS, no build step, no dependencies) published on GitHub Pages: https://ipusiron.github.io/GrayNinja/

## Commands

- Run locally: open `index.html` directly, or `python -m http.server 8000`
- Test: `npm test` (runs `node --test`; no packages to install). CI runs the same on GitHub Actions (`.github/workflows/test.yml`)

## Architecture

Scripts are classic scripts (not modules) loaded in this order; each puts one object on `globalThis`:

1. `js/theme-init.js` (in `<head>`): applies the saved theme (`grayninja-theme`) before rendering; otherwise the OS setting (`prefers-color-scheme`) applies
2. `js/gray-core.js` → `GrayCore`: pure functions, no DOM
   - `normalizeBits(input)`: accepts 0/1, full-width 0/1, spaces/tabs/newlines/`_` as separators, a leading `0b`; any other character returns `{ ok: false, error: 'invalidChar', char, index }`. Limit `MAX_BITS` = 1,024
   - `binToGrayBits` / `grayToBinBits` / `steps`: work on bit strings (never convert to 32-bit integers)
   - `sequence(n)`: comparison table rows (n = 1..12) with Hamming distances and flipped bit positions
   - Disc: `sectorAt(phi, n)`, `sectorCenter`, `ringRuns(n, k, kind)` (runs of equal bits per ring, for drawing), `readAt(phi, n, kind, offsets)`
3. `js/messages.js` → `GrayMessages`: Japanese and English dictionaries with identical keys. `**bold**`, `[text](https://…)` and `\n` are rendered as elements by `i18n.js` (never as HTML)
4. `js/i18n.js` → `GrayI18n`: language detection (`?lang=` → saved `grayninja-lang` → browser language), `data-i18n` / `data-i18n-attr` replacement
5. `js/theme.js` → `GrayTheme`: light/dark toggle
6. `js/app.js`: the screen (tabs, comparison table, discs, conversion, Learn cards). All text comes from `messages.js`

### Disc model

There is a single angle `disc.phi`. The read line is fixed at the top and the disc rotates by `−phi`, so the sector under the read line is `GrayCore.sectorAt(phi, n)`. Each disc is drawn once into an offscreen canvas (cached per size, bit count, options and theme) and rotated on every frame. Rotation is time-based (`requestAnimationFrame`, degrees per second).

## Conventions

- CSP is `script-src 'self'; style-src 'self'`: no inline scripts, no `style` attributes, no inline event handlers
- Build DOM with `textContent` / `createElement`; never use `innerHTML`
- Every user-visible string goes into both dictionaries in `messages.js`
- Colors are CSS variables in `style.css` (light in `:root`, dark in both the `prefers-color-scheme` block and `:root[data-theme="dark"]`, which must stay identical). Text contrast must stay ≥ 4.5:1 (checked by `test/css.test.js`)
- Keyboard shortcuts on the Basics tab must not fire when a button, input, tab or other focusable element has focus
- Claims in the Learn tab and README must be backed by primary sources (patents, papers, standards, manufacturer documents). Do not reintroduce claims such as "Gray code is a side-channel countermeasure", "it is robust against fault injection", "it corrects errors", or "it prevents contact bounce (chattering)" (it only keeps a misreading during the bounce within the two values on either side of a boundary)
