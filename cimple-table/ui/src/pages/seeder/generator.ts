import type { DatatableColumn } from "../../lib/api";

export type GeneratorStrategy =
    // Text strategies
    | "full_name"
    | "first_name"
    | "last_name"
    | "company"
    | "product_name"
    | "email"
    | "phone"
    | "city"
    | "country"
    | "address"
    | "sku"
    | "uuid"
    | "words"
    | "fixed"
    // Number strategies
    | "seq"
    | "int_range"
    | "price"
    | "percentage"
    | "rating"
    // Dropdown strategies
    | "random_option"
    // Date strategies
    | "recent_days"
    | "past_year"
    | "future_days"
    | "today"
    // Checkbox strategies
    | "random_bool"
    | "mostly_true"
    | "mostly_false"
    // Link strategies
    | "website"
    | "image_url"
    | "github"
    // Textarea strategies
    | "description"
    | "note"
    | "lorem";

export interface ColumnSeedConfig {
    columnId: number;
    slug: string;
    name: string;
    columnType: string;
    strategy: GeneratorStrategy;
    params?: {
        min?: number;
        max?: number;
        fixedValue?: string;
        options?: string[];
        startSeq?: number;
    };
}

const FIRST_NAMES = [
    "Alex", "Jordan", "Taylor", "Morgan", "Sam", "Chris", "Pat", "Casey", "Riley", "Jamie",
    "Avery", "Logan", "Parker", "Quinn", "Cameron", "Dakota", "Reese", "Skyler", "Rowan", "Hayden",
    "Emma", "Liam", "Olivia", "Noah", "Sophia", "Jackson", "Ava", "Lucas", "Mia", "Ethan"
];

const LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
    "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson"
];

const COMPANIES = [
    "Acme Corp", "Globex", "Initech", "Umbrella Labs", "Cyberdyne Systems", "Stark Logistics",
    "Wayne Enterprises", "Hooli", "Pied Piper", "Massive Dynamic", "Soylent Corp", "Aperture Science",
    "Wonka Industries", "Dunder Mifflin", "Prestige Worldwide", "Oscorp", "Tyrell Corporation"
];

const PRODUCT_ADJECTIVES = [
    "Wireless", "Ergonomic", "Smart", "Ultra", "Compact", "Heavy-Duty", "Portable", "Pro",
    "Eco-Friendly", "Premium", "Automatic", "Vintage", "Precision", "Modular", "Industrial"
];

const PRODUCT_NOUNS = [
    "Keyboard", "Mouse", "Headphones", "Monitor", "Desk Lamp", "Backpack", "Water Bottle",
    "Coffee Mug", "Charger Hub", "Webcam", "Microphone", "Cable Organizer", "Laptop Stand",
    "External SSD", "Fitness Tracker", "Power Bank", "Speaker", "Tool Set", "Notebook"
];

const CITIES = [
    "New York", "San Francisco", "Austin", "London", "Tokyo", "Berlin", "Toronto", "Sydney",
    "Singapore", "Paris", "Seattle", "Amsterdam", "Denver", "Chicago", "Boston", "Dublin"
];

const COUNTRIES = [
    "United States", "United Kingdom", "Canada", "Germany", "Japan", "Australia",
    "Singapore", "France", "Netherlands", "Ireland", "Switzerland", "New Zealand"
];

const CATEGORIES = [
    "Electronics", "Office Supplies", "Home & Kitchen", "Accessories", "Hardware",
    "Software", "Apparel", "Furniture", "Books", "Logistics"
];

const STREETS = [
    "Main St", "Oak Ave", "Maple Rd", "Cedar Lane", "Pine Boulevard", "Elm St",
    "Broadway", "Market St", "High St", "Park Avenue", "Sunset Blvd"
];

const LOREM_WORDS = [
    "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
    "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
    "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud", "exercitation"
];

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 2): number {
    const val = Math.random() * (max - min) + min;
    return parseFloat(val.toFixed(decimals));
}

function randDate(daysAgoMin: number, daysAgoMax: number): string {
    const daysAgo = randInt(daysAgoMin, daysAgoMax);
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split("T")[0];
}

export function getDefaultGeneratorConfig(column: DatatableColumn): ColumnSeedConfig {
    const nameLower = column.name.toLowerCase();
    const type = column.column_type;

    let strategy: GeneratorStrategy = "words";
    const params: ColumnSeedConfig["params"] = {};

    if (type === "number") {
        if (nameLower.includes("price") || nameLower.includes("cost") || nameLower.includes("fee") || nameLower.includes("rate") || nameLower.includes("amount") || nameLower.includes("balance")) {
            strategy = "price";
            params.min = 10;
            params.max = 500;
        } else if (nameLower.includes("rating") || nameLower.includes("score")) {
            strategy = "rating";
            params.min = 1;
            params.max = 5;
        } else if (nameLower.includes("percent") || nameLower.includes("pct") || nameLower.includes("progress")) {
            strategy = "percentage";
            params.min = 0;
            params.max = 100;
        } else if (nameLower.includes("id") || nameLower.includes("seq") || nameLower.includes("index") || nameLower.includes("order")) {
            strategy = "seq";
            params.startSeq = 1;
        } else {
            strategy = "int_range";
            params.min = 1;
            params.max = 100;
        }
    } else if (type === "email") {
        strategy = "email";
    } else if (type === "percent") {
        strategy = "percentage";
        params.min = 0;
        params.max = 100;
    } else if (type === "rating") {
        strategy = "rating";
        params.min = 1;
        params.max = 5;
    } else if (type === "barcode") {
        strategy = "sku";
    } else if (type === "dropdown") {
        strategy = "random_option";
        const rawOpts = column.options || "";
        const parsed = rawOpts.split(",").map(o => o.trim()).filter(Boolean);
        params.options = parsed.length > 0 ? parsed : CATEGORIES;
    } else if (type === "checkbox") {
        strategy = "random_bool";
    } else if (type === "date") {
        strategy = "recent_days";
        params.min = 0;
        params.max = 60;
    } else if (type === "link") {
        strategy = "website";
    } else if (type === "textarea") {
        if (nameLower.includes("note") || nameLower.includes("comment")) {
            strategy = "note";
        } else {
            strategy = "description";
        }
    } else {
        // Text type
        if (nameLower.includes("email")) {
            strategy = "email";
        } else if (nameLower.includes("phone") || nameLower.includes("tel") || nameLower.includes("mobile")) {
            strategy = "phone";
        } else if (nameLower.includes("sku") || nameLower.includes("code") || nameLower.includes("barcode")) {
            strategy = "sku";
        } else if (nameLower.includes("city")) {
            strategy = "city";
        } else if (nameLower.includes("country")) {
            strategy = "country";
        } else if (nameLower.includes("address") || nameLower.includes("location") || nameLower.includes("street")) {
            strategy = "address";
        } else if (nameLower.includes("company") || nameLower.includes("vendor") || nameLower.includes("client") || nameLower.includes("org")) {
            strategy = "company";
        } else if (nameLower.includes("product") || nameLower.includes("item") || nameLower.includes("title")) {
            strategy = "product_name";
        } else if (nameLower.includes("first")) {
            strategy = "first_name";
        } else if (nameLower.includes("last")) {
            strategy = "last_name";
        } else if (nameLower.includes("name") || nameLower.includes("author") || nameLower.includes("user") || nameLower.includes("assignee")) {
            strategy = "full_name";
        } else {
            strategy = "words";
        }
    }

    return {
        columnId: column.id,
        slug: column.slug,
        name: column.name,
        columnType: type,
        strategy,
        params,
    };
}

export function generateValueForColumn(config: ColumnSeedConfig, rowIndex: number): any {
    const { strategy, params = {} } = config;

    switch (strategy) {
        case "full_name":
            return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
        case "first_name":
            return pick(FIRST_NAMES);
        case "last_name":
            return pick(LAST_NAMES);
        case "company":
            return pick(COMPANIES);
        case "product_name":
            return `${pick(PRODUCT_ADJECTIVES)} ${pick(PRODUCT_NOUNS)}`;
        case "email": {
            const first = pick(FIRST_NAMES).toLowerCase();
            const last = pick(LAST_NAMES).toLowerCase();
            const num = randInt(10, 99);
            const domain = pick(["gmail.com", "example.org", "company.io", "potatoverse.dev"]);
            return `${first}.${last}${num}@${domain}`;
        }
        case "phone":
            return `+1 (${randInt(200, 999)}) ${randInt(100, 999)}-${randInt(1000, 9999)}`;
        case "city":
            return pick(CITIES);
        case "country":
            return pick(COUNTRIES);
        case "address":
            return `${randInt(100, 9999)} ${pick(STREETS)}, ${pick(CITIES)}`;
        case "sku": {
            const prefix = pick(["SKU", "PROD", "ITEM", "INV", "BOX"]);
            return `${prefix}-${randInt(1000, 9999)}`;
        }
        case "uuid": {
            return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                const v = c === "x" ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
        }
        case "words": {
            const wCount = randInt(2, 4);
            const words = Array.from({ length: wCount }, () => pick(LOREM_WORDS));
            return words.join(" ");
        }
        case "fixed":
            return params.fixedValue ?? "";
        case "seq":
            return (params.startSeq ?? 1) + rowIndex;
        case "int_range":
            return randInt(params.min ?? 1, params.max ?? 100);
        case "price":
            return randFloat(params.min ?? 5, params.max ?? 200, 2);
        case "percentage":
            return randInt(params.min ?? 0, params.max ?? 100);
        case "rating":
            return randInt(params.min ?? 1, params.max ?? 5);
        case "random_option": {
            const options = params.options && params.options.length > 0 ? params.options : CATEGORIES;
            return pick(options);
        }
        case "recent_days":
            return randDate(0, params.max ?? 30);
        case "past_year":
            return randDate(0, 365);
        case "future_days": {
            const d = new Date();
            d.setDate(d.getDate() + randInt(1, 30));
            return d.toISOString().split("T")[0];
        }
        case "today":
            return new Date().toISOString().split("T")[0];
        case "random_bool":
            return Math.random() >= 0.5 ? 1 : 0;
        case "mostly_true":
            return Math.random() >= 0.2 ? 1 : 0;
        case "mostly_false":
            return Math.random() >= 0.8 ? 1 : 0;
        case "website": {
            const slug = pick(COMPANIES).toLowerCase().replace(/\s+/g, "");
            return `https://www.${slug}.com`;
        }
        case "image_url": {
            const id = randInt(1, 1000);
            return `https://picsum.photos/id/${id}/200/200`;
        }
        case "github": {
            const user = pick(FIRST_NAMES).toLowerCase() + randInt(1, 99);
            return `https://github.com/${user}`;
        }
        case "description": {
            return `High quality ${pick(PRODUCT_ADJECTIVES).toLowerCase()} ${pick(PRODUCT_NOUNS).toLowerCase()} crafted with durable materials for optimal performance.`;
        }
        case "note": {
            return `Review scheduled with ${pick(FIRST_NAMES)} regarding ${pick(PRODUCT_NOUNS).toLowerCase()} specs.`;
        }
        case "lorem": {
            const sentences = [
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
                "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi.",
            ];
            return sentences.slice(0, randInt(1, 3)).join(" ");
        }
        default:
            return pick(LOREM_WORDS);
    }
}

export function generateSeedRows(configs: ColumnSeedConfig[], count: number): Record<string, any>[] {
    const rows: Record<string, any>[] = [];
    for (let i = 0; i < count; i++) {
        const row: Record<string, any> = {};
        for (const config of configs) {
            row[config.slug] = generateValueForColumn(config, i);
        }
        rows.push(row);
    }
    return rows;
}
