import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';

const Preview = React.memo(forwardRef(({ config, lyrics, currentLineIndex, canvasRef, audioRef, timings, isPlaying, onLineClick, isExporting = false }, ref) => {
    const coverImgRef = useRef(null);
    const mainImgRef = useRef(null);
    const foregroundCanvasRef = useRef(null);
    const positionsRef = useRef([]);
    const offscreenCanvasRef = useRef(document.createElement('canvas'));
    const scrollYRef = useRef(0);
    const currentLineIndexRef = useRef(currentLineIndex);

    useEffect(() => { currentLineIndexRef.current = currentLineIndex; }, [currentLineIndex]);

    // Media Logic (Detect if Video)
    const isVideo = config.mainImage?.toLowerCase().match(/\.(mp4|webm|mov)$/);
    const isGif = config.mainImage?.toLowerCase().match(/\.gif$/);

    const handleCanvasClick = (e) => {
        if (!onLineClick || !foregroundCanvasRef.current) return;
        const rect = foregroundCanvasRef.current.getBoundingClientRect();
        const scaleY = config.height / rect.height;
        const clickY = (e.clientY - rect.top) * scaleY;
        const { height, lyricsY, lyricsScale } = config;
        const centerY = height / 2;
        const isVertical = height > config.width;
        let lyricsBaseY = isVertical ? (height * 0.75) : centerY;
        let ty = lyricsBaseY + lyricsY;
        const scroll = scrollYRef.current;
        const localY = (clickY - ty) / lyricsScale;
        const targetCy = localY + scroll;

        if (positionsRef.current.length > 0) {
            const hit = positionsRef.current.find(p => {
                const top = p.cy - (p.blockHeight / 2);
                const bottom = p.cy + (p.blockHeight / 2);
                return targetCy >= top - 10 && targetCy <= bottom + 10;
            });
            if (hit) onLineClick(hit.index);
        }
    };

    // Pre-calculate Layout
    useEffect(() => {
        const canvas = foregroundCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { width, lyricSize, fontFamily } = config;
        ctx.font = `bold ${lyricSize}px ${fontFamily}`;
        const subLineHeight = lyricSize * 1.2;
        const blockGap = lyricSize * 1.0;
        const maxWidth = width * 0.8;

        const wrapText = (text, maxW) => {
            const lines = [];
            let currentLine = "";
            const words = text.split(' ');
            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const cleanWord = word.replace(/[\[\]]/g, '');
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

    useImperativeHandle(ref, () => ({
        renderFrame: (time) => render(time, true),
        getPositions: () => positionsRef.current
    }));

    // Camera logic calculation (Derived from time)
    const [cameraTransform, setCameraTransform] = useState({ scale: 1, x: 0, y: 0 });

    const render = (inputTime, forceToMain = false) => {
        const baseCanvas = canvasRef.current;
        const fgCanvas = foregroundCanvasRef.current;
        if (!baseCanvas || !fgCanvas) return;

        const baseCtx = baseCanvas.getContext('2d', { alpha: false });
        const fgCtx = fgCanvas.getContext('2d');
        const { width, height, fontFamily, lyricSize, activeColor } = config;

        // Reset canvases
        fgCtx.clearRect(0, 0, width, height);

        let effectiveTime = inputTime;

        // Calculate Camera for Export OR for shared State (Preview)
        const camTime = effectiveTime * 0.05;
        const camZoom = 1.0 + Math.sin(camTime) * 0.015;
        const camPanX = Math.sin(camTime * 0.7) * 15;
        const camPanY = Math.cos(camTime * 0.5) * 10;

        // Update state for DOM sync (only if not exporting to avoid react loops)
        if (!forceToMain && Math.abs(cameraTransform.x - camPanX) > 0.1) {
            setCameraTransform({ scale: camZoom, x: camPanX, y: camPanY });
        }

        const applyCam = (ctx) => {
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.scale(camZoom, camZoom);
            ctx.translate(-width / 2, -height / 2);
            ctx.translate(camPanX, camPanY);
        };

        // --- LAYER 1: BACKGROUND (Base Canvas) ---
        baseCtx.save();
        if (forceToMain) applyCam(baseCtx); // Apply cam only during export

        baseCtx.fillStyle = '#111';
        baseCtx.fillRect(-100, -100, width + 200, height + 200);

        if (coverImgRef.current?.complete) {
            baseCtx.save();
            const img = coverImgRef.current;
            const ratio = Math.max(width / img.naturalWidth, height / img.naturalHeight);
            const w = img.naturalWidth * ratio, h = img.naturalHeight * ratio;
            baseCtx.filter = `blur(${config.coverBlur ?? 40}px) brightness(0.6)`;
            baseCtx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
            baseCtx.restore();
        }

        if (config.enableWater || config.backgroundEffect === 'water') {
            const waterY = height * (config.waterLevel || 0.7);
            const grad = baseCtx.createLinearGradient(0, waterY - 200, 0, waterY + 100);
            grad.addColorStop(0.8, 'rgba(180, 220, 255, 0.15)');
            baseCtx.fillStyle = grad;
            baseCtx.fillRect(0, waterY - 200, width, 300);
        }

        // --- LAYER 2: MEDIA (If Export Mode) ---
        const media = mainImgRef.current;
        const isVertical = height > width;
        const mWidth = media ? (media.videoWidth || media.naturalWidth || 0) : 0;
        const mHeight = media ? (media.videoHeight || media.naturalHeight || 0) : 0;
        
        // Normalization: 1.0x scale = canvas width
        const baseScale = mWidth > 0 ? (width / mWidth) : 1;
        const normalizedScale = baseScale * (config.imageScale || 1);
        const w = mWidth * normalizedScale, h = mHeight * normalizedScale;
        
        const baseX = isVertical ? (width / 2) : (width * 0.3);
        const baseY = isVertical ? (height * 0.3) : (height / 2);
        const dx = baseX + config.imageX, dy = baseY + config.imageY;

        if (forceToMain && media && (media.tagName === 'VIDEO' ? media.readyState >= 2 : (media.complete && mWidth > 0))) {
            baseCtx.save();
            baseCtx.drawImage(media, dx - w / 2, dy - h / 2, w, h);
            baseCtx.restore();
        }
        baseCtx.restore(); // Finish Base

        // --- LAYER 3: FOREGROUND (FG Canvas) ---
        fgCtx.save();
        if (forceToMain) applyCam(fgCtx);

        // Metadata
        if (media && (media.tagName === 'VIDEO' ? media.readyState >= 2 : (media.complete && mWidth > 0))) {
            fgCtx.save();
            fgCtx.textAlign = isVertical ? 'center' : 'left';
            const tx = isVertical ? dx : (dx - w / 2);
            const ty = isVertical ? (dy + h / 2 + 40) : (dy + h / 2 + 50);
            fgCtx.font = `bold ${config.songSize || 40}px ${fontFamily}`;
            fgCtx.fillStyle = config.songColor || 'white';
            fgCtx.shadowColor = 'rgba(0,0,0,0.8)';
            fgCtx.shadowBlur = 4;
            fgCtx.fillText(config.songName || '', tx + (config.songX || 0), ty + (config.songY || 0));
            
            const artistY = ty + 45;
            fgCtx.font = `${config.artistSize || 30}px ${fontFamily}`;
            fgCtx.fillStyle = config.artistColor || '#ddd';
            fgCtx.fillText(config.artistName || '', tx + (config.artistX || 0), artistY + (config.artistY || 0));
            fgCtx.restore();
        }

        // Lyrics
        let lbX = isVertical ? (width / 2) : (width * 0.7);
        let lbY = isVertical ? (height * 0.75) : (height / 2);
        fgCtx.save();
        fgCtx.translate(lbX + config.lyricsX, lbY + config.lyricsY);
        fgCtx.scale(config.lyricsScale, config.lyricsScale);
        fgCtx.textBaseline = 'middle';
        fgCtx.font = `bold ${lyricSize}px ${fontFamily}`;

        // Find index
        let index = 0;
        if (timings?.length > 0) {
            for (let i = 0; i < timings.length; i++) {
                if (timings[i].time > 0.1 && effectiveTime >= timings[i].time) index = timings[i].index;
            }
        }

        const pos = positionsRef.current;
        const currentScroll = pos[index]?.cy || 0;
        scrollYRef.current += (currentScroll - scrollYRef.current) * 0.1;

        pos.forEach((p, i) => {
            const lineY = p.cy - scrollYRef.current;
            if (i < index - (config.maxLinesAbove ?? 2) || i > index + (config.maxLinesBelow ?? 2)) return;
            const active = (i === index);
            fgCtx.save();
            fgCtx.fillStyle = active ? activeColor : `rgba(255,255,255,${Math.max(0.1, 0.4 - Math.abs(index - i) * 0.05)})`;
            p.subLines.forEach((sub, si) => {
                const y = lineY + (si - (p.subLines.length - 1) / 2) * (lyricSize * 1.2);
                const segments = sub.split(/(\[.*?\])/g).filter(s => s);
                const fullW = fgCtx.measureText(segments.map(s => s.replace(/[\[\]]/g, '')).join('')).width;
                let curX = config.lyricsAlign === 'center' ? -fullW / 2 : (config.lyricsAlign === 'right' ? -fullW : 0);
                segments.forEach(seg => {
                    const isHigh = seg.startsWith('[') && seg.endsWith(']');
                    const clean = seg.replace(/[\[\]]/g, '');
                    const sw = fgCtx.measureText(clean).width;
                    fgCtx.save();
                    if (active && isHigh) fgCtx.fillStyle = config.highlightColor;
                    fgCtx.fillText(clean, curX, y);
                    fgCtx.restore();
                    curX += sw;
                });
            });
            fgCtx.restore();
        });
        fgCtx.restore();

        // Particles
        if (config.enableGlobalParticles !== false) {
            fgCtx.save();
            const pTime = effectiveTime * 0.5;
            fgCtx.fillStyle = 'rgba(255,255,255,0.5)';
            for (let i = 0; i < 50; i++) {
                const sx = (Math.abs(Math.sin(i * 4444)) * width + Math.sin(pTime + i) * 20) % width;
                const y = (Math.abs(Math.cos(i * 4444)) * height + Math.cos(pTime + i) * 20) % height;
                fgCtx.beginPath(); fgCtx.arc(sx, y, 1, 0, Math.PI * 2); fgCtx.fill();
            }
            fgCtx.restore();
        }

        if (forceToMain) baseCtx.drawImage(fgCanvas, 0, 0);
        fgCtx.restore();
    };

    useEffect(() => {
        const tick = () => { if (!isExporting) render(audioRef.current?.currentTime || 0); requestAnimationFrame(tick); };
        const id = requestAnimationFrame(tick); return () => cancelAnimationFrame(id);
    }, [config, isExporting, lyrics]);

    // Scale for Media DOM
    const [containerScale, setContainerScale] = useState(1);
    const containerRef = useRef(null);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const updateScale = () => {
            if (wrapperRef.current) {
                const rect = wrapperRef.current.getBoundingClientRect();
                setContainerScale(rect.width / config.width);
            }
        };
        updateScale();
        const obs = new ResizeObserver(updateScale);
        if (wrapperRef.current) obs.observe(wrapperRef.current);
        window.addEventListener('resize', updateScale);
        return () => {
            obs.disconnect();
            window.removeEventListener('resize', updateScale);
        };
    }, [config.width, config.height]);

    const isVertical = config.height > config.width;
    
    // finalScale is now simplified because width is explicitly set to config.width in DOM
    const finalScale = (config.imageScale || 1) * containerScale;

    const mediaStyle = {
        position: 'absolute',
        left: isVertical ? '50%' : '30%',
        top: isVertical ? '30%' : '50%',
        transform: `translate(-50%, -50%) translate(${config.imageX * containerScale}px, ${config.imageY * containerScale}px) scale(${finalScale})`,
        zIndex: 5,
        pointerEvents: 'none',
        display: isExporting ? 'none' : 'block'
    };

    const sharedCameraStyle = {
        position: 'relative',
        width: '100%',
        height: '100%',
        maxWidth: isExporting ? 'none' : '85%',
        maxHeight: isExporting ? 'none' : '85%',
        aspectRatio: `${config.width} / ${config.height}`,
        transform: isExporting ? 'none' : `scale(${cameraTransform.scale}) translate(${cameraTransform.x}px, ${cameraTransform.y}px)`,
        transformOrigin: 'center',
        transition: 'transform 0.1s linear',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    };

    return (
        <div className="preview-area" ref={containerRef} style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000', overflow: 'hidden', position: 'relative'
        }}>
            <div ref={wrapperRef} style={sharedCameraStyle}>
                <canvas ref={canvasRef} width={config.width} height={config.height} style={{ position: 'absolute', zIndex: 1, height: '100%', width: '100%', objectFit: 'contain', border: '1px solid #333', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }} />
                
                {!isExporting && (
                    <div style={mediaStyle}>
                        {isVideo ? (
                            <video src={config.mainImage} muted loop autoPlay playsInline 
                                style={{ display: 'block', width: config.width + 'px', height: 'auto' }} />
                        ) : (
                            <img src={config.mainImage} alt="" 
                                style={{ display: 'block', width: config.width + 'px', height: 'auto' }} />
                        )}
                    </div>
                )}

                <canvas ref={foregroundCanvasRef} width={config.width} height={config.height} onClick={handleCanvasClick} style={{ position: 'absolute', zIndex: 10, height: '100%', width: '100%', objectFit: 'contain', cursor: 'pointer' }} />
            </div>
            <img ref={coverImgRef} src={config.coverImage || config.mainImage} alt="" style={{ display: 'none' }} />
            <div style={{ display: 'none' }}>
                {isVideo ? (
                    <video ref={mainImgRef} src={config.mainImage} muted loop autoPlay playsInline />
                ) : (
                    <img ref={mainImgRef} src={config.mainImage} alt="" />
                )}
            </div>
        </div>
    );
}));


export default Preview;
