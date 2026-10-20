import React from 'react';
import { RotateCcw, Home, Trophy, Flame, Target } from 'lucide-react';
import { GameMode, GameStats } from '../types/game';
import { useTranslation } from 'react-i18next';
import { playButtonFeedback } from '../utils/uiFeedback';

interface GameOverModalProps {
  stats: GameStats | null;
  mode: GameMode;
  onRestart: () => void;
  onHome: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  mode,
  onRestart,
  onHome,
}) => {
  const { t } = useTranslation();
  if (!stats) return null;

  const isNewHighScore = mode !== 'duo' && stats.score > 0 && stats.score >= stats.highScore;
  const playerScores = stats.playerScores ?? [0, 0];
  const duoWinner = stats.duoWinner
    ?? (playerScores[0] === playerScores[1] ? undefined : playerScores[0] > playerScores[1] ? 1 : 2);
  const duoResult = duoWinner
    ? t('modes.winner', { player: duoWinner })
    : t('modes.draw');
  const totalAccurateHits = stats.perfectHits + stats.greatHits + stats.goodHits;
  const accuracyRate = totalAccurateHits > 0 
    ? Math.round(((stats.perfectHits * 1.0 + stats.greatHits * 0.75 + stats.goodHits * 0.5) / totalAccurateHits) * 100) 
    : 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-sm bg-[#090b10] border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
        
        {/* Game Over Title Badge */}
        <span className="text-[10px] text-rose-400 font-bold uppercase tracking-widest mb-1">
          {t('gameOver')}
        </span>
        <h2 className={`text-xl font-bold tracking-tight mb-2 ${mode === 'duo' && duoWinner ? 'duo-winner-celebration duo-winner-title' : 'text-white'}`}>
          {mode === 'duo' ? duoResult : t('gameOver')}
        </h2>

        {/* Score Display */}
        <div className="my-4 py-3 px-6 rounded-xl bg-slate-900/60 border border-slate-800/80 w-full flex flex-col items-center">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">
            {t('finalScore')}
          </span>
          <span className="text-3xl sm:text-4xl font-black text-white font-mono-numbers">
            {stats.score.toLocaleString()}
          </span>
          {mode === 'duo' && (
            <div className="mt-3 grid grid-cols-2 gap-3 w-full text-xs font-semibold">
              {([0, 1] as const).map((playerIndex) => {
                const player = (playerIndex + 1) as 1 | 2;
                const isWinner = duoWinner === player;
                return (
                  <div
                    key={player}
                    className={`relative flex flex-col items-center gap-1 rounded-lg py-2 ${isWinner ? 'duo-winner-celebration text-amber-300' : playerIndex === 0 ? 'text-sky-300' : 'text-violet-300'}`}
                  >
                    <span>{t(playerIndex === 0 ? 'modes.playerOne' : 'modes.playerTwo')}</span>
                    <span className={`font-mono-numbers text-base font-black ${isWinner ? 'text-amber-200' : ''}`}>
                      {playerScores[playerIndex].toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {isNewHighScore && (
            <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-amber-400 tracking-wider uppercase animate-bounce">
              <Trophy className="w-3.5 h-3.5" />
              {t('newHighScore')}
            </div>
          )}
        </div>

        {/* Detailed Metrics Strip */}
        <div className="grid grid-cols-3 gap-2 w-full mb-6 text-center">
          <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60">
            <span className="text-[9px] text-slate-400 block mb-0.5 uppercase flex items-center justify-center gap-1">
              <Flame className="w-3 h-3 text-orange-400" />
              {t('maxCombo')}
            </span>
            <span className="text-sm font-bold text-slate-200 font-mono-numbers">
              x{stats.maxCombo}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60">
            <span className="text-[9px] text-slate-400 block mb-0.5 uppercase flex items-center justify-center gap-1">
              <Target className="w-3 h-3 text-sky-400" />
              {t('perfect')}
            </span>
            <span className="text-sm font-bold text-sky-400 font-mono-numbers">
              {stats.perfectHits}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60">
            <span className="text-[9px] text-slate-400 block mb-0.5 uppercase flex items-center justify-center gap-1">
              {t('accuracy')}
            </span>
            <span className="text-sm font-bold text-emerald-400 font-mono-numbers">
              {accuracyRate}%
            </span>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="w-full space-y-2.5">
          <button
            onClick={() => {
              playButtonFeedback();
              onRestart();
            }}
            className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer shadow-lg shadow-sky-500/20"
          >
            <RotateCcw className="w-4 h-4" />
            {t('restart')}
          </button>

          <button
            onClick={() => {
              playButtonFeedback();
              onHome();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-medium text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            {t('home')}
          </button>
        </div>

      </div>
    </div>
  );
};
