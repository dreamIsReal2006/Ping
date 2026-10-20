import React, { useEffect, useRef, useState } from 'react';
import { MousePointer2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HapticMode } from '../utils/haptics';
import { hapticManager } from '../utils/haptics';
import type { SoundPack } from '../utils/audio';
import { soundManager } from '../utils/audio';
import { playButtonFeedback } from '../utils/uiFeedback';

interface HomePanelsProps {
  panel: 'tutorial' | 'settings' | null;
  onClose: () => void;
  soundPack: SoundPack;
  onSoundPackChange: (pack: SoundPack) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
  hapticMode: HapticMode;
  onHapticModeChange: (mode: HapticMode) => void;
}

const TutorialVisual: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div
      role="img"
      aria-label={t('tutorial.demoCaption')}
      className="tutorial-demo relative mx-auto flex aspect-[16/9] w-full max-w-md items-center justify-center overflow-hidden rounded-2xl border border-sky-400/20 bg-[#050912]"
    >
      <div className="absolute h-36 w-36 rounded-full border border-sky-400/10" />
      <div className="absolute h-24 w-24 rounded-full border border-sky-400/15" />
      <div className="tutorial-demo-ring absolute h-36 w-36 rounded-full border-2 border-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.4)]" />
      <div className="absolute h-14 w-14 rounded-full border border-slate-200 bg-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.2)]" />
      <div className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_12px_white]" />
      <MousePointer2 className="tutorial-demo-pointer absolute left-[calc(50%+32px)] top-[calc(50%+25px)] h-8 w-8 fill-sky-400 text-white drop-shadow-lg" />
      <span className="absolute bottom-3 left-0 right-0 text-center text-xs font-medium tracking-wide text-sky-100">
        {t('tutorial.demoCaption')}
      </span>
    </div>
  );
};

export const HomePanels: React.FC<HomePanelsProps> = ({
  panel,
  onClose,
  soundPack,
  onSoundPackChange,
  isMuted,
  onMuteToggle,
  hapticMode,
  onHapticModeChange,
}) => {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setClosing(false);
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, [panel]);

  if (!panel) return null;

  const closePanel = () => {
    if (closing) return;
    playButtonFeedback();
    setClosing(true);
    closeTimerRef.current = window.setTimeout(onClose, 360);
  };

  return (
    <div
      className={`home-panel-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 px-5 py-6 backdrop-blur-md ${closing ? 'home-panel-backdrop--closing' : ''}`}
      onClick={closePanel}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-panel-title"
        className={`home-panel-shell w-full max-w-xl rounded-[28px] border border-sky-400/35 bg-slate-950/85 p-5 text-slate-200 shadow-[0_0_55px_rgba(56,189,248,0.2)] backdrop-blur-xl sm:p-7 ${closing ? 'home-panel-shell--closing' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="home-panel-title" className="text-lg font-bold text-white">
            {panel === 'tutorial' ? t('tutorial.title') : t('settingsTitle')}
          </h2>
          <button
            type="button"
            onClick={closePanel}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {panel === 'tutorial' ? (
          <div className="grid gap-5 landscape:grid-cols-2 landscape:items-center">
            <TutorialVisual />
            <ol className="space-y-3 text-sm leading-relaxed">
              {([1, 2, 3, 4] as const).map((step) => (
                <li key={step}>
                  <strong className="mb-0.5 block text-sky-300">
                    {t(`tutorial.step${step}Title`)}
                  </strong>
                  {t(`tutorial.step${step}`)}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>{t('sound')}</span>
              <select
                value={soundPack}
                onChange={(event) => {
                  onSoundPackChange(event.target.value as SoundPack);
                  playButtonFeedback();
                }}
                className="max-w-48 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              >
                <option value="decompression">{t('soundBubble')}</option>
                <option value="crystal">{t('soundCrystal')}</option>
                <option value="tactile">{t('soundTactile')}</option>
                <option value="cyber">{t('soundCyber')}</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>{t('muteSound')}</span>
              <input
                type="checkbox"
                checked={isMuted}
                onChange={() => {
                  if (isMuted) {
                    onMuteToggle();
                    window.setTimeout(() => playButtonFeedback(), 0);
                  } else {
                    playButtonFeedback();
                    onMuteToggle();
                  }
                }}
                className="h-5 w-5 accent-sky-500"
              />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>{t('vibration')}</span>
              <select
                value={hapticMode}
                onChange={(event) => {
                  const mode = event.target.value as HapticMode;
                  onHapticModeChange(mode);
                  hapticManager.setMode(mode);
                  hapticManager.testVibration(mode);
                  soundManager.playButton();
                }}
                className="max-w-48 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              >
                <option value="dual_axis">{t('vibrationDual')}</option>
                <option value="z_axis_sharp">{t('vibrationSharp')}</option>
                <option value="x_axis_deep">{t('vibrationDeep')}</option>
                <option value="off">{t('vibrationOff')}</option>
              </select>
            </label>
          </div>
        )}

        <button
          type="button"
          onClick={closePanel}
          className="mt-6 w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
        >
          {t('close')}
        </button>
      </section>
    </div>
  );
};
