class SwordFightGame {
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
        this.targetKOs = 5;
        this.roundTimer = 90;
        this.gameOver = false;
        this.winner = null;

        // Sound synthesizer (Web Audio API)
        this.audioCtx = null;
        this.initAudio();

        // Spawn combatants evenly around circular arena
        const cx = this.width / 2;
        const cy = this.height / 2;
        const spawnRadius = 240;

        this.players = (opts.players || []).map((p, i, arr) => {
            const count = Math.max(arr.length, 2);
            const angle = (i / count) * Math.PI * 2;
            return {
                conn_id: p.conn_id,
                user_id: p.user_id,
                name: p.name || `Player ${i + 1}`,
                color: p.color || defaultColors[i % defaultColors.length],
                x: cx + Math.cos(angle) * spawnRadius,
                y: cy + Math.sin(angle) * spawnRadius,
                vx: 0,
                vy: 0,
                angle: angle + Math.PI, // face arena center
                hp: 100,
                maxHp: 100,
                score: 0,
                radius: 26,
                isAttacking: false,
                attackTimer: 0,
                isShielding: false,
                shieldEnergy: 100,
                respawnTimer: 0,
                invulnerableTimer: 0,
            };
        });

        this.inputs = {};
        this.particles = [];
        this.slashes = [];
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

            if (type === 'slash') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(420, now);
                osc.frequency.exponentialRampToValueAtTime(140, now + 0.14);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.16);
            } else if (type === 'hit') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(180, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.2);
            } else if (type === 'clang') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1100, now);
                osc.frequency.setValueAtTime(880, now + 0.05);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.26);
            } else if (type === 'ko') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(260, now);
                osc.frequency.exponentialRampToValueAtTime(30, now + 0.45);
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.48);
            } else if (type === 'win') {
                const notes = [440, 554.37, 659.25, 880];
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

    onPlayerInput(connId, input) {
        const prev = this.inputs[connId] || { btnA: false, btnB: false };

        // Fresh Button A press triggers slash
        if (input.btnA && !prev.btnA) {
            this.triggerSlash(connId);
        }

        this.inputs[connId] = {
            x: input.x || 0,
            y: input.y || 0,
            btnA: !!input.btnA,
            btnB: !!input.btnB,
        };
    }

    triggerSlash(connId) {
        if (this.gameOver) return;
        const p = this.players.find(pl => pl.conn_id === connId);
        if (!p || p.hp <= 0 || p.isAttacking || p.isShielding) return;

        p.isAttacking = true;
        p.attackTimer = 0.28;
        this.playSfx('slash');

        // Visual slash arc
        this.slashes.push({
            x: p.x,
            y: p.y,
            angle: p.angle,
            color: p.color,
            life: 0.22,
            maxLife: 0.22,
        });

        // Weapon hit check
        const swordReach = 58;
        const hitX = p.x + Math.cos(p.angle) * swordReach;
        const hitY = p.y + Math.sin(p.angle) * swordReach;

        for (const target of this.players) {
            if (target.conn_id === p.conn_id || target.hp <= 0 || target.invulnerableTimer > 0) continue;

            const dist = Math.hypot(target.x - hitX, target.y - hitY);
            if (dist < target.radius + 24) {
                if (target.isShielding) {
                    // Shield parry / deflection!
                    this.playSfx('clang');
                    this.spawnSparks(hitX, hitY, '#7c5cff', 16);
                    // Attacker bounces back
                    p.vx = -Math.cos(p.angle) * 260;
                    p.vy = -Math.sin(p.angle) * 260;
                } else {
                    // Successful hit
                    this.playSfx('hit');
                    const damage = 25;
                    target.hp = Math.max(0, target.hp - damage);

                    // Knockback in strike direction
                    target.vx = Math.cos(p.angle) * 440;
                    target.vy = Math.sin(p.angle) * 440;

                    this.spawnSparks(target.x, target.y, '#ff4757', 16);

                    // Knockout
                    if (target.hp <= 0) {
                        p.score += 1;
                        this.playSfx('ko');
                        target.respawnTimer = 2.5;
                        this.spawnSparks(target.x, target.y, '#ffa502', 30);

                        if (p.score >= this.targetKOs) {
                            this.finishGame(p);
                            return;
                        }
                    }
                }
            }
        }
    }

    spawnSparks(x, y, color, count = 12) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 70 + Math.random() * 200;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                color,
                life: 0.35,
                maxLife: 0.35,
                size: 4 + Math.random() * 4,
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
        const W = this.width;
        const H = this.height;
        const cx = W / 2;
        const cy = H / 2;
        const arenaRadius = Math.min(W, H) / 2 - 40;

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

        // Update particles
        const aliveParticles = [];
        for (const pt of this.particles) {
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.life -= dt;
            if (pt.life > 0) aliveParticles.push(pt);
        }
        this.particles = aliveParticles;

        // Update slash effects
        const aliveSlashes = [];
        for (const sl of this.slashes) {
            sl.life -= dt;
            if (sl.life > 0) aliveSlashes.push(sl);
        }
        this.slashes = aliveSlashes;

        const scoresMap = {};

        // Update players
        for (let i = 0; i < this.players.length; i++) {
            const p = this.players[i];

            // Respawn countdown
            if (p.hp <= 0) {
                p.respawnTimer -= dt;
                if (p.respawnTimer <= 0) {
                    p.hp = p.maxHp;
                    p.invulnerableTimer = 1.5;
                    const randAngle = Math.random() * Math.PI * 2;
                    p.x = cx + Math.cos(randAngle) * (arenaRadius * 0.65);
                    p.y = cy + Math.sin(randAngle) * (arenaRadius * 0.65);
                    p.vx = 0;
                    p.vy = 0;
                }
                scoresMap[p.conn_id] = p.score;
                continue;
            }

            if (p.invulnerableTimer > 0) {
                p.invulnerableTimer -= dt;
            }

            const inp = this.inputs[p.conn_id] || { x: 0, y: 0, btnA: false, btnB: false };

            p.isShielding = !!inp.btnB;

            // Attack cooldown timer
            if (p.isAttacking) {
                p.attackTimer -= dt;
                if (p.attackTimer <= 0) p.isAttacking = false;
            }

            // Movement physics: slower while shielding
            const maxSpeed = p.isShielding ? 130 : 270;
            const accel = 950;
            const friction = 0.91;

            p.vx += inp.x * accel * dt;
            p.vy += inp.y * accel * dt;

            p.vx *= Math.pow(friction, dt * 60);
            p.vy *= Math.pow(friction, dt * 60);

            const speed = Math.hypot(p.vx, p.vy);
            if (speed > maxSpeed) {
                p.vx = (p.vx / speed) * maxSpeed;
                p.vy = (p.vy / speed) * maxSpeed;
            }

            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // Keep within circular arena boundary
            const distFromCenter = Math.hypot(p.x - cx, p.y - cy);
            const maxDist = arenaRadius - p.radius;
            if (distFromCenter > maxDist) {
                const angle = Math.atan2(p.y - cy, p.x - cx);
                p.x = cx + Math.cos(angle) * maxDist;
                p.y = cy + Math.sin(angle) * maxDist;

                // Wall rebound
                p.vx *= -0.5;
                p.vy *= -0.5;
                this.playSfx('bump');
            }

            // Direction facing
            if (Math.hypot(inp.x, inp.y) > 0.15) {
                p.angle = Math.atan2(inp.y, inp.x);
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

        // Confetti
        for (let i = 0; i < 90; i++) {
            this.confetti.push({
                x: this.width * Math.random(),
                y: -20 - Math.random() * 200,
                vx: (Math.random() - 0.5) * 120,
                vy: 90 + Math.random() * 150,
                color: ['#ff4757', '#2f7bff', '#2ed573', '#ffa502', '#70a1ff', '#eccc68'][Math.floor(Math.random() * 6)],
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

        // Arena background: dark combat ring
        ctx.fillStyle = '#080a14';
        ctx.fillRect(0, 0, W, H);

        const cx = W / 2;
        const cy = H / 2;
        const arenaRadius = Math.min(W, H) / 2 - 40;

        // Circular combat ring
        ctx.beginPath();
        ctx.arc(cx, cy, arenaRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#101326';
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#2b3252';
        ctx.stroke();

        // Inner circle markings
        ctx.beginPath();
        ctx.arc(cx, cy, arenaRadius * 0.55, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff0a';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - arenaRadius, cy);
        ctx.lineTo(cx + arenaRadius, cy);
        ctx.moveTo(cx, cy - arenaRadius);
        ctx.lineTo(cx, cy + arenaRadius);
        ctx.stroke();

        // Particles
        for (const pt of this.particles) {
            const alpha = Math.max(0, pt.life / pt.maxLife);
            ctx.fillStyle = pt.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }

        // Sword slashes
        for (const sl of this.slashes) {
            ctx.save();
            ctx.translate(sl.x, sl.y);
            ctx.rotate(sl.angle);
            const alpha = sl.life / sl.maxLife;

            ctx.beginPath();
            ctx.arc(0, 0, 54, -Math.PI * 0.38, Math.PI * 0.38);
            ctx.lineWidth = 14;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
            ctx.stroke();

            ctx.lineWidth = 6;
            ctx.strokeStyle = sl.color;
            ctx.stroke();

            ctx.restore();
        }

        // Render potatoes
        for (const p of this.players) {
            if (p.hp <= 0) {
                // KO skull
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.font = '26px system-ui';
                ctx.textAlign = 'center';
                ctx.fillText('💀', 0, 0);
                ctx.font = 'bold 11px system-ui';
                ctx.fillStyle = '#ff6b81';
                ctx.fillText(`Respawning (${p.respawnTimer.toFixed(1)}s)`, 0, 24);
                ctx.restore();
                continue;
            }

            ctx.save();
            ctx.translate(p.x, p.y);

            // Invulnerability flashing
            if (p.invulnerableTimer > 0 && Math.floor(p.invulnerableTimer * 10) % 2 === 0) {
                ctx.globalAlpha = 0.5;
            }

            // Shadow
            ctx.beginPath();
            ctx.ellipse(0, p.radius + 6, p.radius * 0.9, 7, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fill();

            // Aura ring
            ctx.beginPath();
            ctx.arc(0, 0, p.radius + 5, 0, Math.PI * 2);
            ctx.fillStyle = p.color + '33';
            ctx.fill();
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Shield bubble
            if (p.isShielding) {
                ctx.beginPath();
                ctx.arc(0, 0, p.radius + 14, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(47, 123, 255, 0.28)';
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#2f7bff';
                ctx.stroke();
            }

            // Rotated potato
            ctx.save();
            ctx.rotate(p.angle);

            // Potato body
            ctx.font = '38px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🥔', 0, 0);

            // Held item (Sword or Shield)
            if (p.isShielding) {
                ctx.font = '24px system-ui';
                ctx.fillText('🛡️', 26, 0);
            } else {
                ctx.font = '24px system-ui';
                const swordOffset = p.isAttacking ? 36 : 24;
                ctx.fillText('⚔️', swordOffset, 0);
            }

            ctx.restore();

            // Name Tag
            ctx.font = 'bold 12px system-ui';
            ctx.fillStyle = '#f1f3ff';
            ctx.textAlign = 'center';
            ctx.fillText(p.name, 0, -p.radius - 16);

            // Health Bar
            const barW = 46;
            const barH = 5;
            ctx.fillStyle = '#171a2b';
            ctx.fillRect(-barW / 2, -p.radius - 12, barW, barH);
            const hpRatio = p.hp / p.maxHp;
            ctx.fillStyle = hpRatio > 0.5 ? '#2ee59d' : hpRatio > 0.25 ? '#ffb84d' : '#ff4757';
            ctx.fillRect(-barW / 2, -p.radius - 12, barW * hpRatio, barH);

            // Score tag
            ctx.font = '900 11px system-ui';
            ctx.fillStyle = '#ffd32a';
            ctx.fillText(`${p.score} KOs ⚔️`, 0, p.radius + 18);

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
        ctx.fillText(`FIRST TO ${this.targetKOs} KOs  ·  TIME: ${Math.ceil(this.roundTimer)}s`, W / 2, 36);
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

        ctx.fillStyle = 'rgba(8, 10, 20, 0.92)';
        ctx.fillRect(W / 2 - 280, H / 2 - 170, 560, 340);

        ctx.strokeStyle = '#ff4757';
        ctx.lineWidth = 4;
        ctx.strokeRect(W / 2 - 280, H / 2 - 170, 560, 340);

        ctx.font = '54px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⚔️', W / 2, H / 2 - 95);

        ctx.font = '900 32px system-ui';
        ctx.fillStyle = '#ff4757';
        ctx.fillText('CHAMPION!', W / 2, H / 2 - 40);

        ctx.font = 'bold 22px system-ui';
        ctx.fillStyle = '#f1f3ff';
        ctx.fillText(`${this.winner?.name || 'Player 1'} WINS!`, W / 2, H / 2 + 5);

        ctx.font = 'bold 16px system-ui';
        ctx.fillStyle = '#2ee59d';
        ctx.fillText(`Total KOs: ${this.winner?.score || 0} ⚔️`, W / 2, H / 2 + 40);

        ctx.font = '13px system-ui';
        ctx.fillStyle = '#8c93b8';
        ctx.fillText(`Battle finished · Tap Lobby or reset on screen`, W / 2, H / 2 + 95);
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
    window.GamesRegistry.register('sword-fight', SwordFightGame, {
        name: 'Potato Sword Fight',
        icon: '⚔️',
        description: 'Arena battle! Slash with A, raise shield with B, and score knockouts.',
        btnALabel: 'SLASH ⚔️',
        btnBLabel: 'SHIELD 🛡️',
    });
}