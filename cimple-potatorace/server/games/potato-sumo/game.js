class PotatoSumoGame {
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

        this.targetScore = 3; // 3 ring-outs to win
        this.roundTimer = 90;
        this.gameOver = false;
        this.winner = null;

        // Shrinking ring arena
        this.cx = this.width / 2;
        this.cy = this.height / 2;
        this.initialRadius = Math.min(this.width, this.height) / 2 - 50;
        this.currentRadius = this.initialRadius;
        this.minRadius = 140;

        this.audioCtx = null;
        this.initAudio();

        const spawnRadius = this.initialRadius * 0.6;
        this.players = (opts.players || []).map((p, i, arr) => {
            const count = Math.max(arr.length, 2);
            const angle = (i / count) * Math.PI * 2;
            return {
                conn_id: p.conn_id,
                user_id: p.user_id,
                name: p.name || `Player ${i + 1}`,
                color: p.color || defaultColors[i % defaultColors.length],
                x: this.cx + Math.cos(angle) * spawnRadius,
                y: this.cy + Math.sin(angle) * spawnRadius,
                vx: 0,
                vy: 0,
                angle: angle + Math.PI,
                score: 0,
                radius: 28,
                lastPushedBy: null,
                isTackling: false,
                tackleCooldown: 0,
                isBracing: false,
                isOut: false,
                respawnTimer: 0,
            };
        });

        this.inputs = {};
        this.particles = [];
        this.confetti = [];

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
        } catch {}
    }

    playSfx(type) {
        if (!this.audioCtx) return;
        try {
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            const ctx = this.audioCtx;
            const now = ctx.currentTime;

            if (type === 'tackle') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(180, now);
                osc.frequency.exponentialRampToValueAtTime(360, now + 0.12);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (type === 'smack') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(140, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.2);
            } else if (type === 'splash') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(320, now);
                osc.frequency.exponentialRampToValueAtTime(60, now + 0.4);
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.42);
            } else if (type === 'win') {
                const notes = [392, 523.25, 659.25, 783.99];
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
        } catch {}
    }

    onPlayerInput(connId, input) {
        const prev = this.inputs[connId] || { btnA: false, btnB: false };

        // Fresh Button A triggers Tackle Dash
        if (input.btnA && !prev.btnA) {
            this.triggerTackle(connId);
        }

        this.inputs[connId] = {
            x: input.x || 0,
            y: input.y || 0,
            btnA: !!input.btnA,
            btnB: !!input.btnB,
        };
    }

    triggerTackle(connId) {
        if (this.gameOver) return;
        const p = this.players.find(pl => pl.conn_id === connId);
        if (!p || p.isOut || p.tackleCooldown > 0) return;

        p.isTackling = true;
        p.tackleCooldown = 1.3; // 1.3s cooldown
        this.playSfx('tackle');

        // Strong forward impulse
        const tackleSpeed = 620;
        p.vx = Math.cos(p.angle) * tackleSpeed;
        p.vy = Math.sin(p.angle) * tackleSpeed;

        // Dust clouds
        for (let k = 0; k < 8; k++) {
            this.particles.push({
                x: p.x - Math.cos(p.angle) * 20,
                y: p.y - Math.sin(p.angle) * 20,
                vx: -Math.cos(p.angle) * 100 + (Math.random() - 0.5) * 60,
                vy: -Math.sin(p.angle) * 100 + (Math.random() - 0.5) * 60,
                color: '#ffffff',
                life: 0.3,
                maxLife: 0.3,
                size: 6,
            });
        }
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
        if (this.gameOver) {
            this.updateConfetti(dt);
            return;
        }

        // Round timer
        this.roundTimer = Math.max(0, this.roundTimer - dt);
        if (this.roundTimer <= 0) {
            this.finishGame();
            return;
        }

        // Slowly shrink the ring arena!
        const shrinkSpeed = 1.8; // px per second
        this.currentRadius = Math.max(this.minRadius, this.currentRadius - dt * shrinkSpeed);

        // Update particles
        const aliveParticles = [];
        for (const pt of this.particles) {
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.life -= dt;
            if (pt.life > 0) aliveParticles.push(pt);
        }
        this.particles = aliveParticles;

        const scoresMap = {};

        // Update players
        for (let i = 0; i < this.players.length; i++) {
            const p = this.players[i];

            if (p.isOut) {
                p.respawnTimer -= dt;
                if (p.respawnTimer <= 0) {
                    p.isOut = false;
                    p.x = this.cx + (Math.random() - 0.5) * (this.currentRadius * 0.8);
                    p.y = this.cy + (Math.random() - 0.5) * (this.currentRadius * 0.8);
                    p.vx = 0;
                    p.vy = 0;
                    p.lastPushedBy = null;
                }
                scoresMap[p.conn_id] = p.score;
                continue;
            }

            const inp = this.inputs[p.conn_id] || { x: 0, y: 0, btnA: false, btnB: false };

            p.isBracing = !!inp.btnB;

            if (p.tackleCooldown > 0) {
                p.tackleCooldown -= dt;
                if (p.tackleCooldown <= 0.9) p.isTackling = false;
            }

            // Movement
            const maxSpeed = p.isBracing ? 90 : p.isTackling ? 620 : 250;
            const accel = p.isBracing ? 400 : 850;
            const friction = p.isBracing ? 0.82 : 0.92;

            if (!p.isTackling) {
                p.vx += inp.x * accel * dt;
                p.vy += inp.y * accel * dt;
            }

            p.vx *= Math.pow(friction, dt * 60);
            p.vy *= Math.pow(friction, dt * 60);

            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // Facing direction
            if (Math.hypot(inp.x, inp.y) > 0.15 && !p.isTackling) {
                p.angle = Math.atan2(inp.y, inp.x);
            }

            // Check if fallen out of the ring!
            const distFromCenter = Math.hypot(p.x - this.cx, p.y - this.cy);
            if (distFromCenter > this.currentRadius + p.radius) {
                // RING OUT!
                p.isOut = true;
                p.respawnTimer = 2.2;
                this.playSfx('splash');

                // Lava splash particles
                for (let k = 0; k < 20; k++) {
                    const ang = Math.random() * Math.PI * 2;
                    const spd = 60 + Math.random() * 180;
                    this.particles.push({
                        x: p.x,
                        y: p.y,
                        vx: Math.cos(ang) * spd,
                        vy: Math.sin(ang) * spd,
                        color: '#ff4757',
                        life: 0.5,
                        maxLife: 0.5,
                        size: 6 + Math.random() * 6,
                    });
                }

                // Award point to whoever pushed them out!
                if (p.lastPushedBy) {
                    p.lastPushedBy.score += 1;
                    if (p.lastPushedBy.score >= this.targetScore) {
                        this.finishGame(p.lastPushedBy);
                        return;
                    }
                }
            }

            // Sumo Collision between players
            for (let j = i + 1; j < this.players.length; j++) {
                const p2 = this.players[j];
                if (p2.isOut) continue;

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

                    // Sumo bounce with mass/bracing resistance
                    const pMass = p.isBracing ? 2.8 : 1.0;
                    const p2Mass = p2.isBracing ? 2.8 : 1.0;

                    const pPower = p.isTackling ? 1.8 : 1.0;
                    const p2Power = p2.isTackling ? 1.8 : 1.0;

                    const kx = p.vx - p2.vx;
                    const ky = p.vy - p2.vy;
                    const imp = 2 * (nx * kx + ny * ky) / (pMass + p2Mass);

                    p.vx -= (imp * p2Mass * nx * 1.3 * p2Power) / pMass;
                    p.vy -= (imp * p2Mass * ny * 1.3 * p2Power) / pMass;
                    p2.vx += (imp * pMass * nx * 1.3 * pPower) / p2Mass;
                    p2.vy += (imp * pMass * ny * 1.3 * pPower) / p2Mass;

                    // Track who pushed who
                    if (p.isTackling || Math.hypot(p.vx, p.vy) > Math.hypot(p2.vx, p2.vy)) {
                        p2.lastPushedBy = p;
                    } else {
                        p.lastPushedBy = p2;
                    }

                    this.playSfx('smack');

                    // Impact sparks
                    this.particles.push({
                        x: (p.x + p2.x) / 2,
                        y: (p.y + p2.y) / 2,
                        vx: (Math.random() - 0.5) * 100,
                        vy: (Math.random() - 0.5) * 100,
                        color: '#ffd32a',
                        life: 0.25,
                        maxLife: 0.25,
                        size: 7,
                    });
                }
            }

            scoresMap[p.conn_id] = p.score;
        }

        this.onScoreUpdate(scoresMap);
    }

    finishGame(winner = null) {
        if (this.gameOver) return;
        this.gameOver = true;

        if (!winner) {
            winner = [...this.players].sort((a, b) => b.score - a.score)[0] || this.players[0];
        }

        this.winner = winner;
        this.playSfx('win');
        this.onGameOver(winner);

        for (let i = 0; i < 90; i++) {
            this.confetti.push({
                x: this.width * Math.random(),
                y: -20 - Math.random() * 200,
                vx: (Math.random() - 0.5) * 120,
                vy: 90 + Math.random() * 150,
                color: ['#ff4757', '#ffa502', '#2ed573', '#70a1ff', '#eccc68'][Math.floor(Math.random() * 5)],
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

        // Lava / slime abyss surrounding the arena
        ctx.fillStyle = '#2d0909';
        ctx.fillRect(0, 0, W, H);

        // Bubbling lava glow
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, this.initialRadius + 60, 0, Math.PI * 2);
        ctx.fillStyle = '#440f0f';
        ctx.fill();

        // The Sumo Ring Platform
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, this.currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#171d34';
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#e74c3c';
        ctx.stroke();

        // Warning dashed outer boundary
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, this.currentRadius - 12, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.stroke();

        // Particles
        for (const pt of this.particles) {
            const alpha = Math.max(0, pt.life / pt.maxLife);
            ctx.fillStyle = pt.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }

        // Render potatoes
        for (const p of this.players) {
            if (p.isOut) {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.font = '28px system-ui';
                ctx.textAlign = 'center';
                ctx.fillText('🌊', 0, 0);
                ctx.font = 'bold 11px system-ui';
                ctx.fillStyle = '#ff6b81';
                ctx.fillText(`RING OUT! (${p.respawnTimer.toFixed(1)}s)`, 0, 24);
                ctx.restore();
                continue;
            }

            ctx.save();
            ctx.translate(p.x, p.y);

            // Shadow
            ctx.beginPath();
            ctx.ellipse(0, p.radius + 6, p.radius * 0.9, 7, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fill();

            // Aura ring
            ctx.beginPath();
            ctx.arc(0, 0, p.radius + 5, 0, Math.PI * 2);
            ctx.fillStyle = p.color + (p.isBracing ? '88' : '33');
            ctx.fill();
            ctx.strokeStyle = p.isBracing ? '#ffffff' : p.color;
            ctx.lineWidth = p.isBracing ? 5 : 3;
            ctx.stroke();

            // Rotated potato body
            ctx.save();
            ctx.rotate(p.angle);

            ctx.font = '38px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🥔', 0, 0);

            // Sumo belt or brace icon
            if (p.isBracing) {
                ctx.font = '20px system-ui';
                ctx.fillText('🧱', 0, 0);
            } else if (p.isTackling) {
                ctx.font = '20px system-ui';
                ctx.fillText('💨', -24, 0);
            }

            ctx.restore();

            // Name
            ctx.font = 'bold 12px system-ui';
            ctx.fillStyle = '#f1f3ff';
            ctx.textAlign = 'center';
            ctx.fillText(p.name, 0, -p.radius - 12);

            // Score tag
            ctx.font = '900 12px system-ui';
            ctx.fillStyle = '#ffd32a';
            ctx.fillText(`${p.score} Pushes 💥`, 0, p.radius + 18);

            ctx.restore();
        }

        // HUD - Time & Ring
        ctx.save();
        ctx.fillStyle = 'rgba(18, 21, 38, 0.85)';
        ctx.strokeStyle = '#2a2f4a';
        ctx.lineWidth = 2;
        ctx.roundRect(W / 2 - 130, 10, 260, 42, 12);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 13px system-ui';
        ctx.fillStyle = '#8c93b8';
        ctx.textAlign = 'center';
        ctx.fillText(`FIRST TO ${this.targetScore} PUSHES · TIME: ${Math.ceil(this.roundTimer)}s`, W / 2, 36);
        ctx.restore();

        // Game Over Overlay
        if (this.gameOver) {
            this.renderGameOver(ctx, W, H);
        }
    }

    renderGameOver(ctx, W, H) {
        for (const c of this.confetti) {
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.rotate(c.rot);
            ctx.fillStyle = c.color;
            ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
            ctx.restore();
        }

        ctx.fillStyle = 'rgba(12, 10, 24, 0.92)';
        ctx.fillRect(W / 2 - 280, H / 2 - 170, 560, 340);

        ctx.strokeStyle = '#ff9f1a';
        ctx.lineWidth = 4;
        ctx.strokeRect(W / 2 - 280, H / 2 - 170, 560, 340);

        ctx.font = '54px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('🥋', W / 2, H / 2 - 95);

        ctx.font = '900 32px system-ui';
        ctx.fillStyle = '#ff9f1a';
        ctx.fillText('SUMO CHAMPION!', W / 2, H / 2 - 40);

        ctx.font = 'bold 22px system-ui';
        ctx.fillStyle = '#f1f3ff';
        ctx.fillText(`${this.winner?.name || 'Player 1'} WINS!`, W / 2, H / 2 + 5);

        ctx.font = 'bold 16px system-ui';
        ctx.fillStyle = '#2ee59d';
        ctx.fillText(`Ring Outs: ${this.winner?.score || 0} 💥`, W / 2, H / 2 + 40);

        ctx.font = '13px system-ui';
        ctx.fillStyle = '#8c93b8';
        ctx.fillText(`Match finished · Tap Lobby or reset on screen`, W / 2, H / 2 + 95);
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
    window.GamesRegistry.register('potato-sumo', PotatoSumoGame, {
        name: 'Potato Sumo Ring',
        icon: '🥋',
        description: 'Knock opponents out of the shrinking arena! A to Tackle Dash, B to Brace.',
        btnALabel: 'TACKLE 💥',
        btnBLabel: 'BRACE 🧱',
    });
}
