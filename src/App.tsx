/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Volume2, 
  VolumeX, 
  Play, 
  RotateCcw, 
  Award, 
  Gamepad2, 
  BookOpen, 
  Zap, 
  Heart, 
  ChevronRight, 
  Shield, 
  Star,
  Activity,
  Layers,
  Sparkles,
  Download,
  X,
  Sliders,
  DollarSign,
  Home
} from 'lucide-react';
import { GameStatus, PowerUpType, ScoreEntry } from './types';
import { LEVELS } from './levels';
import { GameCanvas, GameCanvasHandle } from './components/GameCanvas';
import { sound } from './components/SoundManager';
import { AdSenseBanner, MonetizationConfigPanel } from './components/AdSenseBanner';

export default function App() {
  const canvasRef = useRef<GameCanvasHandle>(null);
  
  // Mobile Touch Trackpad and UI states
  const [activeMobileTab, setActiveMobileTab] = useState<'modifiers' | 'arenas' | 'highscores'>('modifiers');
  const [openTab, setOpenTab] = useState<'modifiers' | 'arenas' | 'highscores' | null>(null);
  const [mobileControlMode, setMobileControlMode] = useState<'trackpad' | 'direct'>('trackpad');
  const [isTrackpadDragging, setIsTrackpadDragging] = useState<boolean>(false);
  const [trackpadXPercent, setTrackpadXPercent] = useState<number>(0.5);
  const trackpadRef = useRef<HTMLDivElement>(null);

  const handleTrackpadTouch = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    const trackpad = trackpadRef.current;
    if (!trackpad || !canvasRef.current) return;
    
    const rect = trackpad.getBoundingClientRect();
    let clientX = 0;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
    } else {
      clientX = e.clientX;
    }
    
    const relativeX = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, relativeX / rect.width));
    
    setTrackpadXPercent(pct);
    canvasRef.current.setPaddleXPercent(pct);
  };

  const handleTrackpadMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsTrackpadDragging(true);
    handleTrackpadTouch(e);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const trackpad = trackpadRef.current;
      if (!trackpad || !canvasRef.current) return;
      const rect = trackpad.getBoundingClientRect();
      const relativeX = moveEvent.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, relativeX / rect.width));
      setTrackpadXPercent(pct);
      canvasRef.current.setPaddleXPercent(pct);
    };
    
    const handleMouseUp = () => {
      setIsTrackpadDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };
  
  // Game states in React for UI mirroring
  const [status, setStatus] = useState<GameStatus>(GameStatus.START);
  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [currentLevelIdx, setCurrentLevelIdx] = useState<number>(0);
  
  // Active power-up states for Sidebar displays
  const [activePowerUps, setActivePowerUps] = useState<Record<PowerUpType, number>>({
    [PowerUpType.EXPAND_PADDLE]: 0,
    [PowerUpType.STICKY_PADDLE]: 0,
    [PowerUpType.LASER_PADDLE]: 0,
    [PowerUpType.SLOW_MOTION]: 0,
    [PowerUpType.MULTI_BALL]: 0,
    [PowerUpType.SHIELD]: 0,
  });
  const [hasShield, setHasShield] = useState<boolean>(false);
  
  // Audio state
  const [soundMuted, setSoundMuted] = useState<boolean>(false);

  // High scores
  const [highScores, setHighScores] = useState<ScoreEntry[]>([]);
  const [playerName, setPlayerName] = useState<string>('');
  const [submittedScore, setSubmittedScore] = useState<boolean>(false);

  // PWA installation states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState<boolean>(false);
  const [showMonetizationModal, setShowMonetizationModal] = useState<boolean>(false);

  // Listen for custom installation prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent default browser prompt from showing automatically
      e.preventDefault();
      // Stash event so we can trigger it later on button click
      setDeferredPrompt(e);
      // Update UI to show the install button
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If already running inside installed standalone app, hide the button
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (isStandalone) {
      setShowInstallBtn(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the browser native install overlay
    deferredPrompt.prompt();
    // Wait for the user response
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Installation prompt choice: ${outcome}`);
    // Clear prompt state and hide button
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  // Load high scores & sound preferences on mount
  useEffect(() => {
    const scores = localStorage.getItem('neon_brick_breaker_highscores_v1');
    if (scores) {
      try {
        setHighScores(JSON.parse(scores));
      } catch (e) {
        setHighScores(getDefaultHighScores());
      }
    } else {
      const defaults = getDefaultHighScores();
      setHighScores(defaults);
      localStorage.setItem('neon_brick_breaker_highscores_v1', JSON.stringify(defaults));
    }

    setSoundMuted(sound.getMutedState());
  }, []);

  const getDefaultHighScores = (): ScoreEntry[] => {
    return [
      { name: "OAK_MESSENGER", score: 5000, date: "2026-07-10", level: 3 },
      { name: "SAGE_REFLEX", score: 3500, date: "2026-07-11", level: 2 },
      { name: "SAND_GLIDE", score: 2200, date: "2026-07-12", level: 1 },
      { name: "FOREST_FLUTE", score: 1500, date: "2026-07-13", level: 1 },
      { name: "TERRA_WALKER", score: 800, date: "2026-07-14", level: 1 },
    ];
  };

  const handleScoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    const newEntry: ScoreEntry = {
      name: playerName.trim().toUpperCase().slice(0, 12),
      score,
      date: new Date().toISOString().split('T')[0],
      level: currentLevelIdx + 1
    };

    const updated = [...highScores, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    setHighScores(updated);
    localStorage.setItem('neon_brick_breaker_highscores_v1', JSON.stringify(updated));
    setSubmittedScore(true);
    setPlayerName('');
  };

  const handleToggleMute = () => {
    const isMuted = sound.toggleMute();
    setSoundMuted(isMuted);
  };

  const startNewGame = (levelIdx = 0) => {
    setScore(0);
    setLives(3);
    setCurrentLevelIdx(levelIdx);
    setSubmittedScore(false);
    setStatus(GameStatus.PLAYING);
    setTrackpadXPercent(0.5);
    
    // Give browser a frame to mount canvas
    setTimeout(() => {
      canvasRef.current?.startLevel(levelIdx);
    }, 50);
  };

  const nextLevel = () => {
    const nextIdx = (currentLevelIdx + 1) % LEVELS.length;
    setCurrentLevelIdx(nextIdx);
    setSubmittedScore(false);
    setStatus(GameStatus.PLAYING);
    sound.playLevelUp();
    setTrackpadXPercent(0.5);
    
    setTimeout(() => {
      canvasRef.current?.startLevel(nextIdx);
    }, 50);
  };

  const checkIsHighScore = () => {
    if (score === 0) return false;
    if (highScores.length < 5) return true;
    return score > highScores[highScores.length - 1].score;
  };

  // Periodically query the active powerups from the canvas state to draw beautiful sliders
  useEffect(() => {
    if (status !== GameStatus.PLAYING) return;

    const interval = setInterval(() => {
      const container = document.getElementById('game-canvas-container');
      if (!container) return;
      
      // We retrieve parameters from custom events triggered by canvas or direct state tracking.
      // Wait, let's write a simple listener inside GameCanvas that emits events!
    }, 200);

    return () => clearInterval(interval);
  }, [status]);

  // Handle custom custom power-up event listeners dispatched from GameCanvas
  useEffect(() => {
    const handlePowerUpEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{
        hasShield: boolean;
        timers: Record<PowerUpType, number>;
      }>;
      if (customEvent.detail) {
        setHasShield(customEvent.detail.hasShield);
        setActivePowerUps(customEvent.detail.timers);
      }
    };

    window.addEventListener('neon-breaker-powerups', handlePowerUpEvent);
    return () => {
      window.removeEventListener('neon-breaker-powerups', handlePowerUpEvent);
    };
  }, []);

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-screen flex flex-col overflow-hidden bg-[#090d16] text-slate-100 font-sans selection:bg-amber-500/30 selection:text-white relative select-none">
      
      {/* Dynamic Background Mesh Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(245,158,11,0.12),rgba(0,0,0,0))] pointer-events-none" />

      {/* Primary Header - Compact & Slim to save vertical height */}
      <header className="border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md shrink-0 z-40 px-4 py-2 md:px-8">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse" />
              <div className="absolute inset-0 w-3 h-3 rounded-full bg-amber-500 blur-xs opacity-30" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-mono font-black tracking-widest text-amber-500 leading-none uppercase">
                Gilli Arcade
              </h1>
              <p className="text-[9px] text-slate-400 font-mono tracking-wider">DANDA STRIKER v2.0</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {status === GameStatus.PLAYING && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {LEVELS[currentLevelIdx].name}
              </span>
            )}

            {showInstallBtn && (
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 text-[10px] font-bold font-mono transition-all cursor-pointer shadow-md active:scale-95"
                title="Install App"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">INSTALL</span>
              </button>
            )}

            <button
              onClick={handleToggleMute}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer shadow-xs active:scale-95"
              title={soundMuted ? "Unmute sounds" : "Mute sounds"}
            >
              {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-500" />}
            </button>


          </div>
        </div>
      </header>

      {/* Main Single-Viewport Layout Workspace */}
      <main className="flex-1 min-h-0 w-full px-3 md:px-8 py-2 md:py-4 flex flex-col lg:flex-row gap-4 overflow-hidden relative">
        
        {/* Main Gameplay Column (Left / Center) */}
        <div className="flex-1 min-h-0 flex flex-col justify-between">
          
          {/* Top Compact HUD Row */}
          <div className="flex justify-between items-center bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2 mb-2 font-mono shadow-xs shrink-0">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-[9px] text-slate-400 uppercase font-sans font-bold tracking-wider leading-none mb-0.5">Score</div>
                <div className="text-base font-black text-amber-500 tracking-wider leading-none">{score.toLocaleString()}</div>
              </div>
              <div className="h-5 w-[1px] bg-slate-800" />
              <div>
                <div className="text-[9px] text-slate-400 uppercase font-sans font-bold tracking-wider leading-none mb-0.5">Active Arena</div>
                <div className="text-sm font-black text-amber-500/80 leading-none">0{currentLevelIdx + 1}/0{LEVELS.length}</div>
              </div>
            </div>

            {/* Lives Hearts Representation & Home Button */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Heart
                    key={i}
                    className={`w-4 h-4 transition-all ${
                      i < lives 
                        ? 'text-amber-500 fill-amber-500 drop-shadow-[0_0_4px_rgba(245,158,11,0.5)]' 
                        : 'text-slate-800 fill-transparent'
                    }`}
                  />
                ))}
              </div>

              {(status === GameStatus.PLAYING || status === GameStatus.PAUSED) && (
                <>
                  <div className="h-4 w-[1px] bg-slate-800" />
                  <button
                    onClick={() => setStatus(GameStatus.START)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-[#1e141a] border border-slate-800 hover:border-amber-500/35 text-slate-300 hover:text-amber-400 transition-all cursor-pointer active:scale-95 text-[10px] font-bold font-mono"
                    title="Quit to Menu"
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>LOBBY</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Dynamic Scaling Game Canvas Wrapper (flex-1 forces auto-sizing inside viewport) */}
          <div className="relative flex-1 min-h-[240px] xs:min-h-[300px] sm:min-h-[360px] md:min-h-[400px] rounded-[24px] overflow-hidden bg-[#0a0f1d] border border-slate-800 shadow-[inset_0_4px_24px_rgba(0,0,0,0.8)] select-none flex items-center justify-center" id="game-canvas-container">
            
            <GameCanvas
              ref={canvasRef}
              status={status}
              currentLevelIdx={currentLevelIdx}
              onScoreChange={setScore}
              onLivesChange={setLives}
              onStatusChange={setStatus}
              onLevelComplete={() => setStatus(GameStatus.VICTORY)}
              onGameOver={() => setStatus(GameStatus.GAMEOVER)}
            />

            {/* OVERLAYS USING FRAMER MOTION */}
            <AnimatePresence>
              
              {/* 1. START OVERLAY */}
              {status === GameStatus.START && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-4 text-center z-10 overflow-y-auto"
                  id="overlay-start"
                >
                  <motion.div
                    initial={{ scale: 0.95, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 120 }}
                    className="max-w-xs sm:max-w-md w-full max-h-full bg-slate-900 p-4 sm:p-7 rounded-[28px] border border-slate-800 shadow-2xl relative overflow-y-auto flex flex-col justify-center items-center my-auto"
                  >
                    <div className="w-8 h-8 sm:w-12 sm:h-12 mx-auto rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-2 sm:mb-4 shrink-0">
                      <Gamepad2 className="w-4 h-4 sm:w-6 sm:h-6 text-amber-500" />
                    </div>

                    <h2 className="text-xl sm:text-3xl font-mono font-black text-amber-500 uppercase tracking-widest mb-1 sm:mb-1.5 shrink-0">
                      Gilli
                    </h2>
                    <p className="text-slate-400 text-[10px] sm:text-xs mb-3 sm:mb-5 leading-relaxed font-sans max-w-xs mx-auto overflow-y-auto">
                      An energetic danda-striker retro arcade experience featuring elegant cracking blocks, sliding paddle physics, and cascading power-ups.
                    </p>

                    <button
                      onClick={() => startNewGame(currentLevelIdx)}
                      className="w-full py-2.5 sm:py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-[11px] sm:text-xs font-black tracking-widest uppercase transition-all transform active:scale-95 shadow-lg shadow-amber-500/25 cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-slate-950" />
                      STRIKE DANDA
                    </button>
                  </motion.div>
                </motion.div>
              )}

              {/* 2. PAUSE OVERLAY */}
              {status === GameStatus.PAUSED && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-3 text-center z-10 overflow-y-auto"
                  id="overlay-paused"
                >
                  <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    className="max-w-xs w-full max-h-full bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-[24px] shadow-2xl overflow-y-auto flex flex-col justify-center items-center my-auto"
                  >
                    <h3 className="text-lg sm:text-xl font-mono font-black text-amber-500 uppercase tracking-widest mb-1 shrink-0">STRIKE PAUSED</h3>
                    <p className="text-slate-400 text-[9px] sm:text-[10px] mb-3 sm:mb-4 font-mono shrink-0">Press SPACE or Tap below to resume</p>
                    
                    <button
                      onClick={() => canvasRef.current?.togglePause()}
                      className="w-full py-2 sm:py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-[11px] sm:text-xs font-black tracking-wider transition-all cursor-pointer active:scale-95 shadow-md shrink-0"
                    >
                      RESUME
                    </button>
                  </motion.div>
                </motion.div>
              )}

              {/* 3. VICTORY OVERLAY */}
              {status === GameStatus.VICTORY && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center z-10"
                  id="overlay-victory"
                >
                  <motion.div
                    initial={{ scale: 0.95, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    className="max-w-sm w-full bg-slate-900 p-6 rounded-[28px] border border-slate-800 shadow-2xl relative overflow-hidden"
                  >
                    <div className="w-12 h-12 mx-auto rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                      <Sparkles className="w-6 h-6 text-amber-500" />
                    </div>

                    <h2 className="text-xl sm:text-2xl font-mono font-black text-amber-500 uppercase tracking-widest mb-1.5">
                      Arena Complete!
                    </h2>
                    <p className="text-slate-400 text-xs mb-4 leading-relaxed font-sans">
                      Fantastic hits! Your striker has broken down the defenses.
                    </p>

                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 mb-5 max-w-xs mx-auto font-mono">
                      <div className="text-slate-400 text-[9px] mb-0.5 font-bold uppercase">SCORE REGISTERED</div>
                      <div className="text-xl font-black text-amber-400 tracking-wide">{score.toLocaleString()}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                      <button
                        onClick={() => startNewGame(currentLevelIdx)}
                        className="py-2.5 px-3 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-200 font-bold border border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 text-xs font-mono"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                        REPLAY
                      </button>
                      
                      <button
                        onClick={nextLevel}
                        className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-1 active:scale-95 text-xs font-mono"
                      >
                        NEXT
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {/* 4. GAME OVER OVERLAY */}
              {status === GameStatus.GAMEOVER && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center z-10"
                  id="overlay-gameover"
                >
                  <motion.div
                    initial={{ scale: 0.95, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    className="max-w-sm w-full bg-slate-900 p-5 sm:p-6 rounded-[28px] border border-slate-800 shadow-2xl relative overflow-hidden"
                  >
                    <div className="w-10 h-10 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-3">
                      <Zap className="w-5 h-5 text-rose-500" />
                    </div>

                    <h2 className="text-xl font-mono font-black text-rose-500 uppercase tracking-widest mb-1">
                      Striker Retired
                    </h2>
                    <p className="text-slate-400 text-xs mb-4 font-mono font-bold">
                      FINAL SCORE: {score.toLocaleString()}
                    </p>

                    {/* Score submit form */}
                    {checkIsHighScore() && !submittedScore ? (
                      <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 mb-4 text-left max-w-xs mx-auto">
                        <div className="flex items-center gap-1.5 mb-2 text-amber-500 text-[10px] font-bold">
                          <Award className="w-3.5 h-3.5" />
                          <span>NEW RECORD REGISTERED!</span>
                        </div>
                        
                        <form onSubmit={handleScoreSubmit} className="space-y-2">
                           <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={playerName}
                              onChange={(e) => setPlayerName(e.target.value)}
                              placeholder="YOUR HANDLE"
                              maxLength={10}
                              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-amber-500 font-mono uppercase"
                              required
                            />
                            <button
                              type="submit"
                              className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black hover:bg-amber-400 transition-all cursor-pointer active:scale-95 text-xs font-mono"
                            >
                              SAVE
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : submittedScore ? (
                      <div className="bg-amber-500/10 py-2 px-3 rounded-xl border border-amber-500/25 mb-4 text-amber-400 text-[10px] font-mono flex items-center justify-center gap-1.5 max-w-xs mx-auto">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span>SAVED SUCCESSFULLY!</span>
                      </div>
                    ) : null}

                    <div className="flex gap-3 max-w-xs mx-auto">
                      <button
                        onClick={() => setStatus(GameStatus.START)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 transition-all cursor-pointer active:scale-95 text-xs font-mono"
                      >
                        MENU
                      </button>
                      <button
                        onClick={() => startNewGame(currentLevelIdx)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black transition-all cursor-pointer shadow-md active:scale-95 text-xs font-mono"
                      >
                        RESTART
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {/* 5. IMMERSIVE OPTION DRAWERS FOR MOBILE (Avoids any page scrolling) */}
              {openTab && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col p-5 z-20"
                  id="overlay-mobile-tabs"
                >
                  <div className="flex justify-between items-center border-b border-slate-850 pb-2 mb-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                      {openTab === 'modifiers' && <Zap className="w-4 h-4 text-amber-500" />}
                      {openTab === 'arenas' && <Layers className="w-4 h-4 text-amber-500" />}
                      {openTab === 'highscores' && <Award className="w-4 h-4 text-amber-500" />}
                      <h3 className="text-base font-mono font-black text-amber-500 uppercase leading-none">
                        {openTab === 'highscores' ? 'High Striker (Local)' : openTab}
                      </h3>
                    </div>
                    
                    <button
                      onClick={() => setOpenTab(null)}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Drawer Content Area */}
                  <div className="flex-1 overflow-y-auto min-h-0 pr-1 text-left font-mono">
                    {openTab === 'modifiers' && (
                      <div className="space-y-3.5 font-sans">
                        <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
                          Catch falling power-ups to modify your striker:
                        </p>

                        <div className="space-y-3 font-mono text-xs">
                          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                            <div className="flex items-center gap-1.5">
                              <Shield className={`w-3.5 h-3.5 ${hasShield ? 'text-amber-500' : 'text-slate-600'}`} />
                              <span className={hasShield ? 'text-amber-400 font-bold' : 'text-slate-400'}>Shield Barrier</span>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${hasShield ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-slate-950 text-slate-500'}`}>
                              {hasShield ? "ACTIVE" : "READY"}
                            </span>
                          </div>

                          {[
                            { type: PowerUpType.EXPAND_PADDLE, label: "Wide Danda (Size)", color: "bg-amber-500" },
                            { type: PowerUpType.STICKY_PADDLE, label: "Sticky Catch (Hold)", color: "bg-amber-500" },
                            { type: PowerUpType.LASER_PADDLE, label: "Sun Laser (Shoot)", color: "bg-amber-500" },
                            { type: PowerUpType.SLOW_MOTION, label: "Slow Drift (Time)", color: "bg-amber-500" },
                          ].map((item) => {
                            const framesLeft = activePowerUps[item.type] || 0;
                            const active = framesLeft > 0;
                            const pct = Math.min(100, (framesLeft / 600) * 100);

                            return (
                              <div key={item.type} className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                                <div className="flex justify-between items-center text-xs">
                                  <span className={active ? 'text-amber-400 font-bold' : 'text-slate-400'}>{item.label}</span>
                                  {active ? (
                                    <span className="text-[10px] text-amber-500 font-bold">{(framesLeft / 60).toFixed(1)}s</span>
                                  ) : (
                                    <span className="text-[9px] text-slate-600">INACTIVE</span>
                                  )}
                                </div>
                                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-200 ${item.color}`}
                                    style={{ width: `${active ? pct : 0}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {openTab === 'arenas' && (
                      <div className="space-y-3">
                        <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                          Choose an Arena to begin. Restarts current score:
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {LEVELS.map((level, i) => {
                            const isActive = currentLevelIdx === i;
                            return (
                              <button
                                key={i}
                                onClick={() => {
                                  setCurrentLevelIdx(i);
                                  setTrackpadXPercent(0.5);
                                  sound.playPaddleHit();
                                  setOpenTab(null);
                                  startNewGame(i);
                                }}
                                className={`p-2 rounded-xl border font-mono text-[11px] transition-all text-left flex flex-col justify-between h-14 ${
                                  isActive
                                     ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 font-bold shadow-md'
                                     : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-400 cursor-pointer hover:border-slate-700'
                                }`}
                              >
                                <span className="text-[9px] text-slate-500 font-normal">Arena 0{i + 1}</span>
                                <span className="truncate w-full font-sans leading-tight font-medium text-slate-200">{level.name.split(':')[1]?.trim() || level.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {openTab === 'highscores' && (
                      <div className="space-y-2.5">
                        <p className="text-[11px] text-slate-400 mb-3">
                          Top local strikers:
                        </p>
                        <div className="space-y-1.5 font-mono text-xs">
                          {highScores.map((entry, idx) => {
                            const isTopOne = idx === 0;
                            return (
                              <div 
                                key={idx} 
                                className={`flex items-center justify-between p-2 rounded-lg border ${
                                  isTopOne 
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold' 
                                    : 'bg-slate-900 border-transparent text-slate-300'
                                  }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className={`w-4 text-center font-bold ${isTopOne ? 'text-amber-400' : 'text-slate-500'}`}>{idx + 1}</span>
                                  <span className="truncate">{entry.name}</span>
                                </div>
                                <div className="flex items-center gap-2 font-bold shrink-0">
                                  <span className="text-[9px] text-slate-500 font-normal">LV{entry.level}</span>
                                  <span>{entry.score}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-850 shrink-0">
                    <button
                      onClick={() => setOpenTab(null)}
                      className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs font-mono tracking-widest transition-all cursor-pointer active:scale-95 shadow-md"
                    >
                      RESUME PLAY
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>

          </div>

          {/* Bottom Persistent Horizontal Sponsor/Ad Banner */}
          <AdSenseBanner 
            slot="gilli-bottom-banner" 
            type="horizontal" 
            className="mt-2 shrink-0"
          />

          {/* MOBILE CONTROLLER DECK & TOUCH TRACKPAD (lg:hidden) */}
          <div className="lg:hidden mt-2 bg-slate-950 border border-slate-800 p-2.5 rounded-2xl shadow-xs flex flex-col gap-2 shrink-0" id="mobile-controller-deck">
            
            {/* Quick Overlays Toolbar */}
            <div className="flex justify-between items-center px-1 border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1 text-slate-450">
                <Sliders className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-300">Options Panel</span>
              </div>
              
              {/* Option modal launch triggers */}
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono gap-1 font-semibold">
                <button
                  onClick={() => setOpenTab(openTab === 'modifiers' ? null : 'modifiers')}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    openTab === 'modifiers' ? 'bg-amber-500 text-slate-950 shadow-xs font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Modifiers
                </button>
                <button
                  onClick={() => setOpenTab(openTab === 'arenas' ? null : 'arenas')}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    openTab === 'arenas' ? 'bg-amber-500 text-slate-950 shadow-xs font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Arenas
                </button>
                <button
                  onClick={() => setOpenTab(openTab === 'highscores' ? null : 'highscores')}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    openTab === 'highscores' ? 'bg-amber-500 text-slate-950 shadow-xs font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Scores
                </button>
              </div>
            </div>

            {/* Controller row */}
            <div className="flex gap-2 items-stretch h-11">
              
              {/* Slide touch trackpad */}
              <div 
                ref={trackpadRef}
                onTouchStart={(e) => {
                  setIsTrackpadDragging(true);
                  handleTrackpadTouch(e);
                  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
                }}
                onTouchMove={handleTrackpadTouch}
                onTouchEnd={() => setIsTrackpadDragging(false)}
                onMouseDown={handleTrackpadMouseDown}
                className="flex-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl relative overflow-hidden flex items-center justify-center cursor-ew-resize select-none touch-none shadow-inner"
              >
                {/* Visual grid ticks */}
                <div className="absolute inset-x-4 inset-y-0 flex justify-between pointer-events-none opacity-20">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="w-[1px] h-full bg-slate-700" />
                  ))}
                </div>

                <span className="text-[8px] text-slate-500 font-mono font-bold tracking-widest pointer-events-none uppercase">
                  Slide To Move Paddle
                </span>

                {/* Wooden handle bar */}
                <div 
                  className={`absolute top-0.5 bottom-0.5 w-10 rounded-lg bg-gradient-to-b from-[#d97706] to-[#b45309] border border-amber-500 flex items-center justify-center shadow-md pointer-events-none transition-shadow ${
                    isTrackpadDragging ? 'ring-2 ring-amber-500/20 shadow-lg' : ''
                  }`}
                  style={{ 
                    left: `calc(${trackpadXPercent * 100}% - 20px)` 
                  }}
                >
                  <div className="w-1.5 h-4 rounded-full bg-white/20" />
                </div>
              </div>

              {/* Launcher/Fire button */}
              <button
                onTouchStart={(e) => {
                  e.preventDefault();
                  canvasRef.current?.triggerAction();
                  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
                }}
                onClick={() => {
                  canvasRef.current?.triggerAction();
                  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
                }}
                className="w-24 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 active:from-amber-600 active:to-amber-700 text-slate-950 border border-amber-500/30 shadow-md active:scale-95 flex flex-col items-center justify-center cursor-pointer select-none font-black font-mono text-xs tracking-wide uppercase"
              >
                LAUNCH
              </button>
            </div>

          </div>

        </div>

        {/* Desktop Sidebar (Col Span 1) - Rendered only on lg screens */}
        <div className="hidden lg:flex flex-col gap-4 w-72 shrink-0 overflow-y-auto pr-1">
          
          {/* Ecosystem Modifiers Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-[24px] p-4.5 shadow-sm relative overflow-hidden text-slate-200">
            <div className="flex items-center gap-1.5 mb-3.5">
              <Zap className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Striker Modifiers</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <Shield className={`w-4 h-4 ${hasShield ? 'text-amber-500' : 'text-slate-700'}`} />
                  <span className={hasShield ? 'text-amber-400 font-semibold' : 'text-slate-500'}>Shield Barrier</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[9px] ${hasShield ? 'bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20' : 'bg-slate-900 text-slate-650'}`}>
                  {hasShield ? "ACTIVE" : "READY"}
                </span>
              </div>

              {[
                { type: PowerUpType.EXPAND_PADDLE, label: "Wide Danda", color: "bg-amber-500" },
                { type: PowerUpType.STICKY_PADDLE, label: "Sticky Catch", color: "bg-amber-500" },
                { type: PowerUpType.LASER_PADDLE, label: "Sun Laser", color: "bg-amber-500" },
                { type: PowerUpType.SLOW_MOTION, label: "Slow Drift", color: "bg-amber-500" },
              ].map((item) => {
                const framesLeft = activePowerUps[item.type] || 0;
                const active = framesLeft > 0;
                const pct = Math.min(100, (framesLeft / 600) * 100);

                return (
                  <div key={item.type} className="space-y-1">
                    <div className="flex justify-between items-center font-mono text-xs">
                      <span className={active ? 'text-amber-400 font-semibold' : 'text-slate-500'}>{item.label}</span>
                      {active && (
                        <span className="text-[9px] text-amber-500 font-bold">{(framesLeft / 60).toFixed(1)}s</span>
                      )}
                    </div>
                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-200 ${item.color}`}
                        style={{ width: `${active ? pct : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Arena Select Deck */}
          <div className="bg-slate-950 border border-slate-800 rounded-[24px] p-4.5 shadow-sm text-slate-200">
            <div className="flex items-center gap-1.5 mb-3">
              <Layers className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Select Arena</h3>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {LEVELS.map((level, i) => {
                const isActive = currentLevelIdx === i;
                const disabled = status !== GameStatus.START && status !== GameStatus.GAMEOVER;

                return (
                  <button
                    key={i}
                    disabled={disabled}
                    onClick={() => {
                      setCurrentLevelIdx(i);
                      sound.playPaddleHit();
                      startNewGame(i);
                    }}
                    className={`py-1.5 px-2.5 rounded-xl border font-mono text-xs transition-all text-left flex flex-col justify-between h-[52px] ${
                      isActive
                         ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 font-bold shadow-md'
                         : disabled
                         ? 'opacity-30 border-slate-900 bg-slate-900 text-slate-700 cursor-not-allowed'
                         : 'bg-slate-950 border-slate-850 hover:bg-slate-900 text-slate-400 cursor-pointer hover:border-slate-800'
                    }`}
                  >
                    <span className="text-[9px] text-slate-500 font-normal">0{i + 1}</span>
                    <span className="truncate w-full font-sans leading-tight text-slate-200">{level.name.split(':')[1]?.trim() || level.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop Sidebar Sponsor/Ad Unit */}
          <AdSenseBanner 
            slot="gilli-sidebar-ad" 
            type="square" 
            className="shrink-0"
          />

          {/* High Scores Board */}
          <div className="bg-slate-950 border border-slate-800 rounded-[24px] p-4.5 shadow-sm flex-1 flex flex-col min-h-0 text-slate-200">
            <div className="flex items-center gap-1.5 mb-3">
              <Award className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">High Strikers</h3>
            </div>

            <div className="space-y-2 font-mono text-xs flex-1 overflow-y-auto pr-0.5">
              {highScores.map((entry, idx) => {
                const isTopOne = idx === 0;
                return (
                  <div 
                    key={idx} 
                    className={`flex items-center justify-between p-2 rounded-xl border ${
                      isTopOne 
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 font-bold' 
                        : 'bg-slate-900/50 border-transparent text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-4 text-center ${isTopOne ? 'text-amber-500' : 'text-slate-650'}`}>{idx + 1}</span>
                      <span className="truncate">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-2 font-bold shrink-0">
                      <span className="text-[9px] text-slate-600 font-normal">LV{entry.level}</span>
                      <span>{entry.score}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Controls Box */}
          <div className="bg-slate-900/60 border border-slate-850 rounded-[24px] p-4 text-xs text-slate-400 space-y-1.5 font-mono shrink-0">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold uppercase tracking-wider mb-0.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>How to Play</span>
            </div>
            <p className="leading-relaxed font-sans text-slate-400">
              Danda (Paddle): <span className="text-slate-200 font-semibold">Mouse</span> / <span className="text-slate-200 font-semibold">Arrow Keys</span>.
            </p>
            <p className="leading-relaxed font-sans text-slate-400">
              Gilli Launch: <span className="text-slate-200 font-semibold">Click Canvas</span> / <span className="text-slate-200 font-semibold">SPACEBAR</span>.
            </p>
          </div>

        </div>

      </main>

      {/* Credit footer line - Hidden on mobile to save vertical game screen space */}
      <footer className="hidden sm:block py-2 text-center border-t border-slate-900 text-[10px] text-slate-550 font-mono bg-slate-950/40 shrink-0">
        &copy; 2026 GILLI RETRO ARCADE
      </footer>

      {/* Monetization settings modal overlay */}
      <AnimatePresence>
        {showMonetizationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50"
            id="monetization-modal-overlay"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="max-w-md w-full bg-slate-900 rounded-[28px] border border-slate-800 shadow-2xl overflow-hidden"
              id="monetization-modal-container"
            >
              <MonetizationConfigPanel onClose={() => setShowMonetizationModal(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
