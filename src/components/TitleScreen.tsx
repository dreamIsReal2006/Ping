import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { soundManager } from '../utils/audio';
import { hapticManager } from '../utils/haptics';
import type { GameMode } from '../types/game';

interface TitleScreenProps {
  onStart: (mode: GameMode) => void;
  backHandlerRef: React.MutableRefObject<(() => boolean) | null>;
  highScore: number;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  backHandlerRef,
  highScore,
}) => {
  const { t } = useTranslation();
  const [menuPhase, setMenuPhase] = useState<'idle' | 'opening' | 'open' | 'closing' | 'returning'>('idle');
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);

  useEffect(() => {
    if (menuPhase !== 'opening') return;
    const timeout = window.setTimeout(() => setMenuPhase('open'), 620);
    return () => window.clearTimeout(timeout);
  }, [menuPhase]);

  useEffect(() => {
    if (menuPhase !== 'returning') return;
    const timeout = window.setTimeout(() => setMenuPhase('idle'), 620);
    return () => window.clearTimeout(timeout);
  }, [menuPhase]);

  const handleMenuBack = React.useCallback(() => {
    if (menuPhase !== 'opening' && menuPhase !== 'open') return false;
    setSelectedMode(null);
    setMenuPhase('returning');
    return true;
  }, [menuPhase]);

  useEffect(() => {
    backHandlerRef.current = menuPhase === 'opening' || menuPhase === 'open'
      ? handleMenuBack
      : null;
    return () => {
      backHandlerRef.current = null;
    };
  }, [backHandlerRef, handleMenuBack, menuPhase]);

  const handleStart = () => {
    if (menuPhase !== 'idle') return;
    soundManager.playStart();
    hapticManager.triggerHit('PERFECT');
    setMenuPhase('opening');
  };

  const handleModeSelect = (mode: GameMode) => {
    if (menuPhase !== 'open') return;
    setSelectedMode(mode);
    setMenuPhase('closing');
    soundManager.playStart();
    hapticManager.triggerHit('PERFECT');
    window.setTimeout(() => onStart(mode), 1480);
  };

  return (
    <>
      <div className="relative z-10 w-full h-full flex flex-col justify-between items-center px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] select-none">
        <div className="w-full flex flex-col items-center pt-2">
          <h1 className="text-sm font-semibold tracking-[0.35em] text-slate-200">PING</h1>
          <span className="mt-1 text-[10px] tracking-[0.18em] text-slate-500">{t('tagline')}</span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-[11px] font-medium tracking-[0.25em] uppercase text-slate-500 mb-1">
            {t('best')}
          </span>
          <span className="text-xl font-bold tracking-tight text-slate-300 font-mono-numbers">
            {highScore.toLocaleString()}
          </span>
        </div>

        <div className="relative flex items-center justify-center my-auto">
          <div className="absolute w-36 h-36 rounded-full border border-sky-400/35 animate-ripple pointer-events-none" />
          <div className="absolute w-36 h-36 rounded-full border border-sky-400/20 animate-ripple-delay pointer-events-none" />
          <div
            className={`mode-menu-shell ${menuPhase === 'opening' ? 'mode-menu-shell--opening' : ''} ${menuPhase === 'open' ? 'mode-menu-shell--open' : ''} ${menuPhase === 'closing' ? 'mode-menu-shell--closing' : ''} ${menuPhase === 'returning' ? 'mode-menu-shell--returning' : ''}`}
          >
            {menuPhase === 'idle' ? (
              <button
                onClick={handleStart}
                aria-label={t('startGame')}
                className="group relative flex h-24 w-24 items-center justify-center rounded-full border border-white/80 bg-slate-950/80 shadow-[0_0_40px_rgba(56,189,248,0.2)] transition-all duration-300 hover:border-sky-400 hover:shadow-[0_0_55px_rgba(56,189,248,0.45)] active:scale-95 sm:h-28 sm:w-28"
              >
                <div className="h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-colors group-hover:bg-sky-400" />
              </button>
            ) : (
              <div className={`mode-menu-content ${menuPhase === 'open' ? 'mode-menu-content--visible' : ''} ${menuPhase === 'closing' || menuPhase === 'returning' ? 'mode-menu-content--hidden' : ''}`}>
                <h2 className="mb-3 text-center text-sm font-semibold tracking-wide text-white">
                  {t('chooseMode')}
                </h2>
                <div className="flex w-full flex-col gap-2">
                  {(['duo', 'zen', 'timed'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleModeSelect(mode)}
                      disabled={menuPhase !== 'open'}
                      className="group flex w-full items-center justify-between rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-3 text-left transition-all hover:border-sky-400/80 hover:bg-slate-800 active:scale-[0.98] disabled:cursor-default"
                    >
                      <span className="text-sm font-semibold text-slate-100">{t(`modes.${mode}`)}</span>
                      <span className="ml-3 text-right text-[10px] text-slate-400">{t(`modeDescriptions.${mode}`)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {menuPhase === 'closing' && (
            <div className="mode-menu-burst" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => (
                <i key={index} style={{ '--particle-angle': `${index * 20}deg`, '--particle-distance': `${45 + (index % 4) * 16}px` } as React.CSSProperties} />
              ))}
            </div>
          )}
          {selectedMode && <span className="sr-only" aria-live="polite">{t(`modes.${selectedMode}`)}</span>}
        </div>

        <div className="flex w-full flex-col items-center gap-2 pb-1 text-center">
          <span className="text-[11px] text-slate-300">{t('tapToScore')}</span>
          <span className="text-[10px] text-slate-500">{menuPhase === 'idle' ? t('tapToStart') : t('chooseMode')}</span>
        </div>
      </div>

    </>
  );
};
