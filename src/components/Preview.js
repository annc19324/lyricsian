
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';

const Preview = forwardRef(({ config, lyrics, currentLineIndex, canvasRef, audioRef, timings, isPlaying, onLineClick }, ref) => {
    // Hidden image elements for loading assets
    const coverImgRef = useRef(null);
    const mainImgRef = useRef(null);
    const positionsRef = useRef([]); // Store layout for click detection

    // Animation State
    const scrollYRef = useRef(0); // Current pixel offset for smooth scrolling

    const currentLineIndexRef = useRef(currentLineIndex);
    useEffect(() => { currentLineIndexRef.current = currentLineIndex; }, [currentLineIndex]);

    const mustSnapRef = useRef(false);
    const prevPlayingRef = useRef(isPlaying);
    useEffect(() => {
        if (isPlaying && !prevPlayingRef.current) {
            mustSnapRef.current = true;
        }
        prevPlayingRef.current = isPlaying;
    }, [isPlaying]);

    const handleCanvasClick = (e) => {
        if (!onLineClick) return;
        const rect = canvasRef.current.getBoundingClientRect();

        // Calculate Y relative to the canvas internal resolution
        const scaleY = config.height / rect.height;
        const clickY = (e.clientY - rect.top) * scaleY;

        const { width, height } = config;
        const centerX = width / 2;
        const centerY = height / 2;
        const isVertical = height > width;

        let lyricsBaseY = isVertical ? (height * 0.75) : centerY;
        let ty = lyricsBaseY + config.lyricsY;

        // Current Scroll
        const scroll = scrollYRef.current;
        const localY = (clickY - ty) / config.lyricsScale;
        const targetCy = localY + scroll;

        // Find closest line within bounds
        if (positionsRef.current.length > 0) {
            const hit = positionsRef.current.find(p => {
                const top = p.cy - (p.blockHeight / 2);
                const bottom = p.cy + (p.blockHeight / 2);
                return targetCy >= top - 10 && targetCy <= bottom + 10;
            });

            if (hit) {
                onLineClick(hit.index);
            }
        }
    };

    // Pre-calculate Layout Effect
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Access context purely for measurement (doesn't hurt performance much if done only on config change)
        const ctx = canvas.getContext('2d', { alpha: false });

        const { width, lyricSize, fontFamily } = config;
        ctx.font = `bold ${lyricSize}px ${fontFamily} `;

        const subLineHeight = lyricSize * 1.2;
        const blockGap = lyricSize * 1.0;
        const maxWidth = width * 0.8;

        const wrapText = (text, maxW) => {
            const words = text.split(' ');
            let lines = [];
            let currentLine = words[0];
            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const w = ctx.measureText(currentLine + " " + word).width;
                if (w < maxW) {
                    currentLine += " " + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);
            return lines;
        };

        const positions = [];
        let cursorY = 0;

        lyrics.forEach((line, i) => {
            const explicitLines = line.text.split('\n');
            let finalSubLines = [];
            explicitLines.forEach(l => {
                finalSubLines = finalSubLines.concat(wrapText(l, maxWidth));
            });

            const blockHeight = finalSubLines.length * subLineHeight;
            const cy = cursorY + (blockHeight / 2);
            positions.push({ cy, subLines: finalSubLines, blockHeight, index: i });
            cursorY += blockHeight + blockGap;
        });

        positionsRef.current = positions;

    }, [lyrics, config.width, config.height, config.lyricSize, config.fontFamily, config.lyricsScale]);

    // Expose render method to parent
    useImperativeHandle(ref, () => ({
        renderFrame: (time) => {
            render(time);
        },
        getPositions: () => positionsRef.current
    }));

    const render = (inputTime) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });

        // 0. Resolve effective time and index
        let effectiveTime = inputTime;
        let index = 0;

        // Find active index based on time and timings
        if (timings && timings.length > 0) {
            const hasValidTimings = timings.some(t => t.time > 0.1);
            if (hasValidTimings) {
                let activeIndex = -1;
                let maxTimeFound = -1;
                for (let i = 0; i < timings.length; i++) {
                    const t = timings[i];
                    if (t.time > 0.1 && effectiveTime >= t.time) {
                        if (t.time > maxTimeFound) {
                            maxTimeFound = t.time;
                            activeIndex = t.index;
                        } else if (t.time === maxTimeFound) {
                            if (t.index > activeIndex) activeIndex = t.index;
                        }
                    }
                }
                if (activeIndex !== -1) index = activeIndex;
            }
        }
        // Fallback or override if no timing matched? Use current pointer? 
        // Actually for offline render, we trust time -> index. 
        // For editing, we might want to respect selected index.
        // But the prompt implies "Audio plays -> Preview updates". 
        // So time is truth.

        const { width, height, fontFamily, lyricSize, activeColor } = config;

        // 1. Clear & Setup
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, width, height);

        const centerX = width / 2;
        const centerY = height / 2;
        const isVertical = height > width;

        // 2. Draw Background (Cover Image)
        if (coverImgRef.current && coverImgRef.current.complete && coverImgRef.current.naturalWidth > 0) {
            ctx.save();
            const img = coverImgRef.current;
            const ratio = Math.max(width / img.naturalWidth, height / img.naturalHeight);
            const w = img.naturalWidth * ratio;
            const h = img.naturalHeight * ratio;
            const x = (width - w) / 2;
            const y = (height - h) / 2;
            ctx.filter = `blur(${config.coverBlur ?? 40}px) brightness(0.4)`;
            ctx.drawImage(img, x, y, w, h);
            ctx.restore();
        }

        // 3. Draw Main Image
        if (mainImgRef.current && mainImgRef.current.complete && mainImgRef.current.naturalWidth > 0) {
            ctx.save();
            let baseX = isVertical ? centerX : (width * 0.3);
            let baseY = isVertical ? (height * 0.3) : centerY;
            let drawX = baseX + config.imageX;
            let drawY = baseY + config.imageY;
            const img = mainImgRef.current;
            const scale = config.imageScale || 1;
            const w = img.naturalWidth * scale;
            const h = img.naturalHeight * scale;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 10;
            ctx.shadowOffsetY = 10;
            ctx.drawImage(img, drawX - w / 2, drawY - h / 2, w, h);
            ctx.restore();

            // Draw Song Info Text
            ctx.save();
            ctx.textAlign = isVertical ? 'center' : 'left';
            ctx.fillStyle = 'white';
            const textX = isVertical ? drawX : (drawX - w / 2);
            let textY = isVertical ? (drawY + h / 2 + 40) : (drawY + h / 2 + 50);
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            ctx.font = `bold 40px ${fontFamily} `;
            ctx.fillText(config.songName || '', textX, textY);
            textY += 45;
            ctx.font = `30px ${fontFamily} `;
            ctx.fillStyle = '#ddd';
            ctx.fillText(config.artistName || '', textX, textY);
            textY += 35;
            if (config.channelName) {
                ctx.font = `italic 20px ${fontFamily} `;
                ctx.fillStyle = 'rgba(255,255,255,0.6)';
                ctx.fillText(config.channelName, textX, textY);
            }
            ctx.restore();
        }

        // 4. Draw Lyrics using Pre-calculated Positions
        ctx.save();

        let lyricsBaseX = isVertical ? centerX : (width * 0.7);
        let lyricsBaseY = isVertical ? (height * 0.75) : centerY;
        let tx = lyricsBaseX + config.lyricsX;
        let ty = lyricsBaseY + config.lyricsY;

        ctx.translate(tx, ty);
        ctx.scale(config.lyricsScale, config.lyricsScale);
        ctx.textAlign = config.lyricsAlign;
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${lyricSize}px ${fontFamily} `;

        const positions = positionsRef.current;
        const activePos = positions[index];
        const targetScroll = activePos ? activePos.cy : 0;

        // Smooth Scroll Logic: 
        // For Offline Export (isPlaying can be hijacked or just rely on 'inputTime')
        // In "Frame Based" approach, we ideally want exact scroll position for 'inputTime'.
        // But scroll is an aesthetic state.
        // If we are strictly offline, we should calculate scroll based on time?
        // Or just SNAP if it's a new line.
        // Let's implement a simple lerp state update:
        // BUT: render function is stateless in pure frame-based. 
        // We need to persist scroll state externally or handle it here?
        // We have scrollYRef.
        // Ideally: Scroll = TargetScroll of current index. (Instant snap in export? No, hard cut is bad)
        // Lerp is time-dependent.
        // Let's sim lerp: if |target - current| > threshold, move 10%.

        let currentScroll = scrollYRef.current;
        const diff = targetScroll - currentScroll;

        // Critical: If 'editing' (drag/seek), we might snap.
        // If 'exporting', we process frame by frame. Since frames are 1/30s apart, 
        // running 0.1 lerp per frame is effectively 30FPS animation.
        // So standard lerp works fine!

        if (Math.abs(diff) > 0.5) {
            currentScroll += diff * 0.1;
        } else {
            currentScroll = targetScroll;
        }
        scrollYRef.current = currentScroll;

        // 5. Draw Strings
        positions.forEach((pos, i) => {
            const lineY = pos.cy - currentScroll;

            const maxAbove = config.maxLinesAbove ?? 2;
            const maxBelow = config.maxLinesBelow ?? 2;
            if (i < index - maxAbove || i > index + maxBelow) return;

            const isActive = (i === index);
            let opacity = 0.4;
            if (isActive) opacity = 1;
            else {
                const dist = Math.abs(index - i);
                opacity = Math.max(0.1, 0.4 - (dist * 0.05));
            }

            ctx.save();

            let styles = config.highlightStyles;
            if (!styles) {
                styles = config.highlightStyle ? [config.highlightStyle] : ['color'];
            }

            if (isActive) {
                if (styles.includes('color')) ctx.fillStyle = activeColor;
                else ctx.fillStyle = '#ffffff';

                if (styles.includes('color')) ctx.fillStyle = activeColor;

                if (styles.includes('glow')) {
                    ctx.shadowColor = activeColor;
                    ctx.shadowBlur = 20;
                } else {
                    ctx.shadowBlur = 0;
                }

                if (styles.includes('scale')) {
                    ctx.translate(0, lineY);
                    ctx.scale(1.2, 1.2);
                    ctx.translate(0, -lineY);
                }

                if (styles.includes('box')) {
                    let maxLineWidth = 0;
                    pos.subLines.forEach(sub => {
                        const m = ctx.measureText(sub);
                        if (m.width > maxLineWidth) maxLineWidth = m.width;
                    });
                    const pad = 20;
                    const boxWidth = maxLineWidth + (pad * 2);
                    const blockH = pos.blockHeight;
                    const boxHeight = blockH + (pad * 2);
                    let boxX = 0;
                    if (config.lyricsAlign === 'center') boxX = -boxWidth / 2;
                    else if (config.lyricsAlign === 'right') boxX = -boxWidth;
                    else boxX = -pad;
                    const boxY = lineY - (blockH / 2) - pad;
                    ctx.fillStyle = activeColor;
                    const r = 16;
                    ctx.beginPath();
                    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, r);
                    ctx.fill();
                    ctx.fillStyle = '#000000';
                }
            } else {
                ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                ctx.shadowBlur = 0;
            }

            const isKaraoke = isActive && styles.includes('karaoke');
            // const currentTime = (audioRef && audioRef.current) ? audioRef.current.currentTime : 0; 
            // NO! Use effectiveTime
            const currentTime = effectiveTime;

            const subLineHeight = lyricSize * 1.2;

            pos.subLines.forEach((sub, subIndex) => {
                const verticalOffset = (subIndex - (pos.subLines.length - 1) / 2) * subLineHeight;
                const y = lineY + verticalOffset;

                if (isKaraoke) {
                    ctx.save();
                    ctx.globalAlpha = 0.3;
                    ctx.fillText(sub, 0, y);
                    ctx.restore();

                    const start = timings[i] ? timings[i].time : 0;
                    const next = (timings[i + 1] && timings[i + 1].time > 0.1) ? timings[i + 1].time : (start + 2.5);
                    const kSpeed = config.karaokeSpeed || 1.0;
                    const duration = (next - start) / kSpeed;
                    const globalProgress = Math.min(1, Math.max(0, (currentTime - start) / duration));

                    const totalSubCount = pos.subLines.length;
                    const subStart = subIndex / totalSubCount;
                    const subEnd = (subIndex + 1) / totalSubCount;

                    let subProgress = 0;
                    if (globalProgress >= subEnd) subProgress = 1;
                    else if (globalProgress >= subStart) {
                        subProgress = (globalProgress - subStart) / (subEnd - subStart);
                    }

                    const tw = ctx.measureText(sub).width;
                    const fillWidth = tw * subProgress;

                    let startX = 0;
                    if (config.lyricsAlign === 'center') startX = -tw / 2;
                    else if (config.lyricsAlign === 'right') startX = -tw;

                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(startX, y - (subLineHeight / 2), fillWidth, subLineHeight);
                    ctx.clip();
                    ctx.fillText(sub, 0, y);
                    ctx.restore();
                } else {
                    ctx.fillText(sub, 0, y);
                }
            });
            ctx.restore();
        });
        ctx.restore();
    };

    // Initial render
    useEffect(() => {
        // Render initial frame (time 0) when assets load or config changes
        const t = setTimeout(() => render(0), 100);
        return () => clearTimeout(t);
    }, [config, lyrics, positionsRef.current]);
    // ^ simplified deps. Essentially whenever layout calc changes, we re-render frame 0 (or current?)
    // Actually we should render current... but stateless...

    return (
        <div className="preview-area" style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000', overflow: 'hidden'
        }}>
            <canvas ref={canvasRef} onClick={handleCanvasClick} width={config.width} height={config.height}
                style={{
                    maxWidth: '85%', maxHeight: '85%', objectFit: 'contain',
                    border: '1px solid #333', boxShadow: '0 0 50px rgba(0,0,0,0.8)', cursor: 'pointer'
                }}
            />
            {/* Hidden Asset Loaders */}
            <img ref={coverImgRef} src={config.coverImage || config.mainImage} alt="asset-cover" style={{ display: 'none' }} />
            <img ref={mainImgRef} src={config.mainImage} alt="asset-main" style={{ display: 'none' }} />
        </div>
    );
});

export default Preview;
