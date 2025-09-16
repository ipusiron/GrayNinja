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

The application follows a tab-based single-page architecture:

### Core Files
- `index.html`: Main HTML structure with 7 tab panels (Basics, RBC, Encoder Disc, Convert, K-map, Comms, Use Cases)
- `script.js`: All JavaScript logic including Gray code algorithms, UI interactions, and canvas rendering
- `style.css`: All styling including responsive design and animations

### Key Components in script.js

1. **Utility Functions** (lines 1-19):
   - Binary/Gray conversion algorithms
   - Hamming distance calculation
   - Padding utilities

2. **Tab System** (lines 21-44):
   - Tab switching logic with lazy rendering for performance
   - Each tab has dedicated render functions

3. **Feature Modules**:
   - **Basics Tab** (lines 46-107): Value slider, auto-play, sequence table
   - **RBC Tab** (lines 109-182): Recursive Gray code generation with animation
   - **Encoder Disc** (lines 184-282): Canvas-based rotary encoder visualization
   - **Convert Tab** (lines 284-317): Binary/Gray conversion utilities
   - **K-map Tab** (lines 319-384): Interactive Karnaugh map with Gray ordering
   - **Comms Tab** (lines 386-432): 16-QAM constellation comparison

### Canvas Rendering

The application uses HTML5 Canvas for complex visualizations:
- Encoder disc rendering with concentric rings
- Optional binary disc comparison
- Hypercube path visualization for n=3,4

### State Management

Global state variables track:
- Current bit count (n)
- Current value
- Animation states (autoplay, rotation)
- Tab-specific settings

## Gray Code Implementation Details

The core Gray code algorithms use bitwise operations for efficiency:
- `binToGray(b)`: Returns `b ^ (b >>> 1)`
- `grayToBin(g)`: Cumulative XOR from MSB
- RBC generation follows the recursive reflection method: G(n) = [0+G(n-1)] + [1+reverse(G(n-1))]

## UI/UX Patterns

- **Responsive Design**: Mobile-first with grid layouts that stack vertically on small screens
- **Interactive Elements**: Sliders, checkboxes, and direct input fields with real-time updates
- **Visual Feedback**: Active row highlighting in tables, hover effects on interactive elements
- **Lazy Rendering**: Tab content renders only when accessed to improve initial load performance