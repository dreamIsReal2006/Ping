import React from 'react';
import { Play, RotateCcw, Home, Volume2, VolumeX, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { soundManager, SoundPack } from '../utils/audio';
import { hapticManager, HapticMode } from '../utils/haptics';

interface PauseMenuProps {
  isOpen: boolean;
  onResume: () => void;
  onRestart: () => void;
  onHome: () => void;
  soundPack: SoundPack;
  onSoundPackChange: (pack: SoundPack) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
  hapticMode: HapticMode;
  onHapticModeChange: (mode: HapticMode) => void;
  currentScore: number;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  isOpen,
  onResume,
  onRestart,
  onHome,
  soundPack,
  onSoundPackChange,
  isMuted,
  onMuteToggle,
  hapticMode,
  onHapticModeChange,
  currentScore,
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] bg-black/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-sm bg-[#090b10] border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
        
        {/* Title */}
        <span className="text-[10px] text-sky-400 font-bold uppercase tracking-widest mb-1">
          {t('gamePaused')}
        </span>
        <h2 className="text-xl font-bold text-white tracking-tight mb-2">
          {t('gamePaused')}
        </h2>
        <div className="text-xs text-slate-400 mb-6 font-mono-numbers">
          {t('currentScore', { score: currentScore.toLocaleString() })}
        </div>

        {/* Primary Action Buttons */}
        <div className="w-full space-y-2.5 mb-6">
          <button
            onClick={onResume}
            className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer shadow-lg shadow-sky-500/20"
          >
            <Play className="w-4 h-4 fill-white" />
            {t('resume')}
          </button>

          <button
            onClick={onRestart}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white font-medium text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t('restart')}
          </button>

          <button
            onClick={onHome}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/60 text-slate-400 hover:text-slate-200 font-medium text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            {t('home')}
          </button>
        </div>

        {/* In-game Settings Panel */}
        <div className="w-full pt-4 border-t border-slate-800/80 space-y-3 text-left">
          
          {/* Sound Pack Setting */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
              {t('sound')}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={onMuteToggle}
                aria-label={t('muteSound')}
                aria-pressed={isMuted}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-sky-400" />}
              </button>
              <select
                value={soundPack}
                aria-label={t('sound')}
                onChange={(e) => {
                  const pack = e.target.value as SoundPack;
                  onSoundPackChange(pack);
                  soundManager.setSoundPack(pack);
                  soundManager.playHit(0, 'PERFECT');
                }}
                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                <option value="decompression">{t('soundBubble')}</option>
                <option value="crystal">{t('soundCrystal')}</option>
                <option value="tactile">{t('soundTactile')}</option>
                <option value="cyber">{t('soundCyber')}</option>
              </select>
            </div>
          </div>

          {/* Haptic Mode Setting */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
              {t('vibration')}
            </span>
            <select
              value={hapticMode}
              aria-label={t('vibration')}
              onChange={(e) => {
                const mode = e.target.value as HapticMode;
                onHapticModeChange(mode);
                hapticManager.setMode(mode);
                hapticManager.testVibration(mode);
              }}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="dual_axis">{t('vibrationDual')}</option>
              <option value="z_axis_sharp">{t('vibrationSharp')}</option>
              <option value="x_axis_deep">{t('vibrationDeep')}</option>
              <option value="off">{t('vibrationOff')}</option>
            </select>
          </div>

        </div>

      </div>
    </div>
  );
};
