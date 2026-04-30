import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Nota: Usaremos SpeechSynthesis para o briefing e integraremos o Gemini Live em breve
import { irisAudio } from '../services/audio-handler';
import { ChevronLeft, Mic, MicOff, Loader2, Play } from 'lucide-react';
import { motion } from 'framer-motion';

const IrisVoicePage = () => {
    const navigate = useNavigate();
    const [isActive, setIsActive] = useState(false);
    const [status, setStatus] = useState('Pronta para ajudar');
    const [isTalking, setIsTalking] = useState(false);
    const [briefing, setBriefing] = useState<string | null>(null);

    const handleStartBriefing = async () => {
        setIsActive(true);
        setStatus('Preparando seu resumo...');
        try {
            // Chamada para o novo backend do V2
            const response = await fetch('/api/ia/briefing', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await response.json();
            if (data.success) {
                setBriefing(data.briefing);
                setStatus('Iris falando...');
                setIsTalking(true);
                irisAudio.speak(data.briefing);
            }
        } catch (error) {
            setStatus('Erro ao conectar com Iris');
        } finally {
            setIsActive(false);
        }
    };

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: '#06112a', 
            display: 'flex', 
            flexDirection: 'column', 
            padding: '24px',
            color: 'white',
            fontFamily: 'Inter, sans-serif'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                    <ChevronLeft size={24}/>
                </button>
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ 
                        fontSize: '20px', 
                        fontWeight: 'bold', 
                        background: 'linear-gradient(to right, #fff, #14B8A6)', 
                        WebkitBackgroundClip: 'text', 
                        WebkitTextFillColor: 'transparent',
                        fontStyle: 'italic',
                        letterSpacing: '2px'
                    }}>IRIS NEXUS IA</h1>
                    <p style={{ fontSize: '10px', color: '#14B8A6', fontWeight: 'bold' }}>{status}</p>
                </div>
                <div style={{ width: '24px' }}></div>
            </div>

            {/* AI Visualization */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {isTalking && (
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: [1, 1.2, 1], opacity: 1 }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            style={{
                                position: 'absolute',
                                width: '256px',
                                height: '256px',
                                background: 'rgba(20,184,166,0.1)',
                                borderRadius: '50%',
                                filter: 'blur(60px)'
                            }}
                        />
                    )}
                
                <div onClick={handleStartBriefing} style={{ cursor: 'pointer', position: 'relative', zIndex: 10 }}>
                    <div style={{ 
                        width: '144px', 
                        height: '144px', 
                        borderRadius: '50%', 
                        border: '1px solid rgba(20,184,166,0.3)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        boxShadow: isTalking ? '0 0 80px rgba(20,184,166,0.4)' : 'none',
                        transition: 'all 0.5s'
                    }}>
                        <div style={{ 
                            width: '96px', 
                            height: '96px', 
                            borderRadius: '50%', 
                            background: 'linear-gradient(to bottom right, #14B8A6, #0D9488)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center'
                        }}>
                            {isActive ? (
                                <Loader2 size={40} style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                                <Mic size={40} color="black" />
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '48px', textAlign: 'center', maxWidth: '300px', fontSize: '14px', color: '#94a3b8', fontStyle: 'italic' }}>
                    {briefing || "Toque no microfone para ouvir seu briefing matinal."}
                </div>
            </div>

            {/* Footer Actions */}
            <div style={{ display: 'flex', gap: '16px', marginTop: 'auto' }}>
                <button 
                    onClick={() => navigate('/agenda')}
                    style={{ 
                        flex: 1, 
                        padding: '16px', 
                        background: 'rgba(255,255,255,0.05)', 
                        border: 'none', 
                        borderRadius: '16px', 
                        color: '#64748b', 
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    Voltar à Agenda
                </button>
                <button 
                    onClick={handleStartBriefing}
                    style={{ 
                        flex: 1, 
                        padding: '16px', 
                        background: '#14B8A6', 
                        border: 'none', 
                        borderRadius: '16px', 
                        color: 'black', 
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                >
                    Falar com Iris <Play size={18} fill="black"/>
                </button>
            </div>
        </div>
    );
};

export default IrisVoicePage;
