
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Preview from '../components/Preview';
import Timeline from '../components/Timeline';
import { getAsset } from '../utils/db';

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

    // Default Configuration
    const defaultLyrics = `con tim anh, thực sự mong manh\n\nvì ngoài em, không ai còn ở trong anh\n\nlần đầu gặp em, mưa trong một ngày trời trong xanh\n\nnhưng giờ đây, em đang không anh.\n\ngiá rét, trong những ngày đông lạnh\n\ntại vì sao? là vì em đang không cạnh\n\ntim của anh, em đâm đến mức không lành\n\nanh và em, chỉ dừng lại ở mức không thành.\n\nthằng chó đấy, bị người cũ đá, không đành.\n\nbiết ta là của nhau, nhưng mà không rành\n\ntán em, anh nghĩ là sẽ không thành\n\nnhưng em cho nó theo đuổi như đang không anh.\n\nchửi nó, những nó vẫn không chừa\n\nem bênh nó, lời anh nói không thừa\n\nbản mặt nó, trông nó vẫn ngông, đùa.\n\nanh đã, làm gì mà không vừa lòng em?`;

    const defaultConfig = {
        songName: 'Lời của anh',
        artistName: 'annc19324 ft. Suno A.I x Antigravity',
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
        exportOverlayBlur: 5
    };

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

    // Persistent Audio Context State
    const [audioContext, setAudioContext] = useState(null);
    const [audioSource, setAudioSource] = useState(null);
    const [audioDest, setAudioDest] = useState(null);

    const audioRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const isExportCancelledRef = useRef(false);

    useEffect(() => {
        // Initialize Audio Context only once
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = ctx.createMediaStreamDestination();
        setAudioContext(ctx);
        setAudioDest(dest);

        return () => {
            ctx.close();
        };
    }, []);

    // Connect Audio Element to Context when ready
    useEffect(() => {
        if (audioRef.current && audioContext && audioDest && !audioSource) {
            try {
                // Check if we can connect?
                const src = audioContext.createMediaElementSource(audioRef.current);
                src.connect(audioContext.destination);
                src.connect(audioDest);
                setAudioSource(src);
            } catch (e) {
                // Already connected, ignore
            }
        }
    }, [audioContext, audioDest, audioSource]);

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

    const handleSeek = (time) => {
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
            setCurrentTime(time);

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

        // Resume Audio Context if suspended
        if (audioContext && audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
            setIsRecording(false);
        } else {
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
            if (audioContext && audioContext.state === 'suspended') await audioContext.resume();

            try {
                await audioRef.current.play();
                setIsRecording(true);
                setIsPlaying(true);
            } catch (e) {
                console.error(e);
            }
        }
    };

    const prevLyric = () => {
        if (currentLineIndex > 0) {
            setCurrentLineIndex(prev => prev - 1);
        }
    };

    const nextLyric = () => {
        // Check if Playing -> Update Timing for CURRENT line, then move next
        if (isPlaying) {
            // Force Recording Mode logic to prevent auto-sync jumps
            setIsRecording(true);

            const now = audioRef.current ? audioRef.current.currentTime : 0;

            // Update timing for current line
            const newTimings = [...timings];
            // Ensure structure exists
            if (!newTimings[currentLineIndex]) newTimings[currentLineIndex] = { index: currentLineIndex, time: 0 };

            newTimings[currentLineIndex].time = now;

            // Sort logic is risky during record if user jumps around, but for sequential it's fine.
            // Let's NOT sort automatically to keep index stable.
            setTimings(newTimings);

            // Move to next
            if (currentLineIndex < lyrics.length - 1) {
                setCurrentLineIndex(prev => prev + 1);
            } else {
                setIsRecording(false); // End
                setIsPlaying(false);
            }

        } else {
            // Just navigation
            if (currentLineIndex < lyrics.length - 1) {
                setCurrentLineIndex(prev => prev + 1);
            } else {
                // Loop back to start if at end
                setCurrentLineIndex(0);
            }
        }
    };
    const canvasRef = useRef(null);

    // Export functionality
    const handleExport = async () => {
        if (!config.audioUrl) return alert("No audio loaded.");
        if (!canvasRef.current) return alert("Canvas not ready.");

        // No Confirmation Dialog as requested

        try {
            setIsExporting(true);
            isExportCancelledRef.current = false;

            const startTime = config.exportStart || 0;
            const endTime = config.exportEnd || duration;

            if (endTime <= startTime) return alert("End time must be greater than start time");

            // Seek to start
            if (audioRef.current) {
                audioRef.current.currentTime = startTime;
                setCurrentTime(startTime);
                // Sync lyrics to start time
                if (timings.length > 0) {
                    let activeIndex = 0;
                    for (let i = 0; i < timings.length; i++) {
                        if (startTime >= timings[i].time) activeIndex = timings[i].index; else break;
                    }
                    setCurrentLineIndex(activeIndex);
                } else {
                    setCurrentLineIndex(0);
                }
            }

            setIsPlaying(true); // Auto play to sync

            // 1. Capture Video Stream from Canvas
            // Lowering to 30 FPS provides much better stability for mobile/web encoding
            // and prevents the "1 second stutter" caused by 60FPS CPU spikes.
            const canvasStream = canvasRef.current.captureStream(30); 
            const videoTrack = canvasStream.getVideoTracks()[0];

            // 2. Capture Audio Stream (Persistent)
            const audioTrack = audioDest ? audioDest.stream.getAudioTracks()[0] : null;

            const tracks = [videoTrack];
            if (audioTrack) tracks.push(audioTrack);

            const combinedStream = new MediaStream(tracks);

            // 3. Select Best MIME Type
            const types = [
                "video/mp4; codecs=avc1.42E01E, mp4a.40.2", 
                "video/mp4; codecs=avc1.4D401E, mp4a.40.2",
                "video/mp4",
                "video/webm; codecs=vp9",
                "video/webm"
            ];

            let mimeType = "";
            for (const t of types) {
                if (MediaRecorder.isTypeSupported(t)) {
                    mimeType = t;
                    break;
                }
            }
            if (!mimeType) mimeType = "video/webm";

            // Options for stability
            const options = {
                mimeType,
                videoBitsPerSecond: 4000000 // 4Mbps: Great for lyrics, avoids CPU lag
            };
            
            try { options.videoKeyFrameIntervalDuration = 2000; } catch (e) { }

            const mediaRecorder = new MediaRecorder(combinedStream, options);
            mediaRecorderRef.current = mediaRecorder;

            const chunks = [];
            mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

            mediaRecorder.onstop = () => {
                if (isExportCancelledRef.current) {
                    setIsExporting(false);
                    setIsPlaying(false);
                    mediaRecorderRef.current = null;
                    return; 
                }

                const type = mimeType.split(';')[0];
                const ext = type === 'video/mp4' ? 'mp4' : 'webm';
                const blob = new Blob(chunks, { type });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;

                const normalize = (str) => {
                    return str.toLowerCase()
                        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
                        .replace(/\s+/g, '') 
                        .replace(/[^a-z0-9]/g, ''); 
                };
                const fileName = normalize(config.songName || 'video');

                a.download = `${fileName}.${ext}`;
                a.click();
                URL.revokeObjectURL(url);

                setIsExporting(false);
                setIsPlaying(false);
                mediaRecorderRef.current = null;
            };

            // START EXPORT SEQUENCE
            if (audioContext) await audioContext.resume();

            mediaRecorder.start();
            
            // Tiny 150ms Warmup: Long enough to let the recorder thread settle,
            // short enough to skip the "2 second extra duration" issue.
            setTimeout(() => {
                if (audioRef.current && mediaRecorder.state !== 'inactive') {
                    audioRef.current.play().catch(e => console.error(e));

                    const checkStop = () => {
                        const targetEnd = config.exportEnd || duration;
                        if (audioRef.current.currentTime >= targetEnd) {
                            if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
                            audioRef.current.pause();
                        } else if (mediaRecorder.state !== 'inactive') {
                            requestAnimationFrame(checkStop);
                        }
                    };
                    requestAnimationFrame(checkStop);

                    audioRef.current.onended = () => {
                        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
                    };
                }
            }, 150); 

        } catch (err) {
            console.error(err);
            alert("Export failed: " + err.message);
            setIsExporting(false);
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
        <div className="app-container" style={{ gridTemplateColumns: `${sidebarWidth}px 5px 1fr`, height: '100vh', display: 'grid' }}>
            {/* Export Overlay */}
            {isExporting && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: `rgba(0,0,0,${config.exportOverlayOpacity ?? 0})`, zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: `blur(${config.exportOverlayBlur ?? 5}px)`
                }}>
                    <div style={{
                        background: 'var(--bg-panel)',
                        padding: '30px',
                        borderRadius: '20px',
                        border: '1px solid var(--border)',
                        textAlign: 'center',
                        maxWidth: '400px',
                        width: '90%',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }}>
                        <h2 style={{ color: '#ff4444', marginBottom: '10px' }}>Rendering...</h2>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Do not switch tabs or minimize the browser.</p>

                        <div style={{ width: '100%', height: '10px', background: '#333', borderRadius: '5px', marginTop: '20px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${(currentTime / duration) * 100}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, var(--primary), var(--primary-glow))',
                                transition: 'width 0.2s linear'
                            }}></div>
                        </div>
                        <p style={{ marginTop: '5px' }}>{Math.round((currentTime / duration) * 100)}%</p>

                        <button
                            className="btn"
                            style={{ marginTop: '20px', width: '100%', borderColor: '#ff4444', color: '#ff4444' }}
                            onClick={() => {
                                // Manual Cancel Logic
                                isExportCancelledRef.current = true;
                                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                                    mediaRecorderRef.current.stop();
                                }
                                if (audioRef.current) audioRef.current.pause();
                                setIsExporting(false);
                                setIsPlaying(false);
                            }}
                        >
                            Cancel Export
                        </button>
                    </div>
                </div>
            )}

            <div style={{ display: 'contents' }}>
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
                    onMouseDown={startResizing}
                    style={{
                        width: '5px',
                        cursor: 'col-resize',
                        background: isResizing ? 'var(--primary)' : '#222',
                        gridRow: '1 / 2', // Keep in main area
                        zIndex: 10
                    }}
                />
            </div>

            <Preview
                config={config}
                lyrics={lyrics}
                currentLineIndex={currentLineIndex}
                canvasRef={canvasRef}
                audioRef={audioRef}
                timings={timings}
                isPlaying={isPlaying || isExporting} // Treat exporting as playing for sync
                onLineClick={handleLineClick}
            />

            <Timeline
                currentTime={currentTime} duration={duration} isPlaying={isPlaying}
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
