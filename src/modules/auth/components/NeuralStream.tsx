import React, { useRef, useEffect } from 'react';

interface NeuralStreamProps {
  color?: string;
}

export const NeuralStream: React.FC<NeuralStreamProps> = ({ color = '#2D7A7B' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let animationFrameId: number;

    // Commercial Representation Source Code Blocks
    const codeSource = [
      '// Initialize Sales Engine V2',
      'import { SMV2Core } from "sm-v2";',
      'const engine = new SMV2Core();',
      '',
      'async function processSalesData(rep_id) {',
      '  console.log("Syncing Portfolio...");',
      '  const clients = await engine.getClients(rep_id);',
      '  ',
      '  for (const client of clients) {',
      '    const commission = client.calculate(0.08);',
      '    await engine.updateBalance(rep_id, commission);',
      '  }',
      '}',
      '',
      'function optimizeRoutes(rep_geo) {',
      '  return rep_geo.sort((a, b) => a.dist - b.dist);',
      '}',
      '',
      'export interface SalesConfig {',
      '  auto_export: boolean;',
      '  min_margin: 0.15;',
      '  currency: "BRL";',
      '}',
      '',
      '// AI Refactoring Order Flow...',
      'engine.on("order_created", (order) => {',
      '  if (order.total > 5000) {',
      '    applyBonusDiscount(order);',
      '  }',
      '});',
      '',
      '// System Stabilized.',
      '// Ready for Scale.'
    ];

    interface TypedLine {
      text: string;
      y: number;
      opacity: number;
    }

    const typedLines: TypedLine[] = [];
    let currentLineIndex = 0;
    let currentCharIndex = 0;
    let lastTypeTime = 0;
    const typeSpeed = 50; // ms per char
    const lineHeight = 24;
    const startY = height - 100; // Start typing near the bottom

    const animate = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.font = `14px 'IBM Plex Mono', monospace`;

      // Typing Logic
      if (time - lastTypeTime > typeSpeed && currentLineIndex < codeSource.length) {
        const fullLine = codeSource[currentLineIndex];
        
        if (currentCharIndex < fullLine.length) {
          currentCharIndex++;
        } else {
          // Line complete, move all lines up and start next line
          typedLines.forEach(l => l.y -= lineHeight);
          
          typedLines.push({
            text: fullLine,
            y: startY,
            opacity: 1
          });

          // If too many lines, start fading first lines
          if (typedLines.length > 25) {
            typedLines.shift();
          }

          currentLineIndex++;
          currentCharIndex = 0;
          
          // Loop source if finished
          if (currentLineIndex >= codeSource.length) {
            currentLineIndex = 0;
          }
        }
        lastTypeTime = time;
      }

      // Draw Previous Typed Lines
      typedLines.forEach((line) => {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.15; // Subtle background code
        ctx.fillText(line.text, 40, line.y);
      });

      // Draw Current Line being typed
      if (currentLineIndex < codeSource.length) {
        const currentText = codeSource[currentLineIndex].substring(0, currentCharIndex);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.4; // Brighter active line
        ctx.fillText(currentText, 40, startY + lineHeight);
        
        // Blinking Cursor
        if (Math.floor(time / 500) % 2 === 0) {
          const metrics = ctx.measureText(currentText);
          ctx.fillRect(40 + metrics.width + 2, startY + lineHeight - 12, 8, 14);
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
      style={{ mixBlendMode: 'screen' }}
    />
  );
};
