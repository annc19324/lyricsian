import React, { useRef } from 'react';
import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaVideo } from 'react-icons/fa';

const Timeline = ({
    currentTime,
    duration,
    isPlaying,
    onPlayPause,
    onSeek,
    onNextLyric,
    onPrevLyric,
    onExport,
    isRecording,
    onRecordToggle
}) => {
    const progressBarRef = useRef(null);

    const formatTime = (time) => {
        if (!time) return '0:00';
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        return `${min}:${sec < 10 ? '0' + sec : sec}`;
    };

    const handleClickParams = (e) => {
        if (!progressBarRef.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const percent = Math.max(0, Math.min(1, x / width));
        onSeek(percent * duration);
    };

    const progress = duration ? (currentTime / duration) * 100 : 0;

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
                <span style={{ minWidth: '80px', textAlign: 'center', fontFamily: 'monospace' }}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                </span>
            </div>

            <div
                className="progress-container"
                ref={progressBarRef}
                onClick={handleClickParams}
            >
                <div className="marker" style={{ width: `${progress}%`, background: 'rgba(255,255,255,0.1)' }}></div>
                <div className="playhead" style={{ left: `${progress}%` }}></div>
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
};

export default Timeline;
