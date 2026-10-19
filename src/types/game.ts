export type GameState = 'TITLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';
export type GameMode = 'duo' | 'zen' | 'timed';

export interface CircleTarget {
  id: number;
  x: number; // in pixels
  y: number; // in pixels
  innerRadius: number;
  currentOuterRadius: number;
  initialOuterRadius: number;
  duration: number; // ms to reach inner circle
  spawnTime: number; // performance.now()
  totalRings: number; // Number of concentric rings the player must clear.
  ringsRemaining: number;
  color: string;
  accentColor: string;
  type: 'standard' | 'double_ring' | 'golden_boost';
  pulsePhase: number;
  lane: 0 | 1;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  maxLife: number;
  life: number;
  decay: number;
  shape: 'spark' | 'shatter' | 'ring' | 'glow';
  angle?: number;
  rotSpeed?: number;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
  lineWidth: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  subtext?: string;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  pulseSpeed: number;
  pulsePhase: number;
}

export interface GameStats {
  score: number;
  highScore: number;
  combo: number;
  maxCombo: number;
  perfectHits: number;
  greatHits: number;
  goodHits: number;
  totalClicks: number;
  gameDurationSec: number;
  playerScores?: [number, number];
}
