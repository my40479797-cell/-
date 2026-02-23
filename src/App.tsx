/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Trophy, RotateCcw, Play, AlertTriangle } from 'lucide-react';
import { 
  GameState, 
  Missile, 
  EnemyRocket, 
  Explosion, 
  City, 
  Turret, 
  GameStats 
} from './types/game';
import { 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  TURRET_CONFIGS, 
  CITY_COUNT, 
  EXPLOSION_MAX_RADIUS, 
  EXPLOSION_SPEED, 
  MISSILE_SPEED, 
  ENEMY_SPEED_MIN, 
  ENEMY_SPEED_MAX, 
  WIN_SCORE,
  COLORS 
} from './constants/game';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [stats, setStats] = useState<GameStats>({ score: 0, round: 1, totalEnemyDestroyed: 0 });
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');

  // Game Entities
  const missilesRef = useRef<Missile[]>([]);
  const enemyRocketsRef = useRef<EnemyRocket[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const citiesRef = useRef<City[]>([]);
  const turretsRef = useRef<Turret[]>([]);
  const enemiesToSpawnRef = useRef<number>(0);
  const enemiesSpawnedRef = useRef<number>(0);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  
  const requestRef = useRef<number>(null);

  useEffect(() => {
    const img = new Image();
    img.src = 'https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/480px-Manchester_City_FC_badge.svg.png';
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      bgImageRef.current = img;
    };
  }, []);

  const initGame = useCallback(() => {
    // Init Cities
    const cities: City[] = [];
    const spacing = GAME_WIDTH / (CITY_COUNT + 1);
    for (let i = 0; i < CITY_COUNT; i++) {
      let x = spacing * (i + 1);
      cities.push({ id: `city-${i}`, x, y: GAME_HEIGHT - 20, active: true });
    }
    citiesRef.current = cities;

    // Init Turrets
    turretsRef.current = TURRET_CONFIGS.map((config, i) => ({
      id: `turret-${i}`,
      x: config.x,
      y: GAME_HEIGHT - 30,
      active: true,
      ammo: config.maxAmmo,
      maxAmmo: config.maxAmmo
    }));

    missilesRef.current = [];
    enemyRocketsRef.current = [];
    explosionsRef.current = [];
    enemiesToSpawnRef.current = 0;
    enemiesSpawnedRef.current = 0;
    setStats({ score: 0, round: 1, totalEnemyDestroyed: 0 });
  }, []);

  const startRound = useCallback((round: number) => {
    const count = 10 + round * 2;
    enemiesToSpawnRef.current = count;
    enemiesSpawnedRef.current = 0;
    
    // Restore cities at start of round
    citiesRef.current.forEach(c => c.active = true);
    // Restore turret ammo
    turretsRef.current.forEach(t => {
      if (t.active) t.ammo = t.maxAmmo;
    });

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        // Use a ref check for gameState because this is a timeout
        // We'll check it inside the interval/timeout logic
      }, i * 1000);
    }
  }, []);

  const spawnEnemy = useCallback((round: number) => {
    if (enemiesSpawnedRef.current >= enemiesToSpawnRef.current) return;
    
    enemiesSpawnedRef.current++;
    const startX = Math.random() * GAME_WIDTH;
    const targets = [...citiesRef.current.filter(c => c.active), ...turretsRef.current.filter(t => t.active)];
    if (targets.length === 0) return;
    
    const target = targets[Math.floor(Math.random() * targets.length)];
    
    enemyRocketsRef.current.push({
      id: `enemy-${Date.now()}-${enemiesSpawnedRef.current}`,
      startX,
      startY: 0,
      x: startX,
      y: 0,
      targetX: target.x,
      targetY: target.y,
      progress: 0,
      speed: ENEMY_SPEED_MIN + Math.random() * (ENEMY_SPEED_MAX - ENEMY_SPEED_MIN) * (1 + round * 0.1)
    });
  }, []);

  const handleFire = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== GameState.PLAYING) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    const targetX = (clientX - rect.left) * scaleX;
    const targetY = (clientY - rect.top) * scaleY;

    // Don't fire below the turrets
    if (targetY > GAME_HEIGHT - 60) return;

    // Find closest active turret with ammo
    let bestTurretIndex = -1;
    let minDist = Infinity;

    turretsRef.current.forEach((t, i) => {
      if (t.active && t.ammo > 0) {
        const dist = Math.abs(t.x - targetX);
        if (dist < minDist) {
          minDist = dist;
          bestTurretIndex = i;
        }
      }
    });

    if (bestTurretIndex !== -1) {
      const turret = turretsRef.current[bestTurretIndex];
      turret.ammo--;
      
      missilesRef.current.push({
        id: `missile-${Date.now()}`,
        startX: turret.x,
        startY: turret.y,
        x: turret.x,
        y: turret.y,
        targetX,
        targetY,
        progress: 0,
        speed: MISSILE_SPEED,
        turretIndex: bestTurretIndex
      });
    }
  };

  const update = useCallback(() => {
    if (gameState !== GameState.PLAYING) return;

    // Update Missiles
    missilesRef.current = missilesRef.current.filter(m => {
      m.progress += m.speed;
      m.x = m.startX + (m.targetX - m.startX) * m.progress;
      m.y = m.startY + (m.targetY - m.startY) * m.progress;

      if (m.progress >= 1) {
        explosionsRef.current.push({
          id: `explosion-${Date.now()}`,
          x: m.targetX,
          y: m.targetY,
          radius: 0,
          maxRadius: EXPLOSION_MAX_RADIUS,
          growing: true,
          life: 1
        });
        return false;
      }
      return true;
    });

    // Update Explosions
    explosionsRef.current = explosionsRef.current.filter(exp => {
      if (exp.growing) {
        exp.radius += EXPLOSION_MAX_RADIUS * EXPLOSION_SPEED;
        if (exp.radius >= exp.maxRadius) {
          exp.growing = false;
        }
      } else {
        exp.life -= 0.02;
        exp.radius -= EXPLOSION_MAX_RADIUS * 0.01;
      }
      return exp.life > 0;
    });

    // Update Enemy Rockets
    enemyRocketsRef.current = enemyRocketsRef.current.filter(rocket => {
      rocket.progress += rocket.speed;
      rocket.x = rocket.startX + (rocket.targetX - rocket.startX) * rocket.progress;
      rocket.y = rocket.startY + (rocket.targetY - rocket.startY) * rocket.progress;

      // Check collision with explosions
      let destroyed = false;
      explosionsRef.current.forEach(exp => {
        const dx = rocket.x - exp.x;
        const dy = rocket.y - exp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < exp.radius) {
          destroyed = true;
        }
      });

      if (destroyed) {
        setStats(prev => ({
          ...prev,
          score: prev.score + 20,
          totalEnemyDestroyed: prev.totalEnemyDestroyed + 1
        }));
        explosionsRef.current.push({
          id: `explosion-enemy-${Date.now()}`,
          x: rocket.x,
          y: rocket.y,
          radius: 0,
          maxRadius: EXPLOSION_MAX_RADIUS * 1.2, // Increased for easier chain reactions
          growing: true,
          life: 1
        });
        return false;
      }

      if (rocket.progress >= 1) {
        // Hit target
        explosionsRef.current.push({
          id: `explosion-hit-${Date.now()}`,
          x: rocket.targetX,
          y: rocket.targetY,
          radius: 0,
          maxRadius: EXPLOSION_MAX_RADIUS * 1.5,
          growing: true,
          life: 1
        });

        // Deactivate city or turret
        citiesRef.current.forEach(c => {
          if (Math.abs(c.x - rocket.targetX) < 5 && Math.abs(c.y - rocket.targetY) < 5) {
            c.active = false;
          }
        });
        turretsRef.current.forEach(t => {
          if (Math.abs(t.x - rocket.targetX) < 5 && Math.abs(t.y - rocket.targetY) < 5) {
            t.active = false;
          }
        });

        return false;
      }
      return true;
    });

    // Check Game Over
    const activeTurrets = turretsRef.current.filter(t => t.active).length;
    if (activeTurrets === 0) {
      setGameState(GameState.GAME_OVER);
    }

    // Check Victory
    setStats(prev => {
      if (prev.score >= WIN_SCORE) {
        setGameState(GameState.VICTORY);
      }
      return prev;
    });

    // Check Round End
    if (enemiesSpawnedRef.current >= enemiesToSpawnRef.current && enemyRocketsRef.current.length === 0 && gameState === GameState.PLAYING) {
      setGameState(GameState.ROUND_END);
      setTimeout(() => {
        setStats(prev => ({ ...prev, round: prev.round + 1 }));
        setGameState(GameState.PLAYING);
        // Reset spawn counters for next round
        enemiesSpawnedRef.current = 0;
        enemiesToSpawnRef.current = 10 + (stats.round + 1) * 2;
        // Restore cities
        citiesRef.current.forEach(c => c.active = true);
        // Restore ammo
        turretsRef.current.forEach(t => {
          if (t.active) t.ammo = t.maxAmmo;
        });
      }, 2000);
    }
  }, [gameState, stats.round]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw Background Logo
    if (bgImageRef.current) {
      ctx.save();
      ctx.globalAlpha = 0.3; // Increased visibility
      const size = 320;
      ctx.drawImage(
        bgImageRef.current,
        GAME_WIDTH / 2 - size / 2,
        GAME_HEIGHT / 2 - size / 2 - 50,
        size,
        size
      );
      ctx.restore();
    }

    // Draw Ground
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, GAME_HEIGHT - 20, GAME_WIDTH, 20);

    // Draw Stadiums (Etihad Stadium)
    citiesRef.current.forEach(city => {
      if (city.active) {
        ctx.save();
        ctx.translate(city.x, city.y);
        
        // Main Stadium Body (Oval)
        ctx.fillStyle = '#6CABDD'; // Man City Sky Blue
        ctx.beginPath();
        ctx.ellipse(0, -8, 20, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner Pitch/Detail
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.ellipse(0, -8, 14, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Masts/Cables (Stylized)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          const angle = (i * Math.PI / 2) + Math.PI / 4;
          const x = Math.cos(angle) * 18;
          const y = Math.sin(angle) * 10 - 8;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x * 1.2, y - 10);
          ctx.stroke();
        }
        
        ctx.restore();
      } else {
        // Destroyed Stadium
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.ellipse(city.x, city.y - 4, 15, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw Turrets
    turretsRef.current.forEach(turret => {
      if (turret.active) {
        ctx.fillStyle = COLORS.turret;
        ctx.beginPath();
        ctx.arc(turret.x, turret.y, 15, Math.PI, 0);
        ctx.fill();
        // Ammo bar
        const ammoRatio = turret.ammo / turret.maxAmmo;
        ctx.fillStyle = '#444';
        ctx.fillRect(turret.x - 20, turret.y + 5, 40, 4);
        ctx.fillStyle = COLORS.turret;
        ctx.fillRect(turret.x - 20, turret.y + 5, 40 * ammoRatio, 4);
      } else {
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(turret.x, turret.y, 15, Math.PI, 0);
        ctx.fill();
      }
    });

    // Draw Enemy Rockets
    enemyRocketsRef.current.forEach(rocket => {
      ctx.strokeStyle = COLORS.enemy;
      ctx.lineWidth = 2; // Increased from 1
      ctx.beginPath();
      ctx.moveTo(rocket.startX, rocket.startY);
      ctx.lineTo(rocket.x, rocket.y);
      ctx.stroke();
      
      ctx.fillStyle = COLORS.enemy;
      ctx.beginPath();
      ctx.arc(rocket.x, rocket.y, 3, 0, Math.PI * 2); // Increased from 2
      ctx.fill();
    });

    // Draw Missiles
    missilesRef.current.forEach(m => {
      ctx.strokeStyle = COLORS.missile;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(m.startX, m.startY);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Target X
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(m.targetX - 5, m.targetY - 5);
      ctx.lineTo(m.targetX + 5, m.targetY + 5);
      ctx.moveTo(m.targetX + 5, m.targetY - 5);
      ctx.lineTo(m.targetX - 5, m.targetY + 5);
      ctx.stroke();
    });

    // Draw Explosions
    explosionsRef.current.forEach(exp => {
      const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
      gradient.addColorStop(0, '#fff');
      gradient.addColorStop(0.3, COLORS.explosion);
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();
    });

  }, []);

  const animate = useCallback(() => {
    update();
    draw();
    requestRef.current = requestAnimationFrame(animate);
  }, [update, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const startGame = () => {
    initGame();
    setGameState(GameState.PLAYING);
    enemiesToSpawnRef.current = 10;
    enemiesSpawnedRef.current = 0;
  };

  // Continuous spawning logic
  useEffect(() => {
    let interval: any;
    if (gameState === GameState.PLAYING) {
      interval = setInterval(() => {
        if (enemiesSpawnedRef.current < enemiesToSpawnRef.current) {
          spawnEnemy(stats.round);
        }
      }, 1000 + Math.random() * 1000);
    }
    return () => clearInterval(interval);
  }, [gameState, stats.round, spawnEnemy]);

  const t = {
    zh: {
      title: '李宸睿 曼城防御',
      start: '开始游戏',
      restart: '再玩一次',
      score: '得分',
      target: '目标',
      gameOver: '防御失败',
      victory: '防御成功',
      roundEnd: '回合结束 - 球场已修复',
      desc: '点击屏幕发射拦截导弹，保护伊蒂哈德球场和炮台。',
      winDesc: '你成功守护了伊蒂哈德！',
      loseDesc: '所有炮台已被摧毁。'
    },
    en: {
      title: 'Li Chenrui City Defense',
      start: 'Start Game',
      restart: 'Play Again',
      score: 'Score',
      target: 'Target',
      gameOver: 'Game Over',
      victory: 'Victory',
      roundEnd: 'Round Clear - Stadiums Restored',
      desc: 'Click to fire interceptors. Protect Etihad Stadium and turrets.',
      winDesc: 'You successfully defended Etihad!',
      loseDesc: 'All turrets have been destroyed.'
    }
  }[language];

  return (
    <div className="relative w-full h-screen flex flex-col items-center justify-center bg-black font-sans">
      {/* Header UI */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-10 pointer-events-none">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tighter text-white/90 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-500" />
            {t.title}
          </h1>
          <div className="flex gap-4 text-xs font-mono text-white/50">
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3" /> {t.score}: {stats.score}
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="w-3 h-3" /> {t.target}: {WIN_SCORE}
            </span>
          </div>
        </div>
        <button 
          onClick={() => setLanguage(l => l === 'zh' ? 'en' : 'zh')}
          className="pointer-events-auto px-3 py-1 rounded-full border border-white/20 text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors"
        >
          {language === 'zh' ? 'EN' : '中文'}
        </button>
      </div>

      {/* Game Canvas */}
      <div className="relative aspect-[4/3] w-full max-w-4xl bg-zinc-900 shadow-2xl overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          onMouseDown={handleFire}
          onTouchStart={handleFire}
          className="w-full h-full block"
        />

        {/* Overlays */}
        <AnimatePresence>
          {gameState === GameState.ROUND_END && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="absolute inset-0 bg-blue-600/20 backdrop-blur-sm flex flex-col items-center justify-center z-20"
            >
              <h2 className="text-4xl font-black text-white tracking-tighter drop-shadow-lg">
                {t.roundEnd}
              </h2>
              <div className="mt-4 flex gap-2">
                {citiesRef.current.map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="w-8 h-4 bg-blue-500 rounded-sm"
                  />
                ))}
              </div>
            </motion.div>
          )}

          {gameState === GameState.START && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="max-w-md flex flex-col items-center"
              >
                <img 
                  src="https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/480px-Manchester_City_FC_badge.svg.png" 
                  alt="Man City Logo" 
                  className="w-32 h-32 mb-6 drop-shadow-[0_0_15px_rgba(108,171,221,0.5)]"
                  referrerPolicy="no-referrer"
                />
                <h2 className="text-5xl font-black mb-4 tracking-tighter bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
                  {t.title}
                </h2>
                <p className="text-white/60 mb-8 leading-relaxed">
                  {t.desc}
                </p>
                <button
                  onClick={startGame}
                  className="group relative px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto"
                >
                  <Play className="w-5 h-5 fill-current" />
                  {t.start}
                </button>
              </motion.div>
            </motion.div>
          )}

          {(gameState === GameState.GAME_OVER || gameState === GameState.VICTORY) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0.8, y: 40 }}
                animate={{ scale: 1, y: 0 }}
                className="max-w-md flex flex-col items-center"
              >
                <img 
                  src="https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/480px-Manchester_City_FC_badge.svg.png" 
                  alt="Man City Logo" 
                  className="w-16 h-16 mb-4 opacity-50"
                  referrerPolicy="no-referrer"
                />
                {gameState === GameState.VICTORY ? (
                  <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-6" />
                ) : (
                  <AlertTriangle className="w-20 h-20 text-red-500 mx-auto mb-6" />
                )}
                
                <h2 className={`text-6xl font-black mb-2 tracking-tighter ${gameState === GameState.VICTORY ? 'text-yellow-500' : 'text-red-500'}`}>
                  {gameState === GameState.VICTORY ? t.victory : t.gameOver}
                </h2>
                <p className="text-white/60 mb-8">
                  {gameState === GameState.VICTORY ? t.winDesc : t.loseDesc}
                </p>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                    <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">{t.score}</div>
                    <div className="text-2xl font-mono font-bold">{stats.score}</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                    <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Destroyed</div>
                    <div className="text-2xl font-mono font-bold">{stats.totalEnemyDestroyed}</div>
                  </div>
                </div>

                <button
                  onClick={startGame}
                  className="group relative px-12 py-4 bg-white text-black hover:bg-zinc-200 font-bold rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto"
                >
                  <RotateCcw className="w-5 h-5" />
                  {t.restart}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer / Controls Hint */}
      <div className="mt-8 text-white/20 text-[10px] uppercase tracking-[0.2em] font-medium flex gap-8">
        <span>Left: 1000 Ammo</span>
        <span>Center: 1000 Ammo</span>
        <span>Right: 2000 Ammo</span>
      </div>
    </div>
  );
};

export default App;
