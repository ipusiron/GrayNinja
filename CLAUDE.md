# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GrayNinja is a visual educational tool for understanding Gray (Reflected Binary) Code. It's a single-page web application built with vanilla JavaScript, HTML, and CSS that provides interactive visualizations, conversions, and applications of Gray code.

## Development Commands

This is a static web application with no build process:
- **Run locally**: Open `index.html` directly in a browser or use a local server:
  ```bash
  python -m http.server 8000
  # or
  npx http-server
  ```
- **Deploy**: The site is deployed to GitHub Pages (https://ipusiron.github.io/GrayNinja/)

## Architecture

The application follows a tab-based single-page architecture with 4 tabs:
- **Basics (基本)**: Value slider, auto-play, sequence comparison table
- **Disc (ディスク)**: Canvas-based rotary encoder visualization
- **Convert (変換)**: Binary/Gray conversion utilities with step-by-step calculation display
- **Use Cases (座学)**: Application examples in various fields

### Core Files
- `index.html`: Main HTML structure with CSP headers and tab panels
- `script.js`: All JavaScript logic (~950 lines)
- `style.css`: All styling including responsive design, animations, and dark/light themes

### Key Components in script.js

1. **Utility Functions** (lines 1-71):
   - `$()`: DOM element selector shortcut
   - `pad()`: Binary string padding
   - `hdist()`: Hamming distance calculation (Brian Kernighan's algorithm)
   - `binToGray()`: Binary to Gray conversion (`b ^ (b >>> 1)`)
   - `grayToBin()`: Gray to Binary conversion (cumulative XOR)

2. **Tab System** (lines 73-104):
   - Tab switching with lazy rendering for encoder disc

3. **Basics Tab** (lines 106-341):
   - Global state: `n` (bit count), `val` (current value), `autoplay` timer
   - `syncBasicsBounds()`: Updates slider ranges when bit count changes
   - `setVal()`: Value setter with validation and wrap-around support
   - `renderBasics()`: Updates display and generates comparison table
   - Keyboard shortcuts: Arrow keys, Space for auto-play

4. **Encoder Disc Tab** (lines 343-612):
   - `drawDisc()`: Canvas rendering with concentric rings
   - `renderDiscAll()`: Full disc update with sector information
   - Two animation modes: disc rotation and sector stepping
   - CSS variable-based theming for canvas colors

5. **Convert Tab** (lines 614-880):
   - `convert()`: Conversion with input validation
   - `generateBinaryToGraySteps()` / `generateGrayToBinarySteps()`: Step-by-step calculation generators
   - `displaySteps()`: Safe DOM rendering (XSS-protected)

6. **Theme & Initialization** (lines 882-951):
   - `initializeThemeToggle()`: Dark/light mode with localStorage persistence
   - `init()`: Application bootstrap

### Canvas Rendering

The encoder disc uses HTML5 Canvas with:
- Concentric rings representing bit positions (outer = MSB)
- Sector highlighting for current position
- Optional number display overlay
- CSS variable integration for theme-aware colors (`getCSSVar()`)

### State Management

Global variables:
- `n`: Current bit count (1-12)
- `val`: Current value for basics tab
- `currentAngle`: Sector position angle (0-359)
- `discRotationAngle`: Disc rotation for animation
- Timer references: `autoplay`, `spinTimer`, `discRotateTimer`

## Security Implementation

The application implements several security measures (documented in README.md):
- Content Security Policy (CSP) meta tag
- XSS prevention: Uses `textContent` and `createElement` instead of `innerHTML` for user-controlled content
- Input validation: Range checking (1-12 bits), type validation, DoS protection (max 32-bit input)
- Safe localStorage handling with try-catch and value validation

## Gray Code Implementation Details

The core algorithms use bitwise operations:
- `binToGray(b)`: Returns `b ^ (b >>> 1)`
- `grayToBin(g)`: Cumulative XOR from MSB using a while loop
- Hamming distance uses Brian Kernighan's bit counting algorithm
