import React, { useRef, useEffect } from 'react';
import { Eraser } from 'lucide-react';

/**
 * A simple writing pad: draw with a mouse, finger or pen.
 * `cells` is the number of characters to write (one guide box each).
 * Mount it with a new `key` for every question to start with a clean pad.
 */
export default function DrawPad({ cells = 1, clearLabel = 'Clear' }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);

  const prepare = () => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.max(1, Math.round(rect.width * dpr)); // also clears the pad
    c.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = getComputedStyle(c).color;
    ctx.fillStyle = ctx.strokeStyle;
  };

  useEffect(() => {
    prepare();
  }, [cells]);

  const point = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const handleDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = point(e);
    last.current = p;
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const handleMove = (e) => {
    if (!drawing.current) return;
    const p = point(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const handleUp = () => {
    drawing.current = false;
  };

  return (
    <div className="draw-wrap">
      <div className="draw-pad" style={{ '--cells': cells }}>
        <canvas
          ref={canvasRef}
          className="draw-canvas"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
        />
      </div>
      <button type="button" className="secondary-btn" onClick={prepare}>
        <Eraser style={{ width: 16, height: 16 }} />
        {clearLabel}
      </button>
    </div>
  );
}