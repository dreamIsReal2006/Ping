import React, { useEffect, useState } from 'react';
import { CircleHelp, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { soundManager, type SoundPack } from '../utils/audio';
import { playButtonFeedback } from '../utils/uiFeedback';
import type { GameMode } from '../types/game';
import type { HapticMode } from '../utils/haptics';
import { HomePanels } from './HomePanels';

interface TitleScreenProps {
  onStart: (mode: GameMode) => void;
  backHandlerRef: React.MutableRefObject<(() => boolean) | null>;
  highScore: number;
  soundPack: SoundPack;
  onSoundPackChange: (pack: SoundPack) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
  hapticMode: HapticMode;
  onHapticModeChange: (mode: HapticMode) => void;
}

type MenuPhase = 'idle' | 'opening' | 'open' | 'closing' | 'returning';
const HOME_TIP_KEYS = ['homeTipTiming', 'homeTipFaster', 'homeTipCombo'] as const;

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  backHandlerRef,
  highScore,
  soundPack,
  onSoundPackChange,
  isMuted,
  onMuteToggle,
  hapticMode,
  onHapticModeChange,
}) => {
  const { t } = useTranslation();
  const [menuPhase, setMenuPhase] = useState<MenuPhase>('idle');
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [openPanel, setOpenPanel] = useState<'tutorial' | 'settings' | null>(null);
  const [homeTipIndex, setHomeTipIndex] = useState(0);

  useEffect(() => {
    if (menuPhase !== 'opening' && menuPhase !== 'returning') return;
    const timeout = window.setTimeout(
      () => setMenuPhase(menuPhase === 'opening' ? 'open' : 'idle'),
      420
    );
    return () => window.clearTimeout(timeout);
  }, [menuPhase]);

  useEffect(() => {
    if (menuPhase !== 'idle') return;
    const interval = window.setInterval(() => {
      setHomeTipIndex((index) => (index + 1) % HOME_TIP_KEYS.length);
    }, 2800);
    return () => window.clearInterval(interval);
  }, [menuPhase]);

  const handleMenuBack = React.useCallback(() => {
    if (openPanel) {
      setOpenPanel(null);
      return true;
    }
    if (menuPhase !== 'opening' && menuPhase !== 'open') return false;
    setSelectedMode(null);
    setMenuPhase('returning');
    return true;
  }, [menuPhase, openPanel]);

  useEffect(() => {
    backHandlerRef.current = openPanel || menuPhase === 'opening' || menuPhase === 'open'
      ? handleMenuBack
      : null;
    return () => {
      backHandlerRef.current = null;
    };
  }, [backHandlerRef, handleMenuBack, menuPhase, openPanel]);

  const handleStart = () => {
    if (menuPhase !== 'idle') return;
    soundManager.startMusic();
    playButtonFeedback();
    setMenuPhase('opening');
  };

  const handleModeSelect = (mode: GameMode) => {
    if (menuPhase !== 'open') return;
    setSelectedMode(mode);
    setMenuPhase('closing');
    soundManager.startGameMusic();
    playButtonFeedback();
    window.setTimeout(() => onStart(mode), 500);
  };

  const openHomePanel = (panel: 'tutorial' | 'settings') => {
    playButtonFeedback();
    setOpenPanel(panel);
  };

  return (
    <>
      <div className="relative z-10 flex h-full w-full flex-col items-center px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+5rem)] select-none landscape:pb-[calc(env(safe-area-inset-bottom)+3.5rem)]">
        <header className="w-full shrink-0 pt-2 text-center">
          <h1 className="text-sm font-semibold tracking-[0.35em] text-slate-200">PING</h1>
          <span className="mt-1 block text-[10px] tracking-[0.18em] text-slate-500">{t('tagline')}</span>
        </header>

        <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-2">
          <div className="flex shrink-0 flex-col items-center text-center">
            <span className="mb-1 text-[11px] font-medium tracking-[0.25em] uppercase text-slate-500">
              {t('best')}
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-300 font-mono-numbers">
              {highScore.toLocaleString()}
            </span>
          </div>

          <div className="relative flex max-h-full items-center justify-center">
            <div className="pointer-events-none absolute h-36 w-36 rounded-full border border-sky-400/35 animate-ripple" />
            <div className="pointer-events-none absolute h-36 w-36 rounded-full border border-sky-400/20 animate-ripple-delay" />
            <div
              className={`mode-menu-shell ${menuPhase === 'opening' ? 'mode-menu-shell--opening' : ''} ${menuPhase === 'open' ? 'mode-menu-shell--open' : ''} ${menuPhase === 'closing' ? 'mode-menu-shell--closing' : ''} ${menuPhase === 'returning' ? 'mode-menu-shell--returning' : ''}`}
            >
              {menuPhase === 'idle' ? (
                <button
                  type="button"
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
                        className="group flex w-full items-center justify-between rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-3 text-left transition-all hover:border-sky-400/80 hover:bg-slate-800 active:scale-[0.98] disabled:cursor-default landscape:py-2"
                      >
                        <span className="text-sm font-semibold text-slate-100">{t(`modes.${mode}`)}</span>
                        <span className="ml-3 text-right text-[10px] text-slate-400">{t(`modeDescriptions.${mode}`)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {selectedMode && <span className="sr-only" aria-live="polite">{t(`modes.${selectedMode}`)}</span>}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-6 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-20 grid grid-cols-[3rem_1fr_3rem] items-center">
          <button
            type="button"
            onClick={() => openHomePanel('tutorial')}
            aria-label={t('help')}
            title={t('help')}
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 text-slate-300 shadow-lg transition-all hover:border-sky-400 hover:text-white active:scale-90"
          >
            <CircleHelp className="h-6 w-6" />
          </button>
          <div className={`px-3 text-center transition-opacity ${menuPhase === 'idle' ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
            <span
              key={HOME_TIP_KEYS[homeTipIndex]}
              aria-live="polite"
              className="home-tip-slide block text-xs font-medium tracking-wide text-sky-100"
            >
              {t(HOME_TIP_KEYS[homeTipIndex])}
            </span>
            <span className="mt-0.5 block text-[10px] text-slate-400">{t('tapToStart')}</span>
          </div>
          <button
            type="button"
            onClick={() => openHomePanel('settings')}
            aria-label={t('settingsTitle')}
            title={t('settingsTitle')}
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 text-slate-300 shadow-lg transition-all hover:border-sky-400 hover:text-white active:scale-90"
          >
            <Settings2 className="h-6 w-6" />
          </button>
        </div>
      </div>
      <HomePanels
        panel={openPanel}
        onClose={() => setOpenPanel(null)}
        soundPack={soundPack}
        onSoundPackChange={onSoundPackChange}
        isMuted={isMuted}
        onMuteToggle={onMuteToggle}
        hapticMode={hapticMode}
        onHapticModeChange={onHapticModeChange}
      />
    </>
  );
};
