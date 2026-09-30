import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { ArrowLeft, Plus, Trash2, Save, Package, Layers, Calendar, User, FileText, Hash } from 'lucide-react';
import { createStockIn, updateStockIn, getStockIn, type ProductStockIn, type ProductStockInLine } from '../../lib/api';
import { BASE_PATH } from '../../lib/base';
import { useModal } from '../../lib/shared/modal/modal';
import StockInItemPicker, { type SelectedStockInLine } from './components/StockInItemPicker';

interface FormLine {
    product_id: number;
    product_name: string;
    variant_id?: number;
    variant_name?: string;
    qty: number;
    price: number; // in cents
    amount: number; // in cents
    info: string;
}

const StockInForm = () => {
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const isEditMode = Boolean(id);
    const { openModal } = useModal();

    const [loading, setLoading] = useState(isEditMode);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form fields
    const [vendorName, setVendorName] = useState('');
    const [referenceId, setReferenceId] = useState('');
    const [info, setInfo] = useState('');
    const [stockinDate, setStockinDate] = useState(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    });
    const [lines, setLines] = useState<FormLine[]>([]);

    useEffect(() => {
        if (!isEditMode || !id) return;

        const loadStockIn = async () => {
            setLoading(true);
            try {
                const resp = await getStockIn(parseInt(id, 10));
                if (resp.status === 200 && resp.data) {
                    const s = resp.data;
                    setVendorName(s.vendor_name || '');
                    setReferenceId(s.reference_id || '');
                    setInfo(s.info || '');
                    if (s.stockin_date) {
                        try {
                            const d = new Date(s.stockin_date);
                            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                            setStockinDate(d.toISOString().slice(0, 16));
                        } catch {
                            // keep default
                        }
                    }
                    if (s.lines && s.lines.length > 0) {
                        setLines(s.lines.map((l: ProductStockInLine) => ({
                            product_id: l.product_id,
                            product_name: l.product_name || `Product #${l.product_id}`,
                            variant_id: l.variant_id || 0,
                            variant_name: l.variant_name,
                            qty: l.qty || 1,
                            price: l.price || (l.qty ? Math.round((l.amount || 0) / l.qty) : 0),
                            amount: l.amount || (l.qty * (l.price || 0)),
                            info: l.info || '',
                        })));
                    }
                } else {
                    setError(resp.error || 'Failed to load Stock In record');
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load Stock In record');
            } finally {
                setLoading(false);
            }
        };
        loadStockIn();
    }, [id, isEditMode]);

    const handleAddLine = (line: SelectedStockInLine) => {
        setLines(prev => {
            // Check if same product & variant already in lines
            const existingIdx = prev.findIndex(
                l => l.product_id === line.product_id && (l.variant_id || 0) === (line.variant_id || 0)
            );
            if (existingIdx >= 0) {
                const updated = [...prev];
                const existing = updated[existingIdx];
                const newQty = existing.qty + line.qty;
                const newAmount = newQty * line.price;
                updated[existingIdx] = {
                    ...existing,
                    qty: newQty,
                    price: line.price,
                    amount: newAmount,
                    info: line.info || existing.info,
                };
                return updated;
            }
            return [...prev, line];
        });
    };

    const handleUpdateLineQty = (index: number, newQtyStr: string) => {
        const val = parseInt(newQtyStr, 10);
        if (isNaN(val) || val < 1) return;
        setLines(prev => {
            const updated = [...prev];
            const item = updated[index];
            updated[index] = {
                ...item,
                qty: val,
                amount: val * item.price,
            };
            return updated;
        });
    };

    const handleUpdateLinePrice = (index: number, newPriceStr: string) => {
        const val = parseFloat(newPriceStr);
        if (isNaN(val) || val < 0) return;
        const cents = Math.round(val * 100);
        setLines(prev => {
            const updated = [...prev];
            const item = updated[index];
            updated[index] = {
                ...item,
                price: cents,
                amount: item.qty * cents,
            };
            return updated;
        });
    };

    const handleRemoveLine = (index: number) => {
        setLines(prev => prev.filter((_, i) => i !== index));
    };

    const totalUnits = lines.reduce((sum, l) => sum + (l.qty || 0), 0);
    const totalAmountCents = lines.reduce((sum, l) => sum + (l.amount || 0), 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (lines.length === 0) {
            setError('Please add at least one product to receive into stock.');
            return;
        }

        setSaving(true);
        setError(null);

        const payload: Partial<ProductStockIn> = {
            vendor_name: vendorName.trim(),
            reference_id: referenceId.trim(),
            info: info.trim(),
            stockin_date: new Date(stockinDate).toISOString(),
            amount: totalAmountCents,
            lines: lines.map(l => ({
                product_id: l.product_id,
                variant_id: l.variant_id || 0,
                qty: l.qty,
                price: l.price,
                amount: l.amount,
                info: l.info,
            })),
        };

        try {
            let resp;
            if (isEditMode && id) {
                resp = await updateStockIn(parseInt(id, 10), payload);
            } else {
                resp = await createStockIn(payload);
            }

            if (resp.status === 200) {
                navigate(`${BASE_PATH}stockin`);
            } else {
                setError(resp.error || 'Failed to save Stock In entry');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save Stock In entry');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F4F5F1] p-6 lg:p-8 flex items-center justify-center font-sans">
                <div className="text-stone-500">Loading Stock In details...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F4F5F1] p-6 lg:p-8 font-sans">
            <div className="max-w-5xl mx-auto">
                {/* Header breadcrumb & actions */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <Link
                            to={`${BASE_PATH}stockin`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors mb-2"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Back to Stock In List
                        </Link>
                        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 font-display">
                            {isEditMode ? `Edit Stock In #${id}` : 'Record Stock In'}
                        </h1>
                        <p className="text-stone-500 mt-1 text-sm">
                            Receive new inventory shipment, record purchase cost, and update stock counts
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            to={`${BASE_PATH}stockin`}
                            className="px-4 py-2 border border-[#E1E3DB] bg-white hover:bg-stone-50 text-stone-700 rounded-lg text-sm font-semibold transition-colors shadow-xs"
                        >
                            Cancel
                        </Link>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-[#2E6E52] hover:bg-[#255842] disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save Stock In'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* General Receipt Details Card */}
                    <div className="bg-white rounded-2xl border border-[#E1E3DB] p-6 shadow-xs">
                        <h2 className="text-base font-bold text-stone-900 font-display mb-4 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#2E6E52]" />
                            Receipt & Vendor Details
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div>
                                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-stone-400" />
                                    Vendor / Supplier Name
                                </label>
                                <input
                                    type="text"
                                    value={vendorName}
                                    onChange={(e) => setVendorName(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-[#E1E3DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white text-stone-900"
                                    placeholder="e.g. Acme Distributors Ltd."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                    <Hash className="w-3.5 h-3.5 text-stone-400" />
                                    Reference / PO / Bill #
                                </label>
                                <input
                                    type="text"
                                    value={referenceId}
                                    onChange={(e) => setReferenceId(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-[#E1E3DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white text-stone-900"
                                    placeholder="e.g. PO-2026-081"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                                    Date Received <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    required
                                    value={stockinDate}
                                    onChange={(e) => setStockinDate(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-[#E1E3DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white text-stone-900 font-medium"
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                                Notes / Shipment Remarks
                            </label>
                            <input
                                type="text"
                                value={info}
                                onChange={(e) => setInfo(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-stone-50 border border-[#E1E3DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white text-stone-900"
                                placeholder="Additional details about delivery condition, courier, tracking number, etc."
                            />
                        </div>
                    </div>

                    {/* Stock Items Received Section */}
                    <div className="bg-white rounded-2xl border border-[#E1E3DB] p-6 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                            <div>
                                <h2 className="text-base font-bold text-stone-900 font-display flex items-center gap-2">
                                    <Package className="w-4 h-4 text-[#2E6E52]" />
                                    Received Products & Variants
                                </h2>
                                <p className="text-xs text-stone-500 mt-0.5">
                                    List the products and their respective variants received in this batch
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => openModal({
                                    title: 'Add Product / Variant',
                                    content: <StockInItemPicker onSave={handleAddLine} />,
                                })}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
                            >
                                <Plus className="w-4 h-4" />
                                Add Product / Variant
                            </button>
                        </div>

                        {lines.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-[#E1E3DB] rounded-xl bg-stone-50">
                                <Package className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                                <h4 className="text-sm font-semibold text-stone-700">No products added yet</h4>
                                <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1 mb-4">
                                    Click the button below to pick products or specific variants to add to this stock receipt.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => openModal({
                                        title: 'Add Product / Variant',
                                        content: <StockInItemPicker onSave={handleAddLine} />,
                                    })}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Pick Product to Stock In
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto border border-[#E1E3DB] rounded-xl">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#FAFBF9] border-b border-[#E1E3DB] text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                                            <th className="px-4 py-3">Item / Variant</th>
                                            <th className="px-4 py-3 w-32">Quantity</th>
                                            <th className="px-4 py-3 w-36">Unit Cost ($)</th>
                                            <th className="px-4 py-3 w-32">Total ($)</th>
                                            <th className="px-4 py-3">Notes</th>
                                            <th className="px-4 py-3 w-16 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#E1E3DB] text-sm text-stone-900">
                                        {lines.map((l, index) => (
                                            <tr key={`${l.product_id}-${l.variant_id || 0}-${index}`} className="hover:bg-stone-50/50">
                                                <td className="px-4 py-3.5">
                                                    <div className="font-semibold text-stone-900">{l.product_name}</div>
                                                    {l.variant_name ? (
                                                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs font-medium bg-[#EAF3EE] text-[#2E6E52] border border-[#2E6E52]/20">
                                                            <Layers className="w-3 h-3" />
                                                            {l.variant_name}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-stone-400">Standard item</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        step="1"
                                                        value={l.qty}
                                                        onChange={(e) => handleUpdateLineQty(index, e.target.value)}
                                                        className="w-24 px-2.5 py-1.5 bg-white border border-[#E1E3DB] rounded-lg text-sm text-stone-900 font-semibold focus:outline-none focus:ring-1 focus:ring-[#2E6E52]"
                                                    />
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="relative">
                                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs">$</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={(l.price / 100).toFixed(2)}
                                                            onChange={(e) => handleUpdateLinePrice(index, e.target.value)}
                                                            className="w-28 pl-6 pr-2.5 py-1.5 bg-white border border-[#E1E3DB] rounded-lg text-sm text-stone-900 font-semibold focus:outline-none focus:ring-1 focus:ring-[#2E6E52]"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 font-bold text-stone-900">
                                                    ${(l.amount / 100).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3.5 text-xs text-stone-500">
                                                    <input
                                                        type="text"
                                                        value={l.info}
                                                        placeholder="Line remarks..."
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setLines(prev => {
                                                                const updated = [...prev];
                                                                updated[index].info = val;
                                                                return updated;
                                                            });
                                                        }}
                                                        className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-[#E1E3DB] focus:border-[#2E6E52] rounded text-xs transition-colors"
                                                    />
                                                </td>
                                                <td className="px-4 py-3.5 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveLine(index)}
                                                        className="text-stone-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Remove item"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Summary & Totals Banner */}
                        {lines.length > 0 && (
                            <div className="mt-5 p-4 bg-[#FAFBF9] rounded-xl border border-[#E1E3DB] flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-6 text-sm">
                                    <div>
                                        <span className="text-stone-500 block text-xs">Total Line Items</span>
                                        <span className="font-bold text-stone-800 text-base">{lines.length}</span>
                                    </div>
                                    <div className="h-8 w-px bg-[#E1E3DB]" />
                                    <div>
                                        <span className="text-stone-500 block text-xs">Total Units to Receive</span>
                                        <span className="font-bold text-emerald-800 text-base">+{totalUnits} units</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-stone-500 text-xs block">Total Stock In Value</span>
                                    <span className="text-2xl font-black text-stone-900 font-display">
                                        ${(totalAmountCents / 100).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E1E3DB]">
                        <Link
                            to={`${BASE_PATH}stockin`}
                            className="px-5 py-2.5 border border-[#E1E3DB] bg-white hover:bg-stone-50 text-stone-700 rounded-xl text-sm font-semibold transition-colors shadow-xs"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#2E6E52] hover:bg-[#255842] disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save Stock In'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StockInForm;
