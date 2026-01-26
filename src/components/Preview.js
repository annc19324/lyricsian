
import React, { useEffect, useRef, useState } from 'react';

const Preview = ({ config, lyrics, currentLineIndex, canvasRef, audioRef, timings, isPlaying, onLineClick }) => {
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
        // The canvas is scaled by CSS, so we need ratio
        const scaleY = config.height / rect.height;
        const clickY = (e.clientY - rect.top) * scaleY;

        // We need to find which line corresponds to this Y
        // The positionsRef stores 'cy' (center Y) relative to the SCROLL OFFSET.
        // Screen Y = (pos.cy - scrollY) + translateY_Offset + 
        // Wait, the drawing logic applies `ctx.translate(tx, ty)`.

        // Let's reverse map:
        // Raw Y on Canvas -> adjust for Global Translation -> adjust for Scroll -> find in positions

        const { width, height } = config;
        const centerX = width / 2;
        const centerY = height / 2;
        const isVertical = height > width;

        let lyricsBaseY = isVertical ? (height * 0.75) : centerY;
        let ty = lyricsBaseY + config.lyricsY;

        // Current Scroll
        const scroll = scrollYRef.current;

        // clickY relative to the "Lyrics Group" origin (0,0 of translate)
        // Global Click Y = ty + (Local Y scaled by lyricsScale)
        // Local Y = (Click Y - ty) / lyricsScale
        // And Local Y is also = (LineCY - Scroll)
        // Thus: LineCY = Local Y + Scroll

        const localY = (clickY - ty) / config.lyricsScale;
        const targetCy = localY + scroll;

        // Find closest line
        if (positionsRef.current.length > 0) {
            // Check bounding boxes
            // Each line has 'cy' and 'blockHeight'. 
            // Top = cy - blockHeight/2, Bottom = cy + blockHeight/2

            const hit = positionsRef.current.find(p => {
                const top = p.cy - (p.blockHeight / 2);
                const bottom = p.cy + (p.blockHeight / 2);
                // Add some buffer for gaps
                return targetCy >= top - 10 && targetCy <= bottom + 10;
            });

            if (hit) {
                onLineClick(hit.index);
            }
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: false }); // Optimize
        let animationFrameId;

        const render = () => {
            // Hybrid Logic: Default to Ref (React State)
            let index = currentLineIndexRef.current;

            // Override with Real-time calculation if playing/exporting and we have timings
            if (isPlaying && timings && timings.length > 0 && audioRef && audioRef.current) {
                const time = audioRef.current.currentTime;

                // IMPORTANT: If timings are all 0, don't override index unless playing > 0
                const hasValidTimings = timings.some(t => t.time > 0.1);

                if (hasValidTimings) {
                    // Find LAST timing that is <= time AND has a valid value
                    let activeIndex = -1;
                    let maxTimeFound = -1;

                    for (let i = 0; i < timings.length; i++) {
                        const t = timings[i];
                        // STRICT CHECK: content must have a time > 0.1 to be considered a "valid past event"
                        if (t.time > 0.1 && time >= t.time) {
                            if (t.time > maxTimeFound) {
                                maxTimeFound = t.time;
                                activeIndex = t.index;
                            } else if (t.time === maxTimeFound) {
                                // If tie, take higher index
                                if (t.index > activeIndex) activeIndex = t.index;
                            }
                        }
                    }

                    // Only override if we found a valid active index. 
                    if (activeIndex !== -1) {
                        index = activeIndex;
                    }
                }
            }

            const { width, height, fontFamily, lyricSize, activeColor } = config;

            // 1. Clear & Setup
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, width, height);

            const centerX = width / 2;
            const centerY = height / 2;
            const isVertical = height > width;

            // 2. Draw Background (Cover Image)
            if (coverImgRef.current && coverImgRef.current.complete && coverImgRef.current.naturalWidth > 0) {
                // Draw blurred background
                ctx.save();
                // Simple cover fit
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
                // Position logic based on ratio
                // Horizontal: Image Left, Lyrics Right
                // Vertical: Image Top, Lyrics Bottom
                let baseX = isVertical ? centerX : (width * 0.3);
                let baseY = isVertical ? (height * 0.3) : centerY;

                // Apply User Offsets (imageX, imageY)
                let drawX = baseX + config.imageX;
                let drawY = baseY + config.imageY;

                // Draw from center
                const img = mainImgRef.current;
                const scale = config.imageScale || 1;
                // Base size assumption: 40% of smaller dimension
                // const baseSize = Math.min(width, height) * 0.4; 
                // Using actual image size * scale might be huge. Let's stick to user scale.
                // Assuming user configures scale for 1080p base.
                // If user scale is 1, let's treat it as "Native Size" or "Reasonable Size"?
                // Let's use image natural dimensions * scale.

                const w = img.naturalWidth * scale;
                const h = img.naturalHeight * scale;

                // Shadow
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 20;
                ctx.shadowOffsetX = 10;
                ctx.shadowOffsetY = 10;

                ctx.drawImage(img, drawX - w / 2, drawY - h / 2, w, h);
                ctx.restore();

                // Draw Song Info Text near image
                ctx.save();
                ctx.textAlign = isVertical ? 'center' : 'left';
                ctx.fillStyle = 'white';
                // Position text relative to image
                // Vertical: Below image. Horizontal: Below image (aligned left)
                const textX = isVertical ? drawX : (drawX - w / 2);
                let textY = isVertical ? (drawY + h / 2 + 40) : (drawY + h / 2 + 50);

                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                ctx.font = `bold 40px ${fontFamily} `; // Fixed large size for 1080p
                ctx.fillText(config.songName || '', textX, textY);
                textY += 45;

                ctx.font = `30px ${fontFamily} `;
                ctx.fillStyle = '#ddd';
                ctx.fillText(config.artistName || '', textX, textY);
                textY += 35;

                // Channel Name (Smaller, Muted)
                if (config.channelName) {
                    ctx.font = `italic 20px ${fontFamily} `;
                    ctx.fillStyle = 'rgba(255,255,255,0.6)';
                    ctx.fillText(config.channelName, textX, textY);
                }

                ctx.restore();
            }

            // 4. Draw Lyrics
            ctx.save();

            // Base Position for Lyrics Center
            let lyricsBaseX = isVertical ? centerX : (width * 0.7);
            let lyricsBaseY = isVertical ? (height * 0.75) : centerY;

            // Apply User offsets
            let tx = lyricsBaseX + config.lyricsX;
            let ty = lyricsBaseY + config.lyricsY; // This is the "Center" line position

            ctx.translate(tx, ty);
            ctx.scale(config.lyricsScale, config.lyricsScale);

            ctx.textAlign = config.lyricsAlign; // 'left', 'center', 'right'
            ctx.textBaseline = 'middle'; // Fix vertical centering
            ctx.font = `bold ${lyricSize}px ${fontFamily} `;

            // Smooth Scroll Logic
            // We want the currentLineIndex to be at Y=0 (relative to translate)
            // But we want to scroll smoothly.
            // Let's assume each line is fixed height for simplicity or measure?
            // Measuring is better if lines wrap.
            // Dynamic Layout Calculation
            const subLineHeight = lyricSize * 1.2;
            const blockGap = lyricSize * 1.0; // Space between text blocks

            // Text Wrapping Helper
            const wrapText = (text, maxW) => {
                const words = text.split(' ');
                let lines = [];
                let currentLine = words[0];

                for (let i = 1; i < words.length; i++) {
                    const word = words[i];
                    const width = ctx.measureText(currentLine + " " + word).width;
                    if (width < maxW) {
                        currentLine += " " + word;
                    } else {
                        lines.push(currentLine);
                        currentLine = word;
                    }
                }
                lines.push(currentLine);
                return lines;
            };

            // Calculate Available Width (roughly 80% of canvas width or specific based on alignment?)
            // If Text Align is Center, we can use 80% width.
            const maxWidth = width * 0.8;

            // 1. Calculate Center Y for each block based on content height
            const positions = [];
            let cursorY = 0;

            lyrics.forEach(line => {
                // First handle explicit newlines
                const explicitLines = line.text.split('\n');
                let finalSubLines = [];

                explicitLines.forEach(l => {
                    // Wrap each explicit line
                    finalSubLines = finalSubLines.concat(wrapText(l, maxWidth));
                });

                const blockHeight = finalSubLines.length * subLineHeight;
                // Center of this block is cursorY + half height
                const cy = cursorY + (blockHeight / 2);
                positions.push({ cy, subLines: finalSubLines, blockHeight });
                // Move cursor: height + gap
                cursorY += blockHeight + blockGap;
            });

            // Store for hit testing
            positionsRef.current = positions.map((p, i) => ({ ...p, index: i }));

            // 2. Target Scroll: Center the current active line at 0 offset
            const activePos = positions[index];
            const targetScroll = activePos ? activePos.cy : 0;

            // Lerp or Snap
            if (mustSnapRef.current) {
                scrollYRef.current = targetScroll;
                mustSnapRef.current = false;
            } else {
                scrollYRef.current = scrollYRef.current + (targetScroll - scrollYRef.current) * 0.1;
            }

            // 3. Draw Strings
            positions.forEach((pos, i) => {
                const lineY = pos.cy - scrollYRef.current;

                // Strict Visibility Check based on Lines Count
                const maxAbove = config.maxLinesAbove ?? 2;
                const maxBelow = config.maxLinesBelow ?? 2;
                if (i < index - maxAbove || i > index + maxBelow) return;

                // Styles
                const isActive = (i === index);
                let opacity = 0.4;
                if (isActive) opacity = 1;
                else {
                    const dist = Math.abs(index - i);
                    opacity = Math.max(0.1, 0.4 - (dist * 0.05));
                }

                ctx.save();

                // Highlight Styles (Multi-select)
                // Fallback for old configs: try config.highlightStyle string if array missing
                let styles = config.highlightStyles;
                if (!styles) {
                    styles = config.highlightStyle ? [config.highlightStyle] : ['color'];
                }

                if (isActive) {
                    // 1. Color
                    if (styles.includes('color')) {
                        ctx.fillStyle = activeColor;
                    } else {
                        // If not using color highlight, what to use? White? 
                        // Usually 'scale' or 'glow' implies active color too. 
                        // Let's assume activeColor unless explicitly ONLY box?
                        // Actually, if 'color' is unchecked, maybe we keep white but add effect?
                        // For safety, let's stick to white if 'color' is NOT selected, 
                        // UNLESS 'box' is selected (where text becomes black).

                        // Let's adopt a logic: if ANY highlight is active, use activeColor for effects, 
                        // but text fill depends...
                        // If 'color' is NOT in styles, we default text to White? 
                        ctx.fillStyle = '#ffffff';
                    }

                    // Override text color if 'color' style is explicitly active
                    if (styles.includes('color')) ctx.fillStyle = activeColor;

                    // 2. Glow
                    if (styles.includes('glow')) {
                        ctx.shadowColor = activeColor;
                        ctx.shadowBlur = 20;
                    } else {
                        ctx.shadowBlur = 0;
                    }

                    // 3. Scale
                    if (styles.includes('scale')) {
                        ctx.translate(0, lineY);
                        ctx.scale(1.2, 1.2);
                        ctx.translate(0, -lineY);
                    }

                    // 4. Box
                    if (styles.includes('box')) {
                        // Draw Rounded Box behind the text
                        let maxLineWidth = 0;
                        pos.subLines.forEach(sub => {
                            const m = ctx.measureText(sub);
                            if (m.width > maxLineWidth) maxLineWidth = m.width;
                        });

                        // Configurable Padding (Uniform)
                        const pad = 20;

                        const boxWidth = maxLineWidth + (pad * 2);
                        const blockH = pos.blockHeight;
                        const boxHeight = blockH + (pad * 2);

                        let boxX = 0;
                        // Adjust X so padding is applied correctly
                        if (config.lyricsAlign === 'center') boxX = -boxWidth / 2;
                        else if (config.lyricsAlign === 'right') boxX = -boxWidth;
                        else boxX = -pad; // Left align

                        const boxY = lineY - (blockH / 2) - pad;

                        // Save current fillStyle to restore after box for text
                        const textFill = ctx.fillStyle;

                        // Draw Box
                        ctx.fillStyle = activeColor;
                        const r = 16;
                        ctx.beginPath();
                        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, r);
                        ctx.fill();

                        // Force text color black if box is active (for contrast)
                        ctx.fillStyle = '#000000';
                    }
                } else {
                    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                    ctx.shadowBlur = 0;
                }

                const isKaraoke = isActive && styles.includes('karaoke');
                const currentTime = (audioRef && audioRef.current) ? audioRef.current.currentTime : 0;

                // Render each sub-line centered around lineY
                pos.subLines.forEach((sub, subIndex) => {
                    // verticalOffset relative to lineY
                    const verticalOffset = (subIndex - (pos.subLines.length - 1) / 2) * subLineHeight;
                    const y = lineY + verticalOffset;

                    if (isKaraoke) {
                        // 1. Draw Base (Unfilled / Dimmed)
                        ctx.save();
                        ctx.globalAlpha = 0.3; // Low opacity for "yet to be sung" 
                        ctx.fillText(sub, 0, y);
                        ctx.restore();

                        // 2. Calculate Karaoke Progress for this SPECIFIC sub-line
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

                        // 3. Draw Filled Part
                        const tw = ctx.measureText(sub).width;
                        const fillWidth = tw * subProgress;

                        let startX = 0;
                        if (config.lyricsAlign === 'center') startX = -tw / 2;
                        else if (config.lyricsAlign === 'right') startX = -tw;

                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(startX, y - (subLineHeight / 2), fillWidth, subLineHeight);
                        ctx.clip();

                        // We use the same fillStyle (activeColor) set previously in the isActive block
                        ctx.fillText(sub, 0, y);
                        ctx.restore();

                    } else {
                        // Standard rendering
                        ctx.fillText(sub, 0, y);
                    }
                });

                ctx.restore();
            });

            ctx.restore();

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationFrameId);
    }, [config, lyrics, canvasRef, onLineClick, isPlaying, timings, audioRef]); // Dependencies

    return (
        <div className="preview-area" style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#000',
            overflow: 'hidden'
        }}>
            {/* The Actual Canvas */}
            <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                width={config.width}
                height={config.height}
                style={{
                    maxWidth: '85%',
                    maxHeight: '85%',
                    objectFit: 'contain',
                    border: '1px solid #333',
                    boxShadow: '0 0 50px rgba(0,0,0,0.8)',
                    cursor: 'pointer'
                }}
            />

            {/* Hidden Asset Loaders */}
            <img
                ref={coverImgRef}
                src={config.coverImage || config.mainImage}
                alt="asset-cover"
                style={{ display: 'none' }}
            />
            <img
                ref={mainImgRef}
                src={config.mainImage}
                alt="asset-main"
                style={{ display: 'none' }}
            />
        </div>
    );
};

export default Preview;
