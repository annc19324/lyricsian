
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';

const Preview = React.memo(forwardRef(({ config, lyrics, currentLineIndex, canvasRef, audioRef, timings, isPlaying, onLineClick, isExporting = false }, ref) => {
    // Hidden image elements for loading assets
    const coverImgRef = useRef(null);
    const mainImgRef = useRef(null);
    const positionsRef = useRef([]); // Store layout for click detection
    const offscreenCanvasRef = useRef(document.createElement('canvas')); // Reusable offscreen canvas

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

        const syntaxes = config.customSyntaxes || [{ id: 1, open: '[', close: ']', color: '#ffeb3b' }];

        const tokenizeText = (text, syns) => {
            let result = [];
            let current = 0;
            while (current < text.length) {
                let nextSyn = null;
                let nextIndex = text.length;
                for (const syn of syns) {
                    if (!syn.open || !syn.close) continue;
                    const idx = text.indexOf(syn.open, current);
                    if (idx !== -1 && idx < nextIndex) {
                        nextIndex = idx;
                        nextSyn = syn;
                    }
                }
                if (nextSyn) {
                    if (nextIndex > current) {
                        result.push({ text: text.substring(current, nextIndex), isHighlighted: false, color: null });
                    }
                    const closeIdx = text.indexOf(nextSyn.close, nextIndex + nextSyn.open.length);
                    if (closeIdx !== -1) {
                        result.push({
                            text: text.substring(nextIndex + nextSyn.open.length, closeIdx),
                            isHighlighted: true,
                            color: nextSyn.color,
                        });
                        current = closeIdx + nextSyn.close.length;
                    } else {
                        result.push({ text: text.substring(nextIndex, nextIndex + nextSyn.open.length), isHighlighted: false, color: null });
                        current = nextIndex + nextSyn.open.length;
                    }
                } else {
                    result.push({ text: text.substring(current), isHighlighted: false, color: null });
                    break;
                }
            }
            return result;
        };
        const getCleanText = (text, syns) => tokenizeText(text, syns).map(t => t.text).join('');

        const wrapText = (text, maxW) => {
            const lines = [];
            let currentLine = "";
            const words = text.split(' ');
            
            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                // Clean syntax for measurement
                const cleanWord = getCleanText(word, syntaxes);
                const testLine = currentLine + (currentLine ? " " : "") + cleanWord;
                const w = ctx.measureText(testLine).width;
                if (w < maxW || !currentLine) {
                    currentLine += (currentLine ? " " : "") + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            if (currentLine) lines.push(currentLine);
            return lines;
        };

        const positions = [];
        let cursorY = 0;

        lyrics.forEach((line, i) => {
            // Pre-process syntax highlighting markers
            const flatText = getCleanText(line.text, syntaxes);
            
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

    }, [lyrics, config.width, config.height, config.lyricSize, config.fontFamily, config.lyricsScale, config.highlightColor]);

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
        const { width, height, fontFamily, lyricSize, activeColor } = config;

        // 0. Resolve Time/Index
        let effectiveTime = inputTime;
        let index = 0;
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
                        } else if (t.time === maxTimeFound && t.index > activeIndex) {
                            activeIndex = t.index;
                        }
                    }
                }
                if (activeIndex !== -1) index = activeIndex;
            }
        }

        // --- CINEMATIC CAMERA MOVEMENT (Subtle Zoom/Pan) ---
        // We apply this transform to the entire scene (except maybe UI overlays if we had any)
        // Ideally applies to everything including background and lyrics.

        ctx.save(); // Start Global Camera Transform

        const camTime = effectiveTime * 0.05; // Very slow
        // Subtle Zoom breathing: 1.0 to 1.02
        const camZoom = 1.0 + Math.sin(camTime) * 0.015;
        // Subtle Pan: -10px to +10px
        const camPanX = Math.sin(camTime * 0.7) * 15;
        const camPanY = Math.cos(camTime * 0.5) * 10;

        // Center zoom
        ctx.translate(width / 2, height / 2);
        ctx.scale(camZoom, camZoom);
        ctx.translate(-width / 2, -height / 2);
        ctx.translate(camPanX, camPanY);

        // 1. Clear & Background Base
        ctx.fillStyle = '#111';
        ctx.fillRect(-100, -100, width + 200, height + 200); // Overscan clear

        const centerX = width / 2;
        const centerY = height / 2;
        const isVertical = height > width;

        if (coverImgRef.current?.complete && coverImgRef.current.naturalWidth > 0) {
            ctx.save();
            const img = coverImgRef.current;
            const ratio = Math.max(width / img.naturalWidth, height / img.naturalHeight);
            const w = img.naturalWidth * ratio;
            const h = img.naturalHeight * ratio;
            const x = (width - w) / 2;
            const y = (height - h) / 2;

            // Depth of Field Simulation for Background
            // If we want "Cinematic Blur", we blur the background layer more.
            // Configurable or fixed style? Let's go for fixed Cinematic style.
            ctx.filter = `blur(${config.coverBlur ?? 40}px) brightness(0.6) contrast(1.1)`; // Enhanced contrast

            // Color Grading (Cool Blue Night or Warm Sunset)
            // Let's assume Cool Blue for Water/Fog as default Cinematic
            // We can't easily tint an image without composite.

            ctx.drawImage(img, x, y, w, h);

            // Color Grading Overlay - Blue Night
            ctx.fillStyle = 'rgba(10, 20, 40, 0.4)'; // Dark Blue Tint
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillRect(x, y, w, h);

            ctx.restore();
        }

        // --- HORIZON GLOW (Soft Light from distance) ---
        // Only show horizon glow if there is a water surface to reflect/define it.
        if (config.enableWater || config.backgroundEffect === 'water') {
            ctx.save();
            const horizonY = height * (config.waterLevel || 0.7);

            const glowGrad = ctx.createLinearGradient(0, horizonY - 200, 0, horizonY + 100);
            glowGrad.addColorStop(0, 'rgba(150, 200, 255, 0)');
            glowGrad.addColorStop(0.8, 'rgba(180, 220, 255, 0.15)'); // Horizon line light
            glowGrad.addColorStop(1, 'rgba(150, 200, 255, 0)');

            ctx.globalCompositeOperation = 'screen'; // Additive
            ctx.fillStyle = glowGrad;
            ctx.fillRect(0, horizonY - 200, width, 300);

            // Light Rays (Subtle)
            const rayTime = effectiveTime * 0.2;
            const rayX = width * 0.5 + Math.sin(rayTime) * 200;
            const rayGrad = ctx.createRadialGradient(rayX, horizonY - 100, 0, rayX, horizonY + 200, 600);
            rayGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
            rayGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.rotate(Math.PI * 0.1); // Angled rays
            ctx.translate(100, -200);
            ctx.fillStyle = rayGrad;
            ctx.fillRect(-500, horizonY - 500, width + 1000, 1000); // Oversize

            ctx.restore();
        }

        // --- DRAW SCENE FUNCTION (Accepts targetCTX) ---
        const drawScene = (targetCtx, isReflection = false) => {
            // Main Image / Video
            const media = mainImgRef.current;
            if (media && (media.tagName === 'VIDEO' ? media.readyState >= 2 : (media.complete && media.naturalWidth > 0))) {
                targetCtx.save();
                let baseX = isVertical ? centerX : (width * 0.3);
                let baseY = isVertical ? (height * 0.3) : centerY;
                let drawX = baseX + config.imageX;
                let drawY = baseY + config.imageY;
                const mWidth = media.tagName === 'VIDEO' ? media.videoWidth : media.naturalWidth;
                const mHeight = media.tagName === 'VIDEO' ? media.videoHeight : media.naturalHeight;
                const scale = config.imageScale || 1;
                const w = mWidth * scale;
                const h = mHeight * scale;

                if (!isReflection) {
                    if (config.enableFloatingObject !== false) {
                        const floatY = Math.sin(effectiveTime * (config.floatingSpeed ?? 1.5)) * 5;
                        drawY += floatY;
                    }
                    targetCtx.shadowColor = 'rgba(0,0,0,0.5)';
                    targetCtx.shadowBlur = 20;
                    targetCtx.shadowOffsetX = 10;
                    targetCtx.shadowOffsetY = 10;
                }

                targetCtx.drawImage(media, drawX - w / 2, drawY - h / 2, w, h);
                targetCtx.restore();

                // Song Info
                targetCtx.save();
                targetCtx.textAlign = isVertical ? 'center' : 'left';
                const textX = isVertical ? drawX : (drawX - w / 2);
                let baseTextY = isVertical ? (drawY + h / 2 + 40) : (drawY + h / 2 + 50);

                if (!isReflection) {
                    targetCtx.shadowColor = 'rgba(0,0,0,0.8)';
                    targetCtx.shadowBlur = 4;
                    targetCtx.shadowOffsetX = 2;
                    targetCtx.shadowOffsetY = 2;
                }
                const songFontFamily = config.songFont || fontFamily;
                targetCtx.font = `bold ${config.songSize || 40}px ${songFontFamily} `;
                targetCtx.fillStyle = config.songColor || 'white';
                targetCtx.fillText(config.songName || '', textX + (config.songX || 0), baseTextY + (config.songY || 0));

                const artistBaseY = baseTextY + 45;
                const artistFontFamily = config.artistFont || fontFamily;
                targetCtx.font = `${config.artistSize || 30}px ${artistFontFamily} `;
                targetCtx.fillStyle = config.artistColor || '#ddd';
                targetCtx.fillText(config.artistName || '', textX + (config.artistX || 0), artistBaseY + (config.artistY || 0));

                if (config.channelName) {
                    const channelBaseY = artistBaseY + 35;
                    const channelFontFamily = config.channelFont || fontFamily;
                    targetCtx.font = `italic ${config.channelSize || 20}px ${channelFontFamily} `;
                    targetCtx.fillStyle = config.channelColor || 'rgba(255,255,255,0.6)';
                    targetCtx.fillText(config.channelName, textX + (config.channelX || 0), channelBaseY + (config.channelY || 0));
                }
                targetCtx.restore();
            }

            // Lyrics
            targetCtx.save();
            let lyricsBaseX = isVertical ? centerX : (width * 0.7);
            let lyricsBaseY = isVertical ? (height * 0.75) : centerY;
            let tx = lyricsBaseX + config.lyricsX;
            let ty = lyricsBaseY + config.lyricsY;

            targetCtx.translate(tx, ty);
            targetCtx.scale(config.lyricsScale, config.lyricsScale);
            // targetCtx.textAlign = config.lyricsAlign; // Moved down per segment
            targetCtx.textBaseline = 'middle';
            targetCtx.font = `bold ${lyricSize}px ${fontFamily} `;

            const positions = positionsRef.current;
            const activePos = positions[index];
            const targetScroll = activePos ? activePos.cy : 0;

            // Scroll Logic
            let currentScroll = scrollYRef.current;
            if (!isReflection) {
                const diff = targetScroll - currentScroll;
                if (Math.abs(diff) > 0.5) currentScroll += diff * 0.08;
                else currentScroll = targetScroll;
                scrollYRef.current = currentScroll;
            }

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
                if (isReflection) opacity *= 0.7;

                targetCtx.save();
                let styles = config.highlightStyles || [];
                const useCustomGlow = styles.includes('glow');
                const glowSize = useCustomGlow ? (config.lyricsGlowSize || 20) : 0;

                const baseColor = isActive ? activeColor : `rgba(255, 255, 255, ${opacity})`;
                targetCtx.fillStyle = baseColor;

                if (isActive && useCustomGlow && !isReflection) {
                    targetCtx.shadowColor = activeColor;
                    targetCtx.shadowBlur = glowSize;
                } else {
                    targetCtx.shadowColor = 'transparent';
                    targetCtx.shadowBlur = 0;
                }

                if (isActive && styles.includes('scale')) {
                    targetCtx.translate(0, lineY);
                    const scaleFactor = config.activeScale ?? 1.2;
                    targetCtx.scale(scaleFactor, scaleFactor);
                    targetCtx.translate(0, -lineY);
                }

                const syntaxes = config.customSyntaxes || [{ id: 1, open: '[', close: ']', color: '#ffeb3b' }];
                const tokenizeText = (text, syns) => {
                    let result = [];
                    let current = 0;
                    while (current < text.length) {
                        let nextSyn = null;
                        let nextIndex = text.length;
                        for (const syn of syns) {
                            if (!syn.open || !syn.close) continue;
                            const idx = text.indexOf(syn.open, current);
                            if (idx !== -1 && idx < nextIndex) {
                                nextIndex = idx;
                                nextSyn = syn;
                            }
                        }
                        if (nextSyn) {
                            if (nextIndex > current) {
                                result.push({ text: text.substring(current, nextIndex), isHighlighted: false, color: null });
                            }
                            const closeIdx = text.indexOf(nextSyn.close, nextIndex + nextSyn.open.length);
                            if (closeIdx !== -1) {
                                result.push({
                                    text: text.substring(nextIndex + nextSyn.open.length, closeIdx),
                                    isHighlighted: true,
                                    color: nextSyn.color,
                                });
                                current = closeIdx + nextSyn.close.length;
                            } else {
                                result.push({ text: text.substring(nextIndex, nextIndex + nextSyn.open.length), isHighlighted: false, color: null });
                                current = nextIndex + nextSyn.open.length;
                            }
                        } else {
                            result.push({ text: text.substring(current), isHighlighted: false, color: null });
                            break;
                        }
                    }
                    return result;
                };
                const getCleanText = (text, syns) => tokenizeText(text, syns).map(t => t.text).join('');

                if (isActive && (styles.includes('box') || styles.includes('solidBox') || styles.includes('fullBox')) && !isReflection) {
                    let maxW = 0;
                    pos.subLines.forEach(sub => {
                        const fullText = getCleanText(sub, syntaxes);
                        const w = targetCtx.measureText(fullText).width;
                        if (w > maxW) maxW = w;
                    });
                    const boxPadX = 20;
                    const boxPadY = 10;
                    let bX = 0;
                    let bW = 0;
                    
                    const isFullBox = styles.includes('fullBox');
                    if (isFullBox) {
                        const overscan = 200 / config.lyricsScale;
                        bX = (-tx / config.lyricsScale) - overscan;
                        bW = (width / config.lyricsScale) + (overscan * 2);
                    } else {
                        if (config.lyricsAlign === 'center') bX = -maxW/2 - boxPadX;
                        else if (config.lyricsAlign === 'right') bX = -maxW - boxPadX;
                        else bX = -boxPadX;
                        bW = maxW + boxPadX * 2;
                    }

                    const bY = lineY - (pos.blockHeight / 2) - boxPadY;
                    const bH = pos.blockHeight + boxPadY * 2;

                    targetCtx.save();
                    const primaryBoxColor = config.boxColor || '#000000';
                    targetCtx.fillStyle = primaryBoxColor;
                    targetCtx.globalAlpha = (styles.includes('solidBox') || isFullBox) ? 1.0 : 0.4;
                    targetCtx.beginPath();
                    if (isFullBox) {
                        targetCtx.rect(bX, bY, bW, bH);
                    } else if (targetCtx.roundRect) {
                        targetCtx.roundRect(bX, bY, bW, bH, 8);
                    } else {
                        targetCtx.rect(bX, bY, bW, bH);
                    }
                    targetCtx.fill();
                    targetCtx.restore();
                }

                const subLineHeight = lyricSize * 1.2;

                pos.subLines.forEach((sub, subIndex) => {
                    const verticalOffset = (subIndex - (pos.subLines.length - 1) / 2) * subLineHeight;
                    const y = lineY + verticalOffset;

                    const segments = tokenizeText(sub, syntaxes);
                    
                    const fullText = getCleanText(sub, syntaxes);
                    const totalW = targetCtx.measureText(fullText).width;
                    
                    let startX = 0;
                    if (config.lyricsAlign === 'center') startX = -totalW / 2;
                    else if (config.lyricsAlign === 'right') startX = -totalW;

                    let currentX = startX;

                    segments.forEach(seg => {
                        const cleanSeg = seg.text;
                        const segW = targetCtx.measureText(cleanSeg).width;

                        targetCtx.save();
                        let segColor = baseColor;
                        if (isActive && seg.isHighlighted) {
                            segColor = seg.color || syntaxes[0]?.color || '#ffeb3b';
                        }

                        targetCtx.fillStyle = segColor;

                        // Karaoke logic for segments
                        const isKaraoke = isActive && styles.includes('karaoke');
                        if (isKaraoke) {
                            const start = timings[i] ? timings[i].time : 0;
                            const next = (timings[i + 1]?.time > 0.1) ? timings[i + 1].time : (start + 2.5);
                            const kSpeed = config.karaokeSpeed || 1.0;
                            const duration = (next - start) / kSpeed;
                            const globalProgress = Math.min(1, Math.max(0, (effectiveTime - start) / duration));

                            let subProgress = 0;
                            const karaokeMode = config.karaokeMode || 'smooth';

                            if (karaokeMode === 'smooth') {
                                const targetX = startX + totalW * globalProgress;
                                subProgress = Math.min(1, Math.max(0, (targetX - currentX) / segW));
                            } else {
                                // segment mode: jumps block by block
                                const threshold = (currentX - startX + segW / 2) / totalW;
                                subProgress = globalProgress >= threshold ? 1 : 0;
                            }

                            targetCtx.save();
                            targetCtx.globalAlpha = 0.3;
                            targetCtx.fillText(cleanSeg, currentX, y);
                            targetCtx.restore();

                            targetCtx.save();
                            targetCtx.beginPath();
                            targetCtx.rect(currentX, y - (subLineHeight / 2), segW * subProgress, subLineHeight);
                            targetCtx.clip();
                            targetCtx.fillText(cleanSeg, currentX, y);
                            targetCtx.restore();
                        } else {
                            // Stroke
                            if (config.lyricsBorderWidth > 0 && !isReflection) {
                                targetCtx.lineWidth = config.lyricsBorderWidth;
                                targetCtx.strokeStyle = config.lyricsBorderColor || '#000000';
                                targetCtx.lineJoin = 'round';
                                targetCtx.miterLimit = 2;
                                targetCtx.strokeText(cleanSeg, currentX, y);
                            }
                            targetCtx.fillText(cleanSeg, currentX, y);
                        }
                        
                        targetCtx.restore();
                        currentX += segW;
                    });
                });

                targetCtx.restore();
            });
            targetCtx.restore();
        };

        // 2. Draw Main Scene
        drawScene(ctx, false);

        // --- FLOATING MICRO PARTICLES (Atmosphere) ---
        if (config.enableGlobalParticles !== false) {
            const pCount = config.particleCount || 80;
            const pSpeed = config.particleSpeed || 0.5;
            const pTime = effectiveTime * pSpeed;
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.shadowColor = 'white';
            ctx.shadowBlur = 2;

            for (let i = 0; i < pCount; i++) {
                const seed = i * 4444;
                const rnd = (n) => Math.abs(Math.sin(seed + n));

                const xBase = rnd(1) * width;
                const yBase = rnd(2) * height;

                // Drifting Logic
                const x = (xBase + Math.sin(pTime + i) * 30) % width;
                const y = (yBase + Math.cos(pTime + i * 0.5) * 30) % height;
                const size = rnd(3) * 1.5 + 0.5; // Micro size

                // Fade in/out
                const alpha = (0.2 + 0.8 * Math.sin(pTime * 2 + i)) * 0.5;

                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // 5. Cinematic Water (Enhanced Reflection)
        if (config.enableWater || config.backgroundEffect === 'water') {
            const waterY = height * (config.waterLevel || 0.7);
            const waterH = height - waterY;

            let offC = offscreenCanvasRef.current;
            if (offC.width !== width || offC.height !== height) {
                offC.width = width;
                offC.height = height;
            }
            const offCtx = offC.getContext('2d', { alpha: false });
            
            // Clear offscreen because we reuse it
            offCtx.clearRect(0, 0, width, height);

            // Draw reflection flipped
            offCtx.save();
            offCtx.translate(0, 2 * waterY);
            offCtx.scale(1, -1);
            drawScene(offCtx, true);
            offCtx.restore();

            ctx.save();
            ctx.beginPath();
            ctx.rect(0, waterY, width, height - waterY);
            ctx.clip();


            // -- Cinematic Water Rendering (Scanline + Distortion) --
            const waveBaseSpeed = config.waveSpeed || 1;
            const waveBaseAmp = config.waveAmplitude || 10;
            const sliceHeight = 2;

            for (let y = waterY; y < height; y += sliceHeight) {
                const depth = (y - waterY) / waterH;
                const amp = waveBaseAmp * (0.2 + 0.8 * depth);
                const realTime = effectiveTime * waveBaseSpeed;

                // Complex Wave function
                const w1 = Math.sin(y * 0.02 + realTime);
                const w2 = Math.sin(y * 0.05 + realTime * 2.5) * 0.5;
                const w3 = Math.sin(y * 0.1 + realTime * 0.5) * 0.2;

                const xShift = (w1 + w2 + w3) * amp;

                ctx.globalAlpha = 0.8 - (depth * 0.4); // Fade out at bottom
                ctx.drawImage(offC, 0, y, width, sliceHeight, xShift, y, width, sliceHeight);
            }

            // Water Lighting Overlay
            const grad = ctx.createLinearGradient(0, waterY, 0, height);
            grad.addColorStop(0, `rgba(150, 180, 255, ${0.15})`); // Horizon highlight
            grad.addColorStop(0.3, `rgba(0, 30, 60, ${0.3})`);
            grad.addColorStop(0.8, `rgba(0, 5, 20, ${0.7})`); // Deep dark

            ctx.fillStyle = grad;
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillRect(0, waterY, width, height - waterY); // Fix: Add fillRect

            ctx.restore();
        }

        // 6. Cinematic Fog (Full Screen - Drifting)
        if (config.enableFog || config.backgroundEffect === 'fog') {
            const intensity = config.fogIntensity || 0.5;
            const speed = (config.fogSpeed || 1) * 0.5;

            ctx.save();
            const t = effectiveTime * speed;

            // Full Screen Haze (Base Layer)
            ctx.fillStyle = `rgba(200, 220, 255, ${0.1 * intensity})`;
            ctx.fillRect(0, 0, width, height);

            // Drifting Mist Clouds (Mid Layer)
            const count = 15;
            ctx.globalCompositeOperation = 'screen'; // Additive

            for (let i = 0; i < count; i++) {
                const seed = i * 2222;
                const rnd = (n) => Math.abs(Math.sin(seed + n));

                const size = (width * 0.6) + rnd(1) * width * 0.4; // Large blobs
                const xBase = rnd(2) * width;
                const yBase = rnd(3) * height; // All over Y axis

                // Continuous Drift Logic
                const driftSpeed = 50 * (1 + rnd(4));
                const x = (xBase + t * driftSpeed) % (width + size * 2) - size;
                const y = (yBase + Math.sin(t * 0.5 + i) * 20) % (height + size) - size / 2;

                const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
                grad.addColorStop(0, `rgba(220, 240, 255, ${0.08 * intensity})`);
                grad.addColorStop(1, `rgba(220, 240, 255, 0)`);

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }

        ctx.restore(); // End Camera movement transform


        // 6. Realistic Rain Effect (Multi-Layer + Splash Physics)
        if (config.backgroundEffect === 'rain') {
            const intensity = config.rainIntensity || 0.5;
            
            const isSlowMo = (Math.sin(effectiveTime * 0.5) > 0.6); // Occasional slow mo
            
            const baseSpeed = (config.rainSpeed || 1) * 2.0;

            const layers = [
                { id: 'bg', count: 0.5, speed: 0.8 * baseSpeed, size: 0.5, opacity: 0.3 },
                { id: 'mid', count: 0.3, speed: 1.2 * baseSpeed, size: 1.0, opacity: 0.6 },
                { id: 'fg', count: 0.2, speed: 1.6 * baseSpeed, size: 2.0, opacity: 0.8 }
            ];

            const totalCount = config.particleCount || 200;
            const waterY = (config.backgroundEffect === 'water') ? height * (config.waterLevel || 0.7) : height;
            const hasWater = (config.backgroundEffect === 'water');
            const wind = 30; // Wind pixels x-shift

            ctx.save();
            ctx.lineCap = 'round';

            // Render Layers
            layers.forEach(layer => {
                const count = totalCount * layer.count * intensity * 5;
                ctx.beginPath();
                ctx.lineWidth = layer.size;
                ctx.strokeStyle = `rgba(230, 240, 255, ${layer.opacity})`;

                for (let i = 0; i < count; i++) {
                    const seed = i * 12345 + layer.speed * 99;
                    const rnd = (n) => {
                        const x = Math.sin(seed + n * 12.34);
                        return x - Math.floor(x); // 0..1ish
                    };

                    // X Position
                    let x = (rnd(1) * width * 1.5) - (width * 0.25); // padded for wind

                    // Y Position (Time Based)
                    const regionH = height + 100;
                    const timeOffset = rnd(2) * regionH;
                    let speed = layer.speed * 20 * (1 + rnd(3) * 0.2); // variation

                    const rawY = (effectiveTime * 20 * speed + timeOffset);
                    let y = (rawY % regionH) - 100; // Screen Y

                    // Wind Shear
                    x += (y / height) * wind;

                    // Length
                    const len = 20 * layer.size * (1 + rnd(4)) * (isSlowMo ? 1.5 : 1.0);

                    // Regular Drop (Splashes simplified here for performance in restoration)
                    ctx.moveTo(x, y);
                    ctx.lineTo(x - (wind / height) * len * 0.5, y + len);
                }
                ctx.stroke();
            });

            // -- PARTICLE SYSTEM FOR SPLASHES (Non-Deterministic Visuals for "Wow" factor) --
            if (hasWater) {
                const splashCount = 20 * intensity;
                ctx.fillStyle = `rgba(200, 230, 255, 0.5)`;
                ctx.beginPath();

                for (let s = 0; s < splashCount; s++) {
                    const seed = Math.floor(effectiveTime * 10) + s; 
                    const rnd = (n) => Math.abs(Math.sin(seed * n));

                    if (rnd(1) > 0.5) continue; // Flicker

                    const sx = rnd(2) * width;
                    const sy = waterY + (rnd(3) - 0.5) * 5; 

                    const pCount = 3 + Math.floor(rnd(4) * 5);
                    for (let p = 0; p < pCount; p++) {
                        const px = sx + (rnd(p * 10) * 20 - 10);
                        const py = sy - rnd(p * 20) * 30; 
                        const size = rnd(p) * 2;
                        ctx.moveTo(px, py);
                        ctx.arc(px, py, size, 0, Math.PI * 2);
                    }

                    ctx.moveTo(sx + 20, sy);
                    ctx.ellipse(sx, sy, 20 * rnd(5), 5 * rnd(5), 0, 0, Math.PI * 2);
                }
                ctx.fill();
            }

            ctx.restore();
        }
    };

    useEffect(() => {
        const time = (audioRef && audioRef.current) ? audioRef.current.currentTime : 0;
        const id = requestAnimationFrame(() => render(time));
        return () => cancelAnimationFrame(id);
    }, [config, lyrics, positionsRef.current, isPlaying]);

    // Force re-render when images or videos load
    const handleMediaLoad = () => {
        const time = (audioRef && audioRef.current) ? audioRef.current.currentTime : 0;
        render(time);
    };

    // Font Loading Guard
    useEffect(() => {
        const loadFonts = async () => {
            if (config.fontFamily) {
                try {
                    await document.fonts.load(`bold 16px "${config.fontFamily}"`);
                    handleMediaLoad();
                } catch (e) {
                    console.warn("Font load failed:", e);
                }
            }
        };
        loadFonts();
    }, [config.fontFamily]);

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
            {/* Hidden Asset Loaders: Optimized for keeping GIF animations active */}
            <div style={{ 
                position: 'fixed', 
                top: 0, 
                left: 0, 
                width: '1px',
                height: '1px',
                opacity: 0.01, // Nearly invisible but still "rendered"
                overflow: 'hidden',
                pointerEvents: 'none',
                zIndex: -1 
            }}>
                <img ref={coverImgRef} src={config.coverImage || config.mainImage} alt="asset-cover" onLoad={handleMediaLoad} />
                
                {/* Main Media: Image or Video */}
                {config.mainImage?.toLowerCase().match(/\.(mp4|webm|mov)$/) ? (
                    <video 
                        ref={mainImgRef} 
                        src={config.mainImage} 
                        muted loop autoPlay 
                        onLoadedData={handleMediaLoad}
                        onPlay={handleMediaLoad}
                    />
                ) : (
                    <img ref={mainImgRef} src={config.mainImage} alt="asset-main" onLoad={handleMediaLoad} />
                )}
            </div>
        </div>
    );
}));

export default Preview;
