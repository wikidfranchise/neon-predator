import { MapData, Player, Enemy, Vector2 } from "../types";
import { SCREEN_WIDTH, SCREEN_HEIGHT, WALL_COLORS, ENEMY_STATS } from "../constants";

// Helper to draw a vertical line
function drawVerticalLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y1: number,
  y2: number,
  color: string,
  brightness: number
) {
  ctx.fillStyle = color;
  ctx.globalAlpha = brightness;
  ctx.fillRect(x, y1, 1, y2 - y1);
  ctx.globalAlpha = 1.0;
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  player: Player,
  map: MapData,
  enemies: Enemy[]
) {
  // 1. Clear & Background
  ctx.fillStyle = map.ceilingColor;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT / 2);
  ctx.fillStyle = map.floorColor;
  ctx.fillRect(0, SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT / 2);

  // Z-Buffer for sprite occlusion
  const zBuffer = new Array(SCREEN_WIDTH).fill(0);

  // 2. Cast Rays for Walls
  for (let x = 0; x < SCREEN_WIDTH; x++) {
    const cameraX = (2 * x) / SCREEN_WIDTH - 1;
    const rayDirX = player.dir.x + player.plane.x * cameraX;
    const rayDirY = player.dir.y + player.plane.y * cameraX;

    let mapX = Math.floor(player.pos.x);
    let mapY = Math.floor(player.pos.y);

    let sideDistX;
    let sideDistY;

    const deltaDistX = Math.abs(1 / rayDirX);
    const deltaDistY = Math.abs(1 / rayDirY);

    let perpWallDist;
    let stepX;
    let stepY;
    let hit = 0;
    let side; // 0 for NS, 1 for EW

    if (rayDirX < 0) {
      stepX = -1;
      sideDistX = (player.pos.x - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1.0 - player.pos.x) * deltaDistX;
    }

    if (rayDirY < 0) {
      stepY = -1;
      sideDistY = (player.pos.y - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1.0 - player.pos.y) * deltaDistY;
    }

    // DDA
    let wallType = 0;
    while (hit === 0) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }
      // Check bounds
      if (mapX < 0 || mapX >= map.width || mapY < 0 || mapY >= map.height) {
        hit = 1;
        wallType = 1; // Default border
      } else if (map.grid[mapY][mapX] > 0) {
        hit = 1;
        wallType = map.grid[mapY][mapX];
      }
    }

    if (side === 0) perpWallDist = (sideDistX - deltaDistX);
    else perpWallDist = (sideDistY - deltaDistY);

    // Store for sprite casting
    zBuffer[x] = perpWallDist;

    // Draw Wall
    const lineHeight = Math.floor(SCREEN_HEIGHT / perpWallDist);
    let drawStart = -lineHeight / 2 + SCREEN_HEIGHT / 2;
    if (drawStart < 0) drawStart = 0;
    let drawEnd = lineHeight / 2 + SCREEN_HEIGHT / 2;
    if (drawEnd >= SCREEN_HEIGHT) drawEnd = SCREEN_HEIGHT - 1;

    // Color logic
    const baseColor = WALL_COLORS[wallType] || '#FFFFFF';
    // Shade side walls darker
    const brightness = side === 1 ? 0.7 : 1.0; 
    
    // Basic Fog
    const fog = Math.max(0, 1 - (perpWallDist / 15)); // Visibility falls off

    // Draw the vertical strip
    // We manually mix the color with black for fog/brightness
    // For speed, just use globalAlpha on top of a black background? 
    // Actually, drawing colored rect is faster.
    
    ctx.fillStyle = baseColor;
    // Apply shading
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);

    // Very simple shading
    const shade = brightness * fog;
    const finalColor = `rgb(${r*shade},${g*shade},${b*shade})`;

    ctx.fillStyle = finalColor;
    ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
  }

  // 3. Render Sprites (Enemies)
  // Sort sprites by distance
  const spriteOrder = enemies.map((e) => {
    return {
      enemy: e,
      dist: ((player.pos.x - e.pos.x) ** 2 + (player.pos.y - e.pos.y) ** 2)
    };
  }).sort((a, b) => b.dist - a.dist); // Far to near

  for (const item of spriteOrder) {
    if (item.enemy.state === 'DEAD') continue;

    const spriteX = item.enemy.pos.x - player.pos.x;
    const spriteY = item.enemy.pos.y - player.pos.y;

    // Transform sprite with the inverse camera matrix
    // [ planeX   dirX ] -1                                       [ dirY      -dirX ]
    // [               ]       =  1/(planeX*dirY-dirX*planeY) *   [                 ]
    // [ planeY   dirY ]                                          [ -planeY  planeX ]

    const invDet = 1.0 / (player.plane.x * player.dir.y - player.dir.x * player.plane.y);
    const transformX = invDet * (player.dir.y * spriteX - player.dir.x * spriteY);
    const transformY = invDet * (-player.plane.y * spriteX + player.plane.x * spriteY); // Depth inside screen

    const spriteScreenX = Math.floor((SCREEN_WIDTH / 2) * (1 + transformX / transformY));

    // Calculate height of the sprite on screen
    const spriteHeight = Math.abs(Math.floor(SCREEN_HEIGHT / transformY)); // Using 'transformY' instead of real dist prevents fisheye
    // Calculate width of the sprite
    const spriteWidth = Math.abs(Math.floor(SCREEN_HEIGHT / transformY)); // Aspect ratio 1

    let drawStartY = -spriteHeight / 2 + SCREEN_HEIGHT / 2;
    if (drawStartY < 0) drawStartY = 0;
    let drawEndY = spriteHeight / 2 + SCREEN_HEIGHT / 2;
    if (drawEndY >= SCREEN_HEIGHT) drawEndY = SCREEN_HEIGHT - 1;

    let drawStartX = -spriteWidth / 2 + spriteScreenX;
    let drawEndX = spriteWidth / 2 + spriteScreenX;
    
    // Draw the sprite if it's in front of camera plane
    if (transformY > 0) { 
        // We are drawing a simple emoji text instead of texture strips
        // Check if visible (center point within screen bounds roughly)
        if (drawStartX < SCREEN_WIDTH && drawEndX > 0) {
            // Check zBuffer at the center of the sprite to decide occlusion
            // A perfect sprite check would check every vertical stripe, 
            // but for a simple emoji, checking the center or a few points is enough.
            const checkX = Math.floor(Math.max(0, Math.min(SCREEN_WIDTH - 1, spriteScreenX)));
            
            if (transformY < zBuffer[checkX]) {
                // Render Emoji
                const size = Math.floor(spriteHeight * 0.8);
                ctx.font = `${size}px sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "white"; // Fallback
                
                // Shadow/Glow
                ctx.shadowColor = item.enemy.type === 'TIGER' ? 'orange' : 'cyan';
                ctx.shadowBlur = 10;
                
                // FIXED: Changed item.enemy.symbol to item.enemy.texture
                ctx.fillText(item.enemy.texture, spriteScreenX, SCREEN_HEIGHT / 2 + size * 0.1);
                
                // Health bar above enemy
                const hpPercent = item.enemy.health / ENEMY_STATS[item.enemy.type].hp;
                const barW = size;
                const barH = size * 0.1;
                const barX = spriteScreenX - barW/2;
                const barY = (SCREEN_HEIGHT/2) - size * 0.6;
                
                ctx.shadowBlur = 0;
                ctx.fillStyle = 'red';
                ctx.fillRect(barX, barY, barW, barH);
                ctx.fillStyle = '#00ff00';
                ctx.fillRect(barX, barY, barW * hpPercent, barH);
            }
        }
    }
  }
}
