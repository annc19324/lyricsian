
/* global VideoEncoder, VideoFrame */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Preview from '../components/Preview';
import Timeline from '../components/Timeline';
import { getAsset } from '../utils/db';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import * as Mp4Muxer from 'mp4-muxer';

// Default Configuration
const defaultLyrics = `con tim anh, thực sự mong manh\n\nvì ngoài em, không ai còn ở trong anh\n\nlần đầu gặp em, mưa trong một ngày trời trong xanh\n\nnhưng giờ đây, em đang không anh.\n`;

const defaultConfig = {
    songName: 'Lời của anh',
    artistName: 'annc19324',
    channelName: '@annc19324',
    coverImage: '/background_main.png',
    mainImage: '/image_main.png',
    audioUrl: process.env.PUBLIC_URL + '/sound.mp3',
    fontFamily: 'Inter',
    lyricSize: 32,
    activeColor: '#ffffff',
    highlightStyles: ['color'],
    coverBlur: 40,
    // Layout Config (User Default: YouTube)
    width: 1920,
    height: 1080,
    imageScale: 0.5,
    imageX: -187,
    imageY: -22,
    lyricsScale: 1,
    lyricsX: -591,
    lyricsY: -224,
    lyricsAlign: 'left',
    maxLinesAbove: 0,
    maxLinesBelow: 8,
    exportOverlayOpacity: 0,
    exportOverlayBlur: 5,

    // Metadata Defaults (Offsets from auto-position)
    songX: 0, songY: 0, songSize: 40, songColor: '#ffffff',
    artistX: 0, artistY: 0, artistSize: 30, artistColor: '#dddddd',
    channelX: 0, channelY: 0, channelSize: 20, channelColor: '#aaaaaa',

    // Audio Defaults
    trimEnd: 0,
    fadeIn: 0,
    fadeOut: 0,

    // New Effects & Styling
    lyricsGlowSize: 0,      // Custom Glow Size
    lyricsBorderWidth: 0,   // Custom Border Thickness
    lyricsBorderColor: '#000000',
    highlightColor: '#ffeb3b', // Default yellow
    backgroundEffect: 'none', // none, rain, water
    waterLevel: 0.7,        // Position of water surface (0 to 1)
    rainIntensity: 0.5,
    rainSpeed: 1.0,
    waveSpeed: 1.0,         // For water
    waveAmplitude: 10,      // For water
    reflectionOpacity: 0.5, // For water
    particleCount: 100,      // For rain/particles
    karaokeMode: 'smooth',
    customSyntaxes: [{ id: 1, open: '[', close: ']', color: '#ffeb3b' }],
    activeScale: 1.2,
    floatingSpeed: 1.5,
    boxColor: '#000000',
    songFont: 'Inter',
    artistFont: 'Inter',
    channelFont: 'Inter'
};
const EditorType1 = () => {
    const [sidebarWidth, setSidebarWidth] = useState(450);
    const [isResizing, setIsResizing] = useState(false);

    const startResizing = React.useCallback(() => setIsResizing(true), []);
    const stopResizing = React.useCallback(() => setIsResizing(false), []);
    const resize = React.useCallback(
        (mouseMoveEvent) => {
            if (isResizing) {
                setSidebarWidth(mouseMoveEvent.clientX);
            }
        },
        [isResizing]
    );

    useEffect(() => {
        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", stopResizing);
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [resize, stopResizing]);

    // Load from LocalStorage or use Default
    const [config, setConfig] = useState(() => {
        const saved = localStorage.getItem('lyricsian_config');
        if (saved) {
            const parsed = JSON.parse(saved);
            // We will try to restore blobs from DB next, for now keep defaults if blob string found
            if (parsed.audioUrl && parsed.audioUrl.startsWith('blob:')) parsed.audioUrl = defaultConfig.audioUrl;
            if (parsed.coverImage && parsed.coverImage.startsWith('blob:')) parsed.coverImage = defaultConfig.coverImage;
            if (parsed.mainImage && parsed.mainImage.startsWith('blob:')) parsed.mainImage = defaultConfig.mainImage;
            return parsed;
        }
        return defaultConfig;
    });

    // Restore Assets from IndexedDB
    useEffect(() => {
        const restoreAssets = async () => {
            const keys = ['audioUrl', 'coverImage', 'mainImage'];
            const updates = {};
            for (const key of keys) {
                const file = await getAsset(key);
                if (file) {
                    updates[key] = URL.createObjectURL(file);
                }
            }
            if (Object.keys(updates).length > 0) {
                setConfig(prev => ({ ...prev, ...updates }));
            }
        };
        restoreAssets();
    }, []);

    const [lyricsRaw, setLyricsRaw] = useState(() => {
        const saved = localStorage.getItem('lyricsian_lyrics');
        return saved ? saved : defaultLyrics;
    });

    // Timings State
    const [timings, setTimings] = useState(() => {
        const saved = localStorage.getItem('lyricsian_timings');
        return saved ? JSON.parse(saved) : [];
    });

    const [isRecording, setIsRecording] = useState(false);

    // Player State
    const [currentLineIndex, setCurrentLineIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const [exportStatus, setExportStatus] = useState("Rendering...");

    // UI States
    const [isExportMinimized, setIsExportMinimized] = useState(false);
    const [encodingProgress, setEncodingProgress] = useState(0);
    const skipEncodingRef = useRef(false);

    // FFmpeg
    const ffmpegRef = useRef(new FFmpeg());
    const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

    useEffect(() => {
        const load = async () => {
            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
            const ffmpeg = ffmpegRef.current;

            ffmpeg.on('log', ({ message }) => console.log('FFmpeg:', message));

            // Progress Listener
            ffmpeg.on('progress', ({ progress, time }) => {
                const p = Math.max(0, Math.min(100, progress * 100));
                setEncodingProgress(p);
            });

            if (!ffmpeg.loaded) {
                try {
                    await ffmpeg.load({
                        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                    });
                    setFfmpegLoaded(true);
                } catch (e) {
                    console.error("FFmpeg load failed:", e);
                }
            } else {
                setFfmpegLoaded(true);
            }
        };
        load();
    }, []);

    const audioRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const isExportCancelledRef = useRef(false);



    // Persistence
    useEffect(() => { localStorage.setItem('lyricsian_config', JSON.stringify(config)); }, [config]);
    useEffect(() => { localStorage.setItem('lyricsian_lyrics', lyricsRaw); }, [lyricsRaw]);
    useEffect(() => { localStorage.setItem('lyricsian_timings', JSON.stringify(timings)); }, [timings]);

    // Derive structured lyrics
    const lyrics = useMemo(() => {
        return lyricsRaw.split(/\n\n+/).map(text => ({ text: text.trim() })).filter(l => l.text);
    }, [lyricsRaw]);

    // Store previous lyrics to track changes
    const prevLyricsRef = useRef([]);

    // Auto-Sync Timings Logic: Smart Preservation
    useEffect(() => {
        // 1. If lyrics structure hasn't changed (deep compare of text content only), do nothing
        // We can check if length and content matches exact
        // But we want to handle "Typo Fix" vs "Structure Change"

        if (lyrics.length === 0) return;
        if (lyrics === prevLyricsRef.current) return; // Same ref

        setTimings(prev => {
            // A. Typo Fix Mode: If line count is EXACTLY same, assume 1-to-1 mapping to preserve times
            // This allows user to fix "Hello" -> "Hullo" without losing 5.3s timing.
            if (prevLyricsRef.current.length === lyrics.length && prev.length === lyrics.length) {
                const updated = prev.map((t, i) => ({ ...t, index: i })); // Re-bind index just in case
                return updated;
            }

            // B. Structure Change Mode (Split/Join): Use Content Matching
            // Map: "Text Content" -> [Time1, Time2...]
            const timePool = {};
            if (prevLyricsRef.current.length > 0) {
                prevLyricsRef.current.forEach((line, idx) => {
                    const t = prev.find(item => item && item.index === idx);
                    if (t) {
                        const text = line.text;
                        if (!timePool[text]) timePool[text] = [];
                        timePool[text].push(t.time);
                    }
                });
            }

            const newTimings = lyrics.map((line, idx) => {
                let time = 0;
                // Try to pop a matching time
                if (timePool[line.text] && timePool[line.text].length > 0) {
                    time = timePool[line.text].shift();
                }
                return { index: idx, time };
            });

            return newTimings;
        });

        prevLyricsRef.current = lyrics;

    }, [lyrics]);

    // --- Functions (Moved Up) ---

    const handleReset = () => {
        setConfig(defaultConfig);
        setLyricsRaw(defaultLyrics);
        setTimings([]);
        localStorage.removeItem('lyricsian_config');
        localStorage.removeItem('lyricsian_lyrics');
        localStorage.removeItem('lyricsian_timings');
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleSeek = (uiTime) => {
        const offset = config.trimStart || 0;
        const time = uiTime + offset;

        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);

            // Sync lyrics logic on seek
            if (timings.length > 0) {
                let activeIndex = 0;
                // If all 0, keep 0
                const hasTiming = timings.some(t => t.time > 0);
                if (hasTiming) {
                    for (let i = 0; i < timings.length; i++) {
                        if (time >= timings[i].time) activeIndex = timings[i].index;
                        else break;
                    }
                }
                setCurrentLineIndex(activeIndex);
            }
        }
    };

    const handleClearTimings = () => {
        // No confirmation dialog as requested
        const newTimings = lyrics.map((_, i) => ({ index: i, time: 0 }));
        setTimings(newTimings);
        // Critical: Reset cursor to start so recording starts from top
        setCurrentLineIndex(0);
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            setCurrentTime(0);
        }
    };

    const handleLineClick = (index) => {
        // 1. Highlight
        setCurrentLineIndex(index);

        // 2. Seek if timing exists
        if (timings[index] && timings[index].time > 0) {
            if (audioRef.current) {
                audioRef.current.currentTime = timings[index].time;
                setCurrentTime(timings[index].time);
            }
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const time = audioRef.current.currentTime;

            // Trim / Loop Logic
            const start = config.trimStart || 0;
            const end = (config.trimEnd && config.trimEnd > 0) ? config.trimEnd : duration;

            // Enforce Start Boundary
            if (isPlaying && time < start) {
                audioRef.current.currentTime = start;
                setCurrentTime(start);
                return;
            }

            // If we are playing and pass the end point
            if (isPlaying && end > 0 && time >= end) {
                audioRef.current.pause();
                setIsPlaying(false);
                setIsRecording(false);
                audioRef.current.currentTime = start;
                setCurrentTime(start);
                return;
            }

            // setCurrentTime(time); // Removed to prevent re-renders in playback

            // Sync Timeline visually here too (important for scrubbing when paused)
            if (timelineRef.current) timelineRef.current.updateTime(Math.max(0, time - (config.trimStart || 0)));

            // Auto-Replay Logic (if not recording and timings exist)
            if (!isRecording && timings.length > 0) {
                const hasValues = timings.some(t => t.time > 0.1);
                if (hasValues) {
                    let activeIndex = -1;
                    let maxTimeFound = -1;

                    for (let i = 0; i < timings.length; i++) {
                        const t = timings[i];
                        // Strictly ignore timings that are basically 0 (unassigned)
                        // This prevents unassigned lines from falsely triggering "match" because 0 < currentTime
                        if (t.time > 0.05 && time >= t.time) {
                            if (t.time > maxTimeFound) {
                                maxTimeFound = t.time;
                                activeIndex = t.index;
                            } else if (t.time === maxTimeFound) {
                                if (t.index > activeIndex) activeIndex = t.index;
                            }
                        }
                    }

                    if (activeIndex !== -1 && activeIndex !== currentLineIndex) {
                        setCurrentLineIndex(activeIndex);
                    }
                }
            }
        }
    };

    const togglePlay = async () => {
        if (!config.audioUrl) {
            alert("No audio loaded.");
            return;
        }
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
            setIsRecording(false);
        } else {
            // Check Trim Bounds
            const start = config.trimStart || 0;
            const end = (config.trimEnd && config.trimEnd > 0) ? config.trimEnd : duration;
            const now = audioRef.current.currentTime;

            if (now < start || (end > 0 && now >= end - 0.1)) {
                audioRef.current.currentTime = start;
                setCurrentTime(start);
            }

            try {
                await audioRef.current.play();
                setIsPlaying(true);
            } catch (err) {
                console.error("Play error:", err);
                alert("Cannot play audio. Try clicking 'Reset' or upload a file manually.");
                setIsPlaying(false);
            }
        }
    };

    const toggleRecording = async () => {
        if (isRecording) {
            setIsRecording(false);
            // Don't stop playing? User might want to just stop recording mode.
            // But typically toggle off stops.
        } else {
            if (!config.audioUrl) return alert("Load audio first");

            try {
                await audioRef.current.play();
                setIsRecording(true);
                setIsPlaying(true);
            } catch (e) {
                console.error(e);
            }
        }
    };

    // --- Playback Loop (Master Clock) ---
    const previewRef = useRef(null);
    const timelineRef = useRef(null);
    const playbackRafRef = useRef(null);

    // Sync Playback Loop
    const tick = () => {
        if (!audioRef.current) return;
        const now = audioRef.current.currentTime;
        // setCurrentTime(now); // Removed to prevent re-renders

        // Drive Preview
        if (previewRef.current) {
            previewRef.current.renderFrame(now);
        }

        // Drive Timeline
        if (timelineRef.current) {
            timelineRef.current.updateTime(Math.max(0, now - (config.trimStart || 0)));
        }

        const isMediaDynamic = config.mainImage?.toLowerCase().match(/\.(mp4|webm|mov|gif)$/) || config.backgroundEffect !== 'none';

        if (isPlaying || isRecording || isMediaDynamic) {
            playbackRafRef.current = requestAnimationFrame(tick);
        }
    };

    useEffect(() => {
        const isMediaDynamic = config.mainImage?.toLowerCase().match(/\.(mp4|webm|mov|gif)$/) || config.backgroundEffect !== 'none';
        
        if (isPlaying || isMediaDynamic) {
            playbackRafRef.current = requestAnimationFrame(tick);
        } else {
            cancelAnimationFrame(playbackRafRef.current);
            // Render static frame one last time to ensure sync on pause
            if (audioRef.current && previewRef.current) {
                previewRef.current.renderFrame(audioRef.current.currentTime);
            }
        }
        return () => cancelAnimationFrame(playbackRafRef.current);
    }, [isPlaying, isRecording, config.mainImage, config.backgroundEffect]);

    const canvasRef = useRef(null); // Passed to Preview, but we don't access strictly here except for export logic which is now different.

    const prevLyric = () => {
        if (currentLineIndex > 0) {
            setCurrentLineIndex(prev => prev - 1);
        }
    };

    const nextLyric = () => {
        // ... (NextLyric Logic)
        if (isPlaying) {
            setIsRecording(true);
            const now = audioRef.current ? audioRef.current.currentTime : 0;
            const newTimings = [...timings];
            // Ensure structure exists
            if (!newTimings[currentLineIndex]) newTimings[currentLineIndex] = { index: currentLineIndex, time: 0 };
            newTimings[currentLineIndex].time = now;
            setTimings(newTimings);

            if (currentLineIndex < lyrics.length - 1) {
                setCurrentLineIndex(prev => prev + 1);
            } else {
                // Last line: Keep recording/playing until end of song
                // Do NOT stop.
                console.log("Last line reached. Continuing to end.");
            }
        } else {
            // Navigation
            if (currentLineIndex < lyrics.length - 1) {
                const nextIndex = currentLineIndex + 1;
                setCurrentLineIndex(nextIndex);
                // Also update preview immediate
                // But we need time... Preview derives index from time if playing, or direct index?
                // Our new Preview logic prefers TIME.
                // If we are paused, we might want to jump to that lyric's time?
                // Or just show it? 
                // Preview uses `timings` to find active line. 
                // If we just change index but not time, and we are paused...
                // Preview `renderFrame` takes `effectiveTime`.
                // If we want to preview a specific line without seeking audio, we might need a "Force Index" mode in renderFrame?
                // For now, let's keep it simple: seek audio to that line if it has timing.
                if (timings[nextIndex] && timings[nextIndex].time > 0) {
                    handleSeek(timings[nextIndex].time);
                }
            } else {
                setCurrentLineIndex(0);
                if (timings[0] && timings[0].time > 0) handleSeek(timings[0].time);
                else handleSeek(0);
            }
        }
    };
    // Export functionality (High-Performance WebCodecs + FFmpeg Mux)
    const handleExport = async () => {
        if (!config.audioUrl) return alert("No audio loaded.");
        if (!canvasRef.current) return alert("Canvas not ready.");
        if (!ffmpegLoaded) return alert("FFmpeg not loaded yet. Please wait.");

        // Pause playback first
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
            setIsRecording(false);
        }

        let audioFilename = 'audio_source.mp3'; // Fallback

        try {
            setIsExporting(true);
            setIsExportMinimized(false);
            setExportStatus("Initializing High-Speed Export...");
            setEncodingProgress(0);
            skipEncodingRef.current = false;
            isExportCancelledRef.current = false;

            // Audio Trim Logic
            const startTime = config.trimStart || 0;
            // If trimEnd is 0 or undefined, use full duration.
            // But better to use `duration` state if available.
            const fullDuration = duration || 300;
            const endTime = (config.trimEnd && config.trimEnd > 0) ? config.trimEnd : fullDuration;

            const totalDuration = endTime - startTime;
            if (totalDuration <= 0) throw new Error("Invalid duration (End < Start)");

            const fps = 30; // Stable FPS
            const totalFrames = Math.floor(totalDuration * fps);
            const { width, height } = config;

            // 1. Setup MP4 Muxer & VideoEncoder (WebCodecs)
            const muxer = new Mp4Muxer.Muxer({
                target: new Mp4Muxer.ArrayBufferTarget(),
                video: {
                    codec: 'avc', // H.264
                    width,
                    height
                },
                fastStart: 'in-memory'
            });

            const videoEncoder = new VideoEncoder({
                output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
                error: (e) => { throw e; }
            });

            videoEncoder.configure({
                codec: 'avc1.4d002a', // Main Profile, Level 4.2 (Supports 1080p)
                width,
                height,
                bitrate: 15_000_000, // 15 Mbps to prevent text ringing/blur artifacts
                framerate: fps
            });

            setExportStatus("Rendering & Encoding (Hardware Accel)...");

            const canvas = canvasRef.current;

            // 2. Render Loop with direct Hardware Encoding
            for (let i = 0; i < totalFrames; i++) {
                if (isExportCancelledRef.current) throw new Error("Cancelled");

                const time = startTime + (i / fps);

                // Drive Preview state (Frame-perfect)
                if (previewRef.current) {
                    previewRef.current.renderFrame(time);
                }

                // Update UI: 0-80% for rendering
                setCurrentTime(time);
                setEncodingProgress((i / totalFrames) * 80);

                const bitmap = await createImageBitmap(canvas);

                // Timestamp in microseconds
                const timestamp = Math.round(i * (1_000_000 / fps));

                const frame = new VideoFrame(bitmap, { timestamp: timestamp, duration: Math.round(1_000_000 / fps) });

                const keyFrame = (i % 30 === 0);

                videoEncoder.encode(frame, { keyFrame });
                frame.close();

                if (videoEncoder.encodeQueueSize > 5) {
                    await videoEncoder.flush();
                }

                if (i % 30 === 0) await new Promise(r => setTimeout(r, 0));
            }

            await videoEncoder.flush();
            muxer.finalize();

            const { buffer } = muxer.target;
            const videoBlob = new Blob([buffer], { type: 'video/mp4' });

            // 3. Merge Audio using FFmpeg
            setExportStatus("Merging Audio & Applying Fades...");
            setEncodingProgress(90);

            const ffmpeg = ffmpegRef.current;

            // Dynamically detect file extension to prevent FFmpeg demuxer mismatch
            let audioExt = 'mp3';
            try {
                if (config.audioUrl.startsWith('blob:')) {
                    const res = await fetch(config.audioUrl);
                    const blob = await res.blob();
                    const mime = blob.type || '';
                    if (mime.includes('wav')) audioExt = 'wav';
                    else if (mime.includes('webm')) audioExt = 'webm';
                    else if (mime.includes('ogg')) audioExt = 'ogg';
                    else if (mime.includes('aac')) audioExt = 'aac';
                    else if (mime.includes('m4a') || mime.includes('mp4')) audioExt = 'm4a';
                } else {
                    const urlNoQuery = config.audioUrl.split('?')[0];
                    const parsedExt = urlNoQuery.substring(urlNoQuery.lastIndexOf('.') + 1).toLowerCase();
                    if (['mp3', 'wav', 'webm', 'ogg', 'aac', 'm4a', 'mp4'].includes(parsedExt)) {
                        audioExt = parsedExt;
                    }
                }
            } catch (e) {
                console.warn("Failed to detect audio format, defaulting to mp3", e);
            }
            audioFilename = `audio_source.${audioExt}`;

            await ffmpeg.writeFile('video_clean.mp4', await fetchFile(videoBlob));
            await ffmpeg.writeFile(audioFilename, await fetchFile(config.audioUrl));

            const fadeIn = config.fadeIn || 0;
            const fadeOut = config.fadeOut || 0;

            const filters = [];
            
            // Use exact audio trimming via filter instead of inaccurate fast-seeking
            filters.push(`atrim=start=${startTime}:duration=${totalDuration}`);
            filters.push(`asetpts=PTS-STARTPTS`);

            if (fadeIn > 0) filters.push(`afade=t=in:st=0:d=${fadeIn}`);
            if (fadeOut > 0) filters.push(`afade=t=out:st=${totalDuration - fadeOut}:d=${fadeOut}`);

            const ffmpegArgs = [
                '-i', 'video_clean.mp4',
                '-i', audioFilename,
                '-map', '0:v',
                '-map', '1:a',
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-shortest',
                '-movflags', '+faststart'
            ];

            if (filters.length > 0) {
                ffmpegArgs.push('-af', filters.join(','));
            }

            ffmpegArgs.push('final_output.mp4');

            await ffmpeg.exec(ffmpegArgs);

            setEncodingProgress(100);

            const data = await ffmpeg.readFile('final_output.mp4');
            const finalBlob = new Blob([data.buffer], { type: 'video/mp4' });

            // Download
            const url = URL.createObjectURL(finalBlob);
            const normalize = (str) => {
                return str.toLowerCase()
                     .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                     .replace(/\s+/g, '')
                     .replace(/[^a-z0-9]/g, '');
            };
            const fileName = normalize(config.songName || 'video');

            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName}.mp4`;
            a.click();

            // Cleanup
            try {
                await ffmpeg.deleteFile('video_clean.mp4');
                await ffmpeg.deleteFile(audioFilename);
                await ffmpeg.deleteFile('final_output.mp4');
            } catch (e) { }

            setIsExporting(false);

        } catch (err) {
            console.error(err);
            if (err.message !== "Cancelled") {
                alert("Export failed: " + err.message);
            }
            setIsExporting(false);

            // Try cleanup
            try {
                const ffmpeg = ffmpegRef.current;
                await ffmpeg.deleteFile('video_clean.mp4');
                await ffmpeg.deleteFile(audioFilename);
            } catch (e) { }
        }
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') return;
            if (e.code === 'Space') {
                e.preventDefault();
                if (isRecording) nextLyric();
                else togglePlay();
            }
            if (e.code === 'ArrowRight' || e.code === 'Enter') {
                e.preventDefault();
                nextLyric();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, isRecording, currentLineIndex, lyrics.length]);


    return (
        <div className="app-container" style={{ gridTemplateColumns: `${sidebarWidth}px 5px 1fr` }}>
            {/* Export Overlay */}
            {isExporting && (
                <div style={{
                    position: 'fixed',
                    top: isExportMinimized ? 'auto' : 0,
                    left: isExportMinimized ? 'auto' : 0,
                    right: isExportMinimized ? '20px' : 0,
                    bottom: isExportMinimized ? '20px' : 0,
                    width: isExportMinimized ? 'auto' : '100%',
                    height: isExportMinimized ? 'auto' : '100%',
                    background: isExportMinimized ? 'transparent' : `rgba(0,0,0,${config.exportOverlayOpacity ?? 0})`,
                    zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: isExportMinimized ? 'none' : `blur(${config.exportOverlayBlur ?? 5}px)`,
                    pointerEvents: isExportMinimized ? 'none' : 'auto'
                }}>
                    <div style={{
                        background: 'var(--bg-panel)',
                        padding: isExportMinimized ? '15px' : '30px',
                        borderRadius: '20px',
                        border: '1px solid var(--border)',
                        textAlign: 'center',
                        maxWidth: isExportMinimized ? '300px' : '400px',
                        width: isExportMinimized ? 'auto' : '90%',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                        pointerEvents: 'auto'
                    }}>
                        {/* Header Section */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h2 style={{
                                color: '#ff4444',
                                fontSize: isExportMinimized ? '1rem' : '1.2rem',
                                margin: 0
                            }}>
                                {isExportMinimized ? 'Exporting...' : exportStatus}
                            </h2>
                            <button
                                onClick={() => setIsExportMinimized(!isExportMinimized)}
                                style={{
                                    background: 'transparent', border: '1px solid #555', color: '#aaa',
                                    borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer',
                                    fontSize: '12px', marginLeft: '10px'
                                }}
                                title={isExportMinimized ? "Expand" : "Minimize"}
                            >
                                {isExportMinimized ? "Op" : "_"}
                            </button>
                        </div>

                        {!isExportMinimized && (
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                {exportStatus.includes("Encoding") ?
                                    "Optimizing video compatibility..." :
                                    "Recording in real-time. Do not switch tabs."}
                            </p>
                        )}

                        {/* Progress Bar */}
                        <div style={{ width: '100%', height: '10px', background: '#333', borderRadius: '5px', marginTop: '15px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${exportStatus.includes("Encoding") ? encodingProgress : (currentTime / duration) * 100}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, var(--primary), var(--primary-glow))',
                                transition: 'width 0.2s linear'
                            }}></div>
                        </div>
                        <p style={{ marginTop: '5px', fontSize: '0.9rem' }}>
                            {Math.round(exportStatus.includes("Encoding") ? encodingProgress : (currentTime / duration) * 100)}%
                        </p>

                        {!isExportMinimized && (
                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                {/* Cancel Button */}
                                <button
                                    className="btn"
                                    style={{ flex: 1, borderColor: '#ff4444', color: '#ff4444' }}
                                    onClick={() => {
                                        isExportCancelledRef.current = true;
                                        skipEncodingRef.current = true; // Also skip if cancelling
                                        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                                            mediaRecorderRef.current.stop();
                                        }
                                        if (audioRef.current) audioRef.current.pause();
                                        setIsExporting(false);
                                        setIsPlaying(false);
                                    }}
                                >
                                    Cancel
                                </button>

                                {/* Skip Optimization Button (Only visible during encoding) */}
                                {exportStatus.includes("Encoding") && (
                                    <button
                                        className="btn"
                                        style={{ flex: 1, borderColor: '#aaa', color: '#fff' }}
                                        onClick={() => {
                                            // To skip, we just set the flag. 
                                            // The exec logic continues in background but we ignore result.
                                            // Actually, we can't easily interrupt exec, but user can "Cancel" to stop completely.
                                            // But user wants "Get the video NOW".
                                            // So we set flag, and if logic supports it, it will use original blob.
                                            skipEncodingRef.current = true;
                                            setExportStatus("Skipping optimization...");
                                            // We force valid exit ? 
                                            // We can't interrupt `await ffmpeg.exec`. 
                                            // BUT, we can just trigger the download of original blob right here?
                                            // No, the onstop function is stuck waiting. 
                                            // We can't break the await from outside. 
                                            // Ideally we'd terminate specific worker, but that's complex.
                                            // For now, let's just let them Cancel if it's truly stuck.
                                            // But wait, if we can't interrupt `await` in `onstop`, 
                                            // this button is only placebo unless we structure code differently.
                                            // Valid strategy: The user is stuck. 
                                            // Let's just tell them "Please wait" or "Cancel".
                                            // Or we could reload page.
                                        }}
                                        title="Use raw file immediately (may not work on TikTok)"
                                        disabled={true} // Disabled because we can't truly interrupt await exec easily
                                    >
                                        Wait...
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Fake Skip hint if encoding */}
                        {!isExportMinimized && exportStatus.includes("Encoding") && (
                            <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '10px' }}>
                                (Takes ~1-2 min for full song)
                            </p>
                        )}
                    </div>
                </div>
            )}

            <Sidebar
                config={config} setConfig={setConfig}
                lyricsRaw={lyricsRaw} setLyricsRaw={setLyricsRaw}
                onReset={handleReset}
                timings={timings} setTimings={setTimings}
                lyrics={lyrics}
                duration={duration}
                currentLineIndex={currentLineIndex}
                onClearTimings={handleClearTimings}
            />

            <div
                className={`sidebar-resizer ${isResizing ? 'active' : ''}`}
                onMouseDown={startResizing}
            />

            <Preview
                ref={previewRef}
                config={config}
                lyrics={lyrics}
                currentLineIndex={currentLineIndex}
                canvasRef={canvasRef}
                audioRef={audioRef}
                timings={timings}
                isPlaying={isPlaying} // Now just state, loop drives it
                onLineClick={handleLineClick}
                isExporting={isExporting}
            />

            <Timeline
                ref={timelineRef}
                duration={Math.max(0, ((config.trimEnd && config.trimEnd > 0) ? config.trimEnd : duration) - (config.trimStart || 0))}
                isPlaying={isPlaying}
                onPlayPause={togglePlay} onSeek={handleSeek}
                onNextLyric={nextLyric} onPrevLyric={prevLyric}
                onExport={handleExport} isRecording={isRecording} onRecordToggle={toggleRecording}
            />

            {config.audioUrl && (
                <audio
                    ref={audioRef}
                    src={config.audioUrl}
                    crossOrigin="anonymous"
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => { setIsPlaying(false); setIsRecording(false); }}
                    onError={(e) => {
                        console.error("Audio Load Error:", e);
                        console.log("Attempted URL:", config.audioUrl);
                        alert("Could not load audio from: " + config.audioUrl + "\nCheck if file exists in public folder.");
                    }}

                />
            )}
        </div>
    );
};

export default EditorType1;
