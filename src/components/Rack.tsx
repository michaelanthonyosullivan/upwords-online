import React, { useState, useRef, useEffect } from 'react';
import { Shuffle, ArrowDownToLine, RefreshCw, Send, AlertTriangle } from 'lucide-react';

interface RackProps {
  rack: string[];
  selectedTileIdx: number | null;
  isMyTurn: boolean; // ← ADDED
  onSelectTile: (letter: string, idx: number) => void;
  onDeselectTile: () => void;
  onShuffle: () => void;
  onRecall: () => void;
  onSubmit: () => { success: boolean; error?: string };
  onPass: () => void;
  onExchange: (tiles: string[]) => { success: boolean; error?: string } | void;
  onDropTile: (r: number, c: number, letter: string) => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
  bagCount: number;
  hasPlacements: boolean;
}

export function Rack({
  rack, selectedTileIdx, isMyTurn, onSelectTile, onDeselectTile,
  onShuffle, onRecall, onSubmit, onPass, onExchange, onDropTile, onReorder, bagCount, hasPlacements
}: RackProps) {
  const [exchangeMode, setExchangeMode] = useState(false);
  const [exchangeIdxs, setExchangeIdxs] = useState<Set<number>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tilesContainerRef = useRef<HTMLDivElement>(null);
  const rackRef = useRef(rack);
  const exchangeModeRef = useRef(exchangeMode);
  const [touchGhost, setTouchGhost] = useState<{ letter: string; x: number; y: number } | null>(null);
  const DRAG_THRESHOLD = 10;

  useEffect(() => { rackRef.current = rack; }, [rack]);
  useEffect(() => { exchangeModeRef.current = exchangeMode; }, [exchangeMode]);

  useEffect(() => {
    const container = tilesContainerRef.current;
    if (!container) return;

    let state: { x: number; y: number; idx: number; letter: string; dragging: boolean } | null = null;
    let hoverCell: HTMLElement | null = null;
    let hoverTile: HTMLElement | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (exchangeModeRef.current ||!isMyTurn) return; // ← ADDED isMyTurn check
      const targetEl = (e.target as HTMLElement).closest('[data-tile-idx]') as HTMLElement | null;
      if (!targetEl) return;
      const idx = parseInt(targetEl.getAttribute('data-tile-idx') || '', 10);
      if (isNaN(idx)) return;
      const t = e.touches[0];
      state = { x: t.clientX, y: t.clientY, idx, letter: rackRef.current[idx], dragging: false };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!state) return;
      const t = e.touches[0];
      const dx = t.clientX - state.x;
      const dy = t.clientY - state.y;
      if (!state.dragging && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        state.dragging = true;
      }
      if (state.dragging) {
        if (e.cancelable) e.preventDefault();
        setTouchGhost({ letter: state.letter, x: t.clientX, y: t.clientY });
        const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null;
        const cellEl = el?.closest('[data-cell-r]') as HTMLElement | null;
        const rawTileEl =!cellEl? (el?.closest('[data-tile-idx]') as HTMLElement | null) : null;
        const tileEl = rawTileEl && rawTileEl.getAttribute('data-tile-idx')!== String(state.idx)? rawTileEl : null;

        if (cellEl!== hoverCell) {
          hoverCell?.classList.remove('drag-over');
          cellEl?.classList.add('drag-over');
          hoverCell = cellEl;
        }
        if (tileEl!== hoverTile) {
          hoverTile?.classList.remove('rack-reorder-target');
          tileEl?.classList.add('rack-reorder-target');
          hoverTile = tileEl;
        }
      }
    };

    const endDrag = (e: TouchEvent, commit: boolean) => {
      if (state?.dragging) {
        if (e.cancelable) e.preventDefault();
        if (commit) {
          const touch = e.changedTouches[0];
          const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
          const cellEl = el?.closest('[data-cell-r]') as HTMLElement | null;
          if (cellEl) {
            const r = parseInt(cellEl.getAttribute('data-cell-r') || '', 10);
            const c = parseInt(cellEl.getAttribute('data-cell-c') || '', 10);
            if (!isNaN(r) &&!isNaN(c)) onDropTile(r, c, state.letter);
          } else {
            const tileEl = el?.closest('[data-tile-idx]') as HTMLElement | null;
            if (tileEl) {
              const targetIdx = parseInt(tileEl.getAttribute('data-tile-idx') || '', 10);
              if (!isNaN(targetIdx) && targetIdx!== state.idx) onReorder(state.idx, targetIdx);
            }
          }
        }
      }
      hoverCell?.classList.remove('drag-over');
      hoverTile?.classList.remove('rack-reorder-target');
      hoverCell = null;
      hoverTile = null;
      state = null;
      setTouchGhost(null);
    };

    const onTouchEnd = (e: TouchEvent) => endDrag(e, true);
    const onTouchCancel = (e: TouchEvent) => endDrag(e, false);

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: false });
    container.addEventListener('touchcancel', onTouchCancel, { passive: false });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [onDropTile, onReorder, isMyTurn]); // ← ADDED isMyTurn to deps

  const handleTileClick = (letter: string, idx: number) => {
    if (!isMyTurn) return; // ← ADDED
    setErrorMsg(null);
    if (exchangeMode) {
      setExchangeIdxs(prev => {
        const n = new Set(prev);
        n.has(idx)? n.delete(idx) : n.add(idx);
        return n;
      });
    } else {
      if (selectedTileIdx === idx) onDeselectTile();
      else onSelectTile(letter, idx);
    }
  };

  const handleToggleExchange = () => {
    if (!isMyTurn) return; // ← ADDED
    setErrorMsg(null);
    if (hasPlacements) { setErrorMsg('Recall your tiles before exchanging.'); return; }
    setExchangeMode(e =>!e);
    setExchangeIdxs(new Set());
    onDeselectTile();
  };

  const handleExecuteExchange = () => {
    if (!isMyTurn) return; // ← ADDED
    setErrorMsg(null);
    const tiles = [...exchangeIdxs].map(i => rack[i]);
    const res = onExchange(tiles);
    if (res &&!res.success) { setErrorMsg(res.error || 'Exchange failed.'); return; }
    setExchangeMode(false);
    setExchangeIdxs(new Set());
  };

  const handleSubmit = () => {
    if (!isMyTurn) return; // ← ADDED
    setErrorMsg(null);
    const res = onSubmit();
    if (!res.success) setErrorMsg(res.error || 'Invalid play.');
  };

  const handlePass = () => {
    if (!isMyTurn) return; // ← ADDED
    if (window.confirm('Pass your turn? You will score 0 points.')) onPass();
  };

  return (
    <div className="w-full max-w- flex flex-col items-center gap-3 glass-card p-4 rounded-2xl border border-white/5">
      {errorMsg && (
        <div className="w-full flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-medium animate-popup">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="w-full flex justify-between items-center px-1">
        <span className="text- font-bold uppercase tracking-wider text-slate-400">
          {exchangeMode? <span className="text-orange-400">Select tiles to exchange</span> : isMyTurn? 'Your Rack' : 'Waiting for opponent...'}
        </span>
        {exchangeMode && (
          <span className="text- text-orange-400 font-mono">{exchangeIdxs.size} selected</span>
        )}
      </div>

      <div ref={tilesContainerRef} className="flex gap-2 p-3 bg-slate-950/80 w-full justify-center rounded-xl border border-white/5 min-h-">
        {rack.map((letter, idx) => {
          const isSelected =!exchangeMode && selectedTileIdx === idx;
          const isForExchange = exchangeMode && exchangeIdxs.has(idx);
          const canInteract = isMyTurn; // ← ADDED

          let cls = 'bg-gradient-to-b from-[#FEFEFE] to-[#F0EAE0] border-[#D8CEBE] text-[#B81C2C] shadow-md';
          if (!canInteract) {
            cls = 'bg-gradient-to-b from-slate-700 to-slate-800 border-slate-600 text-slate-500 opacity-50 cursor-not-allowed'; // ← ADDED disabled style
          } else if (isSelected) {
            cls = 'bg-gradient-to-b from-[#FFF8F0] to-[#F5E8D0] border-red-400 text-[#B81C2C] -translate-y-2.5 ring-4 ring-red-500/25 scale-110 shadow-lg shadow-red-500/20';
          } else if (isForExchange) {
            cls = 'bg-gradient-to-b from-orange-400/40 to-orange-500/40 border-orange-500 text-orange-200 scale-95 ring-2 ring-orange-500/40';
          }

          return (
            <button
              key={idx}
              data-tile-idx={idx}
              onClick={() => handleTileClick(letter, idx)}
              draggable={!exchangeMode && isMyTurn} // ← CHANGED
              onDragStart={(e) => {
                if (!isMyTurn) { e.preventDefault(); return; } // ← ADDED
                e.dataTransfer.setData('text/plain', letter);
                e.dataTransfer.setData('application/x-rack-idx', String(idx));
                e.dataTransfer.effectAllowed = 'move';
                onSelectTile(letter, idx);
              }}
              onDragEnd={(e) => {
                e.currentTarget.classList.remove('rack-reorder-target');
                onDeselect