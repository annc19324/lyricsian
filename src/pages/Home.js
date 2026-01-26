
import React from 'react';
import { Link } from 'react-router-dom';
import { FaMusic } from 'react-icons/fa';

const Home = () => {
    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#111',
            color: 'white',
            gap: '40px'
        }}>
            <h1 style={{ fontSize: '3rem', fontWeight: 'bold' }}>Lyricsian</h1>
            <p style={{ color: '#aaa', marginTop: '-20px' }}>Choose a video style to start creating</p>

            <div style={{ display: 'flex', gap: '20px' }}>
                <Link to="/editor/1" style={{ textDecoration: 'none' }}>
                    <div style={{
                        width: '240px',
                        height: '320px',
                        background: '#222',
                        border: '1px solid #333',
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                        transition: 'transform 0.2s',
                        cursor: 'pointer'
                    }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <div style={{ fontSize: '4rem', color: '#ff0055', marginBottom: '20px' }}>
                            <FaMusic />
                        </div>
                        <h3 style={{ color: 'white' }}>Classic Type 1</h3>
                        <p style={{ color: '#666', fontSize: '0.9rem', textAlign: 'center' }}>
                            Standard video with main image and scrolling lyrics.
                        </p>
                    </div>
                </Link>

                {/* Placeholder for future types */}
                <div style={{
                    width: '240px',
                    height: '320px',
                    background: '#1a1a1a',
                    border: '1px dashed #333',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.5
                }}>
                    <h3 style={{ color: '#444' }}>More Coming Soon</h3>
                </div>
            </div>
        </div>
    );
};

export default Home;
