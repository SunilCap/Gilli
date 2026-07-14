/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { 
  Ball, 
  Paddle, 
  Brick, 
  PowerUpItem, 
  PowerUpType, 
  Particle, 
  Laser, 
  GameStatus 
} from '../types';
import { LEVELS } from '../levels';
import { sound } from './SoundManager';

interface GameCanvasProps {
  status: GameStatus;
  currentLevelIdx: number;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelComplete: () => void;
  onGameOver: () => void;
  onStatusChange: (status: GameStatus) => void;
}

export interface GameCanvasHandle {
  resetGame: () => void;
  startLevel: (levelIdx: number) => void;
  togglePause: () => void;
  setPaddleXPercent: (pct: number) => void;
  triggerAction: () => void;
}

// Fixed virtual coordinate space
const GAME_WIDTH = 800;
const GAME_HEIGHT = 800;

const WALL_WIDTH = 40;
const TOP_WALL_HEIGHT = 32;

const LEFT_WALL_STONES = [
  24, 30, 20, 28, 34, 22, 26, 32, 20, 28, 30, 24, 28, 32, 20, 26, 24, 30, 28, 22, 26, 32, 20, 28, 30, 24, 28, 32, 20, 28
];

// Safe helper for triggering haptic vibration on mobile
const triggerVibration = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Ignored safely if not supported or blocked by user preference
    }
  }
};

export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(({
  status,
  currentLevelIdx,
  onScoreChange,
  onLivesChange,
  onLevelComplete,
  onGameOver,
  onStatusChange
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game state stored in refs for access inside the 60fps game loop without closures capturing stale state
  const stateRef = useRef({
    status,
    score: 0,
    lives: 3,
    levelIdx: currentLevelIdx,
    combo: 0,
    comboTimer: 0,
    
    // Entities
    paddle: {
      x: GAME_WIDTH / 2 - 60,
      y: GAME_HEIGHT - 35,
      width: 120,
      height: 14,
      speed: 10,
      color: '#4a463f', // Deep warm charcoal
      isSticky: false,
      isLaser: false,
      laserCooldown: 0
    } as Paddle,
    
    balls: [] as Ball[],
    bricks: [] as Brick[],
    powerUps: [] as PowerUpItem[],
    particles: [] as Particle[],
    lasers: [] as Laser[],
    
    // Shield
    hasShield: false,
    
    // Inputs
    keys: {
      ArrowLeft: false,
      ArrowRight: false,
      a: false,
      d: false,
      Space: false
    },
    mousePositionX: GAME_WIDTH / 2,
    
    // Timers for active power-ups
    powerUpTimers: {
      [PowerUpType.EXPAND_PADDLE]: 0,
      [PowerUpType.STICKY_PADDLE]: 0,
      [PowerUpType.LASER_PADDLE]: 0,
      [PowerUpType.SLOW_MOTION]: 0,
    },
    
    // Visual effects
    screenShake: 0,
    frameCount: 0,
    isLevelLoaded: false
  });

  // Keep state sync'd with React props
  useEffect(() => {
    stateRef.current.status = status;
  }, [status]);

  useEffect(() => {
    stateRef.current.levelIdx = currentLevelIdx;
  }, [currentLevelIdx]);

  // Actions like launching stuck balls or firing lasers
  const handleActionInput = () => {
    const state = stateRef.current;
    if (state.status !== GameStatus.PLAYING) return;
    
    // Launch stuck balls
    state.balls.forEach(ball => {
      if (ball.isStuck) {
        ball.isStuck = false;
        ball.dy = -ball.speed;
        ball.dx = (Math.random() * 4 - 2) + ((ball.stuckRelativeX / state.paddle.width) * 6 - 3);
        sound.playPaddleHit();
      }
    });

    // Fire lasers if active
    if (state.paddle.isLaser && state.paddle.laserCooldown <= 0) {
      state.lasers.push({
        id: `laser-l-${Math.random()}`,
        x: state.paddle.x + 10,
        y: state.paddle.y - 10,
        dy: -9,
        width: 4,
        height: 15
      });
      state.lasers.push({
        id: `laser-r-${Math.random()}`,
        x: state.paddle.x + state.paddle.width - 14,
        y: state.paddle.y - 10,
        dy: -9,
        width: 4,
        height: 15
      });
      state.paddle.laserCooldown = 18; // Frames cooldown
      sound.playLaserShoot();
    }
  };

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    resetGame() {
      const state = stateRef.current;
      state.score = 0;
      state.lives = 3;
      state.levelIdx = 0;
      state.combo = 0;
      state.comboTimer = 0;
      state.hasShield = false;
      state.isLevelLoaded = false;
      state.powerUpTimers = {
        [PowerUpType.EXPAND_PADDLE]: 0,
        [PowerUpType.STICKY_PADDLE]: 0,
        [PowerUpType.LASER_PADDLE]: 0,
        [PowerUpType.SLOW_MOTION]: 0,
      };
      onScoreChange(0);
      onLivesChange(3);
      this.startLevel(0);
    },
    startLevel(levelIdx: number) {
      const state = stateRef.current;
      state.levelIdx = levelIdx;
      state.combo = 0;
      state.comboTimer = 0;
      state.powerUps = [];
      state.lasers = [];
      state.particles = [];
      state.hasShield = false;
      state.isLevelLoaded = false; // set to false during load
      state.powerUpTimers = {
        [PowerUpType.EXPAND_PADDLE]: 0,
        [PowerUpType.STICKY_PADDLE]: 0,
        [PowerUpType.LASER_PADDLE]: 0,
        [PowerUpType.SLOW_MOTION]: 0,
      };
      
      // Reset paddle
      state.paddle.width = 120;
      state.paddle.x = GAME_WIDTH / 2 - 60;
      state.paddle.isSticky = false;
      state.paddle.isLaser = false;
      
      // Load Level Bricks
      const levelTemplate = LEVELS[levelIdx] || LEVELS[0];
      const rows = levelTemplate.grid.length;
      const cols = levelTemplate.grid[0].length;
      
      const brickWidth = (GAME_WIDTH - 80) / cols;
      const brickHeight = 22;
      const startX = 40;
      const startY = 70;
      
      state.bricks = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const strength = levelTemplate.grid[r][c];
          if (strength > 0) {
            // Pick powerup with a ~16% chance for destructible bricks
            let assignedPowerUp: PowerUpType | undefined;
            if (strength !== 9 && Math.random() < 0.16) {
              const types = Object.values(PowerUpType);
              assignedPowerUp = types[Math.floor(Math.random() * types.length)];
            }
            
            const color = strength === 9 
              ? '#808080' // Slate metal
              : levelTemplate.colors[r % levelTemplate.colors.length];
            
            state.bricks.push({
              id: `${r}-${c}-${Math.random()}`,
              x: startX + c * brickWidth,
              y: startY + r * (brickHeight + 6),
              width: brickWidth - 4,
              height: brickHeight,
              strength,
              maxStrength: strength,
              color,
              powerUp: assignedPowerUp
            });
          }
        }
      }
      
      // Reset balls
      state.balls = [
        {
          id: `ball-${Math.random()}`,
          x: GAME_WIDTH / 2,
          y: state.paddle.y - 12,
          dx: 4 * (Math.random() > 0.5 ? 1 : -1),
          dy: -5,
          radius: 8,
          speed: 6.5,
          isStuck: true,
          stuckRelativeX: 60
        }
      ];

      state.isLevelLoaded = true; // successfully loaded
    },
    togglePause() {
      const state = stateRef.current;
      if (state.status === GameStatus.PLAYING) {
        onStatusChange(GameStatus.PAUSED);
      } else if (state.status === GameStatus.PAUSED) {
        onStatusChange(GameStatus.PLAYING);
      }
    },
    setPaddleXPercent(pct: number) {
      const state = stateRef.current;
      state.mousePositionX = pct * GAME_WIDTH;
    },
    triggerAction() {
      handleActionInput();
    }
  }));

  // Handle Canvas Resizing (ResizeObserver maintains pixel density)
  useEffect(() => {
    let resizeAnimationFrameId: number;

    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Scale based on aspect ratio
      const aspect = GAME_WIDTH / GAME_HEIGHT;
      let width = rect.width;
      let height = rect.width / aspect;
      
      if (height > rect.height) {
        height = rect.height;
        width = rect.height * aspect;
      }
      
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr * (width / GAME_WIDTH), dpr * (height / GAME_HEIGHT));
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(resizeAnimationFrameId);
      resizeAnimationFrameId = requestAnimationFrame(handleResize);
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    const onWindowResize = () => {
      cancelAnimationFrame(resizeAnimationFrameId);
      resizeAnimationFrameId = requestAnimationFrame(handleResize);
    };

    window.addEventListener('resize', onWindowResize);
    handleResize(); // Initial call
    
    return () => {
      cancelAnimationFrame(resizeAnimationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', onWindowResize);
    };
  }, []);

  // Set up input event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'd', 'A', 'D'].includes(e.key)) {
        e.preventDefault();
      }
      
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        state.keys.ArrowLeft = true;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        state.keys.ArrowRight = true;
      }
      if (e.key === ' ' || e.key === 'Spacebar') {
        state.keys.Space = true;
        handleActionInput();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        state.keys.ArrowLeft = false;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        state.keys.ArrowRight = false;
      }
      if (e.key === ' ' || e.key === 'Spacebar') {
        state.keys.Space = false;
      }
    };

    const handleCanvasClick = (e: MouseEvent) => {
      handleActionInput();
    };

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const state = stateRef.current;
      
      const rect = canvas.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      
      // Translate to our virtual GAME_WIDTH coordinate space
      state.mousePositionX = (relativeX / rect.width) * GAME_WIDTH;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas || e.touches.length === 0) return;
      const state = stateRef.current;
      
      const rect = canvas.getBoundingClientRect();
      const relativeX = e.touches[0].clientX - rect.left;
      
      state.mousePositionX = (relativeX / rect.width) * GAME_WIDTH;
    };

    const handleTouchStart = (e: TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas || e.touches.length === 0) return;
      const state = stateRef.current;
      
      const rect = canvas.getBoundingClientRect();
      const relativeX = e.touches[0].clientX - rect.left;
      
      state.mousePositionX = (relativeX / rect.width) * GAME_WIDTH;
      handleActionInput();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('click', handleCanvasClick);
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('touchmove', handleTouchMove, { passive: true });
      canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (canvas) {
        canvas.removeEventListener('click', handleCanvasClick);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchstart', handleTouchStart);
      }
    };
  }, []);

  // SPAWNING PARTICLES
  const spawnParticles = (x: number, y: number, color: string, count = 12) => {
    const state = stateRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      const maxLife = Math.random() * 25 + 15;
      state.particles.push({
        id: `p-${Math.random()}`,
        x,
        y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 1.5,
        color,
        alpha: 1.0,
        life: maxLife,
        maxLife
      });
    }
  };

  // CORE PHYSICS AND UPDATE GAME LOOP
  useEffect(() => {
    let animationFrameId: number;
    
    const updateGame = () => {
      const state = stateRef.current;
      state.frameCount++;
      
      if (state.status !== GameStatus.PLAYING) {
        // Just draw the screen (frozen/paused state)
        renderFrame();
        animationFrameId = requestAnimationFrame(updateGame);
        return;
      }

      // 1. Decay Screen Shake
      if (state.screenShake > 0) {
        state.screenShake *= 0.88;
        if (state.screenShake < 0.2) state.screenShake = 0;
      }

      // 2. Combo Timer Decay
      if (state.comboTimer > 0) {
        state.comboTimer -= 1.6; // ~1.6% decay per frame (~1s decay window)
        if (state.comboTimer <= 0) {
          state.combo = 0;
        }
      }

      // 3. Powerup Timers Decay
      Object.keys(state.powerUpTimers).forEach((key) => {
        const type = key as PowerUpType;
        if (state.powerUpTimers[type] > 0) {
          state.powerUpTimers[type] -= 1; // 1 frame
          
          // Trigger updates when expiring
          if (state.powerUpTimers[type] <= 0) {
            if (type === PowerUpType.EXPAND_PADDLE) {
              state.paddle.width = 120;
            }
            if (type === PowerUpType.STICKY_PADDLE) {
              state.paddle.isSticky = false;
            }
            if (type === PowerUpType.LASER_PADDLE) {
              state.paddle.isLaser = false;
            }
          }
        }
      });

      if (state.paddle.laserCooldown > 0) {
        state.paddle.laserCooldown--;
      }

      // 4. Move Paddle (Handle mouse/touch OR keyboard inputs)
      let targetPaddleX = state.paddle.x;
      const keyboardSpeed = 12;
      
      if (state.keys.ArrowLeft) {
        targetPaddleX -= keyboardSpeed;
      } else if (state.keys.ArrowRight) {
        targetPaddleX += keyboardSpeed;
      } else {
        // Mouse/Touch controls target position directly
        targetPaddleX = state.mousePositionX - state.paddle.width / 2;
      }

      // Boundary locking for paddle (respect wall width)
      state.paddle.x = Math.max(WALL_WIDTH, Math.min(GAME_WIDTH - WALL_WIDTH - state.paddle.width, targetPaddleX));

      // 5. Update Lasers
      state.lasers.forEach(laser => {
        laser.y += laser.dy;
      });
      // Remove offscreen lasers or ceiling-hitting lasers
      state.lasers = state.lasers.filter(laser => {
        if (laser.y <= TOP_WALL_HEIGHT) {
          spawnParticles(laser.x + laser.width / 2, TOP_WALL_HEIGHT, '#c7866d', 4);
          return false;
        }
        return true;
      });

      // 6. Update Power-ups
      state.powerUps.forEach(pu => {
        pu.y += pu.speed;
      });
      // Check collision of powerups with paddle
      state.powerUps = state.powerUps.filter(pu => {
        const collides = (
          pu.x + pu.width > state.paddle.x &&
          pu.x < state.paddle.x + state.paddle.width &&
          pu.y + pu.height > state.paddle.y &&
          pu.y < state.paddle.y + state.paddle.height
        );

        if (collides) {
          applyPowerUp(pu.type);
          sound.playPowerUpCollect();
          triggerVibration([20, 40, 20]); // Soft haptic double-pulse
          // Spawn nice matching explosion at collect point
          spawnParticles(pu.x + pu.width / 2, pu.y + pu.height / 2, getPowerUpColor(pu.type), 15);
          return false; // Remove
        }

        // Keep if within boundary
        return pu.y < GAME_HEIGHT;
      });

      // 7. Update Particles
      state.particles.forEach(p => {
        p.x += p.dx;
        p.y += p.dy;
        p.life--;
        p.alpha = p.life / p.maxLife;
        p.dx *= 0.98; // Friction
        p.dy *= 0.98;
      });
      state.particles = state.particles.filter(p => p.life > 0);

      // 8. Update Balls (Physics, Walls, Paddle, Bricks, Lasers)
      let currentSlowMotion = state.powerUpTimers[PowerUpType.SLOW_MOTION] > 0;
      
      state.balls.forEach(ball => {
        if (ball.isStuck) {
          // Keep stuck ball on paddle
          ball.x = state.paddle.x + ball.stuckRelativeX;
          ball.y = state.paddle.y - ball.radius;
          return;
        }

        // Apply speed factors
        const finalSpeed = ball.speed * (currentSlowMotion ? 0.6 : 1);
        
        // Normalize ball movement to standard steps to avoid skipping bricks at high speeds
        const dxNormalized = ball.dx;
        const dyNormalized = ball.dy;

        ball.x += dxNormalized * (currentSlowMotion ? 0.6 : 1);
        ball.y += dyNormalized * (currentSlowMotion ? 0.6 : 1);

        // A. Wall Collisions (X-Axis - Stone Pillars)
        if (ball.x - ball.radius <= WALL_WIDTH) {
          ball.x = WALL_WIDTH + ball.radius;
          ball.dx = Math.abs(ball.dx);
          sound.playWallHit();
          triggerVibration(6); // Tiny tap for wall rebound
          spawnParticles(WALL_WIDTH, ball.y, '#c7866d', 6);
        } else if (ball.x + ball.radius >= GAME_WIDTH - WALL_WIDTH) {
          ball.x = GAME_WIDTH - WALL_WIDTH - ball.radius;
          ball.dx = -Math.abs(ball.dx);
          sound.playWallHit();
          triggerVibration(6); // Tiny tap for wall rebound
          spawnParticles(GAME_WIDTH - WALL_WIDTH, ball.y, '#c7866d', 6);
        }

        // B. Wall Collisions (Y-Axis Top - Archway Ceiling)
        if (ball.y - ball.radius <= TOP_WALL_HEIGHT) {
          ball.y = TOP_WALL_HEIGHT + ball.radius;
          ball.dy = Math.abs(ball.dy);
          sound.playWallHit();
          triggerVibration(6); // Tiny tap for wall rebound
          spawnParticles(ball.x, TOP_WALL_HEIGHT, '#c7866d', 6);
        }

        // C. Shield Collision (Y-Axis Bottom Barrier)
        if (state.hasShield && ball.y + ball.radius >= GAME_HEIGHT - 12) {
          ball.dy = -Math.abs(ball.dy);
          state.hasShield = false; // Consume shield
          sound.playWallHit();
          state.screenShake = 12;
          triggerVibration([30, 50, 30]); // Energetic impact ripple
          spawnParticles(ball.x, GAME_HEIGHT - 8, '#ff33aa', 30);
        }

        // D. Paddle Collision
        if (
          ball.y + ball.radius >= state.paddle.y &&
          ball.y - ball.radius <= state.paddle.y + state.paddle.height &&
          ball.x + ball.radius >= state.paddle.x &&
          ball.x - ball.radius <= state.paddle.x + state.paddle.width
        ) {
          // Hit paddle top
          if (ball.dy > 0) {
            // Check for sticky power-up
            if (state.powerUpTimers[PowerUpType.STICKY_PADDLE] > 0) {
              ball.isStuck = true;
              ball.stuckRelativeX = ball.x - state.paddle.x;
              sound.playPaddleHit();
              triggerVibration(15); // Distinct sticky catch tap
              return;
            }

            // Standard dynamic rebound depending on where ball hit paddle
            const hitPoint = ball.x - (state.paddle.x + state.paddle.width / 2);
            const normalizedHit = hitPoint / (state.paddle.width / 2); // Range -1 to 1
            const maxAngle = Math.PI / 3; // 60 degrees max
            
            const angle = normalizedHit * maxAngle;
            
            ball.dx = ball.speed * Math.sin(angle);
            ball.dy = -ball.speed * Math.cos(angle);
            
            // Adjust ball location outside paddle bounds
            ball.y = state.paddle.y - ball.radius;
            sound.playPaddleHit();
            triggerVibration(12); // Rebound bounce tap
            
            // Spawn sparks
            spawnParticles(ball.x, ball.y + ball.radius, state.paddle.color, 8);
          }
        }

        // E. Bricks Collision (Ball to Bricks)
        for (let i = state.bricks.length - 1; i >= 0; i--) {
          const brick = state.bricks[i];
          
          if (
            ball.x + ball.radius >= brick.x &&
            ball.x - ball.radius <= brick.x + brick.width &&
            ball.y + ball.radius >= brick.y &&
            ball.y - ball.radius <= brick.y + brick.height
          ) {
            // COLLISION!
            // Calculate overlap on each side to find collision normal
            const overlapLeft = (ball.x + ball.radius) - brick.x;
            const overlapRight = (brick.x + brick.width) - (ball.x - ball.radius);
            const overlapTop = (ball.y + ball.radius) - brick.y;
            const overlapBottom = (brick.y + brick.height) - (ball.y - ball.radius);

            const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

            // Reflect ball unless it's a fireball
            if (!ball.isFireball) {
              if (minOverlap === overlapLeft) {
                ball.dx = -Math.abs(ball.dx);
                ball.x = brick.x - ball.radius;
              } else if (minOverlap === overlapRight) {
                ball.dx = Math.abs(ball.dx);
                ball.x = brick.x + brick.width + ball.radius;
              } else if (minOverlap === overlapTop) {
                ball.dy = -Math.abs(ball.dy);
                ball.y = brick.y - ball.radius;
              } else if (minOverlap === overlapBottom) {
                ball.dy = Math.abs(ball.dy);
                ball.y = brick.y + brick.height + ball.radius;
              }
            }

            // Damage brick
            damageBrick(brick, i);
            break; // Stop checking other bricks for this ball this frame
          }
        }
      });

      // 9. Laser to Brick Collisions
      state.lasers = state.lasers.filter(laser => {
        let hitSomething = false;
        
        for (let i = state.bricks.length - 1; i >= 0; i--) {
          const brick = state.bricks[i];
          if (
            laser.x + laser.width >= brick.x &&
            laser.x <= brick.x + brick.width &&
            laser.y + laser.height >= brick.y &&
            laser.y <= brick.y + brick.height
          ) {
            hitSomething = true;
            damageBrick(brick, i);
            break;
          }
        }
        
        return !hitSomething; // Remove laser if hit brick
      });

      // 10. Check Lost Balls / Game Over
      const activeBallsBefore = state.balls.length;
      state.balls = state.balls.filter(ball => ball.y - ball.radius < GAME_HEIGHT);

      if (state.balls.length === 0 && activeBallsBefore > 0) {
        // Lost life!
        state.lives--;
        onLivesChange(state.lives);
        sound.playLoseLife();
        state.combo = 0;
        state.comboTimer = 0;

        if (state.lives <= 0) {
          onStatusChange(GameStatus.GAMEOVER);
          onGameOver();
          triggerVibration([100, 50, 100, 50, 200]); // Heavy rhythmic gameover haptic
        } else {
          triggerVibration(150); // Warning pulse for life lost
          // Re-spawn stuck ball on paddle
          state.balls = [
            {
              id: `ball-${Math.random()}`,
              x: GAME_WIDTH / 2,
              y: state.paddle.y - 12,
              dx: 4 * (Math.random() > 0.5 ? 1 : -1),
              dy: -5,
              radius: 8,
              speed: 6.5,
              isStuck: true,
              stuckRelativeX: state.paddle.width / 2
            }
          ];
        }
      }

      // 11. Check Victory condition (all destructible bricks gone)
      const breakableRemaining = state.bricks.some(b => b.strength !== 9);
      if (state.isLevelLoaded && !breakableRemaining) {
        state.isLevelLoaded = false; // Prevent repeated triggers
        onStatusChange(GameStatus.VICTORY);
        onLevelComplete();
        triggerVibration([50, 40, 50, 40, 150]); // Harmonious melody rumble
      }

      // 11.5 Dispatch Power-up stats to React UI
      if (state.frameCount % 5 === 0) {
        const event = new CustomEvent('neon-breaker-powerups', {
          detail: {
            hasShield: state.hasShield,
            timers: { ...state.powerUpTimers }
          }
        });
        window.dispatchEvent(event);
      }

      // 12. Render Frame
      renderFrame();
      
      // Request next tick
      animationFrameId = requestAnimationFrame(updateGame);
    };

    const damageBrick = (brick: Brick, idx: number) => {
      const state = stateRef.current;
      if (brick.strength === 9) {
        // Metallic unbreakable brick!
        sound.playWallHit();
        spawnParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, '#888888', 6);
        triggerVibration(15); // Light metal tap
        return;
      }

      brick.strength--;
      
      // Audio
      if (brick.strength <= 0) {
        sound.playBrickDestroy(brick.maxStrength);
        triggerVibration(25); // Distinct breaking pop
      } else {
        sound.playBrickHit();
        triggerVibration(10); // Normal hit tap
      }

      // Calculate score & update combos
      state.combo++;
      state.comboTimer = 100; // Reset timer to max percentage
      
      const multiplier = Math.min(5, Math.floor(state.combo / 4) + 1);
      const pointsEarned = brick.maxStrength * 10 * multiplier;
      state.score += pointsEarned;
      onScoreChange(state.score);

      // Camera Shake
      state.screenShake = Math.max(state.screenShake, brick.maxStrength * 3.5);

      // Particles
      spawnParticles(
        brick.x + brick.width / 2,
        brick.y + brick.height / 2,
        brick.color,
        brick.strength <= 0 ? 16 : 6
      );

      // Handle powerups dropping on complete destruction
      if (brick.strength <= 0) {
        state.bricks.splice(idx, 1);
        
        if (brick.powerUp) {
          state.powerUps.push({
            id: `pu-${Math.random()}`,
            type: brick.powerUp,
            x: brick.x + brick.width / 2 - 14,
            y: brick.y + brick.height,
            width: 28,
            height: 28,
            speed: 2.2
          });
        }
      }
    };

    const applyPowerUp = (type: PowerUpType) => {
      const state = stateRef.current;
      
      if (type === PowerUpType.MULTI_BALL) {
        // Add 2 more balls based on existing ball positions
        const referenceBall = state.balls[0] || { x: GAME_WIDTH / 2, y: state.paddle.y - 12, dx: 4, dy: -5, radius: 8, speed: 6.5 };
        
        state.balls.push({
          id: `ball-${Math.random()}`,
          x: referenceBall.x,
          y: referenceBall.y,
          dx: referenceBall.dx * 0.9 + (Math.random() * 2 - 1),
          dy: -Math.abs(referenceBall.dy) * 0.95,
          radius: referenceBall.radius,
          speed: referenceBall.speed,
          isStuck: false,
          stuckRelativeX: 0
        });
        state.balls.push({
          id: `ball-${Math.random()}`,
          x: referenceBall.x,
          y: referenceBall.y,
          dx: -referenceBall.dx * 0.9 + (Math.random() * 2 - 1),
          dy: -Math.abs(referenceBall.dy) * 0.95,
          radius: referenceBall.radius,
          speed: referenceBall.speed,
          isStuck: false,
          stuckRelativeX: 0
        });
      } else if (type === PowerUpType.SHIELD) {
        state.hasShield = true;
      } else {
        // Standard timed powerups (10s = 600 frames)
        state.powerUpTimers[type] = 600;

        if (type === PowerUpType.EXPAND_PADDLE) {
          state.paddle.width = 180;
        }
        if (type === PowerUpType.STICKY_PADDLE) {
          state.paddle.isSticky = true;
        }
        if (type === PowerUpType.LASER_PADDLE) {
          state.paddle.isLaser = true;
        }
      }
    };

    const getPowerUpColor = (type: PowerUpType): string => {
      switch (type) {
        case PowerUpType.MULTI_BALL: return '#7b8a6d'; // Sage Green
        case PowerUpType.EXPAND_PADDLE: return '#c7866d'; // Terracotta
        case PowerUpType.STICKY_PADDLE: return '#cca752'; // Ochre Gold
        case PowerUpType.LASER_PADDLE: return '#3a5a40'; // Forest Green
        case PowerUpType.SLOW_MOTION: return '#8c857b'; // Slate Taupe
        case PowerUpType.SHIELD: return '#b05d47'; // Clay Red
      }
    };

    // RENDER CYCLE ON CANVAS
    const renderFrame = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      
      const state = stateRef.current;

      // Save context for screen shake
      ctx.save();
      
      // Clear Canvas with a sleek 2D retro dark arcade navy-black
      ctx.fillStyle = '#0f172a'; // Slate 900
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Draw subtle retro digital scanlines for an immersive 2D arcade monitor look
      ctx.fillStyle = 'rgba(255, 255, 255, 0.012)';
      for (let y = 0; y < GAME_HEIGHT; y += 4) {
        ctx.fillRect(0, y, GAME_WIDTH, 1.5);
      }

      // Handle Screen Shake offset
      if (state.screenShake > 0) {
        const dx = (Math.random() - 0.5) * state.screenShake;
        const dy = (Math.random() - 0.5) * state.screenShake;
        ctx.translate(dx, dy);
      }

      // Draw Grid lines (Very subtle translucent cyan lines to fit cyber/arcade style)
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.07)';
      ctx.lineWidth = 1;
      for (let x = WALL_WIDTH; x <= GAME_WIDTH - WALL_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, TOP_WALL_HEIGHT);
        ctx.lineTo(x, GAME_HEIGHT);
        ctx.stroke();
      }
      for (let y = TOP_WALL_HEIGHT; y < GAME_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(WALL_WIDTH, y);
        ctx.lineTo(GAME_WIDTH - WALL_WIDTH, y);
        ctx.stroke();
      }

      // Draw bottom safety line (as a sleek red warning neon bar)
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)'; // Crimson warning red
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(WALL_WIDTH, GAME_HEIGHT - 10);
      ctx.lineTo(GAME_WIDTH - WALL_WIDTH, GAME_HEIGHT - 10);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // Draw Shield (Powerup barrier) as a bright neon cyan energy barrier
      if (state.hasShield) {
        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#06b6d4';
        ctx.strokeStyle = '#06b6d4'; // Cyan barrier
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(WALL_WIDTH, GAME_HEIGHT - 6);
        ctx.lineTo(GAME_WIDTH - WALL_WIDTH, GAME_HEIGHT - 6);
        ctx.stroke();
        ctx.restore();
      }

      // Draw Brick Pillars and Archway (Sleek 2D Arcade Slate-Metal Border)
      const drawPillarsAndArch = () => {
        const blockHeight = 40;
        ctx.lineWidth = 2;
        
        // Left pillar (Sleek industrial metal blocks)
        let y = 0;
        while (y < GAME_HEIGHT) {
          ctx.fillStyle = '#334155'; // Slate-700
          ctx.fillRect(0, y, WALL_WIDTH, blockHeight);
          
          ctx.strokeStyle = '#000000';
          ctx.strokeRect(0, y, WALL_WIDTH, blockHeight);
          
          ctx.fillStyle = '#64748b'; // Metallic bevel highlight
          ctx.fillRect(3, y + 3, WALL_WIDTH - 6, 3);
          ctx.fillRect(3, y + 3, 3, blockHeight - 6);
          
          ctx.fillStyle = '#1e293b'; // Shading shadow
          ctx.fillRect(WALL_WIDTH - 6, y + 6, 3, blockHeight - 9);
          ctx.fillRect(6, y + blockHeight - 6, WALL_WIDTH - 9, 3);
          
          // Technical accent line across each block
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(6, y + blockHeight / 2);
          ctx.lineTo(WALL_WIDTH - 6, y + blockHeight / 2);
          ctx.stroke();

          y += blockHeight;
        }

        // Right pillar (Sleek industrial metal blocks)
        y = 0;
        while (y < GAME_HEIGHT) {
          ctx.fillStyle = '#334155';
          ctx.fillRect(GAME_WIDTH - WALL_WIDTH, y, WALL_WIDTH, blockHeight);
          
          ctx.strokeStyle = '#000000';
          ctx.strokeRect(GAME_WIDTH - WALL_WIDTH, y, WALL_WIDTH, blockHeight);
          
          ctx.fillStyle = '#64748b';
          ctx.fillRect(GAME_WIDTH - WALL_WIDTH + 3, y + 3, WALL_WIDTH - 6, 3);
          ctx.fillRect(GAME_WIDTH - WALL_WIDTH + 3, y + 3, 3, blockHeight - 6);
          
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(GAME_WIDTH - 6, y + 6, 3, blockHeight - 9);
          ctx.fillRect(GAME_WIDTH - WALL_WIDTH + 6, y + blockHeight - 6, WALL_WIDTH - 9, 3);
          
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(GAME_WIDTH - WALL_WIDTH + 6, y + blockHeight / 2);
          ctx.lineTo(GAME_WIDTH - 6, y + blockHeight / 2);
          ctx.stroke();

          y += blockHeight;
        }

        // Top arch ceiling
        const brickWidth = 40;
        for (let x = 0; x < GAME_WIDTH; x += brickWidth) {
          ctx.fillStyle = '#334155';
          ctx.fillRect(x, 0, brickWidth, TOP_WALL_HEIGHT);
          
          ctx.strokeStyle = '#000000';
          ctx.strokeRect(x, 0, brickWidth, TOP_WALL_HEIGHT);
          
          ctx.fillStyle = '#64748b';
          ctx.fillRect(x + 3, 3, brickWidth - 6, 3);
          ctx.fillRect(x + 3, 3, 3, TOP_WALL_HEIGHT - 6);
          
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(x + brickWidth - 6, 6, 3, TOP_WALL_HEIGHT - 9);
          ctx.fillRect(x + 6, TOP_WALL_HEIGHT - 6, brickWidth - 9, 3);
        }
      };

      drawPillarsAndArch();

      // Draw Bricks (Custom Mario Styled Bricks!)
      state.bricks.forEach(brick => {
        ctx.save();
        
        if (brick.strength === 9) {
          // Grey Titanium Block (Heavy, unbreakable, 2D industrial armor style)
          ctx.fillStyle = '#475569'; // Slate 600
          ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
          
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
          
          // Highlights
          ctx.fillStyle = '#94a3b8'; // Slate 400
          ctx.fillRect(brick.x + 2, brick.y + 2, brick.width - 4, 3);
          ctx.fillRect(brick.x + 2, brick.y + 2, 3, brick.height - 4);
          
          ctx.fillStyle = '#1e293b'; // Slate 800 shadow
          ctx.fillRect(brick.x + brick.width - 5, brick.y + 5, 3, brick.height - 7);
          ctx.fillRect(brick.x + 5, brick.y + brick.height - 5, brick.width - 7, 3);

          // Central core plate detail
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(brick.x + brick.width / 2, brick.y + brick.height / 2, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (brick.strength === 1) {
          // Special Diamond/Power-up Block (Blinking neon gold/yellow body with a white central diamond)
          const isBlink = Math.floor(state.frameCount / 8) % 2 === 0;
          ctx.fillStyle = isBlink ? '#eab308' : '#facc15';
          ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
          
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
          
          // Highlights and shadows
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(brick.x + 2, brick.y + 2, brick.width - 4, 2);
          ctx.fillRect(brick.x + 2, brick.y + 2, 2, brick.height - 4);
          
          ctx.fillStyle = '#ca8a04'; // Dark orange shadow
          ctx.fillRect(brick.x + 3, brick.y + brick.height - 4, brick.width - 5, 2);
          ctx.fillRect(brick.x + brick.width - 4, brick.y + 3, 2, brick.height - 5);

          // Draw shiny diamond core in center (generic powerup emblem)
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(brick.x + brick.width / 2, brick.y + 4);
          ctx.lineTo(brick.x + brick.width - 12, brick.y + brick.height / 2);
          ctx.lineTo(brick.x + brick.width / 2, brick.y + brick.height - 4);
          ctx.lineTo(brick.x + 12, brick.y + brick.height / 2);
          ctx.closePath();
          ctx.fill();
        } else {
          // Sleek glossy 2D arcade block
          ctx.fillStyle = brick.color;
          ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
          
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
          
          // Bevel highlights
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.fillRect(brick.x + 2, brick.y + 2, brick.width - 4, 2.5);
          ctx.fillRect(brick.x + 2, brick.y + 2, 2.5, brick.height - 4);

          // Inner bottom shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.fillRect(brick.x + 4, brick.y + brick.height - 5, brick.width - 8, 3);
          ctx.fillRect(brick.x + brick.width - 5, brick.y + 4, 3, brick.height - 8);

          // Elegant diagonal glint line across the block for a glassy retro-arcade look
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(brick.x + 10, brick.y + 4);
          ctx.lineTo(brick.x + brick.width - 10, brick.y + brick.height - 4);
          ctx.stroke();
        }
        
        // Shiny sparkle for power-up bricks
        if (brick.powerUp && brick.strength !== 9) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(brick.x + brick.width - 8, brick.y + 6, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw tactile vector fracture cracks if the brick has taken damage
        if (brick.strength < brick.maxStrength && brick.strength > 0 && brick.strength !== 9) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          const bx = brick.x;
          const by = brick.y;
          const bw = brick.width;
          const bh = brick.height;
          
          if (brick.strength === 1 && brick.maxStrength > 2) {
            // Heavy cracks (almost broken)
            ctx.moveTo(bx + bw * 0.25, by);
            ctx.lineTo(bx + bw * 0.4, by + bh * 0.45);
            ctx.lineTo(bx + bw * 0.3, by + bh * 0.7);
            ctx.lineTo(bx + bw * 0.45, by + bh);
            
            ctx.moveTo(bx + bw * 0.75, by);
            ctx.lineTo(bx + bw * 0.65, by + bh * 0.4);
            ctx.lineTo(bx + bw * 0.8, by + bh * 0.75);
            ctx.lineTo(bx + bw * 0.7, by + bh);
            
            ctx.moveTo(bx + 4, by + bh * 0.5);
            ctx.lineTo(bx + bw * 0.3, by + bh * 0.45);
            
            ctx.moveTo(bx + bw - 4, by + bh * 0.5);
            ctx.lineTo(bx + bw * 0.7, by + bh * 0.55);
          } else {
            // Light cracks (first stage of damage)
            ctx.moveTo(bx + bw * 0.5, by);
            ctx.lineTo(bx + bw * 0.45, by + bh * 0.5);
            ctx.lineTo(bx + bw * 0.55, by + bh);
            
            ctx.moveTo(bx + bw * 0.25, by + bh * 0.3);
            ctx.lineTo(bx + bw * 0.45, by + bh * 0.5);
          }
          ctx.stroke();
        }

        ctx.restore();
      });
      ctx.shadowBlur = 0; // reset

      // Draw Power-ups (Glowing 2D arcade badges inside floating protective bubbles)
      state.powerUps.forEach(pu => {
        ctx.save();
        
        // Semi-transparent neon circular bubble
        ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pu.x + pu.width / 2, pu.y + pu.height / 2, pu.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const cx = pu.x + pu.width / 2;
        const cy = pu.y + pu.height / 2;
        const r = pu.width / 2 - 3.5;
        
        // Inner badge backdrop
        ctx.fillStyle = '#1e293b'; // Slate 800
        ctx.strokeStyle = getPowerUpColor(pu.type);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Glowing text representation inside the badge
        ctx.fillStyle = getPowerUpColor(pu.type);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        
        let label = "?";
        if (pu.type === PowerUpType.MULTI_BALL) label = "3X";
        if (pu.type === PowerUpType.EXPAND_PADDLE) label = "↔";
        if (pu.type === PowerUpType.STICKY_PADDLE) label = "★";
        if (pu.type === PowerUpType.LASER_PADDLE) label = "▲";
        if (pu.type === PowerUpType.SLOW_MOTION) label = "⏳";
        if (pu.type === PowerUpType.SHIELD) label = "🛡️";

        ctx.fillText(label, cx, cy);
        ctx.restore();
      });
      ctx.shadowBlur = 0;

      // Draw Particles (Sleek pixelated spark squares)
      state.particles.forEach(p => {
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        ctx.restore();
      });
      ctx.globalAlpha = 1.0; // reset alpha

      // Draw Paddle (Sleek 2D Arcade Metallic Bumper Plate)
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = state.paddle.color;
      
      // Base plate
      ctx.fillStyle = '#334155'; // Slate 700 steel
      ctx.fillRect(state.paddle.x, state.paddle.y, state.paddle.width, state.paddle.height);
      
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(state.paddle.x, state.paddle.y, state.paddle.width, state.paddle.height);
      
      // Side thruster bumper indicators
      ctx.fillStyle = state.paddle.color;
      ctx.fillRect(state.paddle.x, state.paddle.y, 6, state.paddle.height);
      ctx.fillRect(state.paddle.x + state.paddle.width - 6, state.paddle.y, 6, state.paddle.height);
      
      // Center grips / stripes
      ctx.fillStyle = '#475569';
      for (let gx = state.paddle.x + 16; gx < state.paddle.x + state.paddle.width - 16; gx += 16) {
        ctx.fillRect(gx, state.paddle.y + 3, 4, state.paddle.height - 6);
      }
      
      // Sleek top highlight lightbar
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(state.paddle.x + 8, state.paddle.y + 2, state.paddle.width - 16, 2);

      // Render Laser turrets as sleek 2D metallic micro-blasters mounted on both ends
      if (state.paddle.isLaser) {
        ctx.fillStyle = '#ef4444'; // Red blaster tips
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        
        // Left blaster nozzle
        ctx.fillRect(state.paddle.x + 8, state.paddle.y - 6, 6, 6);
        ctx.strokeRect(state.paddle.x + 8, state.paddle.y - 6, 6, 6);
        
        // Right blaster nozzle
        ctx.fillRect(state.paddle.x + state.paddle.width - 14, state.paddle.y - 6, 6, 6);
        ctx.strokeRect(state.paddle.x + state.paddle.width - 14, state.paddle.y - 6, 6, 6);
      }
      ctx.restore();

      // Draw Balls (Highly polished 2D retro arcade energy spheres)
      state.balls.forEach(ball => {
        ctx.save();
        
        if (ball.isFireball) {
          // Drawing raging hot energy plasma ball!
          const scale = 1.0 + Math.sin(state.frameCount * 0.3) * 0.15;
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#ef4444'; // Glowing red-orange
          
          // Blazing outer orange aura
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius * 1.35 * scale, 0, Math.PI * 2);
          ctx.fill();
          
          // Yellow fire core
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius * 0.9, 0, Math.PI * 2);
          ctx.fill();

          // White hot center
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Sleek 2D Gold Energy Ball with realistic vector glint shading
          ctx.shadowBlur = 8;
          ctx.shadowColor = 'rgba(250, 204, 21, 0.4)'; // Soft gold glow

          // 1. Draw base body circle (Rich gold)
          ctx.fillStyle = '#eab308';
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
          ctx.fill();

          // 2. Draw black vector outline
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
          ctx.stroke();

          // 3. Draw a bottom-right inner shadow (Darker bronze crescent)
          ctx.fillStyle = '#ca8a04';
          ctx.beginPath();
          ctx.arc(ball.x + 1.2, ball.y + 1.2, ball.radius * 0.75, 0, Math.PI * 2);
          ctx.arc(ball.x - 1.2, ball.y - 1.2, ball.radius * 0.75, 0, Math.PI * 2, true);
          ctx.fill();

          // 4. Draw a top-left soft highlight crescent
          ctx.fillStyle = '#fef08a'; // Light yellow-white
          ctx.beginPath();
          ctx.arc(ball.x - 1.5, ball.y - 1.5, ball.radius * 0.6, 0, Math.PI * 2);
          ctx.arc(ball.x + 0.5, ball.y + 0.5, ball.radius * 0.6, 0, Math.PI * 2, true);
          ctx.fill();

          // 5. Draw pristine bright-white specular glint point near top-left edge
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ball.x - ball.radius * 0.35, ball.y - ball.radius * 0.35, ball.radius * 0.2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      // Draw active combo text & combo timer bar in middle if active
      if (state.combo >= 4) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Bounce pulse scale depending on frames
        const scale = 1.0 + Math.sin(state.frameCount * 0.15) * 0.08;
        ctx.translate(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 120);
        ctx.scale(scale, scale);
        
        const mult = Math.min(5, Math.floor(state.combo / 4) + 1);
        ctx.font = 'bold 20px "JetBrains Mono", monospace';
        ctx.fillStyle = '#ffffff'; // White text
        ctx.strokeStyle = '#000000'; // Solid black text outline for retro readability
        ctx.lineWidth = 3.5;
        ctx.strokeText(`COMBO x${state.combo} (x${mult} BONUS!)`, 0, 0);
        ctx.fillText(`COMBO x${state.combo} (x${mult} BONUS!)`, 0, 0);

        // Underline representing timer progress
        ctx.strokeStyle = '#facc15'; // Golden progress bar
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-60 * (state.comboTimer / 100), 18);
        ctx.lineTo(60 * (state.comboTimer / 100), 18);
        ctx.stroke();

        ctx.restore();
      }

      // Restore Context (Shake)
      ctx.restore();
    };

    // Begin loop execution
    animationFrameId = requestAnimationFrame(updateGame);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [onScoreChange, onLivesChange, onLevelComplete, onGameOver, onStatusChange]);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full min-h-0 flex items-center justify-center bg-[#0a0f1d] border border-slate-800 rounded-[24px] overflow-hidden shadow-[inset_0_4px_24px_rgba(0,0,0,0.8)]"
      id="game-canvas-container"
    >
      <canvas 
        ref={canvasRef} 
        className="block cursor-crosshair touch-none animate-fade-in"
        id="game-canvas"
      />
    </div>
  );
});

GameCanvas.displayName = 'GameCanvas';
