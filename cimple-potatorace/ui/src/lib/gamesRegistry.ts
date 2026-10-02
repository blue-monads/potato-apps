import { BASE_PATH } from './base';

export interface GameMetadata {
    id: string;
    name: string;
    icon: string;
    description: string;
    btnALabel: string;
    btnBLabel: string;
    gameClass?: any;
}

export interface GameInstance {
    onPlayerInput: (connId: string, input: { x: number; y: number; btnA: boolean; btnB: boolean }) => void;
    destroy: () => void;
}

export const AVAILABLE_GAMES: GameMetadata[] = [
    {
        id: 'stupid-race',
        name: 'Stupid Potato Race',
        icon: '🥔',
        description: 'Race around collecting golden stars! Use A to boost and B to brake.',
        btnALabel: 'BOOST 🚀',
        btnBLabel: 'BRAKE',
    },
    {
        id: 'sword-fight',
        name: 'Potato Sword Fight',
        icon: '⚔️',
        description: 'Gladiatorial battle! Slash with A, shield with B, and score knockouts.',
        btnALabel: 'SLASH ⚔️',
        btnBLabel: 'SHIELD 🛡️',
    },
    {
        id: 'potato-sumo',
        name: 'Potato Sumo Ring',
        icon: '🥋',
        description: 'Knock rivals out of the shrinking arena! A to Tackle Dash, B to Brace.',
        btnALabel: 'TACKLE 💥',
        btnBLabel: 'BRACE 🧱',
    },
];

class GamesRegistry {
    games = new Map<string, GameMetadata>();

    constructor() {
        for (const g of AVAILABLE_GAMES) {
            this.games.set(g.id, { ...g });
        }
    }

    register(id: string, gameClass: any, meta: Partial<GameMetadata> = {}) {
        const existing = this.games.get(id) || {
            id,
            name: id,
            icon: '🎮',
            description: '',
            btnALabel: 'ACTION A',
            btnBLabel: 'ACTION B',
        };
        this.games.set(id, {
            ...existing,
            ...meta,
            gameClass,
        });
    }

    get(id: string): GameMetadata | undefined {
        return this.games.get(id);
    }

    list(): GameMetadata[] {
        return Array.from(this.games.values());
    }

    async loadGameScript(id: string): Promise<any> {
        // If already registered with gameClass
        const entry = this.get(id);
        if (entry?.gameClass) {
            return entry.gameClass;
        }

        const scriptUrl = `${BASE_PATH}games/${id}/game.js`;

        // 1. Try fetching and executing directly
        try {
            const res = await fetch(scriptUrl);
            if (res.ok) {
                const code = await res.text();
                // Execute in global scope
                const fn = new Function(code);
                fn();
                const loaded = this.get(id);
                if (loaded?.gameClass) {
                    return loaded.gameClass;
                }
            }
        } catch (err) {
            console.warn(`Fetch ${scriptUrl} failed, falling back to script tag:`, err);
        }

        // 2. Fallback to script tag
        try {
            await new Promise<void>((resolve, reject) => {
                const existing = document.querySelector(`script[data-game="${id}"]`);
                if (existing) {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = scriptUrl;
                script.setAttribute('data-game', id);
                script.onload = () => resolve();
                script.onerror = (err) => reject(new Error(`Failed to load ${scriptUrl}: ${err}`));
                document.head.appendChild(script);
            });
        } catch (e) {
            console.warn(`Dynamic load failed for ${id}, checking registry`, e);
        }

        const loaded = this.get(id);
        if (loaded?.gameClass) {
            return loaded.gameClass;
        }

        throw new Error(`Game class for ${id} not found after loading script`);
    }
}

// Global singleton
declare global {
    interface Window {
        GamesRegistry: GamesRegistry;
    }
}

if (typeof window !== 'undefined') {
    if (!window.GamesRegistry) {
        window.GamesRegistry = new GamesRegistry();
    }
}

export const registry = typeof window !== 'undefined' ? window.GamesRegistry : new GamesRegistry();
