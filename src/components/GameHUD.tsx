import React, { useEffect, useRef, useState } from 'react';
import { Heart, Pause } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GameMode } from '../types/game';
import { playButtonFeedback } from '../utils/uiFeedback';

interface GameHUDProps {
  mode: GameMode;
  score: number;
  combo: number;
  highScore: number;
  playerScores: [number, number];
  playerLives: [number, number];
  remainingMs: number | null;
  onPause: () => void;
}

interface ScoreMilestone {
  id: number;
  value: number;
}

const ScoreValue: React.FC<{ score: number; player?: 1 | 2 }> = ({ score, player }) => {
  const previousScoreRef = useRef(score);
  const milestoneIdRef = useRef(0);
  const pendingMilestonesRef = useRef<number[]>([]);
  const [milestone, setMilestone] = useState<ScoreMilestone | null>(null);

  useEffect(() => {
    const previousScore = previousScoreRef.current;
    previousScoreRef.current = score;
    if (score <= previousScore) return;

    let threshold = 100;
    const reached: number[] = [];
    while (threshold <= score) {
      if (threshold > previousScore) reached.push(threshold);
      threshold *= 10;
    }
    if (reached.length > 0) {
      if (milestone) {
      pendingMilestonesRef.current.push(...reached);
      } else {
      const [first, ...remaining] = reached;
      pendingMilestonesRef.current.push(...remaining);
      milestoneIdRef.current += 1;
      setMilestone({ id: milestoneIdRef.current, value: first });
      }
    }
  }, [milestone, score]);

  useEffect(() => {
    if (!milestone) return;
    const timeout = window.setTimeout(() => {
      const next = pendingMilestonesRef.current.shift();
      if (next === undefined) {
      setMilestone(null);
      return;
      }
      milestoneIdRef.current += 1;
      setMilestone({ id: milestoneIdRef.current, value: next });
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [milestone]);

  return (
    <span
      aria-label={`${player ? `Player ${player}, ` : ''}${score.toLocaleString()}`}
      className={`score-value font-mono-numbers text-2xl font-extrabold tracking-tight text-white drop-shadow-md sm:text-3xl${milestone ? ' score-value--celebrating' : ''}`}
    >
      <span key={milestone?.id ?? 'score'} className="score-value-number">
        {score.toLocaleString()}
      </span>
      {milestone && (
        <span key={`burst-${milestone.id}`} className="score-milestone-burst" aria-hidden="true">
          <span className="score-milestone-label">+{milestone.value.toLocaleString()}</span>
          {Array.from({ length: 12 }, (_, index) => (
            <i
              key={index}
              style={{ '--particle-angle': `${index * 30}deg` } as React.CSSProperties}
            />
          ))}
        </span>
      )}
    </span>
  );
};

export const GameHUD: React.FC<GameHUDProps> = ({
  mode,
  score,
  combo,
  highScore,
  playerScores,
  playerLives,
  remainingMs,
  onPause,
}) => {
  const { t } = useTranslation();
  const remainingSeconds = remainingMs === null ? null : Math.ceil(remainingMs / 1000);
  const formattedTime = remainingSeconds === null
    ? null
    : `${Math.floor(remainingSeconds / 60).toString().padStart(2, '0')}:${(remainingSeconds % 60).toString().padStart(2, '0')}`;

  const pauseButton = (
    <button
      onClick={() => {
        playButtonFeedback();
        onPause();
      }}
      className="pointer-events-auto rounded-full border border-slate-800/80 bg-slate-900/70 p-2.5 text-slate-300 shadow-sm backdrop-blur-xs transition-all hover:bg-slate-800 hover:text-white active:scale-90"
      title={t('pause')}
      aria-label={t('pause')}
    >
      <Pause className="h-4 w-4" />
    </button>
  );

  if (mode === 'duo') {
    return (
      <div className="pointer-events-none absolute inset-0 z-20 select-none">
        <div className="duo-player-one absolute inset-x-4 top-1/2 flex -translate-y-full rotate-180 items-start justify-between sm:inset-x-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-sky-300 sm:text-xs">
              {t('modes.playerOne')}
            </span>
            <ScoreValue score={playerScores[0]} player={1} />
          </div>
        </div>

        <div className="duo-player-two absolute inset-x-4 top-[calc(50%+0.75rem)] flex items-start justify-between sm:inset-x-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-violet-300 sm:text-xs">
              {t('modes.playerTwo')}
            </span>
            <ScoreValue score={playerScores[1]} player={2} />
          </div>
        </div>

        <div className="duo-lives duo-lives-one absolute flex items-center gap-1" role="img" aria-label={t('duoLives', { count: playerLives[0] })}>
          {[0, 1, 2].map((index) => (
            <Heart
              key={index}
              className={`h-4 w-4 transition-colors ${index < playerLives[0] ? 'fill-white text-white' : 'fill-transparent text-white/45'}`}
            />
          ))}
        </div>
        <div className="duo-lives duo-lives-two absolute flex items-center gap-1" role="img" aria-label={t('duoLives', { count: playerLives[1] })}>
          {[0, 1, 2].map((index) => (
            <Heart
              key={index}
              className={`h-4 w-4 transition-colors ${index < playerLives[1] ? 'fill-white text-white' : 'fill-transparent text-white/45'}`}
            />
          ))}
        </div>

        <button
          onClick={() => {
            playButtonFeedback();
            onPause();
          }}
          className="pointer-events-auto absolute left-1/2 top-1/2 z-30 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-600 bg-slate-950 text-slate-100 shadow-lg shadow-black/50 transition-all hover:border-sky-400 hover:text-white active:scale-90"
          title={t('pause')}
          aria-label={t('pause')}
        >
          <Pause className="h-5 w-5" />
        </button>

        <div className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] flex -translate-x-1/2 flex-col items-center">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
            {t('modes.duo')}
          </span>
          {combo > 1 && (
            <span className="mt-1 text-sm font-black text-sky-300 font-mono-numbers">
              x{combo}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex select-none flex-col justify-between px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-6 sm:pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <div className="mx-auto flex w-full max-w-5xl items-start justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 sm:text-xs">
            {t('score')}
          </span>
          <ScoreValue score={score} />
          {highScore > 0 && (
            <span className="font-mono-numbers text-[10px] text-slate-400">
              {t('best')} {Math.max(score, highScore).toLocaleString()}
            </span>
          )}
        </div>

        <div className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] flex -translate-x-1/2 flex-col items-center text-center">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
            {t(`modes.${mode}`)}
          </span>
          {formattedTime && (
            <span className={`font-mono-numbers text-lg font-black ${remainingMs !== null && remainingMs <= 10_000 ? 'animate-pulse text-rose-400' : 'text-white'}`}>
              {formattedTime}
            </span>
          )}
          {combo > 1 && (
            <div className="flex flex-col items-center animate-in fade-in zoom-in-90 duration-150">
              <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400">
                {t('combo')}
              </span>
              <span className="bg-gradient-to-r from-sky-400 via-indigo-300 to-pink-400 bg-clip-text text-xl font-black text-transparent font-mono-numbers sm:text-2xl">
                x{combo}
              </span>
              {combo >= 10 && (
                <span className="animate-pulse text-[9px] font-semibold uppercase tracking-wider text-amber-300">
                  {t('flowState')}
                </span>
              )}
            </div>
          )}
        </div>

        {pauseButton}
      </div>

      <div className="w-full pb-2 text-center">
        <span className="text-[10px] tracking-wider text-slate-400">{t('playHint')}</span>
      </div>
    </div>
  );
};
