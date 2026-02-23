export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  ROUND_END = 'ROUND_END',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
}

export interface Missile extends Entity {
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  progress: number; // 0 to 1
  speed: number;
  turretIndex: number;
}

export interface EnemyRocket extends Entity {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
}

export interface Explosion extends Entity {
  radius: number;
  maxRadius: number;
  growing: boolean;
  life: number; // 0 to 1
}

export interface City extends Entity {
  active: boolean;
}

export interface Turret extends Entity {
  active: boolean;
  ammo: number;
  maxAmmo: number;
}

export interface GameStats {
  score: number;
  round: number;
  totalEnemyDestroyed: number;
}
