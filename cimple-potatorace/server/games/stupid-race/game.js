class StupidRaceGame {
    /**
     * @param {Object} opts
     * @param {HTMLCanvasElement} opts.canvas
     * @param {Object} opts.room
     * @param {Array} opts.players - [{ conn_id, user_id, name, color, is_host }]
     * @param {Function} opts.onScoreUpdate - (scoresMap) => void
     * @param {Function} opts.onGameOver - (winner) => void
     */
    constructor(opts) {
        this.canvas = opts.canvas;
        this.ctx = opts.canvas.getContext('2d');
        this.room = opts.room;
        this.onScoreUpdate = opts.onScoreUpdate || (() => {});
        this.onGameOver = opts.onGameOver || (() => {});

        this.width = opts.canvas.width || 1200;
        this.height = opts.canvas.height || 700;

        const defaultColors = ['#7c5cff', '#2ee59d', '#ff6b81', '#ffb84d', '#2f7bff', '#ff6bd6'];

        // Win conditions
        this.targetScore = 80; // 8 stars to win
        this.roundTimer = 90;  // or 90 seconds
        this.gameOver = false;
        this.winner = null;
        this.gameOverTimer = 8; // countdown to return

        // Sound synthesizer (Web Audio API)
        this.audioCtx = null;
        this.initAudio();

        // Initialize players
        const numPlayers = Math.max(opts.players?.length || 1, 1);
        this.players = (opts.players || []).map((p, i) => ({
            conn_id: p.conn_id,
            user_id: p.user_id,
            name: p.name || `Player ${i + 1}`,
            color: p.color || defaultColors[i % defaultColors.length],
            x: 160 + (i % 2) * 110,
            y: 220 + Math.floor(i / 2) * 160,
            vx: 0,
            vy: 0,
            angle: 0,
            score: 0,
            boostFuel: 100, // 0 - 100
            maxBoostFuel: 100,
            radius: 26,
            squishX: 1,
            squishY: 1,
        }));

        this.inputs = {};
        this.particles = [];
        this.coins = [];
        this.confetti = [];

        // Spawn collectible golden stars
        for (let i = 0; i < 8; i++) {
            this.spawnCoin(i);
        }

        this.running = true;
        this.lastTime = performance.now();
        this.loop = this.loop.bind(this);
        this.animId = requestAnimationFrame(this.loop);
    }

    initAudio() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        } catch {
            // Audio not allowed or unavailable
        }
    }

    playSfx(type) {
        if (!this.audioCtx) return;
        try {
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            const ctx = this.audioCtx;
            const now = ctx.currentTime;

            if (type === 'coin') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(987, now);
                osc.frequency.setValueAtTime(1318, now + 0.08);
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.3);
            } else if (type === 'bump') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(160, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.14);
            } else if (type === 'win') {
                const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.12);
                    gain.gain.setValueAtTime(0.25, now + idx * 0.12);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now + idx * 0.12);
                    osc.stop(now + idx * 0.12 + 0.4);
                });
            }
        } catch {
            // Ignore audio errors
        }
    }

    spawnCoin(id) {
        this.coins.push({
            id: id ?? Math.random(),
            x: 180 + Math.random() * (this.width - 360),
            y: 120 + Math.random() * (this.height - 240),
            wobble: Math.random() * Math.PI * 2,
            scale: 1,
        });
    }

    onPlayerInput(connId, input) {
        this.inputs[connId] = {
            x: input.x || 0,
            y: input.y || 0,
            btnA: !!input.btnA,
            btnB: !!input.btnB,
        };
    }

    loop(time) {
        if (!this.running) return;

        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        this.update(dt);
        this.render();

        this.animId = requestAnimationFrame(this.loop);
    }

    update(dt) {
        const W = this.width;
        const H = this.height;

        // If game is over, handle victory screen countdown
        if (this.gameOver) {
            this.gameOverTimer -= dt;
            this.updateConfetti(dt);
            return;
        }

        // Round timer
        this.roundTimer = Math.max(0, this.roundTimer - dt);
        if (this.roundTimer <= 0) {
            this.finishGame();
            return;
        }

        // Update particles
        const aliveParticles = [];
        for (const p of this.particles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life > 0) aliveParticles.push(p);
        }
        this.particles = aliveParticles;

        // Wobble stars
        for (const coin of this.coins) {
            coin.wobble += dt * 3.5;
        }

        const scoresMap = {};
        let topScore = 0;

        // Update each player
        for (let i = 0; i < this.players.length; i++) {
            const p = this.players[i];
            const inp = this.inputs[p.conn_id] || { x: 0, y: 0, btnA: false, btnB: false };

            const wantsBoost = inp.btnA && p.boostFuel > 4;
            const isBrake = inp.btnB;

            // Fuel drain / recharge
            if (wantsBoost) {
                p.boostFuel = Math.max(0, p.boostFuel - dt * 35);
            } else {
                p.boostFuel = Math.min(p.maxBoostFuel, p.boostFuel + dt * 18);
            }

            const isBoosting = wantsBoost && p.boostFuel > 0;
            const maxSpeed = isBoosting ? 460 : isBrake ? 140 : 270;
            const accel = isBoosting ? 1400 : 780;
            const friction = isBrake ? 0.84 : 0.93;

            p.vx += inp.x * accel * dt;
            p.vy += inp.y * accel * dt;

            // Apply friction
            p.vx *= Math.pow(friction, dt * 60);
            p.vy *= Math.pow(friction, dt * 60);

            // Clamp max speed
            const speed = Math.hypot(p.vx, p.vy);
            if (speed > maxSpeed) {
                p.vx = (p.vx / speed) * maxSpeed;
                p.vy = (p.vy / speed) * maxSpeed;
            }

            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // Wall collisions with elastic bounce
            const r = p.radius;
            const padX = 40;
            const padY = 40;

            if (p.x < padX + r) {
                p.x = padX + r;
                p.vx = Math.abs(p.vx) * 0.65;
                this.playSfx('bump');
            } else if (p.x > W - padX - r) {
                p.x = W - padX - r;
                p.vx = -Math.abs(p.vx) * 0.65;
                this.playSfx('bump');
            }

            if (p.y < padY + r) {
                p.y = padY + r;
                p.vy = Math.abs(p.vy) * 0.65;
                this.playSfx('bump');
            } else if (p.y > H - padY - r) {
                p.y = H - padY - r;
                p.vy = -Math.abs(p.vy) * 0.65;
                this.playSfx('bump');
            }

            // Direction angle
            if (speed > 15) {
                p.angle = Math.atan2(p.vy, p.vx);
            }

            // Dual rocket flames when boosting
            if (isBoosting) {
                const backDist = 26;
                const spread = 10;
                for (let side of [-1, 1]) {
                    const fx = p.x - Math.cos(p.angle) * backDist + Math.sin(p.angle) * (side * spread);
                    const fy = p.y - Math.sin(p.angle) * backDist - Math.cos(p.angle) * (side * spread);
                    this.particles.push({
                        x: fx,
                        y: fy,
                        vx: -Math.cos(p.angle) * (180 + Math.random() * 120) + (Math.random() - 0.5) * 50,
                        vy: -Math.sin(p.angle) * (180 + Math.random() * 120) + (Math.random() - 0.5) * 50,
                        color: Math.random() > 0.4 ? '#ff5252' : '#ffb142',
                        life: 0.28,
                        maxLife: 0.28,
                        size: 7 + Math.random() * 4,
                    });
                }
            }

            // Check star collection
            for (let c = 0; c < this.coins.length; c++) {
                const coin = this.coins[c];
                const dist = Math.hypot(p.x - coin.x, p.y - coin.y);

                if (dist < 40) {
                    p.score += 10;
                    this.playSfx('coin');

                    // Sparkle particles
                    for (let k = 0; k < 16; k++) {
                        const ang = Math.random() * Math.PI * 2;
                        const spd = 70 + Math.random() * 160;
                        this.particles.push({
                            x: coin.x,
                            y: coin.y,
                            vx: Math.cos(ang) * spd,
                            vy: Math.sin(ang) * spd,
                            color: '#ffd32a',
                            life: 0.45,
                            maxLife: 0.45,
                            size: 5 + Math.random() * 5,
                        });
                    }

                    // Relocate star
                    coin.x = 180 + Math.random() * (W - 360);
                    coin.y = 120 + Math.random() * (H - 240);
                }
            }

            // Player-to-player collision
            for (let j = i + 1; j < this.players.length; j++) {
                const p2 = this.players[j];
                const dx = p2.x - p.x;
                const dy = p2.y - p.y;
                const dist = Math.hypot(dx, dy);
                const minDist = p.radius + p2.radius;

                if (dist < minDist && dist > 0.01) {
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const overlap = minDist - dist;

                    p.x -= nx * overlap * 0.5;
                    p.y -= ny * overlap * 0.5;
                    p2.x += nx * overlap * 0.5;
                    p2.y += ny * overlap * 0.5;

                    // Elastic impulse
                    const kx = p.vx - p2.vx;
                    const ky = p.vy - p2.vy;
                    const pSpeed = 2 * (nx * kx + ny * ky) / 2;

                    p.vx -= pSpeed * nx * 1.1;
                    p.vy -= pSpeed * ny * 1.1;
                    p2.vx += pSpeed * nx * 1.1;
                    p2.vy += pSpeed * ny * 1.1;

                    this.playSfx('bump');

                    // Bump stars
                    this.particles.push({
                        x: (p.x + p2.x) / 2,
                        y: (p.y + p2.y) / 2,
                        vx: (Math.random() - 0.5) * 80,
                        vy: (Math.random() - 0.5) * 80,
                        color: '#ffffff',
                        life: 0.25,
                        maxLife: 0.25,
                        size: 6,
                    });
                }
            }

            scoresMap[p.conn_id] = p.score;
            if (p.score > topScore) topScore = p.score;

            // Target score win check
            if (p.score >= this.targetScore) {
                this.finishGame(p);
                return;
            }
        }

        this.onScoreUpdate(scoresMap);
    }

    finishGame(winner = null) {
        if (this.gameOver) return;
        this.gameOver = true;

        if (!winner) {
            // Find highest score
            winner = [...this.players].sort((a, b) => b.score - a.score)[0] || this.players[0];
        }

        this.winner = winner;
        this.playSfx('win');
        this.onGameOver(winner);

        // Spawn confetti
        for (let i = 0; i < 90; i++) {
            this.confetti.push({
                x: this.width * Math.random(),
                y: -20 - Math.random() * 200,
                vx: (Math.random() - 0.5) * 120,
                vy: 90 + Math.random() * 150,
                color: ['#7c5cff', '#2ee59d', '#ff6b81', '#ffb84d', '#2f7bff', '#ffda79'][Math.floor(Math.random() * 6)],
                size: 7 + Math.random() * 7,
                rot: Math.random() * Math.PI * 2,
                vrot: (Math.random() - 0.5) * 5,
            });
        }
    }

    updateConfetti(dt) {
        for (const c of this.confetti) {
            c.x += c.vx * dt;
            c.y += c.vy * dt;
            c.rot += c.vrot * dt;
            if (c.y > this.height + 20) {
                c.y = -20;
                c.x = this.width * Math.random();
            }
        }
    }

    render() {
        const ctx = this.ctx;
        const W = this.width;
        const H = this.height;

        // Dark track background
        ctx.fillStyle = '#0a0d18';
        ctx.fillRect(0, 0, W, H);

        // Arena outer border
        ctx.strokeStyle = '#222846';
        ctx.lineWidth = 4;
        ctx.strokeRect(40, 40, W - 80, H - 80);

        // Subdued grid pattern
        ctx.strokeStyle = '#ffffff08';
        ctx.lineWidth = 1;
        for (let x = 70; x < W - 40; x += 70) {
            ctx.beginPath();
            ctx.moveTo(x, 40);
            ctx.lineTo(x, H - 40);
            ctx.stroke();
        }
        for (let y = 70; y < H - 40; y += 70) {
            ctx.beginPath();
            ctx.moveTo(40, y);
            ctx.lineTo(W - 40, y);
            ctx.stroke();
        }

        // Checkered starting grid
        ctx.fillStyle = '#ffffff1a';
        for (let y = 140; y < 520; y += 24) {
            ctx.fillRect(270, y, 12, 12);
            ctx.fillRect(282, y + 12, 12, 12);
        }

        // Render particles
        for (const p of this.particles) {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }

        // Render golden stars
        for (const coin of this.coins) {
            ctx.save();
            ctx.translate(coin.x, coin.y + Math.sin(coin.wobble) * 5);
            ctx.shadowColor = '#ffd32a';
            ctx.shadowBlur = 18;
            ctx.font = '30px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⭐', 0, 0);
            ctx.restore();
        }

        // Determine current leader
        const leader = [...this.players].sort((a, b) => b.score - a.score)[0];

        // Render potato racers
        for (const p of this.players) {
            ctx.save();
            ctx.translate(p.x, p.y);

            // Ground shadow
            ctx.beginPath();
            ctx.ellipse(0, p.radius + 6, p.radius * 0.9, 7, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fill();

            // Glow aura
            ctx.beginPath();
            ctx.arc(0, 0, p.radius + 5, 0, Math.PI * 2);
            ctx.fillStyle = p.color + '33';
            ctx.fill();
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Rotated potato body
            ctx.save();
            ctx.rotate(p.angle);

            // Potato body graphic
            ctx.font = '38px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🥔', 0, 0);

            // Little eyes looking forward
            const eyeX = 14;
            const eyeY = 0;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(eyeX, -5, 4, 0, Math.PI * 2);
            ctx.arc(eyeX, 5, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.arc(eyeX + 1.5, -5, 2, 0, Math.PI * 2);
            ctx.arc(eyeX + 1.5, 5, 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();

            // Crown for 1st place leader
            if (leader && p === leader && p.score > 0) {
                ctx.font = '18px system-ui';
                ctx.textAlign = 'center';
                ctx.fillText('👑', 0, -p.radius - 20);
            }

            // Name tag
            ctx.font = 'bold 12px system-ui';
            ctx.fillStyle = '#f1f3ff';
            ctx.textAlign = 'center';
            ctx.fillText(p.name, 0, -p.radius - 6);

            // Boost Fuel Gauge Bar
            const barW = 38;
            const barH = 4;
            ctx.fillStyle = '#171a2b';
            ctx.fillRect(-barW / 2, p.radius + 8, barW, barH);
            const fuelRatio = p.boostFuel / p.maxBoostFuel;
            ctx.fillStyle = fuelRatio > 0.3 ? '#ff9f1a' : '#ff3838';
            ctx.fillRect(-barW / 2, p.radius + 8, barW * fuelRatio, barH);

            // Score tag
            ctx.font = '900 12px system-ui';
            ctx.fillStyle = '#ffd32a';
            ctx.fillText(`${p.score} ⭐`, 0, p.radius + 24);

            ctx.restore();
        }

        // HUD - Time & Target
        ctx.save();
        ctx.fillStyle = 'rgba(18, 21, 38, 0.85)';
        ctx.strokeStyle = '#2a2f4a';
        ctx.lineWidth = 2;
        ctx.roundRect(W / 2 - 120, 10, 240, 42, 12);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 13px system-ui';
        ctx.fillStyle = '#8c93b8';
        ctx.textAlign = 'center';
        ctx.fillText(`FIRST TO ${this.targetScore} ⭐  ·  TIME: ${Math.ceil(this.roundTimer)}s`, W / 2, 36);
        ctx.restore();

        // Game Over Overlay
        if (this.gameOver) {
            this.renderGameOver(ctx, W, H);
        }
    }

    renderGameOver(ctx, W, H) {
        // Confetti
        for (const c of this.confetti) {
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.rotate(c.rot);
            ctx.fillStyle = c.color;
            ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
            ctx.restore();
        }

        // Winner Card
        ctx.fillStyle = 'rgba(10, 13, 24, 0.9)';
        ctx.fillRect(W / 2 - 280, H / 2 - 170, 560, 340);

        ctx.strokeStyle = '#ffd32a';
        ctx.lineWidth = 4;
        ctx.strokeRect(W / 2 - 280, H / 2 - 170, 560, 340);

        ctx.font = '54px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('🏆', W / 2, H / 2 - 95);

        ctx.font = '900 32px system-ui';
        ctx.fillStyle = '#ffd32a';
        ctx.fillText('VICTORY!', W / 2, H / 2 - 40);

        ctx.font = 'bold 22px system-ui';
        ctx.fillStyle = '#f1f3ff';
        ctx.fillText(`${this.winner?.name || 'Player 1'} WINS!`, W / 2, H / 2 + 5);

        ctx.font = 'bold 16px system-ui';
        ctx.fillStyle = '#2ee59d';
        ctx.fillText(`Final Score: ${this.winner?.score || 0} Stars ⭐`, W / 2, H / 2 + 40);

        ctx.font = '13px system-ui';
        ctx.fillStyle = '#8c93b8';
        ctx.fillText(`Round finished · Tap Lobby or reset on screen`, W / 2, H / 2 + 95);
    }

    destroy() {
        this.running = false;
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
        if (this.audioCtx) {
            try { this.audioCtx.close(); } catch {}
            this.audioCtx = null;
        }
    }
}

// Register with GamesRegistry
if (typeof window !== 'undefined' && window.GamesRegistry) {
    window.GamesRegistry.register('stupid-race', StupidRaceGame, {
        name: 'Stupid Potato Race',
        icon: '🥔',
        description: 'Race around collecting golden stars! Use A to boost and B to brake.',
        btnALabel: 'BOOST 🚀',
        btnBLabel: 'BRAKE',
    });
}