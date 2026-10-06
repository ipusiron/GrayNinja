English · [日本語](README.md)

![GitHub Repo stars](https://img.shields.io/github/stars/ipusiron/GrayNinja?style=social)
![GitHub forks](https://img.shields.io/github/forks/ipusiron/GrayNinja?style=social)
![GitHub last commit](https://img.shields.io/github/last-commit/ipusiron/GrayNinja)
![GitHub license](https://img.shields.io/github/license/ipusiron/GrayNinja)
[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-blue?logo=github)](https://ipusiron.github.io/GrayNinja/)

**Day066 - 100 Security Tools with Generative AI**

# GrayNinja - Gray Code Encoder Disc Visualization Tool

**GrayNinja** is a tool for learning the Gray code (reflected binary code) through four screens: a comparison table, encoder discs, step-by-step conversion, and source-backed notes.

The Gray code is a binary code ordered so that adjacent values always differ in exactly one bit. Two discs (Gray and binary) rotate to the same angle, so you can compare how many rings change at once when a sector boundary is crossed.

---

## 🌐 Demo

👉 **[https://ipusiron.github.io/GrayNinja/](https://ipusiron.github.io/GrayNinja/)**

Try it directly in your browser.

---

## 📸 Screenshots

>![Disc tab (the 7/8 boundary)](assets/en/screenshot.png)
>*A 4-bit disc just past the boundary from 7 to 8. One ring changes on the Gray disc and four on the binary disc*

>![Basics tab (comparison table)](assets/en/screenshot-basics.png)
>*The comparison table highlights the bits that changed from the previous value. 7→8 changes 4 bits in binary and 1 bit in Gray*

>![Convert tab (dark mode)](assets/en/screenshot-dark.png)
>*Dark mode: converting a 32-digit binary number to Gray code with the steps shown*

>![Learn tab](assets/en/screenshot-learn.png)
>*The Learn tab: history and real uses, each with a source*

---

## ✨ Features

- Four tabs (Basics, Disc, Convert, Learn) walk through the properties and uses of the Gray code.
- The comparison table supports 1 to 12 bits and highlights the changed bits in both binary and Gray.
- Two encoder discs rotate to the same angle, so the sector under the read line can be read in Gray and in binary side by side.
- Conversion accepts up to 1,024 digits and shows digit-by-digit steps for up to 64 digits.
- The Learn tab is based on patents, papers, standards, and manufacturer materials, and every card links to its source.
- Japanese/English and light/dark theme switching (your choices are saved automatically).

---

## 📖 How to use

### Basics

1. Choose the number of bits n (1 to 12).
2. Move the value with Next/Prev or the slider. The ← → keys also step, and Space starts or stops auto play.
3. In the table, check how many bits changed from the previous value (ΔBinary, ΔGray) and which ones are highlighted.

Keyboard shortcuts work only while the Basics tab is shown and no button or input has focus.

### Disc

1. Move the "Disc position" slider slowly, or press "Next sector".
2. Compare the code of the sector under the read line (the red line) and the value it represents, in Gray and in binary.
3. Press "Rotate" to keep the discs turning at a constant speed.

The outer ring is the most significant bit and the inner ring the least significant bit. On the discs, the light color is 0 and the dark color is 1 (the same in both themes).

### Convert

1. Enter a binary or Gray bit string and press "Convert" (Enter also works).
2. Check the result, the value it represents (decimal), and the digit-by-digit steps.

Spaces and "_" are ignored as separators, and a leading `0b` and full-width 0/1 are accepted. Any other character is reported with its position, and the previous result is cleared.

### Learn

Read cards with sources on the history, real uses, connections to security, and common misconceptions.

---

## 📚 Gray code basics

### Construction (reflection)

Take the 1-bit list `0, 1`, append it in reverse order, then prefix the first half with 0 and the second half with 1. This gives the 2-bit list `00, 01, 11, 10`. Repeating the step gives the n-bit list. The second half mirrors the first, hence "reflected binary code".

```text
n=1: 0, 1
n=2: 00, 01, 11, 10
n=3: 000, 001, 011, 010, 110, 111, 101, 100
```

### Conversion formulas

Bit indices run from 0 at the least significant bit to n−1 at the most significant bit.

- Binary→Gray: `g = b ⊕ (b ≫ 1)`. Bit by bit, `gₙ₋₁ = bₙ₋₁` and `gᵢ = bᵢ₊₁ ⊕ bᵢ`.
- Gray→Binary: `bₙ₋₁ = gₙ₋₁`, `bᵢ = bᵢ₊₁ ⊕ gᵢ`. From the top digit down, XOR the binary bit just obtained with the next Gray bit.

For example, binary `1010` becomes Gray `1111`, and Gray `1111` becomes binary `1010`.

```text
Binary→Gray (1010)        Gray→Binary (1111)
g₃ = b₃ = 1               b₃ = g₃ = 1
g₂ = b₃ ⊕ b₂ = 1 ⊕ 0 = 1   b₂ = b₃ ⊕ g₂ = 1 ⊕ 1 = 0
g₁ = b₂ ⊕ b₁ = 0 ⊕ 1 = 1   b₁ = b₂ ⊕ g₁ = 0 ⊕ 1 = 1
g₀ = b₁ ⊕ b₀ = 1 ⊕ 0 = 1   b₀ = b₁ ⊕ g₀ = 1 ⊕ 1 = 0
```

### 4-bit comparison table

Δ is the number of bits that changed from the previous value. The "previous value" of row 0 is 15 (wrap around).

| Decimal | Binary | Gray | ΔBinary | ΔGray |
|---|---|---|---|---|
| 0 | 0000 | 0000 | 4 | 1 |
| 1 | 0001 | 0001 | 1 | 1 |
| 2 | 0010 | 0011 | 2 | 1 |
| 3 | 0011 | 0010 | 1 | 1 |
| 4 | 0100 | 0110 | 3 | 1 |
| 5 | 0101 | 0111 | 1 | 1 |
| 6 | 0110 | 0101 | 2 | 1 |
| 7 | 0111 | 0100 | 1 | 1 |
| 8 | 1000 | 1100 | 4 | 1 |
| 9 | 1001 | 1101 | 1 | 1 |
| 10 | 1010 | 1111 | 2 | 1 |
| 11 | 1011 | 1110 | 1 | 1 |
| 12 | 1100 | 1010 | 3 | 1 |
| 13 | 1101 | 1011 | 1 | 1 |
| 14 | 1110 | 1001 | 2 | 1 |
| 15 | 1111 | 1000 | 1 | 1 |

Going through all 16 values from 0 to 15, the total number of changed bits is 26 in binary and 15 in Gray. In general, for n bits it is 2^(n+1)−n−2 in binary and 2^n−1 in Gray.

### What the Gray code cannot do

- It cannot detect or correct errors. All 2^n patterns of n bits are used, so flipping one bit yields another valid codeword.
- "A single-bit error only gives a neighboring value" does not hold. The true property is that misreading as a neighboring value costs only one bit; flipping the top bit of `0000` gives `1000`, which represents 15.
- It is not a side-channel countermeasure. See "Power analysis and Hamming distance" and "Common misconceptions" in the Learn tab.

---

## 🎯 Use cases

- Explain the Gray code and Hamming distance in computer science or electronics classes and training, using the table and the moving discs.
- Before using a rotary encoder in an electronics project, see how Gray and binary readings differ at a boundary.
- Support learning about asynchronous FIFOs in FPGAs or the ordering of Karnaugh maps (00, 01, 11, 10).
- Before studying Gray mapping in digital modulation (QAM, PSK), check by hand that neighbors differ in one bit.
- Follow the positions of flipped bits (0, 1, 0, 2, 0, 1, 0, 3, …) in the table and relate them to puzzles such as the Chinese rings and the Tower of Hanoi.
- Use it as an entry point in security lectures to explain the Hamming-distance model of power analysis, or the order for brute-forcing switches (4,095 flips for 12 switches in Gray order versus 8,178 in binary order).
- Practice bit operations and XOR in programming by checking results against the steps.

---

## 🔬 Technical notes

- Conversion works on the bit string itself. Because it never converts to a number (a 32-bit integer), inputs of 32 digits with the top bit set neither flip sign nor hang. Decimal values are computed with BigInt.
- The discs have a single angle. The read line is fixed at the top and the disc rotates. The reading is the code of the sector under the read line.
- Each disc is drawn once with runs of equal bits merged into single arcs, cached, and then rotated on every frame. Rotation advances by elapsed time multiplied by speed, so heavy drawing does not change the speed.
- The comparison table is rebuilt only when the number of bits changes; changing the value just moves the marker on the selected row.
- The computational core (conversion, input normalization, steps, the table, and disc readings) lives in `js/gray-core.js` and is tested with `node --test`.

---

## 🔒 Security

- No network access; a CSP limits scripts and styles to files from the same origin (`script-src 'self'`, `style-src 'self'`, `connect-src 'none'`, `object-src 'none'`).
- On-screen text is built with DOM APIs (`textContent`, `createElement`); no HTML is built with `innerHTML`.
- Input is limited to 1,024 digits, and any character other than 0 and 1 is an error.
- Only the language and theme choices are stored in the browser. The tool works even where storage is unavailable.

---

## ⚠️ Notes and limitations

- The table and the discs go up to 12 bits. On a 12-bit disc the inner sectors are very fine and hard to tell apart without zooming.
- The discs assume that the sector under the read line is read correctly; misreadings caused by offset sensors in a read head are not simulated.
- The Learn tab stays within what its sources say. See each card's source for details of each field.

---

## 🧪 Tests

Tests cover the core, HTML, CSS, messages, and READMEs.

```bash
npm test
```

The same tests run on GitHub Actions (`.github/workflows/test.yml`).

---

## 🔗 References

- Frank Gray, [US Patent 2,632,058 "Pulse Code Communication"](https://patents.google.com/patent/US2632058A/en) (filed November 13, 1947; granted March 17, 1953)
- D. E. Knuth, [The Art of Computer Programming 7.2.1.1 "Generating all n-tuples" (Pre-Fascicle 2A)](https://www-cs-faculty.stanford.edu/~knuth/fasc2a.ps.gz)
- [OMRON FAQ00941](https://www.ia.omron.com/support/faq/answer/34/faq00941/index.html) (Gray code in rotary encoders)
- E. Agrell et al., [On the optimality of the binary reflected Gray code](https://doi.org/10.1109/TIT.2004.838367), IEEE Trans. Inf. Theory, 2004
- C. E. Cummings, [Simulation and Synthesis Techniques for Asynchronous FIFO Design](https://web.archive.org/web/2020/http://www.sunburst-design.com/papers/CummingsSNUG2002SJ_FIFO1.pdf), SNUG 2002
- Analog Devices, [MT-020 ADC Architectures I: The Flash Converter](https://www.analog.com/media/en/training-seminars/tutorials/MT-020.pdf)
- E. Brier, C. Clavier, F. Olivier, [Correlation Power Analysis with a Leakage Model](https://www.iacr.org/archive/ches2004/31560016/31560016.pdf), CHES 2004
- Other sources are linked from each card in the Learn tab.

---

## 📁 Directory structure

```text
GrayNinja/
├── .github/
│   └── workflows/
│       └── test.yml              # GitHub Actions workflow that runs the tests
├── assets/
│   ├── en/
│   │   ├── screenshot-basics.png # English screenshot of the Basics tab
│   │   ├── screenshot-dark.png   # English screenshot of the Convert tab in dark mode
│   │   ├── screenshot-learn.png  # English screenshot of the Learn tab
│   │   └── screenshot.png        # English screenshot of the Disc tab
│   ├── favicon.svg               # Favicon
│   ├── screenshot-basics.png     # Screenshot of the Basics tab
│   ├── screenshot-dark.png       # Screenshot of the Convert tab in dark mode
│   ├── screenshot-learn.png      # Screenshot of the Learn tab
│   └── screenshot.png            # Screenshot of the Disc tab
├── js/
│   ├── app.js                    # Screen logic (tabs, table, discs, conversion, notes)
│   ├── gray-core.js              # Core (conversion, input normalization, steps, disc readings)
│   ├── i18n.js                   # Language selection and static text replacement
│   ├── messages.js               # Japanese and English message dictionary
│   ├── theme-init.js             # Applies the theme before rendering
│   └── theme.js                  # Light/dark switching
├── test/
│   ├── core.test.js              # Core tests
│   ├── css.test.js               # CSS tests (variables, contrast, sizes)
│   ├── html.test.js              # HTML tests (CSP, aria, dictionary keys)
│   ├── i18n.test.js              # Language detection tests
│   ├── load.js                   # Helper that loads scripts into tests, plus reference implementations
│   ├── messages.test.js          # Message tests (Japanese/English parity, sources)
│   └── readme.test.js            # README tests
├── .gitignore                    # Git ignore rules
├── .nojekyll                     # Disables Jekyll on GitHub Pages
├── CLAUDE.md                     # Project notes for Claude Code
├── LICENSE                       # MIT License
├── README.en.md                  # This file
├── README.md                     # Japanese README
├── index.html                    # Main HTML
├── package.json                  # Test definition
└── style.css                     # Stylesheet
```

---

## 💻 Requirements

- Works in modern browsers (Chrome, Edge, Firefox, Safari).
- No installation or build. Open `index.html` or serve the folder from a static server.
- Running the tests requires Node.js 18 or later.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🛠 About this tool

This tool was built as part of the "100 Security Tools with Generative AI" project.
In this project, with the help of AI, a variety of security-related tools are built and released over 100 days.

For details on the project and other tools, see the page below.

🔗 [https://akademeia.info/?page_id=42163](https://akademeia.info/?page_id=42163)
