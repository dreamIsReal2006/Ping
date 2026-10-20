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
  const [playerLives, setPlayerLives] = useState<[number, number]>([3, 3]);
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
    if (!Capacitor.isNativePlatform()) return;
    soundManager.startGameMusic();
    setScore(0);
    setCombo(0);
    setPlayerScores([0, 0]);
    setPlayerLives([3, 3]);
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
    if (!Capacitor.isNativePlatform()) return;
    switch (gameState) {
      case 'TITLE':
        soundManager.startMusic();
        break;
      case 'PLAYING':
        soundManager.startGameMusic();
        break;
      case 'PAUSED':
        soundManager.stopMusic();
        break;
      case 'GAME_OVER':
        soundManager.playGameOver();
        break;
    }
  }, [gameState]);

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
      if (!isActive) {
        soundManager.stopMusic();
        if (gameStateRef.current === 'PLAYING') setGameState('PAUSED');
      } else {
        if (gameStateRef.current === 'TITLE') soundManager.startMusic();
        if (gameStateRef.current === 'PLAYING') soundManager.startGameMusic();
      }
    }).then((listener) => {
      if (disposed) {
        void listener.remove().catch(handleListenerError);
      } else {
        appStateListener = listener;
      }
    }).catch(handleListenerError);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        soundManager.stopMusic();
        if (gameStateRef.current === 'PLAYING') setGameState('PAUSED');
      } else {
        if (gameStateRef.current === 'TITLE') soundManager.startMusic();
        if (gameStateRef.current === 'PLAYING') soundManager.startGameMusic();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      void backButtonListener?.remove().catch(handleListenerError);
      void appStateListener?.remove().catch(handleListenerError);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      soundManager.stopMusic();
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

  if (!Capacitor.isNativePlatform()) {
    return (
      <div className="min-h-dvh bg-[#050508] px-6 flex items-center justify-center text-center font-sans text-slate-200">
        <main className="max-w-md">
          <h1 className="text-2xl font-bold tracking-widest text-white">PING</h1>
          <p className="mt-4">The game is available in the Android app and cannot be played in a web browser.</p>
          <p className="mt-3 text-slate-400">游戏仅能在 Android 应用中游玩，网页版本不提供游戏功能。</p>
          <a className="mt-6 inline-block text-sky-400 underline" href="/privacy-policy.html">
            Privacy Policy / 隐私政策
          </a>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-screen items-center justify-center overflow-hidden bg-[#020204] font-sans select-none">
      <main className="relative flex h-full w-full max-w-[1440px] flex-col overflow-hidden bg-[#050508] shadow-[0_0_80px_rgba(0,0,0,0.9)]">
        <GameCanvas
          gameSessionId={gameSessionId}
          mode={gameMode}
          isHomeScreen={gameState === 'TITLE'}
          isPlaying={gameState === 'PLAYING'}
          isPaused={gameState === 'PAUSED'}
          onGameOver={handleGameOver}
          onScoreUpdate={handleScoreUpdate}
          onLivesUpdate={setPlayerLives}
        />

        {gameState === 'TITLE' && (
          <TitleScreen
            onStart={startNewGame}
            backHandlerRef={titleScreenBackHandlerRef}
            highScore={highScore}
            soundPack={soundPack}
            onSoundPackChange={setSoundPack}
            isMuted={isMuted}
            onMuteToggle={() => setIsMuted((muted) => !muted)}
            hapticMode={hapticMode}
            onHapticModeChange={setHapticMode}
          />
        )}

        {gameState === 'PLAYING' && (
          <GameHUD
            mode={gameMode}
            score={score}
            combo={combo}
            highScore={highScore}
            playerScores={playerScores}
            playerLives={playerLives}
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
              startNewGame();
            }}
            onHome={() => setGameState('TITLE')}
          />
        )}

      </main>
    </div>
  );
}
