import React, { useState, useEffect } from 'react';
import { FaUpload, FaFont, FaPalette, FaImage, FaMusic, FaLayerGroup, FaClock, FaCog, FaAlignLeft, FaHeart, FaMagic } from 'react-icons/fa';
import { saveAsset } from '../utils/db';

// Helper for Section Header (Moved outside to prevent re-renders)
const SectionHeader = ({ title, isCollapsed, onToggle }) => (
  <div
    onClick={onToggle}
    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', cursor: 'pointer', userSelect: 'none' }}
  >
    <h4 style={{ fontSize: '0.8rem', color: '#fff', margin: 0, borderLeft: '3px solid var(--primary)', paddingLeft: '8px' }}>{title}</h4>
    <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>{isCollapsed ? '+' : '-'}</span>
  </div>
);

const Sidebar = React.memo(({ config, setConfig, lyricsRaw, setLyricsRaw, onReset, timings, setTimings, lyrics, duration, currentLineIndex, onClearTimings }) => {
  const [activeTab, setActiveTab] = useState('general'); // general, lyrics, layout, timings

  // Collapse State
  const [collapsed, setCollapsed] = useState({
    meta: true,
    presets: true,
    mainImage: true,
    lyricsPos: true,
    assets: true,
    audio: true,
    export: true
  });

  const toggleCollapse = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const handleFileChange = async (e, key) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setConfig(prev => ({ ...prev, [key]: url }));
      // Save to IndexedDB for persistence
      await saveAsset(key, file);
    }
  };

  const fonts = [
    'Montserrat', 'Playfair Display', 'Dancing Script', 'Be Vietnam Pro', 
    'FC VIP Alpha Brights', 'Instagram Regular', 'Instagram Bold', 
    'Instagram Sans Script', 'Instagram Sans Script Bold'
  ];

  // Timings Update Logic
  const handleTimingChange = (index, value) => {
    const newTimings = [...timings];
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
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentLineIndex, activeTab]);

  const renderTabs = () => (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '15px' }}>
      {[
        { id: 'general', icon: <FaCog />, label: 'Chung' },
        { id: 'lyrics', icon: <FaAlignLeft />, label: 'Lời bài hát' },
        { id: 'layout', icon: <FaLayerGroup />, label: 'Bố cục' },
        { id: 'effects', icon: <FaMagic />, label: 'Hiệu ứng' },
        { id: 'timings', icon: <FaClock />, label: 'Thời gian' },
        { id: 'donate', icon: <FaHeart style={{ color: '#ff4444' }} />, label: 'Ủng hộ' }
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
    <div className="sidebar-container">
      {renderTabs()}

      <div className="sidebar-content" style={{ paddingBottom: '150px' }}>

        {activeTab === 'general' && (
          <>
            <div className="panel-section">
              <h3 className="panel-title">Thông tin bài hát</h3>
              <input
                type="text"
                placeholder="Tên bài hát"
                value={config.songName}
                onChange={(e) => setConfig({ ...config, songName: e.target.value })}
              />
              <input
                type="text"
                placeholder="Tên ca sĩ"
                value={config.artistName}
                onChange={(e) => setConfig({ ...config, artistName: e.target.value })}
              />
              <input
                type="text"
                placeholder="Kênh / Nguồn / Credit"
                value={config.channelName}
                onChange={(e) => setConfig({ ...config, channelName: e.target.value })}
              />
            </div>

            <div className="panel-section">
              <SectionHeader
                title="Tài nguyên (Assets)"
                isCollapsed={collapsed.assets}
                onToggle={() => toggleCollapse('assets')}
              />

              {!collapsed.assets && (
                <>
                  <div className="file-input-group">
                    <label className="btn">
                      <FaImage /> Ảnh nền (Background)
                      <input type="file" hidden accept="image/*" onChange={(e) => handleFileChange(e, 'coverImage')} />
                    </label>
                  </div>
                  <div className="control-row">
                    <label>Độ mờ nền ({config.coverBlur}px)</label>
                    <input
                      type="range" min="0" max="100"
                      value={config.coverBlur ?? 40}
                      onChange={(e) => setConfig({ ...config, coverBlur: parseInt(e.target.value) })}
                    />
                  </div>

                  <div className="file-input-group">
                    <label className="btn">
                      <FaImage /> Ảnh chính (Trái/Giữa)
                      <input type="file" hidden accept="image/*" onChange={(e) => handleFileChange(e, 'mainImage')} />
                    </label>
                  </div>

                  <div className="file-input-group">
                    <label className="btn primary">
                      <FaMusic /> File Âm thanh
                      <input type="file" hidden accept="audio/*, video/*" onChange={(e) => handleFileChange(e, 'audioUrl')} />
                    </label>
                  </div>
                </>
              )}

              {/* Audio Settings nested or separate? Let's separate */}
            </div>

            <div className="panel-section">
              <SectionHeader
                title="Cài đặt Âm thanh"
                isCollapsed={collapsed.audio}
                onToggle={() => toggleCollapse('audio')}
              />
              {!collapsed.audio && (
                <>
                  <div className="control-row">
                    <label style={{ color: 'var(--text-muted)' }}>Cắt & Làm mờ (Giây)</label>
                    <div style={{ display: 'flex', gap: '5px', width: '100%', marginTop: '5px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.65rem' }}>Bắt đầu</label>
                        <input
                          type="number" step="0.1"
                          value={config.trimStart}
                          onChange={(e) => setConfig({ ...config, trimStart: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.65rem' }}>Kết thúc</label>
                        <input
                          type="number" step="0.1"
                          value={config.trimEnd}
                          onChange={(e) => setConfig({ ...config, trimEnd: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                          placeholder="Auto"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="control-row">
                    <div style={{ display: 'flex', gap: '5px', width: '100%' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.65rem' }}>Fade In (Vào)</label>
                        <input
                          type="number" step="0.5"
                          value={config.fadeIn}
                          onChange={(e) => setConfig({ ...config, fadeIn: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.65rem' }}>Fade Out (Ra)</label>
                        <input
                          type="number" step="0.5"
                          value={config.fadeOut}
                          onChange={(e) => setConfig({ ...config, fadeOut: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="panel-section">
              <SectionHeader
                title="Xuất Video"
                isCollapsed={collapsed.export}
                onToggle={() => toggleCollapse('export')}
              />
              {!collapsed.export && (
                <>
                  <div className="control-row" style={{ flexDirection: 'row' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.7rem' }}>Bắt đầu (s)</label>
                      <input
                        type="number" step="0.1"
                        value={config.exportStart ?? ''}
                        onChange={e => setConfig({ ...config, exportStart: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ flex: 1, marginLeft: '5px' }}>
                      <label style={{ fontSize: '0.7rem' }}>Kết thúc (s)</label>
                      <input
                        type="number" step="0.1"
                        value={config.exportEnd ?? ''}
                        placeholder={duration ? duration.toFixed(1) : "Auto"}
                        onChange={e => setConfig({ ...config, exportEnd: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div className="control-row">
                    <label>Độ mờ lớp phủ ({config.exportOverlayOpacity ?? 0})</label>
                    <input
                      type="range" min="0" max="1" step="0.1"
                      value={config.exportOverlayOpacity ?? 0}
                      onChange={(e) => setConfig({ ...config, exportOverlayOpacity: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div className="control-row">
                    <label>Độ nhòe lớp phủ ({config.exportOverlayBlur ?? 5}px)</label>
                    <input
                      type="range" min="0" max="20" step="1"
                      value={config.exportOverlayBlur ?? 5}
                      onChange={(e) => setConfig({ ...config, exportOverlayBlur: parseInt(e.target.value) })}
                    />
                  </div>
                  <button className="btn" onClick={onReset} style={{ marginTop: '20px', width: '100%', justifyContent: 'center', color: '#ff4444', borderColor: '#ff4444' }}>
                    Khôi phục mặc định
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {activeTab === 'lyrics' && (
          <div className="panel-section">
            <h3 className="panel-title">Nội dung Lời bài hát</h3>
            <textarea
              style={{ minHeight: '300px' }}
              placeholder="Dán lời bài hát vào đây. Dùng dòng trống để tách khổ."
              value={lyricsRaw}
              onChange={(e) => setLyricsRaw(e.target.value)}
            />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Lưu ý: Dùng dòng trống để tách khổ. Một dòng đơn sẽ được coi là câu liên tiếp.
            </div>
            <div className="control-row" style={{ marginTop: '20px' }}>
              <label>Phông chữ</label>
              <select
                value={config.fontFamily}
                onChange={(e) => setConfig({ ...config, fontFamily: e.target.value })}
                style={{ width: '100%', padding: '5px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white', borderRadius: '4px' }}
              >
                {fonts.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="control-row">
              <label>Canh lề</label>
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
              <label>Màu chữ đang hát</label>
              <input
                type="color"
                value={config.activeColor}
                onChange={(e) => setConfig({ ...config, activeColor: e.target.value })}
                style={{ width: '100%', height: '30px', cursor: 'pointer', border: 'none', background: 'none' }}
              />
            </div>
            <div className="control-row">
              <label>Màu chữ Nhấn mạnh ([...])</label>
              <input
                type="color"
                value={config.highlightColor || '#ffeb3b'}
                onChange={(e) => setConfig({ ...config, highlightColor: e.target.value })}
                style={{ width: '100%', height: '30px', cursor: 'pointer', border: 'none', background: 'none' }}
              />
            </div>
            <div className="control-row">
              <label>Hiệu ứng nổi bật</label>
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
                      {{ color: 'Màu', karaoke: 'Karaoke', scale: 'Phóng to', glow: 'Phát sáng', box: 'Khung' }[style]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="control-row" style={{ marginTop: '15px', borderTop: '1px solid #333', paddingTop: '10px' }}>
              <label style={{ color: 'var(--primary-glow)', marginBottom: '10px', display: 'block' }}>Tùy chỉnh Chi tiết</label>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem' }}>Độ nhòe (Glow)</label>
                  <input
                    type="range" min="0" max="100"
                    value={config.lyricsGlowSize}
                    onChange={(e) => setConfig({ ...config, lyricsGlowSize: parseInt(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ width: '50px' }}>
                  <input type="number" value={config.lyricsGlowSize} onChange={e => setConfig({ ...config, lyricsGlowSize: parseInt(e.target.value) })} style={{ width: '100%', marginTop: '18px' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem' }}>Viền chữ (Stroke)</label>
                  <input
                    type="range" min="0" max="20" step="0.5"
                    value={config.lyricsBorderWidth}
                    onChange={(e) => setConfig({ ...config, lyricsBorderWidth: parseFloat(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ width: '50px' }}>
                  <input type="number" value={config.lyricsBorderWidth} onChange={e => setConfig({ ...config, lyricsBorderWidth: parseFloat(e.target.value) })} style={{ width: '100%', marginTop: '18px' }} />
                </div>
              </div>

              <div className="control-row">
                <label>Màu viền</label>
                <input
                  type="color"
                  value={config.lyricsBorderColor || '#000000'}
                  onChange={(e) => setConfig({ ...config, lyricsBorderColor: e.target.value })}
                  style={{ width: '100%', height: '30px', cursor: 'pointer', border: 'none', background: 'none' }}
                />
              </div>
            </div>

            {(config.highlightStyles || []).includes('karaoke') && (
              <div className="control-row">
                <label>Tốc độ Karaoke ({config.karaokeSpeed || 1.0}x)</label>
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
            <h3 className="panel-title">Bố cục & Giao diện</h3>

            {/* Export Ratio */}
            <div style={{ marginBottom: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <SectionHeader
                title="Mẫu Xuất Video"
                isCollapsed={collapsed.presets}
                onToggle={() => toggleCollapse('presets')}
              />
              {!collapsed.presets && (
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
                    16:9 (Youtube)
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
              )}
            </div>

            {/* Main Image Controls */}
            <div style={{ marginBottom: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <SectionHeader
                title="Ảnh Chính & Hiệu ứng"
                isCollapsed={collapsed.mainImage}
                onToggle={() => toggleCollapse('mainImage')}
              />
              {!collapsed.mainImage && (
                <>
                  <div className="control-row">
                    <label>Tỷ lệ ({config.imageScale}x)</label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <input
                        type="range" min="0.1" max="20" step="0.1"
                        value={config.imageScale}
                        onChange={(e) => setConfig({ ...config, imageScale: parseFloat(e.target.value) })}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="number" step="0.1"
                        value={config.imageScale}
                        onChange={(e) => setConfig({ ...config, imageScale: parseFloat(e.target.value) || 1 })}
                        style={{ width: '70px', background: '#111', border: '1px solid #333', color: '#fff', textAlign: 'center' }}
                      />
                    </div>
                  </div>
                  <div className="control-row">
                    <label>Vị trí X</label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <input
                        type="range" min="-5000" max="5000"
                        value={config.imageX}
                        onChange={(e) => setConfig({ ...config, imageX: parseInt(e.target.value) })}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="number"
                        value={config.imageX}
                        onChange={(e) => setConfig({ ...config, imageX: parseInt(e.target.value) })}
                        style={{ width: '70px', background: '#111', border: '1px solid #333', color: '#fff', textAlign: 'center' }}
                      />
                    </div>
                  </div>
                  <div className="control-row">
                    <label>Vị trí Y</label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <input
                        type="range" min="-5000" max="5000"
                        value={config.imageY}
                        onChange={(e) => setConfig({ ...config, imageY: parseInt(e.target.value) })}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="number"
                        value={config.imageY}
                        onChange={(e) => setConfig({ ...config, imageY: parseInt(e.target.value) })}
                        style={{ width: '70px', background: '#111', border: '1px solid #333', color: '#fff', textAlign: 'center' }}
                      />
                    </div>
                  </div>


                </>
              )}
            </div>

            {/* Metadata Styling */}
            <div style={{ marginBottom: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <SectionHeader
                title="Tùy chỉnh Thông tin Bài hát"
                isCollapsed={collapsed.meta}
                onToggle={() => toggleCollapse('meta')}
              />

              {!collapsed.meta && ['song', 'artist', 'channel'].map(type => {
                const labelMap = { song: 'Tên Bài Hát', artist: 'Tên Ca Sĩ', channel: 'Tên Kênh' };
                return (
                  <div key={type} style={{ marginBottom: '15px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                    <h5 style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: 'var(--primary-glow)' }}>{labelMap[type]}</h5>

                    <div className="control-row">
                      <label>Dịch chuyển X ({config[`${type}X`]}px)</label>
                      <input
                        type="range" min="-5000" max="5000"
                        value={config[`${type}X`] ?? 0}
                        onChange={(e) => setConfig({ ...config, [`${type}X`]: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="control-row">
                      <label>Dịch chuyển Y ({config[`${type}Y`]}px)</label>
                      <input
                        type="range" min="-5000" max="5000"
                        value={config[`${type}Y`] ?? 0}
                        onChange={(e) => setConfig({ ...config, [`${type}Y`]: parseInt(e.target.value) })}
                      />
                    </div>

                    <div className="control-row" style={{ flexDirection: 'row', gap: '5px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '2px' }}>Cỡ chữ</label>
                        <input
                          type="number"
                          value={config[`${type}Size`] ?? (type === 'song' ? 40 : type === 'artist' ? 30 : 20)}
                          onChange={(e) => setConfig({ ...config, [`${type}Size`]: parseInt(e.target.value) })}
                          style={{ width: '95%' }}
                        />
                      </div>
                      <div style={{ flex: 0.5 }}>
                        <label style={{ display: 'block', marginBottom: '2px' }}>Màu sắc</label>
                        <input
                          type="color"
                          value={config[`${type}Color`] ?? (type === 'channel' ? '#aaaaaa' : (type === 'artist' ? '#dddddd' : '#ffffff'))}
                          onChange={(e) => setConfig({ ...config, [`${type}Color`]: e.target.value })}
                          style={{ width: '100%', height: '30px', padding: 0, border: 'none' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Lyrics Controls */}
            <div style={{ marginBottom: '15px' }}>
              <SectionHeader
                title="Vị trí Lời bài hát"
                isCollapsed={collapsed.lyricsPos}
                onToggle={() => toggleCollapse('lyricsPos')}
              />
              {!collapsed.lyricsPos && (
                <>
                  <div className="control-row">
                    <label>Cỡ chữ ({config.lyricSize}px)</label>
                    <input
                      type="range" min="10" max="300"
                      value={config.lyricSize}
                      onChange={(e) => setConfig({ ...config, lyricSize: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="control-row">
                    <label>Vị trí X</label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <input
                        type="range" min="-5000" max="5000"
                        value={config.lyricsX}
                        onChange={(e) => setConfig({ ...config, lyricsX: parseInt(e.target.value) })}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="number"
                        value={config.lyricsX}
                        onChange={(e) => setConfig({ ...config, lyricsX: parseInt(e.target.value) })}
                        style={{ width: '70px', background: '#111', border: '1px solid #333', color: '#fff', textAlign: 'center' }}
                      />
                    </div>
                  </div>
                  <div className="control-row">
                    <label>Vị trí Y</label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <input
                        type="range" min="-5000" max="5000"
                        value={config.lyricsY}
                        onChange={(e) => setConfig({ ...config, lyricsY: parseInt(e.target.value) })}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="number"
                        value={config.lyricsY}
                        onChange={(e) => setConfig({ ...config, lyricsY: parseInt(e.target.value) })}
                        style={{ width: '70px', background: '#111', border: '1px solid #333', color: '#fff', textAlign: 'center' }}
                      />
                    </div>
                  </div>

                  <div className="control-row" style={{ flexDirection: 'row', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label>Dòng Trên</label>
                      <input
                        type="number" min="0" max="10"
                        value={config.maxLinesAbove ?? 2}
                        onChange={e => setConfig({ ...config, maxLinesAbove: parseInt(e.target.value) })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label>Dòng Dưới</label>
                      <input
                        type="number" min="0" max="10"
                        value={config.maxLinesBelow ?? 2}
                        onChange={e => setConfig({ ...config, maxLinesBelow: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'effects' && (
          <div className="panel-section">
            <h3 className="panel-title">Hiệu ứng Môi trường (Environment)</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {/* WATER */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                <div className="control-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: (config.enableWater || config.backgroundEffect === 'water') ? '10px' : '0' }}>
                  <label style={{ fontWeight: 'bold' }}>🌊 Mặt nước (Water)</label>
                  <input type="checkbox" checked={config.enableWater || config.backgroundEffect === 'water'}
                    onChange={e => setConfig({ ...config, enableWater: e.target.checked, backgroundEffect: e.target.checked ? 'water' : (config.enableFog ? 'fog' : 'none') })} />
                  {/* Fallback to fog if water disabled but fog enabled, else none. Complex? Just use flags in Preview */}
                </div>
                {(config.enableWater || config.backgroundEffect === 'water') && (
                  <div style={{ paddingLeft: '10px', borderLeft: '2px solid var(--primary)' }}>
                    <div className="control-row">
                      <label>Mực nước</label>
                      <input type="range" min="0" max="1" step="0.01" value={config.waterLevel ?? 0.7} onChange={e => setConfig({ ...config, waterLevel: parseFloat(e.target.value) })} />
                    </div>
                    <div className="control-row">
                      <label>Biên độ sóng</label>
                      <input type="range" min="0" max="50" step="1" value={config.waveAmplitude ?? 10} onChange={e => setConfig({ ...config, waveAmplitude: parseFloat(e.target.value) })} />
                    </div>
                  </div>
                )}
              </div>

              {/* FOG */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                <div className="control-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: (config.enableFog || config.backgroundEffect === 'fog') ? '10px' : '0' }}>
                  <label style={{ fontWeight: 'bold' }}>🌫️ Sương mù (Fog)</label>
                  <input type="checkbox" checked={config.enableFog || config.backgroundEffect === 'fog'}
                    onChange={e => setConfig({ ...config, enableFog: e.target.checked })} />
                </div>
                {(config.enableFog || config.backgroundEffect === 'fog') && (
                  <div style={{ paddingLeft: '10px', borderLeft: '2px solid var(--primary)' }}>
                    <div className="control-row">
                      <label>Độ dày</label>
                      <input type="range" min="0" max="1" step="0.05" value={config.fogIntensity ?? 0.5} onChange={e => setConfig({ ...config, fogIntensity: parseFloat(e.target.value) })} />
                    </div>
                    <div className="control-row">
                      <label>Tốc độ trôi</label>
                      <input type="range" min="0" max="5" step="0.1" value={config.fogSpeed ?? 1} onChange={e => setConfig({ ...config, fogSpeed: parseFloat(e.target.value) })} />
                    </div>
                  </div>
                )}
              </div>

              {/* PARTICLES */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                <div className="control-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: (config.enableGlobalParticles ?? true) ? '10px' : '0' }}>
                  <label style={{ fontWeight: 'bold' }}>✨ Hạt bụi (Particles)</label>
                  <input type="checkbox" checked={config.enableGlobalParticles ?? true}
                    onChange={e => setConfig({ ...config, enableGlobalParticles: e.target.checked })} />
                </div>
                {(config.enableGlobalParticles ?? true) && (
                  <div style={{ paddingLeft: '10px', borderLeft: '2px solid var(--primary)' }}>
                    <div className="control-row">
                      <label>Số lượng</label>
                      <input type="range" min="10" max="3000" step="10"
                        value={config.particleCount || 80}
                        onChange={e => setConfig({ ...config, particleCount: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="control-row">
                      <label>Tốc độ</label>
                      <input type="range" min="0.1" max="3" step="0.1"
                        value={config.particleSpeed || 0.5}
                        onChange={e => setConfig({ ...config, particleSpeed: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* FLOATING */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                <div className="control-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: 0 }}>
                  <label style={{ fontWeight: 'bold' }}>🎈 Trôi nổi (Floating)</label>
                  <input
                    type="checkbox"
                    checked={config.enableFloatingObject ?? true}
                    onChange={e => setConfig({ ...config, enableFloatingObject: e.target.checked })}
                  />
                </div>
                <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '5px' }}>
                  Áp dụng chuyển động nhẹ cho Hình ảnh & Thông tin bài hát.
                </div>
              </div>

            </div>

          </div>
        )}

        {activeTab === 'timings' && (
          <div className="panel-section">
            <h3 className="panel-title">Chỉnh sửa Thời gian</h3>
            <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
              <button className="btn" onClick={sortTimings} style={{ fontSize: '0.7rem', flex: 1 }}>Sắp xếp</button>
              <button className="btn danger" onClick={onClearTimings} style={{ fontSize: '0.7rem', flex: 1 }}>Xóa tất cả (0s)</button>
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

        {activeTab === 'donate' && (
          <div className="panel-section" style={{ textAlign: 'center' }}>
            <h3 className="panel-title">Ủng hộ Dự án</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Nếu bạn thấy công cụ này hữu ích, hãy cân nhắc ủng hộ để phát triển thêm!
            </p>
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '20px',
              borderRadius: '16px',
              display: 'inline-flex',
              justifyContent: 'center',
              alignItems: 'center',
              border: '1px solid var(--border)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
            }}>
              <img
                src="/qr.jpg"
                alt="Donate QR"
                style={{ width: '280px', height: 'auto', borderRadius: '8px', display: 'block' }}
                onError={(e) => { e.target.style.display = 'none'; alert('QR code not found in public folder.'); }}
              />
            </div>
            <p style={{ marginTop: '20px', fontSize: '0.8rem', color: 'var(--primary-glow)' }}>
              Quét mã để Donate ❤️
            </p>
          </div>
        )}


      </div>
    </div>

  );
});

export default Sidebar;
