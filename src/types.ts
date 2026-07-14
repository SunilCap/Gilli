/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum GameStatus {
  START = 'START',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAMEOVER = 'GAMEOVER',
  VICTORY = 'VICTORY',
}

export enum PowerUpType {
  MULTI_BALL = 'MULTI_BALL',
  EXPAND_PADDLE = 'EXPAND_PADDLE',
  STICKY_PADDLE = 'STICKY_PADDLE',
  LASER_PADDLE = 'LASER_PADDLE',
  SLOW_MOTION = 'SLOW_MOTION',
  SHIELD = 'SHIELD',
}

export interface Ball {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  speed: number;
  isStuck: boolean;
  stuckRelativeX: number; // Position relative to paddle when stuck
  isFireball?: boolean; // Destroys bricks instantly without bouncing
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  color: string;
  isSticky: boolean;
  isLaser: boolean;
  laserCooldown: number;
}

export interface Brick {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  strength: number;
  maxStrength: number;
  color: string;
  powerUp?: PowerUpType;
}

export interface PowerUpItem {
  id: string;
  type: PowerUpType;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface Laser {
  id: string;
  x: number;
  y: number;
  dy: number;
  width: number;
  height: number;
}

export interface ScoreEntry {
  name: string;
  score: number;
  date: string;
  level: number;
}
