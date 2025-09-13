# vTileGen - Pixel Art Tile Generator

**vTileGen** is a web-based pixel art tile generator that lets you create, customize, and download pixel tiles with a variety of controls for palette, symmetry, patterns, and more.

---

## Features

- **Palette Management**
  - Choose from preset palettes (Pastel, Neon, Retro, Ocean, Fire) or create your own custom palette.
  - Add/remove colors interactively.

- **Tile Controls**
  - Size options: 8x8, 16x16, 24x24, 32x32, 48x48, 64x64.
  - Symmetry: None, Vertical, Horizontal, Radial.
  - Pattern presets: Random, Checkerboard, Vertical Stripes, Horizontal Stripes, Gradient, Border Only, Circle, Diagonal Stripes, Cross, Diamond, Spiral, Dots.
  - Density, definition (block size), clarity (blur), transparency, border toggle.
  - Seed input for reproducible randomness.

- **Canvas & Output**
  - Real-time preview on a canvas, with zoom controls.
  - Download tile as PNG.

- **UI**
  - Dark theme, responsive layout, modern controls.

- **Persistent Settings**
  - All settings are automatically saved and restored after page refresh.

---

## Getting Started

1. **Clone or Download**
   - Download the repository or clone it:
     ```
     git clone https://github.com/yourusername/vTileGen.git
     ```

2. **Open in Browser**
   - Open `index.html` in your browser.

3. **Usage**
   - Select your palette, size, symmetry, pattern, and other options.
   - Click **Generate Tile** to preview.
   - Adjust zoom as needed.
   - Click **Download PNG** to save your tile.

---

## File Structure

- `index.html` — Main UI structure.
- `styles.css` — Dark-themed, responsive styling.
- `main.js` — Palette logic, tile generation, UI event listeners, canvas rendering.

---

## Customization

- Add new palettes or patterns by editing `main.js` and `index.html`.
- Modify styles in `styles.css` for a different look.

---

## License

MIT License

---

## Credits

Created by vCore.
