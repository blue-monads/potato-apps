class CrossyRoadGame {
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
        this.room = opts.room;
        this.onScoreUpdate = opts.onScoreUpdate || (() => {});
        this.onGameOver = opts.onGameOver || (() => {});

        this.width = opts.canvas.width || 1200;
        this.height = opts.canvas.height || 700;

        const THREE = window.THREE;
        if (!THREE) {
            console.error('ThreeJS is not loaded on window.THREE');
            return;
        }

        const BoxGeometry = THREE.BoxGeometry || THREE.BoxBufferGeometry;
        const PlaneGeometry = THREE.PlaneGeometry || THREE.PlaneBufferGeometry;

        this.targetLane = 45; // Cross 45 lanes to win!
        this.gameOver = false;
        this.winner = null;

        // Web Audio SFX
        this.audioCtx = null;
        this.initAudio();

        // 3D Scene & Renderer
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
        });
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setSize(this.width, this.height);

        // Isometric Orthographic Camera
        const distance = 500;
        this.camera = new THREE.OrthographicCamera(
            this.width / -2,
            this.width / 2,
            this.height / 2,
            this.height / -2,
            0.1,
            10000
        );

        this.camera.rotation.x = (50 * Math.PI) / 180;
        this.camera.rotation.y = (20 * Math.PI) / 180;
        this.camera.rotation.z = (10 * Math.PI) / 180;

        this.initialCameraPositionY = -Math.tan(this.camera.rotation.x) * distance;
        this.initialCameraPositionX =
            Math.tan(this.camera.rotation.y) *
            Math.sqrt(distance ** 2 + this.initialCameraPositionY ** 2);
        this.camera.position.y = this.initialCameraPositionY;
        this.camera.position.x = this.initialCameraPositionX;
        this.camera.position.z = distance;

        // Constants
        this.zoom = 2;
        this.potatoSize = 16;
        this.positionWidth = 42;
        this.columns = 17;
        this.boardWidth = this.positionWidth * this.columns;
        this.stepTime = 180; // ms per hop

        // Lighting
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444455, 0.75);
        this.scene.add(this.hemiLight);

        this.initialDirLightPositionX = -100;
        this.initialDirLightPositionY = -100;
        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
        this.dirLight.position.set(this.initialDirLightPositionX, this.initialDirLightPositionY, 220);
        this.dirLight.castShadow = true;
        this.scene.add(this.dirLight);

        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        const d = 500;
        this.dirLight.shadow.camera.left = -d;
        this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d;
        this.dirLight.shadow.camera.bottom = -d;

        const backLight = new THREE.DirectionalLight(0x1a254a, 0.4);
        backLight.position.set(200, 200, 60);
        this.scene.add(backLight);

        // Vehicle Textures
        this.carFrontTexture = this.createTexture(40, 80, [{ x: 0, y: 10, w: 30, h: 60 }]);
        this.carBackTexture = this.createTexture(40, 80, [{ x: 10, y: 10, w: 30, h: 60 }]);
        this.carRightSideTexture = this.createTexture(110, 40, [{ x: 10, y: 0, w: 50, h: 30 }, { x: 70, y: 0, w: 30, h: 30 }]);
        this.carLeftSideTexture = this.createTexture(110, 40, [{ x: 10, y: 10, w: 50, h: 30 }, { x: 70, y: 0, w: 30, h: 30 }]);
        this.truckFrontTexture = this.createTexture(30, 30, [{ x: 15, y: 0, w: 10, h: 30 }]);
        this.truckRightSideTexture = this.createTexture(25, 30, [{ x: 0, y: 15, w: 10, h: 10 }]);
        this.truckLeftSideTexture = this.createTexture(25, 30, [{ x: 0, y: 5, w: 10, h: 10 }]);

        this.vehicleColors = [0xa52523, 0xbdb638, 0x78b14b, 0x2f7bff, 0xe5484d, 0xff9f1a, 0x8c7ae6];
        this.treeHeights = [20, 35, 50];

        // Generate Lanes
        this.lanes = [];
        this.generateAllLanes();

        // Initialize Players
        const defaultColors = ['#7c5cff', '#2ee59d', '#ff6b81', '#ffb84d', '#2f7bff', '#ff6bd6'];
        const numP = Math.max(opts.players?.length || 1, 1);
        const startCols = [8, 6, 10, 4, 12, 2];

        this.players = (opts.players || []).map((p, i) => {
            const hexColor = p.color || defaultColors[i % defaultColors.length];
            const col = startCols[i % startCols.length];
            const mesh = this.createPotatoMesh(hexColor, i + 1);
            this.scene.add(mesh);

            return {
                conn_id: p.conn_id,
                user_id: p.user_id,
                name: p.name || `Player ${i + 1}`,
                color: hexColor,
                mesh,
                currentLane: 0,
                currentColumn: col,
                moves: [],
                startMoving: false,
                stepStartTimestamp: null,
                isAlive: true,
                respawnTimer: 0,
                lastSafeLane: 0,
                maxLane: 0,
                score: 0,
                inputState: { x: 0, y: 0, btnA: false, btnB: false },
                prevInput: { x: 0, y: 0, btnA: false, btnB: false },
            };
        });

        // Set initial positions
        for (const p of this.players) {
            this.placePlayer(p, p.currentLane, p.currentColumn);
        }

        this.running = true;
        this.previousTimestamp = null;
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
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            const ctx = this.audioCtx;
            const now = ctx.currentTime;

            if (type === 'hop') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(320, now);
                osc.frequency.exponentialRampToValueAtTime(580, now + 0.1);
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.13);
            } else if (type === 'honk') {
                [440, 554].forEach(f => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(f, now);
                    gain.gain.setValueAtTime(0.14, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.24);
                });
            } else if (type === 'splat') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(160, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.24);
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
        } catch {}
    }

    createTexture(width, height, rects) {
        const THREE = window.THREE;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.fillStyle = 'rgba(0,0,0,0.6)';
        rects.forEach((rect) => {
            context.fillRect(rect.x, rect.y, rect.w, rect.h);
        });
        return new THREE.CanvasTexture(canvas);
    }

    createPotatoMesh(hexColor, pNum) {
        const THREE = window.THREE;
        const BoxGeometry = THREE.BoxGeometry || THREE.BoxBufferGeometry;
        const group = new THREE.Group();

        // Potato Body
        const bodyMat = new THREE.MeshPhongMaterial({
            color: parseInt(hexColor.replace('#', '0x')),
            flatShading: true,
        });
        const body = new THREE.Mesh(
            new BoxGeometry(this.potatoSize * this.zoom, this.potatoSize * this.zoom, 18 * this.zoom),
            bodyMat
        );
        body.position.z = 9 * this.zoom;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // Eyes
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

        for (let side of [-1, 1]) {
            const eye = new THREE.Mesh(new BoxGeometry(3 * this.zoom, 2 * this.zoom, 3 * this.zoom), eyeMat);
            eye.position.set(side * 4 * this.zoom, 8 * this.zoom, 12 * this.zoom);
            group.add(eye);

            const pupil = new THREE.Mesh(new BoxGeometry(1.5 * this.zoom, 1.5 * this.zoom, 1.5 * this.zoom), pupilMat);
            pupil.position.set(side * 4 * this.zoom, 8.8 * this.zoom, 12 * this.zoom);
            group.add(pupil);
        }

        // Colored Cap / Badge on top
        const cap = new THREE.Mesh(
            new BoxGeometry(6 * this.zoom, 6 * this.zoom, 4 * this.zoom),
            new THREE.MeshLambertMaterial({ color: 0xffd32a, flatShading: true })
        );
        cap.position.z = 20 * this.zoom;
        cap.castShadow = true;
        group.add(cap);

        return group;
    }

    createWheel() {
        const THREE = window.THREE;
        const BoxGeometry = THREE.BoxGeometry || THREE.BoxBufferGeometry;
        const wheel = new THREE.Mesh(
            new BoxGeometry(12 * this.zoom, 33 * this.zoom, 12 * this.zoom),
            new THREE.MeshLambertMaterial({ color: 0x2b2b2b, flatShading: true })
        );
        wheel.position.z = 6 * this.zoom;
        return wheel;
    }

    createCar() {
        const THREE = window.THREE;
        const BoxGeometry = THREE.BoxGeometry || THREE.BoxBufferGeometry;
        const car = new THREE.Group();
        const color = this.vehicleColors[Math.floor(Math.random() * this.vehicleColors.length)];

        const main = new THREE.Mesh(
            new BoxGeometry(60 * this.zoom, 30 * this.zoom, 15 * this.zoom),
            new THREE.MeshPhongMaterial({ color, flatShading: true })
        );
        main.position.z = 12 * this.zoom;
        main.castShadow = true;
        main.receiveShadow = true;
        car.add(main);

        const cabin = new THREE.Mesh(
            new BoxGeometry(33 * this.zoom, 24 * this.zoom, 12 * this.zoom),
            [
                new THREE.MeshPhongMaterial({ color: 0xdcdde1, flatShading: true, map: this.carBackTexture }),
                new THREE.MeshPhongMaterial({ color: 0xdcdde1, flatShading: true, map: this.carFrontTexture }),
                new THREE.MeshPhongMaterial({ color: 0xdcdde1, flatShading: true, map: this.carRightSideTexture }),
                new THREE.MeshPhongMaterial({ color: 0xdcdde1, flatShading: true, map: this.carLeftSideTexture }),
                new THREE.MeshPhongMaterial({ color: 0xdcdde1, flatShading: true }),
                new THREE.MeshPhongMaterial({ color: 0xdcdde1, flatShading: true }),
            ]
        );
        cabin.position.x = 6 * this.zoom;
        cabin.position.z = 25.5 * this.zoom;
        cabin.castShadow = true;
        cabin.receiveShadow = true;
        car.add(cabin);

        const frontWheel = this.createWheel();
        frontWheel.position.x = -18 * this.zoom;
        car.add(frontWheel);

        const backWheel = this.createWheel();
        backWheel.position.x = 18 * this.zoom;
        car.add(backWheel);

        return car;
    }

    createTruck() {
        const THREE = window.THREE;
        const BoxGeometry = THREE.BoxGeometry || THREE.BoxBufferGeometry;
        const truck = new THREE.Group();
        const color = this.vehicleColors[Math.floor(Math.random() * this.vehicleColors.length)];

        const base = new THREE.Mesh(
            new BoxGeometry(100 * this.zoom, 25 * this.zoom, 5 * this.zoom),
            new THREE.MeshLambertMaterial({ color: 0x718093, flatShading: true })
        );
        base.position.z = 10 * this.zoom;
        truck.add(base);

        const cargo = new THREE.Mesh(
            new BoxGeometry(75 * this.zoom, 35 * this.zoom, 40 * this.zoom),
            new THREE.MeshPhongMaterial({ color: 0xf5f6fa, flatShading: true })
        );
        cargo.position.x = 15 * this.zoom;
        cargo.position.z = 30 * this.zoom;
        cargo.castShadow = true;
        cargo.receiveShadow = true;
        truck.add(cargo);

        const cabin = new THREE.Mesh(
            new BoxGeometry(25 * this.zoom, 30 * this.zoom, 30 * this.zoom),
            [
                new THREE.MeshPhongMaterial({ color, flatShading: true }),
                new THREE.MeshPhongMaterial({ color, flatShading: true, map: this.truckFrontTexture }),
                new THREE.MeshPhongMaterial({ color, flatShading: true, map: this.truckRightSideTexture }),
                new THREE.MeshPhongMaterial({ color, flatShading: true, map: this.truckLeftSideTexture }),
                new THREE.MeshPhongMaterial({ color, flatShading: true }),
                new THREE.MeshPhongMaterial({ color, flatShading: true }),
            ]
        );
        cabin.position.x = -40 * this.zoom;
        cabin.position.z = 20 * this.zoom;
        cabin.castShadow = true;
        cabin.receiveShadow = true;
        truck.add(cabin);

        const frontWheel = this.createWheel();
        frontWheel.position.x = -38 * this.zoom;
        truck.add(frontWheel);

        const middleWheel = this.createWheel();
        middleWheel.position.x = -10 * this.zoom;
        truck.add(middleWheel);

        const backWheel = this.createWheel();
        backWheel.position.x = 30 * this.zoom;
        truck.add(backWheel);

        return truck;
    }

    createTree() {
        const THREE = window.THREE;
        const BoxGeometry = THREE.BoxGeometry || THREE.BoxBufferGeometry;
        const tree = new THREE.Group();

        const trunk = new THREE.Mesh(
            new BoxGeometry(15 * this.zoom, 15 * this.zoom, 20 * this.zoom),
            new THREE.MeshPhongMaterial({ color: 0x4d2926, flatShading: true })
        );
        trunk.position.z = 10 * this.zoom;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        tree.add(trunk);

        const height = this.treeHeights[Math.floor(Math.random() * this.treeHeights.length)];
        const crown = new THREE.Mesh(
            new BoxGeometry(30 * this.zoom, 30 * this.zoom, height * this.zoom),
            new THREE.MeshLambertMaterial({ color: 0x44bd32, flatShading: true })
        );
        crown.position.z = (height / 2 + 20) * this.zoom;
        crown.castShadow = true;
        crown.receiveShadow = false;
        tree.add(crown);

        return tree;
    }

    createRoadMesh() {
        const THREE = window.THREE;
        const PlaneGeometry = THREE.PlaneGeometry || THREE.PlaneBufferGeometry;
        const road = new THREE.Group();

        const createSection = (color) =>
            new THREE.Mesh(
                new PlaneGeometry(this.boardWidth * this.zoom, this.positionWidth * this.zoom),
                new THREE.MeshPhongMaterial({ color })
            );

        const middle = createSection(0x353b48);
        middle.receiveShadow = true;
        road.add(middle);

        const left = createSection(0x2f3640);
        left.position.x = -this.boardWidth * this.zoom;
        road.add(left);

        const right = createSection(0x2f3640);
        right.position.x = this.boardWidth * this.zoom;
        road.add(right);

        return road;
    }

    createGrassMesh(isFinish = false) {
        const THREE = window.THREE;
        const BoxGeometry = THREE.BoxGeometry || THREE.BoxBufferGeometry;
        const grass = new THREE.Group();

        const color = isFinish ? 0xffd32a : 0x4cd137;
        const sideColor = isFinish ? 0xffa502 : 0x44bd32;

        const createSection = (col) =>
            new THREE.Mesh(
                new BoxGeometry(this.boardWidth * this.zoom, this.positionWidth * this.zoom, 3 * this.zoom),
                new THREE.MeshPhongMaterial({ color: col })
            );

        const middle = createSection(color);
        middle.receiveShadow = true;
        grass.add(middle);

        const left = createSection(sideColor);
        left.position.x = -this.boardWidth * this.zoom;
        grass.add(left);

        const right = createSection(sideColor);
        right.position.x = this.boardWidth * this.zoom;
        grass.add(right);

        grass.position.z = 1.5 * this.zoom;
        return grass;
    }

    generateAllLanes() {
        const laneTypes = ['car', 'truck', 'forest', 'car', 'truck'];
        const laneSpeeds = [2.2, 2.8, 3.4];

        for (let idx = -6; idx <= this.targetLane + 6; idx++) {
            let type = 'field';
            if (idx === this.targetLane) {
                type = 'finish';
            } else if (idx > 0 && idx % 7 !== 0) {
                type = laneTypes[Math.floor(Math.random() * laneTypes.length)];
            }

            const lane = { index: idx, type, occupiedPositions: new Set(), vehicles: [] };

            if (type === 'field' || idx <= 0) {
                lane.mesh = this.createGrassMesh(false);
            } else if (type === 'finish') {
                lane.mesh = this.createGrassMesh(true);
            } else if (type === 'forest') {
                lane.mesh = this.createGrassMesh(false);
                const count = 3 + Math.floor(Math.random() * 3);
                for (let k = 0; k < count; k++) {
                    const tree = this.createTree();
                    let pos;
                    do {
                        pos = Math.floor(Math.random() * this.columns);
                    } while (lane.occupiedPositions.has(pos));
                    lane.occupiedPositions.add(pos);
                    tree.position.x = (pos * this.positionWidth + this.positionWidth / 2) * this.zoom - (this.boardWidth * this.zoom) / 2;
                    lane.mesh.add(tree);
                }
            } else if (type === 'car') {
                lane.mesh = this.createRoadMesh();
                lane.direction = Math.random() >= 0.5;
                lane.speed = laneSpeeds[Math.floor(Math.random() * laneSpeeds.length)];
                const vCount = 2 + Math.floor(Math.random() * 2);
                const occ = new Set();
                for (let k = 0; k < vCount; k++) {
                    const car = this.createCar();
                    let pos;
                    do {
                        pos = Math.floor((Math.random() * this.columns) / 2);
                    } while (occ.has(pos));
                    occ.add(pos);
                    car.position.x = (pos * this.positionWidth * 2 + this.positionWidth / 2) * this.zoom - (this.boardWidth * this.zoom) / 2;
                    if (!lane.direction) car.rotation.z = Math.PI;
                    lane.mesh.add(car);
                    lane.vehicles.push(car);
                }
            } else if (type === 'truck') {
                lane.mesh = this.createRoadMesh();
                lane.direction = Math.random() >= 0.5;
                lane.speed = laneSpeeds[Math.floor(Math.random() * laneSpeeds.length)] * 0.9;
                const vCount = 1 + Math.floor(Math.random() * 2);
                const occ = new Set();
                for (let k = 0; k < vCount; k++) {
                    const truck = this.createTruck();
                    let pos;
                    do {
                        pos = Math.floor((Math.random() * this.columns) / 3);
                    } while (occ.has(pos));
                    occ.add(pos);
                    truck.position.x = (pos * this.positionWidth * 3 + this.positionWidth / 2) * this.zoom - (this.boardWidth * this.zoom) / 2;
                    if (!lane.direction) truck.rotation.z = Math.PI;
                    lane.mesh.add(truck);
                    lane.vehicles.push(truck);
                }
            }

            lane.mesh.position.y = idx * this.positionWidth * this.zoom;
            this.scene.add(lane.mesh);
            this.lanes.push(lane);
        }
    }

    placePlayer(p, lane, column) {
        const x = (column * this.positionWidth + this.positionWidth / 2) * this.zoom - (this.boardWidth * this.zoom) / 2;
        const y = lane * this.positionWidth * this.zoom;
        p.mesh.position.x = x;
        p.mesh.position.y = y;
        p.mesh.position.z = 0;
    }

    onPlayerInput(connId, input) {
        const p = this.players.find(pl => pl.conn_id === connId);
        if (!p) return;

        p.inputState = {
            x: input.x || 0,
            y: input.y || 0,
            btnA: !!input.btnA,
            btnB: !!input.btnB,
        };

        // Fresh Button A = Hop Forward
        if (p.inputState.btnA && !p.prevInput.btnA) {
            this.queueMove(p, 'forward');
        }

        // Fresh Button B = Honk Horn
        if (p.inputState.btnB && !p.prevInput.btnB) {
            this.playSfx('honk');
        }

        // Directional Joystick Triggers
        const deadzone = 0.45;
        const prev = p.prevInput;
        const cur = p.inputState;

        if (cur.y < -deadzone && prev.y >= -deadzone) {
            this.queueMove(p, 'forward');
        } else if (cur.y > deadzone && prev.y <= deadzone) {
            this.queueMove(p, 'backward');
        } else if (cur.x < -deadzone && prev.x >= -deadzone) {
            this.queueMove(p, 'left');
        } else if (cur.x > deadzone && prev.x <= deadzone) {
            this.queueMove(p, 'right');
        }

        p.prevInput = { ...p.inputState };
    }

    queueMove(p, direction) {
        if (!p.isAlive || this.gameOver) return;

        const finalPos = p.moves.reduce(
            (pos, move) => {
                if (move === 'forward') return { lane: pos.lane + 1, column: pos.column };
                if (move === 'backward') return { lane: pos.lane - 1, column: pos.column };
                if (move === 'left') return { lane: pos.lane, column: pos.column - 1 };
                if (move === 'right') return { lane: pos.lane, column: pos.column + 1 };
                return pos;
            },
            { lane: p.currentLane, column: p.currentColumn }
        );

        const targetLaneObj = this.lanes.find(l => l.index === finalPos.lane + (direction === 'forward' ? 1 : direction === 'backward' ? -1 : 0));

        if (direction === 'forward') {
            if (targetLaneObj?.type === 'forest' && targetLaneObj.occupiedPositions.has(finalPos.column)) return;
            if (!p.stepStartTimestamp) p.startMoving = true;
        } else if (direction === 'backward') {
            if (finalPos.lane <= 0) return;
            if (targetLaneObj?.type === 'forest' && targetLaneObj.occupiedPositions.has(finalPos.column)) return;
            if (!p.stepStartTimestamp) p.startMoving = true;
        } else if (direction === 'left') {
            if (finalPos.column <= 0) return;
            const curLaneObj = this.lanes.find(l => l.index === finalPos.lane);
            if (curLaneObj?.type === 'forest' && curLaneObj.occupiedPositions.has(finalPos.column - 1)) return;
            if (!p.stepStartTimestamp) p.startMoving = true;
        } else if (direction === 'right') {
            if (finalPos.column >= this.columns - 1) return;
            const curLaneObj = this.lanes.find(l => l.index === finalPos.lane);
            if (curLaneObj?.type === 'forest' && curLaneObj.occupiedPositions.has(finalPos.column + 1)) return;
            if (!p.stepStartTimestamp) p.startMoving = true;
        }

        p.moves.push(direction);
        this.playSfx('hop');
    }

    loop(timestamp) {
        if (!this.running) return;

        if (!this.previousTimestamp) this.previousTimestamp = timestamp;
        const delta = timestamp - this.previousTimestamp;
        this.previousTimestamp = timestamp;

        this.update(timestamp, delta);
        this.renderer.render(this.scene, this.camera);

        this.animId = requestAnimationFrame(this.loop);
    }

    update(timestamp, delta) {
        // Animate vehicles across lanes
        for (const lane of this.lanes) {
            if (lane.type === 'car' || lane.type === 'truck') {
                const aBitBefore = (-this.boardWidth * this.zoom) / 2 - this.positionWidth * 2 * this.zoom;
                const aBitAfter = (this.boardWidth * this.zoom) / 2 + this.positionWidth * 2 * this.zoom;

                for (const vehicle of lane.vehicles) {
                    if (lane.direction) {
                        vehicle.position.x = vehicle.position.x < aBitBefore ? aBitAfter : vehicle.position.x - (lane.speed / 16) * delta;
                    } else {
                        vehicle.position.x = vehicle.position.x > aBitAfter ? aBitBefore : vehicle.position.x + (lane.speed / 16) * delta;
                    }
                }
            }
        }

        const scoresMap = {};
        let leaderY = 0;

        // Update each player
        for (const p of this.players) {
            if (!p.isAlive) {
                p.respawnTimer -= delta / 1000;
                if (p.respawnTimer <= 0) {
                    p.isAlive = true;
                    p.mesh.scale.set(1, 1, 1);
                    p.mesh.rotation.x = 0;
                    p.currentLane = p.lastSafeLane;
                    p.moves = [];
                    p.stepStartTimestamp = null;
                    this.placePlayer(p, p.currentLane, p.currentColumn);
                }
                scoresMap[p.conn_id] = p.score;
                continue;
            }

            if (p.startMoving) {
                p.stepStartTimestamp = timestamp;
                p.startMoving = false;
            }

            if (p.stepStartTimestamp && p.moves.length > 0) {
                const moveDeltaTime = timestamp - p.stepStartTimestamp;
                const progress = Math.min(moveDeltaTime / this.stepTime, 1);
                const moveDist = progress * this.positionWidth * this.zoom;
                const jumpDist = Math.sin(progress * Math.PI) * 10 * this.zoom;

                const baseLaneY = p.currentLane * this.positionWidth * this.zoom;
                const baseColX = (p.currentColumn * this.positionWidth + this.positionWidth / 2) * this.zoom - (this.boardWidth * this.zoom) / 2;

                const curMove = p.moves[0];
                if (curMove === 'forward') {
                    p.mesh.position.y = baseLaneY + moveDist;
                    p.mesh.position.z = jumpDist;
                    p.mesh.rotation.z = 0;
                } else if (curMove === 'backward') {
                    p.mesh.position.y = baseLaneY - moveDist;
                    p.mesh.position.z = jumpDist;
                    p.mesh.rotation.z = Math.PI;
                } else if (curMove === 'left') {
                    p.mesh.position.x = baseColX - moveDist;
                    p.mesh.position.z = jumpDist;
                    p.mesh.rotation.z = Math.PI / 2;
                } else if (curMove === 'right') {
                    p.mesh.position.x = baseColX + moveDist;
                    p.mesh.position.z = jumpDist;
                    p.mesh.rotation.z = -Math.PI / 2;
                }

                if (moveDeltaTime >= this.stepTime) {
                    if (curMove === 'forward') {
                        p.currentLane++;
                        if (p.currentLane % 7 === 0) p.lastSafeLane = p.currentLane;
                    } else if (curMove === 'backward') {
                        p.currentLane--;
                    } else if (curMove === 'left') {
                        p.currentColumn--;
                    } else if (curMove === 'right') {
                        p.currentColumn++;
                    }

                    p.maxLane = Math.max(p.maxLane, p.currentLane);
                    p.score = p.maxLane;
                    p.moves.shift();
                    p.stepStartTimestamp = p.moves.length > 0 ? timestamp : null;

                    this.placePlayer(p, p.currentLane, p.currentColumn);

                    // Win Check!
                    if (p.currentLane >= this.targetLane) {
                        this.finishGame(p);
                        return;
                    }
                }
            }

            // Hit Test with vehicles on the player's current lane
            const currentLaneObj = this.lanes.find(l => l.index === p.currentLane);
            if (currentLaneObj && (currentLaneObj.type === 'car' || currentLaneObj.type === 'truck')) {
                const pMinX = p.mesh.position.x - (this.potatoSize * this.zoom) / 2;
                const pMaxX = p.mesh.position.x + (this.potatoSize * this.zoom) / 2;
                const vehicleLen = currentLaneObj.type === 'car' ? 60 : 100;

                for (const v of currentLaneObj.vehicles) {
                    const vMinX = v.position.x - (vehicleLen * this.zoom) / 2;
                    const vMaxX = v.position.x + (vehicleLen * this.zoom) / 2;

                    if (pMaxX > vMinX && pMinX < vMaxX) {
                        // SQUISH!
                        p.isAlive = false;
                        p.respawnTimer = 1.8;
                        p.mesh.scale.set(1.5, 1.5, 0.15);
                        this.playSfx('splat');
                        break;
                    }
                }
            }

            scoresMap[p.conn_id] = p.score;
            if (p.mesh.position.y > leaderY) {
                leaderY = p.mesh.position.y;
            }
        }

        // Camera smoothly follows the leading potato
        const targetCamY = this.initialCameraPositionY + leaderY;
        this.camera.position.y += (targetCamY - this.camera.position.y) * 0.08;
        this.dirLight.position.y += (this.initialDirLightPositionY + leaderY - this.dirLight.position.y) * 0.08;

        this.onScoreUpdate(scoresMap);
    }

    finishGame(winner) {
        if (this.gameOver) return;
        this.gameOver = true;
        this.winner = winner;
        this.playSfx('win');
        this.onGameOver(winner);
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
        if (this.renderer) {
            try { this.renderer.dispose(); } catch {}
        }
    }
}

// Register with GamesRegistry
if (typeof window !== 'undefined' && window.GamesRegistry) {
    window.GamesRegistry.register('crossy-road', CrossyRoadGame, {
        name: 'Potato Crossy Road',
        icon: '🦘',
        description: 'Dodge speeding cars and trucks in 3D! First to cross the highway wins.',
        btnALabel: 'HOP ⬆️',
        btnBLabel: 'HONK 📢',
    });
}
