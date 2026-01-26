# Lyricsian

A powerful, high-performance web-based Lyrics Video Editor. Create stunning karaoke-style lyric videos directly in your browser with real-time preview and high-quality export.

## 🚀 Features

- **Real-time Editor**: Dynamic layout adjustment with instant visual feedback.
- **Karaoke System**: 
  - Precision timing recording via keyboard (Space/Enter).
  - Progressive color fill effect (Karaoke style).
  - Adjustable highlight styles (Scale, Glow, Box, Color).
  - Sequential multi-line highlighting.
- **Advanced Export**:
  - Direct MP4/WebM export (H.264 Baseline Profile for maximum mobile compatibility).
  - High-performance rendering (30 FPS).
  - Audio-Video synchronization with startup warm-up protection.
  - Export range selection.
- **Smart Sidebar**:
  - Persistent asset management (IndexedDB).
  - Auto-scrolling lyrics list during recording/playback.
  - Comprehensive styling controls (Blur, Opacity, Dimensions, Alignment).
- **Responsive Layout**: Support for both Horizontal (YouTube) and Vertical (TikTok/Reels) formats.

## 🛠️ Technology Stack

- **Frontend**: React.js
- **Styling**: Vanilla CSS (Modern CSS Variables)
- **Audio/Video**: Web Audio API, Canvas API, MediaRecorder API
- **Storage**: IndexedDB (via custom utility) for local asset persistence.

## 📦 Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/annc19324/lyricsian.git
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run locally**:
   ```bash
   npm start
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

## 📖 How to Use

1. **Upload Assets**: Add your background image, main artist image, and audio file.
2. **Paste Lyrics**: Enter your lyrics in the "Lyrics" tab.
3. **Record Timings**: 
   - Switch to the "Timings" tab.
   - Press the **Record** button.
   - Use **Space** or **Enter** to stamp each line as the music plays.
4. **Style**: Adjust colors, fonts, and highlight effects to your liking.
5. **Export**: Click the Export button in the timeline. Stay on the tab until the process completes.

---
Built with ❤️ by Antigravity (Advanced Agentic Coding)
