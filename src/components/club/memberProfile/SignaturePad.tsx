'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export type SignaturePadHandle = {
  /** Current canvas image (call before save to avoid stale React state). */
  getValue: () => string;
};

type Props = {
  value: string;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
};

const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { value, onChange, disabled },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  /** Latest committed data URL — survives React state lag before Save. */
  const latestValueRef = useRef(value || '');

  useImperativeHandle(ref, () => ({
    getValue: () => {
      const canvas = canvasRef.current;
      if (canvas && hasInk.current) {
        const fromCanvas = canvas.toDataURL('image/png');
        latestValueRef.current = fromCanvas;
        return fromCanvas;
      }
      return latestValueRef.current || value || '';
    },
  }));

  useEffect(() => {
    latestValueRef.current = value || '';
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!value) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasInk.current = false;
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      hasInk.current = true;
    };
    img.src = value;
  }, [value]);

  const pos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const commit = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk.current) return;
    const dataUrl = canvas.toDataURL('image/png');
    latestValueRef.current = dataUrl;
    onChange(dataUrl);
  };

  const start = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';
    ctx.lineTo(x, y);
    ctx.stroke();
    hasInk.current = true;
  };

  const end = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    drawing.current = false;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    commit();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    latestValueRef.current = '';
    onChange('');
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={480}
        height={160}
        className="w-full max-w-lg touch-none rounded border border-gray-400 bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      {!disabled ? (
        <button
          type="button"
          onClick={clear}
          className="mt-2 text-sm text-red-700 underline"
        >
          Clear signature
        </button>
      ) : null}
    </div>
  );
});

export default SignaturePad;
