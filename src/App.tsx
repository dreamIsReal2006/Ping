/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { GameCanvas } from './components/GameCanvas';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { PauseMenu } from './components/PauseMenu';
import { GameOverModal } from './components/GameOverModal';
import { GameMode, GameState, GameStats } from './types/game';
import { soundManager, SoundPack } from './utils/audio';
import { hapticManager, HapticMode } from './utils/haptics';

const readSoundPack = (): SoundPack => {
  const stored = localStorage.getItem('ping_sound_pack');
  return stored === 'crystal' || stored === 'tactile' || stored === 'cyber'
    ? stored
    : 'decompression';
};

const readHapticMode = (): HapticMode => {
  const stored = localStorage.getItem('ping_haptic_mode');
  return stored === 'z_axis_sharp' || stored === 'x_axis_deep' || stored === 'off'
    ? stored
    : 'dual_axis';
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE');
  const titleScreenBackHandlerRef = useRef<(() => boolean) | null>(null);
  const [gameSessionId, setGameSessionId] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>('zen');
  const [playerScores, setPlayerScores] = useState<[number, number]>([0, 0]);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const [score, setScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    return Number(localStorage.getItem('ping_high_score') || 0);
  });
  const [lastGameStats, setLastGameStats] = useState<GameStats | null>(null);
  const [soundPack, setSoundPack] = useState<SoundPack>(readSoundPack);
  const [isMuted, setIsMuted] = useState<boolean>(() => localStorage.getItem('ping_muted') === 'true');
  const [hapticMode, setHapticMode] = useState<HapticMode>(readHapticMode);

  const startNewGame = (mode: GameMode = gameMode) => {
    setScore(0);
    setCombo(0);
    setPlayerScores([0, 0]);
    setRemainingMs(mode === 'timed' ? 120_000 : null);
    setGameMode(mode);
    setGameSessionId((sessionId) => sessionId + 1);
    setGameState('PLAYING');
  };

  useEffect(() => {
    soundManager.setSoundPack(soundPack);
    localStorage.setItem('ping_sound_pack', soundPack);
  }, [soundPack]);

  useEffect(() => {
    soundManager.setMuted(isMuted);
    localStorage.setItem('ping_muted', String(isMuted));
  }, [isMuted]);

  useEffect(() => {
    hapticManager.setMode(hapticMode);
    localStorage.setItem('ping_haptic_mode', hapticMode);
  }, [hapticMode]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let disposed = false;
    let backButtonListener: PluginListenerHandle | undefined;
    let appStateListener: PluginListenerHandle | undefined;
    const handleListenerError = (error: unknown) => {
      console.error('Unable to register native app listener.', error);
    };

    void CapacitorApp.addListener('backButton', () => {
      switch (gameStateRef.current) {
        case 'PLAYING':
          setGameState('PAUSED');
          break;
        case 'PAUSED':
          setGameState('PLAYING');
          break;
        case 'GAME_OVER':
          setGameState('TITLE');
          break;
        case 'TITLE':
          if (titleScreenBackHandlerRef.current?.()) break;
          void CapacitorApp.exitApp().catch(handleListenerError);
          break;
      }
    }).then((listener) => {
      if (disposed) {
        void listener.remove().catch(handleListenerError);
      } else {
        backButtonListener = listener;
      }
    }).catch(handleListenerError);

    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive && gameStateRef.current === 'PLAYING') {
        setGameState('PAUSED');
      }
    }).then((listener) => {
      if (disposed) {
        void listener.remove().catch(handleListenerError);
      } else {
        appStateListener = listener;
      }
    }).catch(handleListenerError);

    return () => {
      disposed = true;
      void backButtonListener?.remove().catch(handleListenerError);
      void appStateListener?.remove().catch(handleListenerError);
    };
  }, []);

  const handleScoreUpdate = useCallback((
    newScore: number,
    newCombo: number,
    nextPlayerScores: [number, number],
    nextRemainingMs: number | null
  ) => {
    setScore(newScore);
    setCombo(newCombo);
    setPlayerScores(nextPlayerScores);
    setRemainingMs(nextRemainingMs);
    if (gameMode === 'duo') return;
    setHighScore((prev) => {
      if (newScore > prev) {
        localStorage.setItem('ping_high_score', newScore.toString());
        return newScore;
      }
      return prev;
    });
  }, [gameMode]);

  const handleGameOver = useCallback((stats: GameStats) => {
    setLastGameStats(stats);
    setGameState('GAME_OVER');
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (gameState === 'GAME_OVER') {
          soundManager.playStart();
          startNewGame(gameMode);
        }
      } else if (e.code === 'Escape') {
        if (gameState === 'PLAYING') {
          setGameState('PAUSED');
        } else if (gameState === 'PAUSED') {
          setGameState('PLAYING');
        } else if (gameState === 'TITLE') {
          titleScreenBackHandlerRef.current?.();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, gameMode]);

  return (
    <div className="w-screen h-dvh bg-[#020204] flex items-center justify-center overflow-hidden font-sans select-none">
      <main className="relative w-full max-w-[440px] h-full sm:max-h-[920px] bg-[#050508] sm:border sm:border-slate-800/80 sm:rounded-[36px] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.9)] flex flex-col">
        <GameCanvas
          gameSessionId={gameSessionId}
          mode={gameMode}
          isPlaying={gameState === 'PLAYING'}
          isPaused={gameState === 'PAUSED'}
          onGameOver={handleGameOver}
          onScoreUpdate={handleScoreUpdate}
        />

        {gameState === 'TITLE' && (
          <TitleScreen
            onStart={startNewGame}
            backHandlerRef={titleScreenBackHandlerRef}
            highScore={highScore}
          />
        )}

        {gameState === 'PLAYING' && (
          <GameHUD
            mode={gameMode}
            score={score}
            combo={combo}
            highScore={highScore}
            playerScores={playerScores}
            remainingMs={remainingMs}
            onPause={() => setGameState('PAUSED')}
          />
        )}

        <PauseMenu
          isOpen={gameState === 'PAUSED'}
          onResume={() => setGameState('PLAYING')}
          onRestart={() => startNewGame()}
          onHome={() => setGameState('TITLE')}
          soundPack={soundPack}
          onSoundPackChange={setSoundPack}
          isMuted={isMuted}
          onMuteToggle={() => setIsMuted((muted) => !muted)}
          hapticMode={hapticMode}
          onHapticModeChange={setHapticMode}
          currentScore={score}
        />

        {gameState === 'GAME_OVER' && (
          <GameOverModal
            stats={lastGameStats}
            mode={gameMode}
            onRestart={() => {
              soundManager.playStart();
              startNewGame();
            }}
            onHome={() => setGameState('TITLE')}
          />
        )}

      </main>
    </div>
  );
}
