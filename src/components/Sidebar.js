import React, { useState, useEffect } from 'react';
import { FaUpload, FaFont, FaPalette, FaImage, FaMusic, FaLayerGroup, FaClock, FaCog, FaAlignLeft } from 'react-icons/fa';
import { saveAsset } from '../utils/db';

const Sidebar = ({ config, setConfig, lyricsRaw, setLyricsRaw, onReset, timings, setTimings, lyrics, duration, currentLineIndex, onClearTimings }) => {
  const [activeTab, setActiveTab] = useState('general'); // general, lyrics, layout, timings

  const handleFileChange = async (e, key) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setConfig(prev => ({ ...prev, [key]: url }));
      // Save to IndexedDB for persistence
      await saveAsset(key, file);
    }
  };

  const fonts = ['Inter', 'Roboto', 'Montserrat', 'Playfair Display', 'Oswald', 'Lobster', 'Dancing Script', 'Pacifico', 'Bangers', 'Orbitron'];

  // Timings Update Logic
  const handleTimingChange = (index, value) => {
    const newTimings = [...timings];
    // Find index in timings matching lyric index? Or assumes array match?
    // With recent changes, timings array matches lyrics array length/order.
    // But let's be safe.
    if (newTimings[index]) {
      newTimings[index] = { ...newTimings[index], time: value };
      setTimings(newTimings);
    }
  };

  const sortTimings = () => {
    const sorted = [...timings].sort((a, b) => a.time - b.time);
    setTimings(sorted);
  };

  // Auto-scroll logic for Timings Tab
  useEffect(() => {
    if (activeTab === 'timings') {
      const activeEl = document.getElementById(`timing-row-${currentLineIndex}`);
      if (activeEl) {
        // Scroll with 'center' alignment ensures context above and below is visible
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentLineIndex, activeTab]);

  const renderTabs = () => (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '15px' }}>
      {[
        { id: 'general', icon: <FaCog />, label: 'General' },
        { id: 'lyrics', icon: <FaAlignLeft />, label: 'Lyrics' },
        { id: 'layout', icon: <FaLayerGroup />, label: 'Layout' },
        { id: 'timings', icon: <FaClock />, label: 'Timings' }
      ].map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          style={{
            flex: 1, padding: '10px 5px', background: 'none', border: 'none',
            color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : 'none',
            cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', fontSize: '0.7rem'
          }}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="sidebar">
      {renderTabs()}

      {activeTab === 'general' && (
        <>
          <div className="panel-section">
            <h3 className="panel-title">Metadata</h3>
            <input
              type="text"
              placeholder="Song Name"
              value={config.songName}
              onChange={(e) => setConfig({ ...config, songName: e.target.value })}
            />
            <input
              type="text"
              placeholder="Artist Name"
              value={config.artistName}
              onChange={(e) => setConfig({ ...config, artistName: e.target.value })}
            />
            <input
              type="text"
              placeholder="Channel / Credit"
              value={config.channelName}
              onChange={(e) => setConfig({ ...config, channelName: e.target.value })}
            />
          </div>

          <div className="panel-section">
            <h3 className="panel-title">Assets</h3>

            <div className="file-input-group">
              <label className="btn">
                <FaImage /> Cover Image (Bg)
                <input type="file" hidden accept="image/*" onChange={(e) => handleFileChange(e, 'coverImage')} />
              </label>
            </div>
            <div className="control-row">
              <label>Blur Bg ({config.coverBlur}px)</label>
              <input
                type="range" min="0" max="100"
                value={config.coverBlur ?? 40}
                onChange={(e) => setConfig({ ...config, coverBlur: parseInt(e.target.value) })}
              />
            </div>

            <div className="file-input-group">
              <label className="btn">
                <FaImage /> Main Image (Left)
                <input type="file" hidden accept="image/*" onChange={(e) => handleFileChange(e, 'mainImage')} />
              </label>
            </div>

            <div className="file-input-group">
              <label className="btn primary">
                <FaMusic /> Audio File
                <input type="file" hidden accept="audio/*, video/*" onChange={(e) => handleFileChange(e, 'audioUrl')} />
              </label>
            </div>
          </div>
          <div className="panel-section">
            <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
              <h4 style={{ fontSize: '0.8rem', marginBottom: '10px', color: '#fff' }}>Export Range (sec)</h4>
              <div className="control-row" style={{ flexDirection: 'row' }}>
                <input
                  type="number" step="0.1"
                  value={config.exportStart || 0}
                  onChange={e => setConfig({ ...config, exportStart: parseFloat(e.target.value) })}
                  placeholder="Start"
                  style={{ width: '50%' }}
                />
                <input
                  type="number" step="0.1"
                  value={config.exportEnd || duration || 0}
                  onChange={e => setConfig({ ...config, exportEnd: parseFloat(e.target.value) })}
                  placeholder="End"
                  style={{ width: '50%' }}
                />
              </div>
            </div>

            <div className="control-row">
              <label>Export Overlay Opacity ({config.exportOverlayOpacity ?? 0})</label>
              <input
                type="range" min="0" max="1" step="0.1"
                value={config.exportOverlayOpacity ?? 0}
                onChange={(e) => setConfig({ ...config, exportOverlayOpacity: parseFloat(e.target.value) })}
              />
            </div>

            <div className="control-row">
              <label>Export Overlay Blur ({config.exportOverlayBlur ?? 5}px)</label>
              <input
                type="range" min="0" max="20" step="1"
                value={config.exportOverlayBlur ?? 5}
                onChange={(e) => setConfig({ ...config, exportOverlayBlur: parseInt(e.target.value) })}
              />
            </div>
            <button className="btn" onClick={onReset} style={{ marginTop: '20px', width: '100%', justifyContent: 'center', color: '#ff4444', borderColor: '#ff4444' }}>
              Reset to Default
            </button>
          </div>
        </>
      )}

      {activeTab === 'lyrics' && (
        <div className="panel-section">
          <h3 className="panel-title">Lyrics Content</h3>
          <textarea
            style={{ minHeight: '300px' }}
            placeholder="Paste lyrics here. Empty lines separate paragraphs/groups."
            value={lyricsRaw}
            onChange={(e) => setLyricsRaw(e.target.value)}
          />
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Note: Use empty lines to separate verses. Single lines will be treated as consecutive lines.
          </div>
          <div className="control-row" style={{ marginTop: '20px' }}>
            <label>Font</label>
            <select
              value={config.fontFamily}
              onChange={(e) => setConfig({ ...config, fontFamily: e.target.value })}
              style={{ width: '100%', padding: '5px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white', borderRadius: '4px' }}
            >
              {fonts.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="control-row">
            <label>Align</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              {['left', 'center', 'right'].map(align => (
                <button
                  key={align}
                  className={`btn ${config.lyricsAlign === align ? 'primary' : ''}`}
                  style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                  onClick={() => setConfig({ ...config, lyricsAlign: align })}
                >
                  {align.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="control-row">
            <label>Active Color</label>
            <input
              type="color"
              value={config.activeColor}
              onChange={(e) => setConfig({ ...config, activeColor: e.target.value })}
              style={{ width: '100%', height: '30px', cursor: 'pointer', border: 'none', background: 'none' }}
            />
          </div>
          <div className="control-row">
            <label>Highlight Styles</label>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {['color', 'karaoke', 'scale', 'glow', 'box'].map(style => {
                const activeStyles = config.highlightStyles || [];
                const isActive = activeStyles.includes(style);
                return (
                  <button
                    key={style}
                    className={`btn ${isActive ? 'primary' : ''}`}
                    style={{ padding: '5px 10px', fontSize: '0.8rem', flex: 1 }}
                    onClick={() => {
                      let newStyles;
                      if (isActive) {
                        newStyles = activeStyles.filter(s => s !== style);
                      } else {
                        newStyles = [...activeStyles, style];
                      }
                      setConfig({ ...config, highlightStyles: newStyles });
                    }}
                  >
                    {style.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {(config.highlightStyles || []).includes('karaoke') && (
            <div className="control-row">
              <label>Karaoke Speed ({config.karaokeSpeed || 1.0}x)</label>
              <input
                type="range" min="0.5" max="3.0" step="0.1"
                value={config.karaokeSpeed || 1.0}
                onChange={(e) => setConfig({ ...config, karaokeSpeed: parseFloat(e.target.value) })}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'layout' && (
        <div className="panel-section">
          <h3 className="panel-title">Layout & Style</h3>

          {/* Export Ratio */}
          <div style={{ marginBottom: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
            <h4 style={{ fontSize: '0.8rem', marginBottom: '10px', color: '#fff' }}>Export Presets</h4>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                className={`btn ${config.width === 1920 && config.height === 1080 ? 'primary' : ''}`}
                onClick={() => setConfig({
                  ...config,
                  width: 1920, height: 1080,
                  imageScale: 0.5, imageX: -187, imageY: -22,
                  lyricSize: 32, lyricsX: -591, lyricsY: -224,
                  maxLinesAbove: 0, maxLinesBelow: 8,
                  lyricsAlign: 'left'
                })}
                style={{ fontSize: '0.7rem', flex: 1, padding: '5px' }}
              >
                16:9 (YT)
              </button>
              <button
                className={`btn ${config.width === 1080 && config.height === 1920 ? 'primary' : ''}`}
                onClick={() => setConfig({
                  ...config,
                  width: 1080, height: 1920,
                  imageScale: 0.5, imageX: 0, imageY: -75,
                  lyricSize: 32, lyricsX: 3, lyricsY: -521,
                  maxLinesAbove: 0, maxLinesBelow: 8,
                  lyricsAlign: 'center'
                })}
                style={{ fontSize: '0.7rem', flex: 1, padding: '5px' }}
              >
                9:16 (TikTok)
              </button>

            </div>
          </div>

          {/* Main Image Controls */}
          <div style={{ marginBottom: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
            <h4 style={{ fontSize: '0.8rem', marginBottom: '10px', color: '#fff' }}>Main Image</h4>
            <div className="control-row">
              <label>Scale ({config.imageScale}x)</label>
              <input
                type="range" min="0.1" max="1" step="0.01"
                value={config.imageScale}
                onChange={(e) => setConfig({ ...config, imageScale: parseFloat(e.target.value) })}
              />
            </div>
            <div className="control-row">
              <label>Pos X ({config.imageX}px)</label>
              <input
                type="range" min="-1000" max="1000"
                value={config.imageX}
                onChange={(e) => setConfig({ ...config, imageX: parseInt(e.target.value) })}
              />
            </div>
            <div className="control-row">
              <label>Pos Y ({config.imageY}px)</label>
              <input
                type="range" min="-1000" max="1000"
                value={config.imageY}
                onChange={(e) => setConfig({ ...config, imageY: parseInt(e.target.value) })}
              />
            </div>
          </div>

          {/* Lyrics Controls */}
          <div style={{ marginBottom: '15px' }}>
            <h4 style={{ fontSize: '0.8rem', marginBottom: '10px', color: '#fff' }}>Lyrics Position</h4>
            <div className="control-row">
              <label>Size ({config.lyricSize}px)</label>
              <input
                type="range" min="10" max="300"
                value={config.lyricSize}
                onChange={(e) => setConfig({ ...config, lyricSize: parseInt(e.target.value) })}
              />
            </div>
            <div className="control-row">
              <label>Pos X ({config.lyricsX}px)</label>
              <input
                type="range" min="-1000" max="1000"
                value={config.lyricsX}
                onChange={(e) => setConfig({ ...config, lyricsX: parseInt(e.target.value) })}
              />
            </div>
            <div className="control-row">
              <label>Pos Y ({config.lyricsY}px)</label>
              <input
                type="range" min="-1000" max="1000"
                value={config.lyricsY}
                onChange={(e) => setConfig({ ...config, lyricsY: parseInt(e.target.value) })}
              />
            </div>

            <div className="control-row" style={{ flexDirection: 'row', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label>Lines Above</label>
                <input
                  type="number" min="0" max="10"
                  value={config.maxLinesAbove ?? 2}
                  onChange={e => setConfig({ ...config, maxLinesAbove: parseInt(e.target.value) })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label>Lines Below</label>
                <input
                  type="number" min="0" max="10"
                  value={config.maxLinesBelow ?? 2}
                  onChange={e => setConfig({ ...config, maxLinesBelow: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'timings' && (
        <div className="panel-section">
          <h3 className="panel-title">Timing Editor</h3>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
            <button className="btn" onClick={sortTimings} style={{ fontSize: '0.7rem', flex: 1 }}>Sort Timings</button>
            <button className="btn danger" onClick={onClearTimings} style={{ fontSize: '0.7rem', flex: 1 }}>Reset All (0s)</button>
          </div>

          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: 'calc(100vh - 200px)' }}>
            {lyrics.map((line, i) => {
              const tObj = timings.find(t => t && t.index === i);
              const val = tObj ? tObj.time : 0;
              const isCurrent = i === currentLineIndex;

              return (
                <div
                  key={i}
                  id={`timing-row-${i}`}
                  className={`timing-row ${isCurrent ? 'active' : ''}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '5px',
                    background: isCurrent ? 'var(--primary-dark)' : 'transparent',
                    borderBottom: '1px solid #333',
                    borderRadius: '4px'
                  }}>
                  <span style={{ fontSize: '0.7rem', color: '#888', minWidth: '20px' }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: isCurrent ? '#fff' : '#ccc' }}>
                    {line.text}
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={val}
                    onChange={(e) => handleTimingChange(i, parseFloat(e.target.value))}
                    style={{ width: '60px', padding: '2px', background: '#222', border: '1px solid #444', color: 'white', fontSize: '0.8rem' }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};

export default Sidebar;
