import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Player, MapData, GameState, Enemy, Vector2 } from '../types';
import { renderScene } from './Raycaster';
import { generateMission, generateEnemyBark } from '../services/geminiService';
import { 
  MOVE_SPEED, 
  ROTATION_SPEED, 
  SCREEN_WIDTH, 
  SCREEN_HEIGHT, 
  ENEMY_STATS, 
  WEAPON_DAMAGE 
} from '../constants';
import { Sparkles, Skull, Crosshair, Zap } from 'lucide-react';

const INITIAL_PLAYER: Player = {
  pos: { x: 3.5, y: 3.5 },
  dir: { x: -1, y: 0 },
  plane: { x: 0, y: 0.66 },
  health: 100,
  ammo: 50,
  score: 0
};

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>({
    screen: 'MENU',
    missionName: '',
    missionBrief: '',
    logs: []
  });
  
  // Game logic state (Refs for performance to avoid re-renders during loop)
  const playerRef = useRef<Player>({ ...INITIAL_PLAYER });
  const mapRef = useRef<MapData | null>(null);
  const enemiesRef = useRef<Enemy[]>([]);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const lastTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  // Audio refs
  const shootSoundRef = useRef<HTMLAudioElement | null>(null);

  const addLog = useCallback((msg: string) => {
    setGameState(prev => ({
      ...prev,
      logs: [msg, ...prev.logs].slice(0, 5)
    }));
  }, []);

  // --- Controls ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysPressed.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.code] = false; };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- Game Loop ---
  const gameLoop = useCallback((timestamp: number) => {
    if (gameState.screen !== 'PLAYING') return;

    const dt = timestamp - lastTimeRef.current; // Delta time could be used for smoother movement
    lastTimeRef.current = timestamp;

    const player = playerRef.current;
    const map = mapRef.current;
    if (!map) return;

    // 1. Movement Logic
    // Rotation
    if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) {
      const oldDirX = player.dir.x;
      player.dir.x = player.dir.x * Math.cos(-ROTATION_SPEED) - player.dir.y * Math.sin(-ROTATION_SPEED);
      player.dir.y = oldDirX * Math.sin(-ROTATION_SPEED) + player.dir.y * Math.cos(-ROTATION_SPEED);
      const oldPlaneX = player.plane.x;
      player.plane.x = player.plane.x * Math.cos(-ROTATION_SPEED) - player.plane.y * Math.sin(-ROTATION_SPEED);
      player.plane.y = oldPlaneX * Math.sin(-ROTATION_SPEED) + player.plane.y * Math.cos(-ROTATION_SPEED);
    }
    if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) {
      const oldDirX = player.dir.x;
      player.dir.x = player.dir.x * Math.cos(ROTATION_SPEED) - player.dir.y * Math.sin(ROTATION_SPEED);
      player.dir.y = oldDirX * Math.sin(ROTATION_SPEED) + player.dir.y * Math.cos(ROTATION_SPEED);
      const oldPlaneX = player.plane.x;
      player.plane.x = player.plane.x * Math.cos(ROTATION_SPEED) - player.plane.y * Math.sin(ROTATION_SPEED);
      player.plane.y = oldPlaneX * Math.sin(ROTATION_SPEED) + player.plane.y * Math.cos(ROTATION_SPEED);
    }

    // Move Forward/Back
    if (keysPressed.current['ArrowUp'] || keysPressed.current['KeyW']) {
      if (map.grid[Math.floor(player.pos.y)][Math.floor(player.pos.x + player.dir.x * MOVE_SPEED)] === 0) {
        player.pos.x += player.dir.x * MOVE_SPEED;
      }
      if (map.grid[Math.floor(player.pos.y + player.dir.y * MOVE_SPEED)][Math.floor(player.pos.x)] === 0) {
        player.pos.y += player.dir.y * MOVE_SPEED;
      }
    }
    if (keysPressed.current['ArrowDown'] || keysPressed.current['KeyS']) {
      if (map.grid[Math.floor(player.pos.y)][Math.floor(player.pos.x - player.dir.x * MOVE_SPEED)] === 0) {
        player.pos.x -= player.dir.x * MOVE_SPEED;
      }
      if (map.grid[Math.floor(player.pos.y - player.dir.y * MOVE_SPEED)][Math.floor(player.pos.x)] === 0) {
        player.pos.y -= player.dir.y * MOVE_SPEED;
      }
    }

    // 2. Enemy Logic (Simple AI)
    enemiesRef.current.forEach(enemy => {
      if (enemy.state === 'DEAD') return;

      const dist = Math.sqrt((player.pos.x - enemy.pos.x) ** 2 + (player.pos.y - enemy.pos.y) ** 2);
      
      // Chase
      if (dist < 8 && dist > 1) { // Activation radius
        enemy.state = 'CHASING';
        const moveX = (player.pos.x - enemy.pos.x) * ENEMY_STATS[enemy.type].speed;
        const moveY = (player.pos.y - enemy.pos.y) * ENEMY_STATS[enemy.type].speed;
        
        // Simple collision check for enemy
        if (map.grid[Math.floor(enemy.pos.y)][Math.floor(enemy.pos.x + moveX)] === 0) {
            enemy.pos.x += moveX;
        }
        if (map.grid[Math.floor(enemy.pos.y + moveY)][Math.floor(enemy.pos.x)] === 0) {
            enemy.pos.y += moveY;
        }
      }

      // Attack
      if (dist < 1.5) {
        enemy.state = 'ATTACKING';
        if (Math.random() < 0.05) { // Random chance to hit per frame
          player.health -= ENEMY_STATS[enemy.type].damage;
          addLog(`${enemy.type} hits you! -${ENEMY_STATS[enemy.type].damage} HP`);
          // Flash screen red (handled in render via state if we wanted, but let's just log for now)
          
          if (player.health <= 0) {
            setGameState(prev => ({ ...prev, screen: 'GAMEOVER' }));
          }
        }
      }
    });

    // 3. Render
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && mapRef.current) {
      renderScene(ctx, player, mapRef.current, enemiesRef.current);
    }
    
    // Force UI update periodically if needed (React State updates are slow, so do sparingly)
    // Here we might rely on a separate interval for UI or just accept 60fps React updates if the component is simple.
    // However, updating React state every frame kills performance. 
    // We will update the HUD using a separate `useRef` based approach or only update when values change significantly.
    // For this demo, let's just trigger a re-render if health changes.
    // Actually, let's keep React state out of the 60fps loop. We'll use a `useEffect` with setInterval to sync HUD.

    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [gameState.screen, addLog]);

  // Sync HUD
  const [hudStats, setHudStats] = useState({ hp: 100, ammo: 0, score: 0 });
  useEffect(() => {
    const interval = setInterval(() => {
        if (gameState.screen === 'PLAYING') {
            const p = playerRef.current;
            setHudStats(prev => {
                if (prev.hp !== p.health || prev.ammo !== p.ammo || prev.score !== p.score) {
                    return { hp: p.health, ammo: p.ammo, score: p.score };
                }
                return prev;
            });
        }
    }, 200);
    return () => clearInterval(interval);
  }, [gameState.screen]);

  // Start Loop
  useEffect(() => {
    if (gameState.screen === 'PLAYING') {
      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    }
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [gameState.screen, gameLoop]);


  // --- Actions ---
  const startGame = async () => {
    setGameState(prev => ({ ...prev, screen: 'LOADING', logs: ["Establishing neural link...", "Downloading grid data..."] }));
    
    const { map, name, brief } = await generateMission();
    
    // Spawn Player
    // Find empty spot
    let spawnX = 1.5, spawnY = 1.5;
    for(let y=1; y<map.height-1; y++) {
        for(let x=1; x<map.width-1; x++) {
            if (map.grid[y][x] === 0) {
                spawnX = x + 0.5;
                spawnY = y + 0.5;
                break;
            }
        }
    }

    playerRef.current = {
        ...INITIAL_PLAYER,
        pos: { x: spawnX, y: spawnY }
    };
    mapRef.current = map;
    
    // Spawn Enemies
    const enemies: Enemy[] = [];
    const enemyTypes = Object.keys(ENEMY_STATS) as ('WOLF'|'TIGER'|'FOX')[];
    
    // Simple spawning logic: 1 enemy per 10 empty tiles roughly
    let emptyCount = 0;
    map.grid.forEach((row, y) => row.forEach((cell, x) => {
        if (cell === 0) {
            emptyCount++;
            if (Math.random() < 0.08 && (Math.abs(x - spawnX) > 4 || Math.abs(y - spawnY) > 4)) {
                const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
                enemies.push({
                    id: Math.random().toString(36),
                    pos: { x: x + 0.5, y: y + 0.5 },
                    type,
                    health: ENEMY_STATS[type].hp,
                    state: 'IDLE',
                    texture: ENEMY_STATS[type].symbol,
                    lastSeen: 0
                });
            }
        }
    }));
    enemiesRef.current = enemies;

    setGameState({
        screen: 'PLAYING',
        missionName: name,
        missionBrief: brief,
        logs: ["System Online.", "Weapons Free."]
    });
  };

  const handleShoot = useCallback(async () => {
    if (gameState.screen !== 'PLAYING') return;
    
    // Simple Raycast for shooting
    const player = playerRef.current;
    
    // Gun recoil visual could go here
    
    // Check enemies
    // Sort enemies by distance to check closest first? 
    // Actually shooting is instant hitscan in middle of screen.
    // We just check if an enemy is roughly in the center of the FOV and visible.
    
    let hitEnemy: Enemy | null = null;
    let minDist = 1000;

    enemiesRef.current.forEach(e => {
        if (e.state === 'DEAD') return;
        
        // Vector to enemy
        const dx = e.pos.x - player.pos.x;
        const dy = e.pos.y - player.pos.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // Angle to enemy
        // const angleToEnemy = Math.atan2(dy, dx);
        // const playerAngle = Math.atan2(player.dir.y, player.dir.x);
        
        // Easier: project enemy to screen X. If near center (SCREEN_WIDTH/2), it's a hit.
        // Re-use projection logic from Raycaster? Or simplified dot product.
        
        const dirMag = Math.sqrt(player.dir.x**2 + player.dir.y**2);
        const toEnemyX = dx / dist;
        const toEnemyY = dy / dist;
        
        const dot = toEnemyX * player.dir.x + toEnemyY * player.dir.y;
        // Dot product close to 1 means facing directly
        if (dot > 0.95) { // Threshold for "aim"
             if (dist < minDist) {
                 // Check walls occlusion simply?
                 // For now, shoot through walls allowed or ignore for MVP responsiveness
                 minDist = dist;
                 hitEnemy = e;
             }
        }
    });

    if (hitEnemy) {
        const e = hitEnemy as Enemy;
        e.health -= WEAPON_DAMAGE;
        addLog(`Hit ${e.type}!`);
        
        if (e.health <= 0) {
            e.state = 'DEAD';
            player.score += 100;
            addLog(`Neutralized ${e.type}.`);
            
            // Async generate death bark
            generateEnemyBark('DEATH', e.type).then(bark => {
                if(bark) addLog(`${e.type}: "${bark}"`);
            });
        } else {
             // Hit bark
             if (Math.random() > 0.7) {
                 generateEnemyBark('HIT', e.type).then(bark => {
                    if(bark) addLog(`${e.type}: "${bark}"`);
                 });
             }
        }
    }
  }, [gameState.screen, addLog]);

  // Click to shoot
  useEffect(() => {
      const handler = () => handleShoot();
      window.addEventListener('mousedown', handler);
      return () => window.removeEventListener('mousedown', handler);
  }, [handleShoot]);


  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden crt">
      
      {/* --- MENU SCREEN --- */}
      {gameState.screen === 'MENU' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/90 text-green-500">
          <h1 className="text-6xl font-cyber font-bold mb-4 animate-pulse tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
            NEON PREDATOR
          </h1>
          <p className="mb-8 text-xl font-mono text-gray-400">Hunt. Survive. Upgrade.</p>
          <button 
            onClick={startGame}
            className="px-8 py-4 border-2 border-green-500 text-green-500 hover:bg-green-500 hover:text-black font-bold text-xl transition-all duration-200 uppercase tracking-wider"
          >
            Initialize Sequence
          </button>
        </div>
      )}

      {/* --- LOADING --- */}
      {gameState.screen === 'LOADING' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black text-green-500 font-mono">
           <div className="w-16 h-16 border-4 border-t-green-500 border-r-transparent border-b-green-500 border-l-transparent rounded-full animate-spin mb-4"></div>
           <p className="animate-pulse">GENERATING NEURAL INTERFACE...</p>
        </div>
      )}

      {/* --- GAME OVER --- */}
      {gameState.screen === 'GAMEOVER' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-red-900/90 text-white font-mono">
           <Skull size={64} className="mb-4 text-red-500" />
           <h2 className="text-5xl font-bold mb-2 text-red-500">SIGNAL LOST</h2>
           <p className="mb-6">You have been neutralized.</p>
           <button 
            onClick={() => setGameState(prev => ({ ...prev, screen: 'MENU' }))}
            className="px-6 py-2 border border-white hover:bg-white hover:text-red-900 transition"
           >
             Reboot System
           </button>
        </div>
      )}

      {/* --- GAME CANVAS --- */}
      <canvas 
        ref={canvasRef}
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        className="w-full h-full object-cover image-pixelated"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* --- HUD --- */}
      {gameState.screen === 'PLAYING' && (
        <div className="absolute inset-0 pointer-events-none">
            {/* Crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-green-400 opacity-80">
                <Crosshair size={32} />
            </div>

            {/* Weapon Overlay */}
            <div className="absolute bottom-0 right-1/4 w-1/2 h-1/3 flex justify-center items-end">
                 {/* Simple CSS Gun Representation */}
                 <div className="w-32 h-48 bg-gray-800 border-4 border-gray-600 rounded-t-lg relative transform translate-y-4">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-full bg-gray-900"></div>
                    <div className="absolute bottom-10 -left-4 w-40 h-12 bg-gray-700 rounded-lg"></div>
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_red]"></div>
                 </div>
            </div>

            {/* Top Bar */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                <div className="bg-black/50 border border-green-500 p-4 rounded backdrop-blur-sm max-w-md">
                    <h3 className="text-green-400 font-bold text-lg mb-1">{gameState.missionName}</h3>
                    <p className="text-xs text-gray-300 leading-tight">{gameState.missionBrief}</p>
                </div>
                
                <div className="flex flex-col gap-2 items-end">
                    <div className="text-yellow-400 font-mono text-xl font-bold">SCORE: {hudStats.score.toString().padStart(6, '0')}</div>
                    {/* Log Feed */}
                    <div className="w-64 flex flex-col gap-1 items-end">
                        {gameState.logs.map((log, i) => (
                            <div key={i} className="text-xs font-mono text-cyan-300 bg-black/60 px-2 py-1 rounded animate-fade-in">
                                {`> ${log}`}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="absolute bottom-8 left-8 flex items-center gap-8">
                {/* Health */}
                <div className="flex flex-col">
                    <label className="text-xs text-green-500 font-bold tracking-widest">VITALS</label>
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-48 bg-gray-800 border border-gray-600 skew-x-12 relative overflow-hidden">
                            <div 
                                className={`absolute top-0 left-0 h-full transition-all duration-300 ${hudStats.hp > 30 ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} 
                                style={{ width: `${hudStats.hp}%` }}
                            />
                        </div>
                        <span className="text-2xl font-mono font-bold text-white">{Math.ceil(hudStats.hp)}%</span>
                    </div>
                </div>
                
                {/* Weapon Stats */}
                <div className="flex flex-col">
                     <label className="text-xs text-blue-500 font-bold tracking-widest">CHARGE</label>
                     <div className="flex items-center gap-2 text-blue-400">
                        <Zap size={24} />
                        <span className="text-2xl font-mono font-bold">INF</span>
                     </div>
                </div>
            </div>
            
            {/* Controls Hint */}
             <div className="absolute bottom-2 right-2 text-gray-600 text-xs font-mono">
                WASD: Move | MOUSE: Click to Fire
            </div>
        </div>
      )}
    </div>
  );
}
