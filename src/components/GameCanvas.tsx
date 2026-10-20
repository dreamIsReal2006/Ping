import React, { useEffect, useRef, useCallback } from 'react';
import { CircleTarget, Particle, Shockwave, FloatingText, AmbientParticle, GameMode, GameStats } from '../types/game';
import { soundManager } from '../utils/audio';
import { hapticManager } from '../utils/haptics';
import i18n from '../i18n';

interface GameCanvasProps {
  gameSessionId: number;
  mode: GameMode;
  isPlaying: boolean;
  isPaused: boolean;
  onGameOver: (stats: GameStats) => void;
  onScoreUpdate: (score: number, combo: number, playerScores: [number, number], remainingMs: number | null) => void;
  onLivesUpdate: (playerLives: [number, number]) => void;
}

interface GeometryChallenge {
  x: number;
  y: number;
  radius: number;
  points: Array<{ x: number; y: number }>;
  nextPointIndex: number;
  cursor: { x: number; y: number } | null;
  pointerId: number | null;
  timeRemainingMs: number;
}

const GEOMETRY_CHALLENGE_CHANCE = 1 / 8;
const GEOMETRY_CHALLENGE_DURATION_MS = 12000;
const GEOMETRY_POINT_HIT_RADIUS = 32;
const GEOMETRY_PATH_TOLERANCE = 42;
const MAX_CONCURRENT_MULTI_RING_TARGETS = 3;
const MAX_PARTICLES = 140;
const MAX_SHOCKWAVES = 24;
const MAX_FLOATING_TEXTS = 20;

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameSessionId,
  mode,
  isPlaying,
  isPaused,
  onGameOver,
  onScoreUpdate,
  onLivesUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Gameplay State Refs (persisting across requestAnimationFrame without React re-render lag)
  const targetsRef = useRef<CircleTarget[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const ambientParticlesRef = useRef<AmbientParticle[]>([]);
  const geometryChallengeRef = useRef<GeometryChallenge | null>(null);
  
  const nextTargetIdRef = useRef<number>(1);
  const nextTextIdRef = useRef<number>(1);

  const scoreRef = useRef<number>(0);
  const comboRef = useRef<number>(0);
  const playerScoresRef = useRef<[number, number]>([0, 0]);
  const playerCombosRef = useRef<[number, number]>([0, 0]);
  const playerLivesRef = useRef<[number, number]>([3, 3]);
  const gameOverTriggeredRef = useRef(false);
  const remainingMsRef = useRef<number | null>(null);
  const lastTimerReportRef = useRef(0);
  const maxComboRef = useRef<number>(0);
  const perfectHitsRef = useRef<number>(0);
  const greatHitsRef = useRef<number>(0);
  const goodHitsRef = useRef<number>(0);
  const totalClicksRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  // Screen shake
  const shakeIntensityRef = useRef<number>(0);

  // Background random burst timer
  const lastRandomBurstRef = useRef<number>(0);

  // Target spawning controller
  const lastSpawnTimeRef = useRef<number>(0);
  const pauseStartedAtRef = useRef<number | null>(null);
  const geometryChallengeSeenRef = useRef(false);

  // Setup Haptic visual shake callback
  useEffect(() => {
    hapticManager.setVisualShakeCallback((intensity: number) => {
      shakeIntensityRef.current = Math.max(shakeIntensityRef.current, intensity);
    });
    return () => {
      hapticManager.setVisualShakeCallback(null);
    };
  }, []);

  // Initialize ambient background particles
  const initAmbientParticles = useCallback((width: number, height: number) => {
    const list: AmbientParticle[] = [];
    const count = Math.min(Math.floor((width * height) / 22000), 36);
    for (let i = 0; i < count; i++) {
      list.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.45 + 0.1,
        pulseSpeed: Math.random() * 0.02 + 0.01,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    ambientParticlesRef.current = list;
  }, []);

  const successfulHitsRef = useRef<number>(0);

  // Concentric rings unlock gradually; newly unlocked counts remain mixed with earlier ones.
  const getMaxOuterRings = (hitCount: number) => {
    if (hitCount >= 25) return 4;
    if (hitCount >= 10) return 3;
    if (hitCount >= 8) return 2;
    return 1;
  };

  // Increase the number of simultaneous targets separately from concentric rings.
  const getDifficulty = (hitCount: number) => {
    let duration: number;
    if (mode === 'duo') {
      const stage = hitCount <= 5 ? 0
        : hitCount <= 10 ? 1
        : hitCount <= 20 ? 2
        : hitCount <= 30 ? 3
        : hitCount <= 50 ? 4
        : hitCount <= 75 ? 5
        : hitCount <= 100 ? 6
        : hitCount <= 115 ? 7
        : hitCount <= 130 ? 8
        : 8 + Math.ceil((hitCount - 130) / 15);
      duration = Math.max(500, 3200 - stage * 230);
    } else {
      duration = mode === 'zen'
        ? Math.max(700, 3200 - hitCount * 38)
        : Math.max(1350, 3200 - hitCount * 24);
    }

    let maxConcurrent = mode === 'duo' ? 2 : 1;
    if (hitCount >= 45) {
      maxConcurrent = 4;
    } else if (hitCount >= 22) {
      maxConcurrent = 3;
    } else if (hitCount >= 8) {
      maxConcurrent = 2;
    }

    return { duration, maxConcurrent };
  };

  const spawnGeometryChallenge = (width: number, height: number): GeometryChallenge | null => {
    const landscape = width > height;
    const radius = landscape ? Math.min(height * 0.22, 72) : Math.min(width * 0.23, 100);
    const safeTop = (landscape ? 42 : 115) + radius;
    const safeBottom = height - (landscape ? 42 : 100) - radius;
    const safeLeft = 55 + radius;
    const safeRight = width - 55 - radius;
    if (safeRight <= safeLeft || safeBottom <= safeTop) return null;

    const vertexCount = 3 + Math.floor(Math.random() * 3);
    const direction = Math.random() < 0.5 ? 1 : -1;
    const startAngle = -Math.PI / 2;
    const points = Array.from({ length: vertexCount }, (_, index) => {
      const angle = startAngle + direction * (index * Math.PI * 2) / vertexCount;
      const pointRadius = radius * 0.68;
      return {
        x: Math.cos(angle) * pointRadius,
        y: Math.sin(angle) * pointRadius,
      };
    });
    const x = safeLeft + Math.random() * (safeRight - safeLeft);
    const y = safeTop + Math.random() * (safeBottom - safeTop);

    return {
      x,
      y,
      radius,
      points: points.map((point) => ({ x: x + point.x, y: y + point.y })),
      nextPointIndex: 1,
      cursor: null,
      pointerId: null,
      timeRemainingMs: GEOMETRY_CHALLENGE_DURATION_MS,
    };
  };

  const distanceToSegment = (
    point: { x: number; y: number },
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
    const projection = Math.max(0, Math.min(1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    ));
    return Math.hypot(
      point.x - (start.x + projection * dx),
      point.y - (start.y + projection * dy)
    );
  };

  const completeGeometryChallenge = (challenge: GeometryChallenge) => {
    geometryChallengeRef.current = null;
    const scoreGained = 1200;
    scoreRef.current += scoreGained;
    comboRef.current++;
    playerScoresRef.current[0] += scoreGained;
    playerCombosRef.current[0]++;
    maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
    successfulHitsRef.current++;
    onScoreUpdateRef.current(scoreRef.current, comboRef.current, [...playerScoresRef.current], remainingMsRef.current);

    soundManager.playHit(comboRef.current, 'PERFECT');
    hapticManager.triggerHit('PERFECT');
    createExplosion(challenge.x, challenge.y, '#C084FC', 4.5);
    createExplosion(challenge.x, challenge.y, '#38BDF8', 3.2);
    createExplosion(challenge.x, challenge.y, '#FDE68A', 2.2);
    addFloatingText(
      challenge.x,
      challenge.y,
      i18n.t('game.geometryComplete'),
      '#E9D5FF',
      `+${scoreGained}`
    );
    lastSpawnTimeRef.current = performance.now();
  };

  // Helper to spawn a new circle target with safe collision separation
  const spawnCircle = (
    width: number,
    height: number,
    customDuration?: number,
    lane: 0 | 1 = 0
  ) => {
    const { duration } = getDifficulty(successfulHitsRef.current);
    const maxOuterRings = getMaxOuterRings(successfulHitsRef.current);
    const targetDuration = customDuration || duration;

    // Keep targets touch-friendly on both landscape phones and larger tablets.
    const innerRadius = Math.min(Math.max(width * 0.08, 32), 38);
    const initialOuterRadius = innerRadius * 3.1;

    const landscape = width > height;
    const horizontalDuo = mode === 'duo' && landscape;
    const laneTop = mode === 'duo' && !landscape ? lane * height / 2 : 0;
    const laneBottom = mode === 'duo' && !landscape ? (lane + 1) * height / 2 : height;
    const laneLeft = horizontalDuo ? lane * width / 2 : 0;
    const laneRight = horizontalDuo ? (lane + 1) * width / 2 : width;
    const safeTop = landscape
      ? horizontalDuo ? 38 : 62
      : mode === 'duo' ? laneTop + (lane === 0 ? 82 : 36) : 82;
    const safeBottom = landscape
      ? height - (horizontalDuo ? 38 : 54)
      : mode === 'duo' ? laneBottom - 42 : height - 72;
    const safeLeft = horizontalDuo ? laneLeft + 54 : 55;
    const safeRight = horizontalDuo ? laneRight - 54 : width - 55;

    if (safeRight <= safeLeft || safeBottom <= safeTop) return null;

    let x = 0;
    let y = 0;
    let validPosition = false;
    let attempts = 0;

    while (!validPosition && attempts < 25) {
      attempts++;
      x = safeLeft + Math.random() * (safeRight - safeLeft);
      y = safeTop + Math.random() * (safeBottom - safeTop);

      // Check distance from existing targets to prevent overlapping
      let overlap = false;
      for (const t of targetsRef.current) {
        if (t.lane !== lane) continue;
        const dx = t.x - x;
        const dy = t.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < initialOuterRadius * 1.35) {
          overlap = true;
          break;
        }
      }
      if (!overlap) {
        validPosition = true;
      }
    }

    if (!validPosition) {
      x = safeLeft + Math.random() * (safeRight - safeLeft);
      y = safeTop + Math.random() * (safeBottom - safeTop);
    }

    const activeMultiRingTargets = targetsRef.current.filter((target) => target.totalRings > 1).length;
    const ringRoll = Math.random();
    let rings = 1;
    if (activeMultiRingTargets < MAX_CONCURRENT_MULTI_RING_TARGETS) {
      if (maxOuterRings < 3) {
        rings = 1 + Math.floor(ringRoll * maxOuterRings);
      } else if (ringRoll < 0.2) {
        rings = 3;
      } else if (maxOuterRings === 4 && ringRoll < 0.4) {
        rings = 4;
      } else {
        const commonRingRange = maxOuterRings === 3 ? 0.8 : 0.6;
        rings = 1 + Math.floor(((ringRoll - (1 - commonRingRange)) / commonRingRange) * 2);
      }
    }

    const palette = rings > 1
      ? { color: '#38BDF8', accent: '#0284C7' }
      : Math.random() > 0.4
      ? { color: '#FFFFFF', accent: '#94A3B8' } // Pure clean white
      : { color: '#F43F5E', accent: '#E11D48' }; // Radiant rose

    const target: CircleTarget = {
      id: nextTargetIdRef.current++,
      x,
      y,
      innerRadius,
      currentOuterRadius: initialOuterRadius,
      initialOuterRadius,
      duration: targetDuration,
      spawnTime: performance.now(),
      totalRings: rings,
      ringsRemaining: rings,
      color: palette.color,
      accentColor: palette.accent,
      type: rings > 1 ? 'double_ring' : 'standard',
      pulsePhase: Math.random() * Math.PI,
      lane,
    };

    return target;
  };

  // Trigger explosion shatter effect
  const createExplosion = (x: number, y: number, color: string, intensity: number = 1) => {
    const particleCount = Math.min(
      Math.floor(18 * intensity),
      MAX_PARTICLES - particlesRef.current.length
    );

    // 1. Shards and Sparks
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 4.5 + 2.5) * intensity;
      const shape: Particle['shape'] = Math.random() > 0.4 ? 'shatter' : 'spark';
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 25 + 20,
        decay: Math.random() * 0.03 + 0.025,
        shape,
        angle: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.2,
      });
    }

    // 2. High-speed Shockwave Ring
    if (shockwavesRef.current.length >= MAX_SHOCKWAVES) shockwavesRef.current.shift();
    shockwavesRef.current.push({
      x,
      y,
      radius: 20,
      maxRadius: 85 * intensity,
      alpha: 0.9,
      color,
      lineWidth: 3 * intensity,
    });
  };

  // Add floating judgment text
  const addFloatingText = (x: number, y: number, text: string, color: string, subtext?: string) => {
    if (floatingTextsRef.current.length >= MAX_FLOATING_TEXTS) floatingTextsRef.current.shift();
    floatingTextsRef.current.push({
      id: nextTextIdRef.current++,
      x,
      y: y - 10,
      text,
      subtext,
      color,
      alpha: 1,
      life: 0,
      maxLife: 40,
    });
  };

  // Trigger ambient background burst (decompression atmosphere)
  const triggerAmbientBurst = (width: number, height: number) => {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const colors = ['#38BDF8', '#818CF8', '#C084FC', '#F43F5E'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    for (let i = 0; i < Math.min(8, MAX_PARTICLES - particlesRef.current.length); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 1.5 + 0.8;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 2 + 1,
        color,
        alpha: 0.6,
        life: 0,
        maxLife: 50,
        decay: 0.015,
        shape: 'glow',
      });
    }
  };

  const onScoreUpdateRef = useRef(onScoreUpdate);
  onScoreUpdateRef.current = onScoreUpdate;
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  // Reset Game
  const resetGame = useCallback(() => {
    targetsRef.current = [];
    geometryChallengeRef.current = null;
    particlesRef.current = [];
    shockwavesRef.current = [];
    floatingTextsRef.current = [];
    scoreRef.current = 0;
    comboRef.current = 0;
    playerScoresRef.current = [0, 0];
    playerCombosRef.current = [0, 0];
    playerLivesRef.current = [3, 3];
    gameOverTriggeredRef.current = false;
    remainingMsRef.current = mode === 'timed' ? 120_000 : null;
    lastTimerReportRef.current = 0;
    maxComboRef.current = 0;
    perfectHitsRef.current = 0;
    greatHitsRef.current = 0;
    goodHitsRef.current = 0;
    totalClicksRef.current = 0;
    successfulHitsRef.current = 0;
    geometryChallengeSeenRef.current = false;
    pauseStartedAtRef.current = null;
    startTimeRef.current = performance.now();
    lastSpawnTimeRef.current = performance.now();
    onScoreUpdateRef.current(0, 0, [0, 0], remainingMsRef.current);
    onLivesUpdateRef.current([3, 3]);

    const canvas = canvasRef.current;
    if (canvas) {
      const initialTargets: Array<CircleTarget | null> = mode === 'duo'
        ? [
            spawnCircle(canvas.clientWidth, canvas.clientHeight, undefined, 0),
            spawnCircle(canvas.clientWidth, canvas.clientHeight, undefined, 1),
          ]
        : [spawnCircle(canvas.clientWidth, canvas.clientHeight)];
      for (const target of initialTargets) {
        if (target) targetsRef.current.push(target);
      }
    }
  }, [mode]);

  // Handle Game Over (stable callback)
  const triggerGameOver = useCallback((duoWinner?: 1 | 2) => {
    if (gameOverTriggeredRef.current) return;
    gameOverTriggeredRef.current = true;
    soundManager.playMiss();
    hapticManager.triggerMiss();

    const stats: GameStats = {
      score: scoreRef.current,
      highScore: Number(localStorage.getItem('ping_high_score') || 0),
      combo: comboRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectHitsRef.current,
      greatHits: greatHitsRef.current,
      goodHits: goodHitsRef.current,
      totalClicks: totalClicksRef.current,
      gameDurationSec: Math.floor((performance.now() - startTimeRef.current) / 1000),
      playerScores: [...playerScoresRef.current] as [number, number],
      duoWinner,
    };

    if (mode !== 'duo' && stats.score > stats.highScore) {
      stats.highScore = stats.score;
      localStorage.setItem('ping_high_score', stats.score.toString());
    }

    onGameOverRef.current(stats);
  }, [mode]);

  const onLivesUpdateRef = useRef(onLivesUpdate);
  onLivesUpdateRef.current = onLivesUpdate;

  const loseDuoLife = (lane: 0 | 1, x: number, y: number) => {
    if (mode !== 'duo' || gameOverTriggeredRef.current) return;
    playerLivesRef.current[lane] = Math.max(0, playerLivesRef.current[lane] - 1);
    playerCombosRef.current[lane] = 0;
    comboRef.current = Math.max(...playerCombosRef.current);
    onLivesUpdateRef.current([...playerLivesRef.current]);
    soundManager.playMiss();
    hapticManager.triggerMiss();
    addFloatingText(x, y, '-1', '#FDA4AF', i18n.t('duoLifeLost'));

    if (playerLivesRef.current[lane] === 0) {
      triggerGameOver(lane === 0 ? 2 : 1);
    }
  };

  // Handle Pointer / Touch interaction
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPlaying || isPaused) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const lane: 0 | 1 = mode === 'duo'
      && (rect.width > rect.height ? clickX >= rect.width / 2 : clickY >= rect.height / 2)
      ? 1
      : 0;

    totalClicksRef.current++;
    const challenge = geometryChallengeRef.current;
    if (challenge) {
      const start = challenge.points[0];
      if (Math.hypot(start.x - clickX, start.y - clickY) <= GEOMETRY_POINT_HIT_RADIUS) {
        challenge.pointerId = e.pointerId;
        challenge.cursor = { x: clickX, y: clickY };
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }

    // Find if clicked any active target
    let hitIndex = -1;
    let closestDist = Infinity;

    for (let i = 0; i < targetsRef.current.length; i++) {
      const target = targetsRef.current[i];
      if (mode === 'duo' && target.lane !== lane) continue;
      const dx = target.x - clickX;
      const dy = target.y - clickY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Generous touch hit box: covers the inner circle, outer shrinking ring, plus 25px thumb padding!
      const hitThreshold = Math.max(target.innerRadius + 32, target.currentOuterRadius + 18);
      if (dist <= hitThreshold) {
        if (dist < closestDist) {
          closestDist = dist;
          hitIndex = i;
        }
      }
    }

    if (hitIndex !== -1) {
      const target = targetsRef.current[hitIndex];
      const shrinkRatio = target.currentOuterRadius / target.innerRadius;

      // Check if it is a multi-ring circle with rings remaining
      if (target.ringsRemaining > 1) {
        target.ringsRemaining--;
        const completedRings = target.totalRings - target.ringsRemaining;
        const stepSize = 1.75 / (target.totalRings - 1);
        const nextRingScale = 3.1 - completedRings * stepSize;
        target.currentOuterRadius = target.innerRadius * nextRingScale;
        target.initialOuterRadius = target.innerRadius * nextRingScale;
        target.spawnTime = performance.now();

        soundManager.playDoubleTap();
        hapticManager.triggerDoubleTap();

        createExplosion(target.x, target.y, '#38BDF8', 1.2);
        addFloatingText(target.x, target.y, i18n.t('game.tapAgain'), '#38BDF8', '+50');
        scoreRef.current += 50;
        playerScoresRef.current[target.lane] += 50;
        playerCombosRef.current[target.lane]++;
        comboRef.current = mode === 'duo'
          ? Math.max(...playerCombosRef.current)
          : playerCombosRef.current[0];
        maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
        onScoreUpdateRef.current(scoreRef.current, comboRef.current, [...playerScoresRef.current], remainingMsRef.current);
        return;
      }

      // Timing Accuracy Evaluation
      let judgment: 'PERFECT' | 'GREAT' | 'GOOD' = 'GOOD';
      let scoreGained = 50;
      let textColor = '#94A3B8';

      if (shrinkRatio <= 1.25) {
        judgment = 'PERFECT';
        scoreGained = 150;
        textColor = '#38BDF8';
        perfectHitsRef.current++;
      } else if (shrinkRatio <= 1.55) {
        judgment = 'GREAT';
        scoreGained = 100;
        textColor = '#A78BFA';
        greatHitsRef.current++;
      } else {
        judgment = 'GOOD';
        scoreGained = 50;
        textColor = '#E2E8F0';
        goodHitsRef.current++;
      }

      // Update score and combo
      playerCombosRef.current[target.lane]++;
      comboRef.current = mode === 'duo'
        ? Math.max(...playerCombosRef.current)
        : playerCombosRef.current[target.lane];
      maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
      const comboBonus = Math.floor(playerCombosRef.current[target.lane] / 5) * 20;
      scoreRef.current += scoreGained + comboBonus;
      playerScoresRef.current[target.lane] += scoreGained + comboBonus;
      onScoreUpdateRef.current(scoreRef.current, comboRef.current, [...playerScoresRef.current], remainingMsRef.current);

      // Increment successful hit count to drive progressive difficulty
      successfulHitsRef.current++;
      const currentHits = successfulHitsRef.current;

      // Announce newly unlocked concentric ring counts.
      if (currentHits === 8) {
        addFloatingText(canvas.clientWidth / 2, 170, i18n.t('game.stageTwo'), '#38BDF8', '2×');
      } else if (currentHits === 10) {
        addFloatingText(canvas.clientWidth / 2, 170, i18n.t('game.stageThree'), '#818CF8', '3×');
      } else if (currentHits === 25) {
        addFloatingText(canvas.clientWidth / 2, 170, i18n.t('game.stageFour'), '#F43F5E', '4×');
      }

      // Trigger Audio & Haptic Feedback
      soundManager.playHit(comboRef.current, judgment);
      hapticManager.triggerHit(judgment);

      // Visual Explosion & Floating Score Text
      createExplosion(target.x, target.y, target.color, judgment === 'PERFECT' ? 1.5 : 1.1);
      const bonusText = comboBonus > 0 ? `+${scoreGained + comboBonus}` : `+${scoreGained}`;
      addFloatingText(target.x, target.y, i18n.t(`game.${judgment.toLowerCase()}`), textColor, bonusText);

      // Remove the clicked circle with pleasant particle burst
      targetsRef.current.splice(hitIndex, 1);

      // Replenish target pool immediately if below concurrency so user sees multiple circles
      if (targetsRef.current.length === 0) {
        lastSpawnTimeRef.current = performance.now() - 60;
      } else {
        lastSpawnTimeRef.current = performance.now() - 160;
      }
    } else {
      // Empty click on screen - subtle decompression ripple wave
      shockwavesRef.current.push({
        x: clickX,
        y: clickY,
        radius: 5,
        maxRadius: 40,
        alpha: 0.35,
        color: '#FFFFFF',
        lineWidth: 1.5,
      });
      if (mode === 'duo') loseDuoLife(lane, clickX, clickY);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPlaying || isPaused) return;
    const challenge = geometryChallengeRef.current;
    if (!challenge || challenge.pointerId !== e.pointerId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    challenge.cursor = cursor;

    const previousIndex = challenge.nextPointIndex === 0
      ? challenge.points.length - 1
      : challenge.nextPointIndex - 1;
    const previous = challenge.points[previousIndex];
    const next = challenge.points[challenge.nextPointIndex];

    if (distanceToSegment(cursor, previous, next) > GEOMETRY_PATH_TOLERANCE) {
      challenge.pointerId = null;
      challenge.cursor = null;
      challenge.nextPointIndex = 1;
      addFloatingText(challenge.x, challenge.y, i18n.t('game.geometryTryAgain'), '#FCA5A5');
      return;
    }

    if (Math.hypot(next.x - cursor.x, next.y - cursor.y) <= GEOMETRY_POINT_HIT_RADIUS) {
      if (challenge.nextPointIndex === 0) {
        completeGeometryChallenge(challenge);
        return;
      }
      challenge.nextPointIndex++;
      if (challenge.nextPointIndex === challenge.points.length) {
        challenge.nextPointIndex = 0;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const challenge = geometryChallengeRef.current;
    if (!challenge || challenge.pointerId !== e.pointerId) return;
    challenge.pointerId = null;
    challenge.cursor = null;
    challenge.nextPointIndex = 1;
  };

  // Reset only when a new session is explicitly started, not when resuming.
  useEffect(() => {
    if (gameSessionId > 0) resetGame();
  }, [gameSessionId, resetGame]);

  useEffect(() => {
    if (isPaused) {
      pauseStartedAtRef.current = performance.now();
      return;
    }

    const pauseStartedAt = pauseStartedAtRef.current;
    if (pauseStartedAt === null) return;

    const pausedDuration = performance.now() - pauseStartedAt;
    for (const target of targetsRef.current) {
      target.spawnTime += pausedDuration;
    }
    if (startTimeRef.current > 0) startTimeRef.current += pausedDuration;
    lastSpawnTimeRef.current += pausedDuration;
    pauseStartedAtRef.current = null;
  }, [isPaused]);

  // Main 60-120fps Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    // Resize canvas safely taking devicePixelRatio into account
    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      if (ambientParticlesRef.current.length === 0) {
        initAmbientParticles(width, height);
      }
    };

    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);
    window.addEventListener('resize', handleResize);

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      // 1. Clear Screen with deep pitch black background
      ctx.save();
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, width, height);

      // Screen Shake application
      if (shakeIntensityRef.current > 0.05) {
        const shakeX = (Math.random() - 0.5) * shakeIntensityRef.current;
        const shakeY = (Math.random() - 0.5) * shakeIntensityRef.current;
        ctx.translate(shakeX, shakeY);
        shakeIntensityRef.current *= 0.88;
      }

      // 2. Render Ambient Floating Dust Particles (Decompression background)
      const ambientList = ambientParticlesRef.current;
      for (let i = 0; i < ambientList.length; i++) {
        const p = ambientList[i];
        p.x += p.vx;
        p.y += p.vy;
        p.pulsePhase += p.pulseSpeed;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const currentAlpha = p.alpha + Math.sin(p.pulsePhase) * 0.15;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.04, currentAlpha)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Occasional spontaneous background distant burst
      if (isPlaying && !isPaused && now - lastRandomBurstRef.current > 3200) {
        lastRandomBurstRef.current = now;
        triggerAmbientBurst(width, height);
      }

      // 4. Update & Render Gameplay Entities if active
      if (isPlaying && !isPaused) {
        const { duration, maxConcurrent } = getDifficulty(successfulHitsRef.current);
        if (mode === 'timed' && remainingMsRef.current !== null) {
          remainingMsRef.current = Math.max(0, remainingMsRef.current - dt * 1000);
          if (now - lastTimerReportRef.current >= 250 || remainingMsRef.current === 0) {
            lastTimerReportRef.current = now;
            onScoreUpdateRef.current(
              scoreRef.current,
              comboRef.current,
              [...playerScoresRef.current],
              remainingMsRef.current
            );
          }
          if (remainingMsRef.current === 0) {
            triggerGameOver();
            ctx.restore();
            return;
          }
        }

        if (mode === 'duo') {
          ctx.save();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
          ctx.setLineDash([7, 8]);
          ctx.beginPath();
          if (width > height) {
            ctx.moveTo(width / 2, 18);
            ctx.lineTo(width / 2, height - 18);
          } else {
            ctx.moveTo(18, height / 2);
            ctx.lineTo(width - 18, height / 2);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }

        // Spawn targets to maintain required concurrency (同时出现 2个 / 3个 / 极限4个)
        const spawnDelay = targetsRef.current.length === 0 ? 200 : 140;
        if (!geometryChallengeRef.current
          && targetsRef.current.length < maxConcurrent
          && now - lastSpawnTimeRef.current > spawnDelay) {
          if (mode !== 'duo'
            && targetsRef.current.length === 0
            && successfulHitsRef.current >= 25
            && (!geometryChallengeSeenRef.current || Math.random() < GEOMETRY_CHALLENGE_CHANCE)) {
            geometryChallengeRef.current = spawnGeometryChallenge(width, height);
            if (geometryChallengeRef.current) geometryChallengeSeenRef.current = true;
          }

          if (geometryChallengeRef.current) {
            lastSpawnTimeRef.current = now;
          } else {
            // Stagger concurrent targets so they do not expire together.
            const offsetDuration = duration + targetsRef.current.length * 340;
            const laneCounts: [number, number] = [0, 0];
            if (mode === 'duo') {
              for (const target of targetsRef.current) laneCounts[target.lane]++;
            }
            const nextLane: 0 | 1 = mode === 'duo' && laneCounts[1] < laneCounts[0] ? 1 : 0;
            const newTarget = spawnCircle(width, height, offsetDuration, nextLane);
            if (newTarget) {
              targetsRef.current.push(newTarget);
              lastSpawnTimeRef.current = now;
            }
          }
        }

        // Process Target Circles
        let missTriggered = false;
        const activeTargets = targetsRef.current;
        const challenge = geometryChallengeRef.current;

        if (challenge) {
          challenge.timeRemainingMs -= dt * 1000;
          if (challenge.timeRemainingMs <= 0) {
            if (mode === 'timed') {
              geometryChallengeRef.current = null;
              playerCombosRef.current[0] = 0;
              comboRef.current = 0;
            } else {
              triggerGameOver();
              ctx.restore();
              return;
            }
          }
          const remainingRatio = Math.max(
            0,
            challenge.timeRemainingMs / GEOMETRY_CHALLENGE_DURATION_MS
          );
          const points = challenge.points;
          const completedSegments = challenge.nextPointIndex === 0
            ? points.length - 1
            : challenge.nextPointIndex - 1;
          const previousIndex = challenge.nextPointIndex === 0
            ? points.length - 1
            : challenge.nextPointIndex - 1;

          ctx.save();
          ctx.textAlign = 'center';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#C084FC';

          ctx.beginPath();
          ctx.arc(challenge.x, challenge.y, challenge.radius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(30, 20, 48, 0.78)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(192, 132, 252, 0.38)';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(
            challenge.x,
            challenge.y,
            challenge.radius + 9,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * remainingRatio
          );
          ctx.strokeStyle = '#FDE68A';
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.shadowBlur = 0;
          ctx.setLineDash([6, 5]);
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(192, 132, 252, 0.5)';
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let index = 1; index < points.length; index++) {
            ctx.lineTo(points[index].x, points[index].y);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let index = 1; index <= completedSegments; index++) {
            ctx.lineTo(points[index % points.length].x, points[index % points.length].y);
          }
          if (challenge.pointerId !== null && challenge.cursor) {
            ctx.lineTo(challenge.cursor.x, challenge.cursor.y);
          }
          ctx.strokeStyle = '#67E8F9';
          ctx.lineWidth = 4;
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#67E8F9';
          ctx.stroke();

          ctx.shadowBlur = 0;
          for (let index = 0; index < points.length; index++) {
            const point = points[index];
            const isNext = challenge.nextPointIndex === index;
            ctx.beginPath();
            ctx.arc(point.x, point.y, isNext ? 12 : 8, 0, Math.PI * 2);
            ctx.fillStyle = index === 0 ? '#FDE68A' : isNext ? '#67E8F9' : '#C084FC';
            ctx.fill();
            ctx.fillStyle = '#090b10';
            ctx.font = 'bold 10px system-ui, sans-serif';
            ctx.fillText(String(index + 1), point.x, point.y + 3.5);
          }

          ctx.fillStyle = '#F8FAFC';
          ctx.font = '600 14px system-ui, sans-serif';
          ctx.fillText(i18n.t('game.geometryTitle'), challenge.x, challenge.y - challenge.radius - 27);
          ctx.fillStyle = '#CBD5E1';
          ctx.font = '11px system-ui, sans-serif';
          ctx.fillText(i18n.t('game.geometryInstruction'), challenge.x, challenge.y + challenge.radius + 27);
          ctx.restore();

          if (challenge.pointerId !== null) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(points[previousIndex].x, points[previousIndex].y, 15, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(103, 232, 249, 0.7)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
          }
        }

        for (let i = activeTargets.length - 1; i >= 0; i--) {
          const target = activeTargets[i];
          const elapsed = now - target.spawnTime;
          const contractProgress = Math.min(elapsed / target.duration, 1.0);

          // Contract outer ring from initial outer radius down to inner radius
          target.currentOuterRadius = target.initialOuterRadius - (target.initialOuterRadius - target.innerRadius) * contractProgress;
          target.pulsePhase += 0.04;

          // Grace period (Coyote time) of 320ms:
          // The moment the ring touches the inner circle (contractProgress === 1.0), the player has a 320ms window to tap it!
          // Clicking during this window awards a PERFECT / GREAT hit.
          // Only if this grace window expires without being clicked does it count as a Miss.
          const GRACE_PERIOD_MS = 320;
          if (elapsed > target.duration + GRACE_PERIOD_MS) {
            if (mode === 'timed') {
              activeTargets.splice(i, 1);
              playerCombosRef.current[target.lane] = 0;
              comboRef.current = Math.max(...playerCombosRef.current);
              lastSpawnTimeRef.current = now - 160;
              continue;
            }
            if (mode === 'duo') {
              activeTargets.splice(i, 1);
              loseDuoLife(target.lane, target.x, target.y);
              if (gameOverTriggeredRef.current) {
                ctx.restore();
                return;
              }
              lastSpawnTimeRef.current = now - 160;
              continue;
            }
            missTriggered = true;
            break;
          }

          // Draw Inner Target Circle
          ctx.save();
          // Subtle breathing inner ring
          const breath = Math.sin(target.pulsePhase) * 1.5;
          const currentInnerR = target.innerRadius + breath;

          // Soft glow shadow
          ctx.shadowBlur = 7;
          ctx.shadowColor = target.color;

          // Inner filled circular button
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.beginPath();
          ctx.arc(target.x, target.y, currentInnerR, 0, Math.PI * 2);
          ctx.fill();

          // Inner circle perimeter stroke
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = target.color;
          ctx.stroke();

          // Center tactile dot
          ctx.fillStyle = target.color;
          ctx.beginPath();
          ctx.arc(target.x, target.y, 4, 0, Math.PI * 2);
          ctx.fill();

          // Outer Shrinking Approach Line (The Ring)
          ctx.shadowBlur = 5;
          ctx.shadowColor = target.color;
          ctx.lineWidth = 2.2;
          ctx.strokeStyle = target.color;
          ctx.beginPath();
          ctx.arc(target.x, target.y, Math.max(target.currentOuterRadius, currentInnerR), 0, Math.PI * 2);
          ctx.stroke();

          // Dashed concentric guides show how many taps remain.
          if (target.ringsRemaining > 1) {
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
            ctx.setLineDash([6, 4]);
            for (let ring = 1; ring < target.ringsRemaining; ring++) {
              ctx.beginPath();
              ctx.arc(target.x, target.y, target.currentOuterRadius + ring * 13, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.setLineDash([]);
          }

          ctx.restore();
        }

        // If a circle contracted all the way into the inner circle without click -> Game Over!
        if (missTriggered) {
          triggerGameOver();
          ctx.restore();
          return;
        }
      }

      // 5. Update & Render Shockwaves
      const shockwaves = shockwavesRef.current;
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.radius += (sw.maxRadius - sw.radius) * 0.18;
        sw.alpha *= 0.88;

        if (sw.alpha < 0.02 || sw.radius >= sw.maxRadius * 0.95) {
          shockwaves.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = sw.alpha;
        ctx.lineWidth = sw.lineWidth;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 6. Update & Render Particles (Shatter / Spark / Burst)
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.alpha -= p.decay;
        p.life++;

        if (p.angle !== undefined && p.rotSpeed !== undefined) {
          p.angle += p.rotSpeed;
        }

        if (p.alpha <= 0.01 || p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;

        if (p.shape === 'shatter' && p.angle !== undefined) {
          // Sharp glass shard
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.beginPath();
          ctx.moveTo(-p.size, -p.size * 0.6);
          ctx.lineTo(p.size * 1.2, 0);
          ctx.lineTo(-p.size * 0.5, p.size * 0.8);
          ctx.closePath();
          ctx.fill();
        } else if (p.shape === 'spark') {
          // Elongated spark
          ctx.shadowBlur = 3;
          ctx.shadowColor = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Subtle circular glow
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 7. Update & Render Floating Judgment Text
      const texts = floatingTextsRef.current;
      for (let i = texts.length - 1; i >= 0; i--) {
        const ft = texts[i];
        ft.y -= 1.1;
        ft.life++;
        ft.alpha = 1 - ft.life / ft.maxLife;

        if (ft.life >= ft.maxLife) {
          texts.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '700 15px Outfit, sans-serif';
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.shadowBlur = 4;
        ctx.shadowColor = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);

        if (ft.subtext) {
          ctx.font = '500 12px "JetBrains Mono", monospace';
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(ft.subtext, ft.x, ft.y + 16);
        }
        ctx.restore();
      }

      ctx.restore();
      if (!isPlaying || isPaused) return;
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [isPlaying, isPaused, mode, initAmbientParticles, triggerGameOver]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="absolute inset-0 w-full h-full cursor-pointer touch-none select-none"
      style={{ touchAction: 'none' }}
    />
  );
};
