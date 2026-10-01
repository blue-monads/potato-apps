import { useState, useEffect } from 'react';
import { 
    Settings, 
    Save, 
    CheckCircle2, 
    AlertCircle, 
    Percent, 
    TrendingUp, 
    ShoppingBag,
    CircleDollarSign,
    RefreshCw
} from 'lucide-react';
import { 
    getSettings, 
    updateSettings, 
    listTaxes, 
    listAccounts, 
    type AppSettings, 
    type Tax, 
    type Account 
} from '../../lib/api';

const SettingsPage = () => {
    const [settings, setSettings] = useState<AppSettings>({
        currency_symbol: '$',
        default_tax_rate_id: null,
        default_sales_account_id: null,
        default_purchase_account_id: null,
    });
    const [taxes, setTaxes] = useState<Tax[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [settingsResp, taxesResp, accountsResp] = await Promise.all([
                getSettings(),
                listTaxes(),
                listAccounts(),
            ]);

            if (settingsResp.status === 200 && settingsResp.data) {
                setSettings({
                    currency_symbol: settingsResp.data.currency_symbol || '$',
                    default_tax_rate_id: settingsResp.data.default_tax_rate_id ?? null,
                    default_sales_account_id: settingsResp.data.default_sales_account_id ?? null,
                    default_purchase_account_id: settingsResp.data.default_purchase_account_id ?? null,
                });
            }

            if (taxesResp.status === 200 && Array.isArray(taxesResp.data)) {
                setTaxes(taxesResp.data.filter(t => !t.is_deleted));
            }

            if (accountsResp.status === 200 && Array.isArray(accountsResp.data)) {
                setAccounts(accountsResp.data.filter(a => !a.is_deleted));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load settings data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setSaving(true);
        setError(null);
        setSaveSuccess(false);

        try {
            const payload: AppSettings = {
                currency_symbol: settings.currency_symbol?.trim() || '$',
                default_tax_rate_id: settings.default_tax_rate_id ? Number(settings.default_tax_rate_id) : null,
                default_sales_account_id: settings.default_sales_account_id ? Number(settings.default_sales_account_id) : null,
                default_purchase_account_id: settings.default_purchase_account_id ? Number(settings.default_purchase_account_id) : null,
            };

            const resp = await updateSettings(payload);
            if (resp.status === 200) {
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 4000);
            } else {
                setError(resp.error || 'Failed to save settings');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const formatRate = (rate: number) => {
        return (rate / 100).toFixed(2) + '%';
    };

    // Group accounts by account type
    const groupedAccounts = accounts.reduce((acc, account) => {
        const type = account.acc_type || 'other';
        if (!acc[type]) acc[type] = [];
        acc[type].push(account);
        return acc;
    }, {} as Record<string, Account[]>);

    // Order of account type groups
    const typeOrder = ['revenue', 'expenses', 'assets', 'liabilities', 'equity', 'other'];
    const sortedGroupKeys = Object.keys(groupedAccounts).sort((a, b) => {
        const idxA = typeOrder.indexOf(a);
        const idxB = typeOrder.indexOf(b);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex items-center gap-3 text-stone-500 font-medium">
                    <RefreshCw className="w-5 h-5 animate-spin text-[#2E6E52]" />
                    <span>Loading settings...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F4F5F1] p-6 lg:p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-[#2E6E52]/10 rounded-lg text-[#2E6E52]">
                                <Settings className="w-6 h-6" />
                            </div>
                            <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 font-display">Settings</h1>
                        </div>
                        <p className="text-stone-500 mt-1 text-sm">
                            Configure system defaults for taxes, sales, and purchase workflows
                        </p>
                    </div>

                    <div>
                        <button
                            type="button"
                            onClick={() => loadData()}
                            disabled={loading || saving}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg text-sm font-medium transition-colors"
                            title="Reload settings"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Reload
                        </button>
                    </div>
                </div>

                {/* Alerts */}
                {saveSuccess && (
                    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center gap-3 shadow-sm animate-fade-in">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <div>
                            <span className="font-semibold">Settings saved successfully!</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex items-center gap-3 shadow-sm">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <div>
                            <span className="font-semibold">Error saving settings:</span> {error}
                        </div>
                    </div>
                )}

                {/* Settings Form Card */}
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-sm divide-y divide-[#E1E3DB] overflow-hidden">
                        {/* Section Title */}
                        <div className="px-6 py-4 bg-[#F8F9F6]">
                            <h2 className="text-base font-semibold text-stone-900 font-display">System Defaults & Localization</h2>
                            <p className="text-xs text-stone-500 mt-0.5">These defaults are applied automatically across transactions, sales, and reports</p>
                        </div>

                        {/* 1. Currency Symbol */}
                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 rounded-lg bg-emerald-50 text-[#2E6E52] border border-emerald-100 flex-shrink-0 mt-0.5">
                                    <CircleDollarSign className="w-5 h-5" />
                                </div>
                                <div className="flex-1 max-w-xl">
                                    <label htmlFor="currency_symbol" className="block text-sm font-semibold text-stone-900 mb-1">
                                        Currency Symbol
                                    </label>
                                    <p className="text-xs text-stone-500 mb-3">
                                        The currency symbol displayed across journal entries, sales invoices, stock valuations, and reports.
                                    </p>
                                    <div className="flex items-center gap-3 max-w-sm mb-3">
                                        <input
                                            type="text"
                                            id="currency_symbol"
                                            value={settings.currency_symbol ?? '$'}
                                            onChange={(e) => setSettings({
                                                ...settings,
                                                currency_symbol: e.target.value
                                            })}
                                            placeholder="$"
                                            maxLength={6}
                                            className="w-24 px-3.5 py-2 border border-[#D5D7CE] rounded-lg text-sm font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:border-transparent bg-white text-stone-900 shadow-xs"
                                        />
                                        <div className="text-xs text-stone-600 bg-[#FAFBF9] border border-[#E1E3DB] px-3 py-2 rounded-lg">
                                            Preview: <strong className="text-stone-900 font-mono text-sm">{settings.currency_symbol || '$'} 1,250.00</strong>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[11px] text-stone-400 font-semibold uppercase tracking-wider">Presets:</span>
                                        {[
                                            { sym: '$', label: '$ (USD)' },
                                            { sym: '€', label: '€ (EUR)' },
                                            { sym: '£', label: '£ (GBP)' },
                                            { sym: '₹', label: '₹ (INR)' },
                                            { sym: 'Rs.', label: 'Rs. (NPR/PKR)' },
                                            { sym: '¥', label: '¥ (JPY/CNY)' },
                                            { sym: 'A$', label: 'A$ (AUD)' },
                                            { sym: 'C$', label: 'C$ (CAD)' },
                                            { sym: 'CHF', label: 'CHF' },
                                            { sym: 'kr', label: 'kr (SEK/NOK)' }
                                        ].map(({ sym, label }) => (
                                            <button
                                                key={sym}
                                                type="button"
                                                onClick={() => setSettings({ ...settings, currency_symbol: sym })}
                                                className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors ${
                                                    (settings.currency_symbol || '$') === sym
                                                        ? 'bg-[#2E6E52] text-white border-[#2E6E52] shadow-xs'
                                                        : 'bg-[#FAFBF9] hover:bg-stone-100 text-stone-700 border-[#E1E3DB]'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Default Tax Rate */}
                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 rounded-lg bg-emerald-50 text-[#2E6E52] border border-emerald-100 flex-shrink-0 mt-0.5">
                                    <Percent className="w-5 h-5" />
                                </div>
                                <div className="flex-1 max-w-xl">
                                    <label htmlFor="default_tax_rate" className="block text-sm font-semibold text-stone-900 mb-1">
                                        Default Tax Rate
                                    </label>
                                    <p className="text-xs text-stone-500 mb-3">
                                        Pre-selected tax rate for line items when creating sales invoices, estimates, or quotations.
                                    </p>
                                    <select
                                        id="default_tax_rate"
                                        value={settings.default_tax_rate_id ?? ''}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            default_tax_rate_id: e.target.value ? Number(e.target.value) : null
                                        })}
                                        className="w-full px-3.5 py-2.5 border border-[#D5D7CE] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:border-transparent bg-white text-stone-900"
                                    >
                                        <option value="">-- No Default Tax Rate (None) --</option>
                                        {taxes.map((tax) => (
                                            <option key={tax.id} value={tax.id}>
                                                {tax.name} ({formatRate(tax.rate)}) {tax.ttype ? `• ${tax.ttype}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {taxes.length === 0 && (
                                        <p className="text-xs text-amber-600 mt-2">
                                            No tax rates found. You can add tax rates in the Taxes section.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 2. Default Sales Account */}
                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 flex-shrink-0 mt-0.5">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                                <div className="flex-1 max-w-xl">
                                    <label htmlFor="default_sales_account" className="block text-sm font-semibold text-stone-900 mb-1">
                                        Default Sales Account
                                    </label>
                                    <p className="text-xs text-stone-500 mb-3">
                                        The primary revenue ledger account credited when sales and income transactions are recorded.
                                    </p>
                                    <select
                                        id="default_sales_account"
                                        value={settings.default_sales_account_id ?? ''}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            default_sales_account_id: e.target.value ? Number(e.target.value) : null
                                        })}
                                        className="w-full px-3.5 py-2.5 border border-[#D5D7CE] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:border-transparent bg-white text-stone-900"
                                    >
                                        <option value="">-- No Default Sales Account (None) --</option>
                                        {sortedGroupKeys.map((groupKey) => (
                                            <optgroup key={groupKey} label={groupKey.toUpperCase()}>
                                                {groupedAccounts[groupKey].map((account) => (
                                                    <option key={account.id} value={account.id}>
                                                        {account.name} {account.info ? `(${account.info})` : ''}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                    {accounts.length === 0 && (
                                        <p className="text-xs text-amber-600 mt-2">
                                            No accounts found. You can add accounts in the Accounts section.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 3. Default Purchase Account */}
                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 flex-shrink-0 mt-0.5">
                                    <ShoppingBag className="w-5 h-5" />
                                </div>
                                <div className="flex-1 max-w-xl">
                                    <label htmlFor="default_purchase_account" className="block text-sm font-semibold text-stone-900 mb-1">
                                        Default Purchase Account
                                    </label>
                                    <p className="text-xs text-stone-500 mb-3">
                                        The default expense or cost of goods sold ledger account debited when purchase orders and bills are recorded.
                                    </p>
                                    <select
                                        id="default_purchase_account"
                                        value={settings.default_purchase_account_id ?? ''}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            default_purchase_account_id: e.target.value ? Number(e.target.value) : null
                                        })}
                                        className="w-full px-3.5 py-2.5 border border-[#D5D7CE] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:border-transparent bg-white text-stone-900"
                                    >
                                        <option value="">-- No Default Purchase Account (None) --</option>
                                        {sortedGroupKeys.map((groupKey) => (
                                            <optgroup key={groupKey} label={groupKey.toUpperCase()}>
                                                {groupedAccounts[groupKey].map((account) => (
                                                    <option key={account.id} value={account.id}>
                                                        {account.name} {account.info ? `(${account.info})` : ''}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                    {accounts.length === 0 && (
                                        <p className="text-xs text-amber-600 mt-2">
                                            No accounts found. You can add accounts in the Accounts section.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom action bar */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setSettings({
                                    currency_symbol: '$',
                                    default_tax_rate_id: null,
                                    default_sales_account_id: null,
                                    default_purchase_account_id: null,
                                });
                            }}
                            className="px-4 py-2 border border-[#D5D7CE] text-stone-700 bg-white hover:bg-stone-50 rounded-lg text-sm font-medium transition-colors"
                        >
                            Clear All Defaults
                        </button>

                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#2E6E52] hover:bg-[#255842] disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                        >
                            {saving ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SettingsPage;
