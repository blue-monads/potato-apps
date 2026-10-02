import React, { useState, useEffect, useMemo } from 'react';
import { X, PackageX, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router';
import { scrapProduct, getCurrencySymbol, type Product, type ProductVariant, type Sale } from '../../../lib/api';
import { BASE_PATH } from '../../../lib/base';

interface ScrapProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (sale: Sale, updatedProduct: Product) => void;
    products?: Product[];
    initialProduct?: Product | null;
}

const COMMON_REASONS = [
    'Damaged goods in warehouse',
    'Damaged in transit / shipment',
    'Lost order / Unaccounted inventory',
    'Expired / Perished merchandise',
    'Defective item / Factory recall',
    'Store display / sample degradation',
    'Other write-off',
];

export const ScrapProductModal: React.FC<ScrapProductModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    products = [],
    initialProduct = null,
}) => {
    const [selectedProductId, setSelectedProductId] = useState<number>(initialProduct?.id || (products[0]?.id || 0));
    const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
    const [qty, setQty] = useState<number>(1);
    const [reasonPreset, setReasonPreset] = useState<string>(COMMON_REASONS[0]);
    const [customReason, setCustomReason] = useState<string>('');
    const [scrapDate, setScrapDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [unitCost, setUnitCost] = useState<string>('0.00');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successSale, setSuccessSale] = useState<Sale | null>(null);

    const cs = getCurrencySymbol();

    // Active product
    const currentProduct = useMemo(() => {
        if (initialProduct && initialProduct.id === selectedProductId) {
            return initialProduct;
        }
        return products.find(p => p.id === selectedProductId) || initialProduct || null;
    }, [initialProduct, products, selectedProductId]);

    // Active variant
    const currentVariant = useMemo(() => {
        if (!currentProduct || !currentProduct.variants || currentProduct.variants.length === 0) {
            return null;
        }
        if (!selectedVariantId) {
            return null;
        }
        return currentProduct.variants.find((v: ProductVariant) => v.id === selectedVariantId) || null;
    }, [currentProduct, selectedVariantId]);

    // Available stock count
    const availableStock = useMemo(() => {
        if (!currentProduct) return 0;
        if (currentVariant) {
            return currentVariant.stock_count || 0;
        }
        return currentProduct.stock_count || 0;
    }, [currentProduct, currentVariant]);

    // Track inventory flag
    const isTracked = currentProduct?.track_inventory !== false;

    // Reset when modal opens or initialProduct changes
    useEffect(() => {
        if (isOpen) {
            setSuccessSale(null);
            setError(null);
            const prod = initialProduct || products[0] || null;
            if (prod) {
                setSelectedProductId(prod.id);
                if (prod.variants && prod.variants.length > 0) {
                    setSelectedVariantId(prod.variants[0].id);
                    setUnitCost(((prod.variants[0].sales_price || prod.sales_price || 0) / 100).toFixed(2));
                } else {
                    setSelectedVariantId(null);
                    setUnitCost(((prod.sales_price || 0) / 100).toFixed(2));
                }
            }
            setQty(1);
            setReasonPreset(COMMON_REASONS[0]);
            setCustomReason('');
            setScrapDate(new Date().toISOString().slice(0, 10));
        }
    }, [isOpen, initialProduct, products]);

    // When product selection changes
    const handleProductChange = (prodId: number) => {
        setSelectedProductId(prodId);
        const prod = products.find(p => p.id === prodId);
        if (prod && prod.variants && prod.variants.length > 0) {
            setSelectedVariantId(prod.variants[0].id);
            setUnitCost(((prod.variants[0].sales_price || prod.sales_price || 0) / 100).toFixed(2));
        } else {
            setSelectedVariantId(null);
            setUnitCost(((prod?.sales_price || 0) / 100).toFixed(2));
        }
    };

    // When variant selection changes
    const handleVariantChange = (varId: number | null) => {
        setSelectedVariantId(varId);
        if (varId && currentProduct?.variants) {
            const v = currentProduct.variants.find(v => v.id === varId);
            if (v && v.sales_price !== undefined) {
                setUnitCost((v.sales_price / 100).toFixed(2));
            }
        } else if (currentProduct) {
            setUnitCost(((currentProduct.sales_price || 0) / 100).toFixed(2));
        }
    };

    if (!isOpen) return null;

    const unitPriceCents = Math.round(parseFloat(unitCost || '0') * 100) || 0;
    const totalCents = (qty || 0) * unitPriceCents;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentProduct) {
            setError('Please select a product to scrap.');
            return;
        }

        if (qty <= 0) {
            setError('Quantity must be greater than 0.');
            return;
        }

        if (isTracked && qty > availableStock) {
            setError(`Cannot scrap ${qty} items: only ${availableStock} currently in stock.`);
            return;
        }

        const fullReason = customReason.trim()
            ? `${reasonPreset}: ${customReason.trim()}`
            : reasonPreset;

        setLoading(true);
        setError(null);

        try {
            const resp = await scrapProduct(currentProduct.id, {
                variant_id: selectedVariantId || undefined,
                qty: qty,
                reason: fullReason,
                scrap_date: new Date(scrapDate).toISOString(),
                unit_cost: unitPriceCents,
            });

            if (resp.status === 200 && resp.data?.success && resp.data.sale) {
                setSuccessSale(resp.data.sale);
                onSuccess(resp.data.sale, resp.data.product);
            } else {
                setError(resp.error || 'Failed to complete scrap process.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred while scrapping the product.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl border border-[#E1E3DB] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1E3DB] bg-[#FAFBF9]">
                    <div className="flex items-center gap-2.5 text-stone-900 font-semibold font-display">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
                            <PackageX className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-base font-bold text-stone-900">Scrap Product Flow</div>
                            <div className="text-xs text-stone-500 font-normal">Damaged goods, loss write-off & inventory outflow</div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-stone-400 hover:text-stone-600 p-1.5 hover:bg-stone-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {successSale ? (
                    <div className="p-6 space-y-5">
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                            <div>
                                <h4 className="text-sm font-semibold text-emerald-900">Scrap Order Completed Successfully</h4>
                                <p className="text-xs text-emerald-700 mt-0.5">
                                    Inventory has been deducted and a formal write-off sale record was posted.
                                </p>
                            </div>
                        </div>

                        <div className="bg-[#F8F9F6] border border-[#E1E3DB] rounded-xl p-4 space-y-2.5 text-sm">
                            <div className="flex justify-between items-center text-stone-600 text-xs">
                                <span>Sale Record:</span>
                                <span className="font-semibold text-stone-900 font-mono">#{successSale.id}</span>
                            </div>
                            <div className="flex justify-between items-center text-stone-600 text-xs">
                                <span>Status:</span>
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 uppercase">
                                    {successSale.sales_status}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-stone-600 text-xs">
                                <span>Scrapped Product:</span>
                                <span className="font-semibold text-stone-900">
                                    {currentProduct?.name} {currentVariant ? `(${currentVariant.name})` : ''}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-stone-600 text-xs">
                                <span>Quantity Written Off:</span>
                                <span className="font-bold text-rose-600">-{qty} units</span>
                            </div>
                            <div className="flex justify-between items-center text-stone-600 text-xs">
                                <span>Total Loss Value:</span>
                                <span className="font-bold text-stone-900">{cs}{(totalCents / 100).toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Link
                                to={`${BASE_PATH}sales`}
                                onClick={onClose}
                                className="px-4 py-2 border border-[#E1E3DB] hover:bg-stone-50 text-stone-700 rounded-lg text-sm font-semibold transition-colors"
                            >
                                View Sales List
                            </Link>
                            <button
                                onClick={onClose}
                                className="px-5 py-2 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-sm font-semibold transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {error && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Product selection (if multiple options available) */}
                        {!initialProduct && products.length > 0 && (
                            <div>
                                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                                    Select Product <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={selectedProductId}
                                    onChange={(e) => handleProductChange(parseInt(e.target.value, 10))}
                                    className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg text-sm focus:outline-none focus:border-[#2E6E52]"
                                >
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.stock_count} in stock)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Target Product Summary Box */}
                        {currentProduct && (
                            <div className="p-3.5 bg-[#FAFBF9] border border-[#E1E3DB] rounded-lg flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-bold text-stone-900">{currentProduct.name}</div>
                                    <div className="text-xs text-stone-500">
                                        Catalogue item #{currentProduct.id} • {isTracked ? 'Tracked Inventory' : 'Non-tracked'}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-stone-500">Available Stock</div>
                                    <div className={`text-sm font-bold ${availableStock > 0 ? 'text-emerald-700' : 'text-stone-500'}`}>
                                        {availableStock} units
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Variant selector (if product has variants) */}
                        {currentProduct?.variants && currentProduct.variants.length > 0 && (
                            <div>
                                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                                    Product Variant <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={selectedVariantId || ''}
                                    onChange={(e) => handleVariantChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                                    className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg text-sm focus:outline-none focus:border-[#2E6E52]"
                                >
                                    {currentProduct.variants.map((v: ProductVariant) => (
                                        <option key={v.id} value={v.id}>
                                            {v.name} ({v.stock_count || 0} in stock) - {cs}{((v.sales_price || 0) / 100).toFixed(2)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Quantity & Date */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                                    Scrap Quantity <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        max={isTracked && availableStock > 0 ? availableStock : undefined}
                                        value={qty}
                                        onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                        className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg text-sm focus:outline-none focus:border-[#2E6E52]"
                                        required
                                    />
                                    {isTracked && availableStock > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setQty(availableStock)}
                                            className="absolute right-2 top-2 text-[10px] font-semibold text-[#2E6E52] hover:underline"
                                        >
                                            Max ({availableStock})
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                                    Scrap Date
                                </label>
                                <input
                                    type="date"
                                    value={scrapDate}
                                    onChange={(e) => setScrapDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg text-sm focus:outline-none focus:border-[#2E6E52]"
                                />
                            </div>
                        </div>

                        {/* Reason selection */}
                        <div>
                            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                                Reason for Scrapping <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={reasonPreset}
                                onChange={(e) => setReasonPreset(e.target.value)}
                                className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg text-sm focus:outline-none focus:border-[#2E6E52] mb-2"
                            >
                                {COMMON_REASONS.map((r) => (
                                    <option key={r} value={r}>
                                        {r}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="text"
                                placeholder="Additional details or notes (optional)"
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                                className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg text-sm focus:outline-none focus:border-[#2E6E52]"
                            />
                        </div>

                        {/* Unit Valuation & Total */}
                        <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
                                    Unit Loss Valuation ({cs})
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={unitCost}
                                    onChange={(e) => setUnitCost(e.target.value)}
                                    className="w-24 px-2 py-1 text-right text-xs bg-white border border-amber-300 rounded font-semibold text-stone-900 focus:outline-none focus:border-amber-500"
                                />
                            </div>
                            <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-200/50">
                                <span className="text-amber-800 font-medium">Total Inventory Loss to Write-off:</span>
                                <span className="text-sm font-bold text-amber-900">
                                    {cs}{(totalCents / 100).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        {/* Explanatory Info */}
                        <p className="text-[11px] text-stone-500 leading-relaxed">
                            ℹ️ Clicking <strong>Confirm & Scrap</strong> creates an official Sale with status <code className="text-purple-700 bg-purple-50 px-1 py-0.5 rounded">scrapped</code> containing this item, decrements product stock by <strong>{qty}</strong>, and writes off the value into the journal.
                        </p>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E1E3DB]">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="px-4 py-2 border border-[#E1E3DB] hover:bg-stone-50 text-stone-600 rounded-lg text-sm font-semibold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || (isTracked && availableStock <= 0)}
                                className="inline-flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                            >
                                {loading ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Scrapping...
                                    </>
                                ) : (
                                    <>
                                        <PackageX className="w-4 h-4" />
                                        Confirm & Scrap
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
