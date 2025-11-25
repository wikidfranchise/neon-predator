export interface Vector2 {
  x: number;
  y: number;
}

export interface Player {
  pos: Vector2;
  dir: Vector2; // Direction vector
  plane: Vector2; // Camera plane vector (for FOV)
  health: number;
  ammo: number;
  score: number;
}

export interface Enemy {
  id: string;
  pos: Vector2;
  type: 'WOLF' | 'TIGER' | 'FOX';
  health: number;
  state: 'IDLE' | 'CHASING' | 'ATTACKING' | 'DYING' | 'DEAD';
  texture: string; // Emoji char
  lastSeen: number;
}

export interface MapData {
  grid: number[][]; // 0 = empty, 1+ = walls
  width: number;
  height: number;
  floorColor: string;
  ceilingColor: string;
}

export interface GameState {
  screen: 'MENU' | 'LOADING' | 'PLAYING' | 'GAMEOVER' | 'VICTORY';
  missionName: string;
  missionBrief: string;
  logs: string[];
}

export enum RayResult {
  NONE,
  WALL,
  ENEMY
}
