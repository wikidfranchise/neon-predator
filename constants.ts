export const TILE_SIZE = 64;
export const FOV = 0.66; // Field of view (tan(66/2))
export const ROTATION_SPEED = 0.08; // Radians per frame
export const MOVE_SPEED = 0.12; // Units per frame
export const MINIMAP_SCALE = 0.2;

export const SCREEN_WIDTH = 640;
export const SCREEN_HEIGHT = 360; // Internal render resolution (scaled up by CSS)

export const WALL_COLORS = [
  '#000000', // 0: None
  '#00FF99', // 1: Cyber Green
  '#FF0055', // 2: Neon Pink
  '#00CCFF', // 3: Electric Blue
  '#FFCC00', // 4: Warning Yellow
];

// Enemy Config
export const ENEMY_STATS = {
  WOLF: { hp: 50, speed: 0.04, damage: 10, symbol: '🐺' },
  TIGER: { hp: 100, speed: 0.03, damage: 20, symbol: '🐯' },
  FOX: { hp: 30, speed: 0.06, damage: 5, symbol: '🦊' },
};

export const WEAPON_DAMAGE = 25;
