'use client';

import {
  forwardRef, useEffect, useImperativeHandle, useRef, useState,
} from 'react';

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  /** Retorna o PNG (data URL) ou null se estiver em branco. */
  toDataURL: () => string | null;
}

/**
 * Área de assinatura com o dedo (touch) ou mouse.
 * Desenha traços pretos sobre fundo transparente — assim a linha de
 * assinatura embaixo continua visível ao embutir no PDF.
 */
export const SignaturePad = forwardRef<
  SignaturePadHandle,
  { initial?: string | null; onChange?: () => void; className?: string }
>(function SignaturePad({ initial, onChange, className }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [empty, setEmpty] = useState(true);

  // Configura resolução do canvas (nítido em telas retina) e carrega assinatura existente.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111111';

    if (initial) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        dirty.current = true;
        setEmpty(false);
      };
      img.src = initial;
    }
  }, [initial]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvasRef.current!.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!dirty.current) { dirty.current = true; setEmpty(false); }
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    onChange?.();
  }

  function clearCanvas() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirty.current = false;
    setEmpty(true);
    onChange?.();
  }

  useImperativeHandle(ref, () => ({
    clear: clearCanvas,
    isEmpty: () => !dirty.current,
    toDataURL: () => (dirty.current ? canvasRef.current!.toDataURL('image/png') : null),
  }));

  return (
    <div className={`relative rounded-lg border border-input bg-background ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full h-36 touch-none cursor-crosshair rounded-lg"
      />
      {empty && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Assine aqui com o dedo
        </span>
      )}
      <button
        type="button"
        onClick={clearCanvas}
        className="absolute bottom-1.5 right-2 text-xs text-muted-foreground hover:text-foreground"
      >
        Limpar
      </button>
    </div>
  );
});
