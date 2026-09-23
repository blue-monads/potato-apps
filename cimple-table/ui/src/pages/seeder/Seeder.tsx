import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { BASE_PATH } from "../../lib/base";
import {
    listDatatables,
    getDatatable,
    seedTableRows,
    type Datatable,
    type DatatableColumn,
} from "../../lib/api";
import {
    type ColumnSeedConfig,
    type GeneratorStrategy,
    getDefaultGeneratorConfig,
    generateSeedRows,
} from "./generator";

const BATCH_SIZE = 100;
const COUNT_PRESETS = [10, 50, 100, 500, 1000];

const STRATEGY_LABELS: Record<GeneratorStrategy, string> = {
    full_name: "Full Name (e.g. Jordan Smith)",
    first_name: "First Name (e.g. Jordan)",
    last_name: "Last Name (e.g. Smith)",
    company: "Company / Org (e.g. Acme Corp)",
    product_name: "Product Name (e.g. Wireless Mouse)",
    email: "Email Address",
    phone: "Phone Number",
    city: "City Name",
    country: "Country Name",
    address: "Street Address",
    sku: "SKU / Code (e.g. SKU-8492)",
    uuid: "UUID / Identifier",
    words: "Random Words",
    fixed: "Fixed Text Value",
    seq: "Sequential (1, 2, 3...)",
    int_range: "Integer Range (Min..Max)",
    price: "Price / Currency ($)",
    percentage: "Percentage (0..100%)",
    rating: "Rating (1..5 stars)",
    random_option: "Random from Options",
    recent_days: "Recent Date (Past 30 days)",
    past_year: "Past Year Date",
    future_days: "Future Date (Next 30 days)",
    today: "Today's Date",
    random_bool: "Random Boolean (50/50)",
    mostly_true: "Mostly Checked (80%)",
    mostly_false: "Mostly Unchecked (20%)",
    website: "Company Website URL",
    image_url: "Image URL",
    github: "GitHub Profile URL",
    description: "Product Description",
    note: "Short Status / Note",
    lorem: "Lorem Ipsum Paragraph",
};

const STRATEGIES_BY_TYPE: Record<string, GeneratorStrategy[]> = {
    text: [
        "product_name", "full_name", "first_name", "last_name", "company",
        "email", "phone", "sku", "city", "country", "address",
        "uuid", "words", "fixed"
    ],
    number: [
        "int_range", "price", "seq", "percentage", "rating"
    ],
    email: [
        "email", "fixed"
    ],
    percent: [
        "percentage", "int_range", "seq", "fixed"
    ],
    rating: [
        "rating", "int_range", "fixed"
    ],
    dropdown: [
        "random_option"
    ],
    date: [
        "recent_days", "past_year", "future_days", "today"
    ],
    checkbox: [
        "random_bool", "mostly_true", "mostly_false"
    ],
    link: [
        "website", "github", "image_url", "fixed"
    ],
    textarea: [
        "description", "note", "lorem", "fixed"
    ],
};

const Seeder = () => {
    const { tableId } = useParams<{ tableId?: string }>();
    const navigate = useNavigate();

    const [datatables, setDatatables] = useState<Datatable[]>([]);
    const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
    const [currentTable, setCurrentTable] = useState<Datatable | null>(null);
    const [loadingTable, setLoadingTable] = useState(false);

    const [seedCount, setSeedCount] = useState<number>(50);
    const [configs, setConfigs] = useState<ColumnSeedConfig[]>([]);
    const [previewKey, setPreviewKey] = useState<number>(0);

    // Seeding execution state
    const [isSeeding, setIsSeeding] = useState(false);
    const [seededCount, setSeededCount] = useState(0);
    const [seedingError, setSeedingError] = useState<string | null>(null);
    const [seedingSuccess, setSeedingSuccess] = useState<boolean>(false);

    // Load tables list
    useEffect(() => {
        const fetchTables = async () => {
            const res = await listDatatables();
            if (res.data && res.data.length > 0) {
                setDatatables(res.data);
                if (tableId) {
                    setSelectedTableId(parseInt(tableId, 10));
                } else {
                    setSelectedTableId(res.data[0].id);
                }
            }
        };
        fetchTables();
    }, [tableId]);

    // Load selected table details
    useEffect(() => {
        if (!selectedTableId) return;
        const load = async () => {
            setLoadingTable(true);
            setSeedingSuccess(false);
            setSeedingError(null);
            const res = await getDatatable(selectedTableId);
            if (res.data) {
                const tbl = res.data;
                const cols = Array.isArray(tbl.columns)
                    ? tbl.columns
                    : (tbl.columns && typeof tbl.columns === "object"
                        ? Object.values(tbl.columns) as DatatableColumn[]
                        : []);
                tbl.columns = cols;
                setCurrentTable(tbl);

                // Initialize column configurations with smart defaults
                const initialConfigs = cols.map(c => getDefaultGeneratorConfig(c));
                setConfigs(initialConfigs);
            }
            setLoadingTable(false);
        };
        load();
    }, [selectedTableId]);

    const handleTableChange = (id: number) => {
        setSelectedTableId(id);
        navigate(`${BASE_PATH}seeder/${id}`);
    };

    const updateConfig = (columnId: number, patch: Partial<ColumnSeedConfig>) => {
        setConfigs(prev =>
            prev.map(c => {
                if (c.columnId !== columnId) return c;
                return { ...c, ...patch };
            })
        );
    };

    const updateParams = (columnId: number, paramPatch: Partial<ColumnSeedConfig["params"]>) => {
        setConfigs(prev =>
            prev.map(c => {
                if (c.columnId !== columnId) return c;
                return {
                    ...c,
                    params: { ...(c.params || {}), ...paramPatch },
                };
            })
        );
    };

    // Live preview rows (5 rows)
    const previewRows = useMemo(() => {
        if (configs.length === 0) return [];
        // previewKey forces re-evaluation on "Regenerate" click
        void previewKey;
        return generateSeedRows(configs, 5);
    }, [configs, previewKey]);

    const handleSeed = async () => {
        if (!currentTable || configs.length === 0 || seedCount <= 0 || isSeeding) return;

        setIsSeeding(true);
        setSeededCount(0);
        setSeedingError(null);
        setSeedingSuccess(false);

        let completed = 0;
        const total = seedCount;

        try {
            while (completed < total) {
                const batchSize = Math.min(BATCH_SIZE, total - completed);
                const batchRows = generateSeedRows(configs, batchSize);

                const res = await seedTableRows(currentTable.id, batchRows);
                if (res.error || !res.data?.success) {
                    throw new Error(res.error || "Batch insert failed");
                }

                completed += res.data.inserted || batchSize;
                setSeededCount(completed);
            }

            setSeedingSuccess(true);
        } catch (err: any) {
            setSeedingError(err.message || "Failed to seed records");
        } finally {
            setIsSeeding(false);
        }
    };

    const progressPct = seedCount > 0 ? Math.min(100, Math.round((seededCount / seedCount) * 100)) : 0;

    return (
        <div className="min-h-screen flex flex-col bg-surface-50 text-surface-800">
            {/* Header */}
            <header className="flex items-center justify-between gap-4 bg-surface-800 text-white px-5 py-3 shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                    <Link
                        to={`${BASE_PATH}table${selectedTableId ? `/${selectedTableId}` : ""}`}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded text-surface-300 hover:text-white hover:bg-surface-700 transition-colors"
                        title="Return to Table"
                    >
                        <i className="fa-solid fa-arrow-left text-[11px]" />
                        <span>Back to Table</span>
                    </Link>
                    <div className="h-4 w-px bg-surface-700" />
                    <div className="flex items-center gap-2">
                        <i className="fa-solid fa-seedling text-emerald-400 text-base" />
                        <h1 className="font-semibold text-[16px]">Data Seeder</h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-surface-400">Target Table:</span>
                    <select
                        value={selectedTableId ?? ""}
                        onChange={e => handleTableChange(parseInt(e.target.value, 10))}
                        className="bg-surface-900 text-white text-xs font-medium px-3 py-1.5 rounded border border-surface-700 outline-none focus:border-accent-500 cursor-pointer"
                    >
                        {datatables.map(t => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
                {/* Status Banners */}
                {seedingSuccess && (
                    <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-800 animate-slide-in">
                        <div className="flex items-center gap-3">
                            <i className="fa-solid fa-circle-check text-emerald-600 text-xl" />
                            <div>
                                <h3 className="font-semibold text-sm">Successfully Seeded Records!</h3>
                                <p className="text-xs text-emerald-700 mt-0.5">
                                    Inserted {seededCount.toLocaleString()} generated records into <strong>{currentTable?.name}</strong>.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    setSeedingSuccess(false);
                                    setPreviewKey(k => k + 1);
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 rounded transition-colors"
                            >
                                Seed More
                            </button>
                            <Link
                                to={`${BASE_PATH}table/${selectedTableId}`}
                                className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-sm transition-colors"
                            >
                                View in Table →
                            </Link>
                        </div>
                    </div>
                )}

                {seedingError && (
                    <div className="flex items-center gap-3 p-4 bg-coral-50 border border-coral-300 rounded-lg text-coral-800">
                        <i className="fa-solid fa-circle-exclamation text-coral-600 text-xl" />
                        <div>
                            <h3 className="font-semibold text-sm">Seeding Failed</h3>
                            <p className="text-xs text-coral-700 mt-0.5">{seedingError}</p>
                        </div>
                    </div>
                )}

                {/* Seeder Config Card */}
                <div className="bg-white border border-surface-200 rounded-xl shadow-xs overflow-hidden">
                    <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between flex-wrap gap-4 bg-surface-50/50">
                        <div>
                            <h2 className="text-sm font-semibold text-surface-900 flex items-center gap-2">
                                <i className="fa-solid fa-sliders text-accent-600 text-xs" />
                                Seeding Configuration
                            </h2>
                            <p className="text-xs text-surface-500 mt-0.5">
                                Configure generator rules for each field in <strong>{currentTable?.name || "the table"}</strong>.
                            </p>
                        </div>

                        {/* Record Count Selector */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-surface-600">Rows to Generate:</span>
                            <div className="inline-flex rounded-md border border-surface-200 bg-white p-0.5">
                                {COUNT_PRESETS.map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setSeedCount(n)}
                                        disabled={isSeeding}
                                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                                            seedCount === n
                                                ? "bg-accent-600 text-white shadow-xs"
                                                : "text-surface-600 hover:text-surface-900 hover:bg-surface-100"
                                        }`}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="number"
                                min="1"
                                max="10000"
                                value={seedCount}
                                disabled={isSeeding}
                                onChange={e => setSeedCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                className="w-20 px-2 py-1 text-xs font-medium border border-surface-200 rounded text-center outline-none focus:border-accent-600"
                                title="Custom row count"
                            />
                        </div>
                    </div>

                    {/* Columns List */}
                    {loadingTable ? (
                        <div className="p-12 text-center text-surface-400 text-sm">
                            <i className="fa-solid fa-spinner animate-spin text-lg mb-2" />
                            <div>Loading table schema...</div>
                        </div>
                    ) : configs.length === 0 ? (
                        <div className="p-12 text-center text-surface-400 text-sm">
                            <i className="fa-solid fa-table-columns text-2xl mb-2 text-surface-300" />
                            <div>This table has no custom fields to seed.</div>
                            <Link
                                to={`${BASE_PATH}table/${selectedTableId}`}
                                className="inline-block mt-3 px-3 py-1.5 text-xs font-medium text-accent-600 hover:underline"
                            >
                                Add fields in Table view →
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-surface-100">
                            {configs.map(config => {
                                const allowedStrategies =
                                    STRATEGIES_BY_TYPE[config.columnType] || STRATEGIES_BY_TYPE["text"];

                                return (
                                    <div
                                        key={config.columnId}
                                        className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-surface-50/70 transition-colors"
                                    >
                                        {/* Column Info */}
                                        <div className="min-w-44">
                                            <div className="font-medium text-xs text-surface-800 flex items-center gap-1.5">
                                                <span>{config.name}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[10px] uppercase font-semibold tracking-wider text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded">
                                                    {config.columnType}
                                                </span>
                                                <span className="text-[11px] text-surface-400 font-mono">
                                                    {config.slug}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Strategy Selector */}
                                        <div className="flex items-center gap-3 flex-1 max-w-md">
                                            <select
                                                value={config.strategy}
                                                disabled={isSeeding}
                                                onChange={e =>
                                                    updateConfig(config.columnId, {
                                                        strategy: e.target.value as GeneratorStrategy,
                                                    })
                                                }
                                                className="w-full text-xs font-medium px-3 py-1.5 bg-white border border-surface-200 rounded-md outline-none focus:border-accent-600 cursor-pointer"
                                            >
                                                {allowedStrategies.map(st => (
                                                    <option key={st} value={st}>
                                                        {STRATEGY_LABELS[st] || st}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Strategy Parameters (Range, Options, Fixed text) */}
                                        <div className="w-56 flex items-center gap-2 justify-end text-xs">
                                            {(config.strategy === "int_range" || config.strategy === "price") && (
                                                <div className="flex items-center gap-1 text-surface-500">
                                                    <span>Min:</span>
                                                    <input
                                                        type="number"
                                                        value={config.params?.min ?? (config.strategy === "price" ? 10 : 1)}
                                                        disabled={isSeeding}
                                                        onChange={e =>
                                                            updateParams(config.columnId, {
                                                                min: parseFloat(e.target.value) || 0,
                                                            })
                                                        }
                                                        className="w-14 px-1.5 py-1 text-xs border border-surface-200 rounded text-center"
                                                    />
                                                    <span>Max:</span>
                                                    <input
                                                        type="number"
                                                        value={config.params?.max ?? (config.strategy === "price" ? 500 : 100)}
                                                        disabled={isSeeding}
                                                        onChange={e =>
                                                            updateParams(config.columnId, {
                                                                max: parseFloat(e.target.value) || 100,
                                                            })
                                                        }
                                                        className="w-14 px-1.5 py-1 text-xs border border-surface-200 rounded text-center"
                                                    />
                                                </div>
                                            )}

                                            {config.strategy === "fixed" && (
                                                <input
                                                    type="text"
                                                    placeholder="Fixed value..."
                                                    value={config.params?.fixedValue ?? ""}
                                                    disabled={isSeeding}
                                                    onChange={e =>
                                                        updateParams(config.columnId, {
                                                            fixedValue: e.target.value,
                                                        })
                                                    }
                                                    className="w-48 px-2 py-1 text-xs border border-surface-200 rounded"
                                                />
                                            )}

                                            {config.strategy === "seq" && (
                                                <div className="flex items-center gap-1 text-surface-500">
                                                    <span>Start at:</span>
                                                    <input
                                                        type="number"
                                                        value={config.params?.startSeq ?? 1}
                                                        disabled={isSeeding}
                                                        onChange={e =>
                                                            updateParams(config.columnId, {
                                                                startSeq: parseInt(e.target.value, 10) || 1,
                                                            })
                                                        }
                                                        className="w-16 px-1.5 py-1 text-xs border border-surface-200 rounded text-center"
                                                    />
                                                </div>
                                            )}

                                            {config.strategy === "random_option" && (
                                                <span className="text-[11px] text-surface-400 italic truncate max-w-xs" title={(config.params?.options || []).join(", ")}>
                                                    {(config.params?.options || []).slice(0, 3).join(", ")}
                                                    {(config.params?.options?.length || 0) > 3 ? "..." : ""}
                                                </span>
                                            )}

                                            {config.strategy !== "int_range" &&
                                                config.strategy !== "price" &&
                                                config.strategy !== "fixed" &&
                                                config.strategy !== "seq" &&
                                                config.strategy !== "random_option" && (
                                                    <span className="text-[11px] text-surface-400">
                                                        Auto-randomized
                                                    </span>
                                                )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Live Preview Card */}
                {configs.length > 0 && (
                    <div className="bg-white border border-surface-200 rounded-xl shadow-xs overflow-hidden">
                        <div className="px-6 py-3 border-b border-surface-100 flex items-center justify-between bg-surface-50/50">
                            <div className="flex items-center gap-2">
                                <i className="fa-solid fa-eye text-surface-400 text-xs" />
                                <h3 className="text-xs font-semibold text-surface-800">
                                    Sample Preview (5 Rows)
                                </h3>
                            </div>
                            <button
                                onClick={() => setPreviewKey(k => k + 1)}
                                disabled={isSeeding}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-surface-600 bg-white border border-surface-200 rounded hover:bg-surface-50 transition-colors"
                            >
                                <i className="fa-solid fa-arrows-rotate text-[10px]" />
                                Regenerate Preview
                            </button>
                        </div>

                        <div className="overflow-x-auto scrollbar-thin">
                            <table className="border-collapse text-xs w-full text-left">
                                <thead>
                                    <tr className="bg-surface-50 border-b border-surface-200">
                                        <th className="py-2 px-3 text-center text-surface-400 w-10 font-semibold">#</th>
                                        {configs.map(c => (
                                            <th key={c.columnId} className="py-2 px-3 font-semibold text-surface-600 border-r border-surface-100 whitespace-nowrap">
                                                {c.name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-100">
                                    {previewRows.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-surface-50/60">
                                            <td className="py-2 px-3 text-center text-[11px] text-surface-400 font-mono">
                                                {idx + 1}
                                            </td>
                                            {configs.map(c => (
                                                <td key={c.columnId} className="py-2 px-3 text-surface-700 border-r border-surface-100 whitespace-nowrap max-w-xs truncate">
                                                    {row[c.slug] !== undefined && row[c.slug] !== null
                                                        ? String(row[c.slug])
                                                        : ""}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Seeder Action Bar / Progress */}
                {configs.length > 0 && (
                    <div className="bg-white border border-surface-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex-1 w-full">
                            {isSeeding ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-semibold text-surface-700">
                                        <span className="flex items-center gap-1.5">
                                            <i className="fa-solid fa-spinner animate-spin text-accent-600" />
                                            Seeding records...
                                        </span>
                                        <span>
                                            {seededCount.toLocaleString()} / {seedCount.toLocaleString()} ({progressPct}%)
                                        </span>
                                    </div>
                                    <div className="w-full h-2.5 bg-surface-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-accent-600 rounded-full transition-all duration-300"
                                            style={{ width: `${progressPct}%` }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="text-xs text-surface-500">
                                        Ready to seed <strong>{seedCount.toLocaleString()}</strong> records into <strong>{currentTable?.name}</strong> using configured generator rules.
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="shrink-0 flex items-center gap-3">
                            <button
                                onClick={handleSeed}
                                disabled={isSeeding || configs.length === 0}
                                className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                            >
                                {isSeeding ? (
                                    <>
                                        <i className="fa-solid fa-spinner animate-spin text-xs" />
                                        Seeding ({progressPct}%)
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-seedling text-xs" />
                                        Generate & Seed {seedCount.toLocaleString()} Records
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Seeder;
