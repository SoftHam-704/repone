import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface BackgroundPortalProps {
  videoSrc: string;
}

export const BackgroundPortal: React.FC<BackgroundPortalProps> = ({ videoSrc }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <div className="absolute inset-0 z-[-1] overflow-hidden bg-[#030712]">
      {/* SVG Displacement Filter Definition */}
      <svg className="hidden">
        <defs>
          <filter id="liquid-distortion">
            <feTurbulence 
              type="fractalNoise" 
              baseFrequency="0.01 0.01" 
              numOctaves="2" 
              result="noise"
            >
              <animate 
                attributeName="baseFrequency" 
                dur="30s" 
                values="0.01 0.01; 0.015 0.015; 0.01 0.01" 
                repeatCount="indefinite" 
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="50" />
          </filter>
        </defs>
      </svg>

      {/* Background Video with Liquid Filter */}
      <motion.div 
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, ease: "easeOut" }}
        className="w-full h-full"
        style={{ filter: 'url(#liquid-distortion) contrast(1.1) brightness(0.6)' }}
      >
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        />
      </motion.div>

      {/* Textured Overlays */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#030712] via-transparent to-transparent opacity-80" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(45,122,123,0.1),transparent)] pointer-events-none" />
      
      {/* Noise Texture for Depth */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E')] mix-blend-overlay" />
    </div>
  );
};
