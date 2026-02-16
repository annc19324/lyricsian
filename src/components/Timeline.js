import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaVideo } from 'react-icons/fa';

const Timeline = forwardRef(({
    duration,
    isPlaying,
    onPlayPause,
    onSeek,
    onNextLyric,
    onPrevLyric,
    onExport,
    isRecording,
    onRecordToggle
}, ref) => {
    const progressBarRef = useRef(null);
    const progressMarkerRef = useRef(null);
    const playheadRef = useRef(null);
    const timeDisplayRef = useRef(null);

    const formatTime = (time) => {
        if (!time && time !== 0) return '0:00';
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        return `${min}:${sec < 10 ? '0' + sec : sec}`;
    };

    useImperativeHandle(ref, () => ({
        updateTime: (time) => {
            if (timeDisplayRef.current) {
                timeDisplayRef.current.textContent = `${formatTime(time)} / ${formatTime(duration)}`;
            }
            if (duration > 0) {
                const percent = (time / duration) * 100;
                if (progressMarkerRef.current) progressMarkerRef.current.style.width = `${percent}%`;
                if (playheadRef.current) playheadRef.current.style.left = `${percent}%`;
            }
        }
    }));

    // Initial render or duration change update
    useEffect(() => {
        if (timeDisplayRef.current) {
            // We don't know the current time here easily without prop, but that's okay.
            // The parent will call updateTime(0) or current on mount/seek.
            // We can default to 0:00 / duration
            timeDisplayRef.current.textContent = `0:00 / ${formatTime(duration)}`;
        }
    }, [duration]);

    const handleClickParams = (e) => {
        if (!progressBarRef.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const percent = Math.max(0, Math.min(1, x / width));
        onSeek(percent * (duration || 0));
    };

    return (
        <div className="timeline-bar">
            <div className="controls">
                <button
                    className="btn"
                    onClick={onRecordToggle}
                    title={isRecording ? "Stop Recording" : "Start Recording Timings"}
                    style={{
                        borderColor: isRecording ? 'red' : 'var(--border)',
                        color: isRecording ? 'red' : 'inherit',
                        minWidth: '100px'
                    }}
                >
                    <span style={{
                        width: '10px', height: '10px', borderRadius: '50%',
                        background: isRecording ? 'red' : '#555',
                        marginRight: '8px', display: 'inline-block'
                    }}></span>
                    {isRecording ? "REC" : "Record"}
                </button>

                <button className="btn primary" onClick={onPlayPause}>
                    {isPlaying ? <FaPause /> : <FaPlay />}
                </button>
                <span ref={timeDisplayRef} style={{ minWidth: '80px', textAlign: 'center', fontFamily: 'monospace' }}>
                    0:00 / {formatTime(duration)}
                </span>
            </div>

            <div
                className="progress-container"
                ref={progressBarRef}
                onClick={handleClickParams}
            >
                <div className="marker" ref={progressMarkerRef} style={{ width: `0%`, background: 'rgba(255,255,255,0.1)' }}></div>
                <div className="playhead" ref={playheadRef} style={{ left: `0%` }}></div>
            </div>

            <div className="controls">
                <button className="btn" onClick={onPrevLyric} title="Jump to previous lyric">
                    <FaStepBackward /> Prev
                </button>
                <button className="btn" onClick={onNextLyric} title="Jump to next lyric line (Spacebar)">
                    <FaStepForward /> Next
                </button>
                <button className="btn" style={{ borderColor: 'cyan', color: 'cyan' }} onClick={onExport}>
                    <FaVideo /> Export
                </button>
            </div>
        </div>
    );
});

export default Timeline;
