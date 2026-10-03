import { useState, useEffect } from 'react';
import { Package, Search, ArrowLeft, Plus, Check, Layers } from 'lucide-react';
import { listProducts, getCurrencySymbol, type Product, type ProductVariant } from '../../../lib/api';
import { useModal } from '../../../lib/shared/modal/modal';
import { getFilePreviewUrl } from '../../../lib/spaceFile';

export interface SelectedStockInLine {
    product_id: number;
    product_name: string;
    variant_id?: number;
    variant_name?: string;
    qty: number;
    price: number; // in cents
    amount: number; // in cents
    info: string;
}

interface StockInItemPickerProps {
    onSave: (line: SelectedStockInLine) => void;
}

const StockInItemPicker = ({ onSave }: StockInItemPickerProps) => {
    const { closeModal } = useModal();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Step: 'select_item' or 'enter_details'
    const [step, setStep] = useState<'select_item' | 'enter_details'>('select_item');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

    // Form fields in step 2
    const [qty, setQty] = useState<string>('1');
    const [unitCost, setUnitCost] = useState<string>('0.00');
    const [lineInfo, setLineInfo] = useState<string>('');

    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            try {
                const resp = await listProducts();
                if (resp.status === 200 && Array.isArray(resp.data)) {
                    setProducts(resp.data);
                }
            } catch (err) {
                console.error('Failed to load products', err);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);

    const handleSelectProduct = (product: Product, variant?: ProductVariant) => {
        setSelectedProduct(product);
        setSelectedVariant(variant || null);

        // Pre-fill cost with sales price or variant sales price as initial hint
        const defaultPriceCents = variant ? variant.sales_price : (product.sales_price || 0);
        setUnitCost((defaultPriceCents / 100).toFixed(2));
        setQty('1');
        
        let initialInfo = '';
        if (variant) {
            initialInfo = `${product.name} - ${variant.name}`;
        } else {
            initialInfo = product.name;
        }
        setLineInfo(initialInfo);
        setStep('enter_details');
    };

    const handleConfirm = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct) return;

        const parsedQty = parseInt(qty, 10);
        if (isNaN(parsedQty) || parsedQty <= 0) {
            alert('Please enter a valid quantity greater than 0');
            return;
        }

        const parsedCostCents = Math.round(parseFloat(unitCost || '0') * 100);
        const totalAmountCents = parsedQty * parsedCostCents;

        onSave({
            product_id: selectedProduct.id,
            product_name: selectedProduct.name,
            variant_id: selectedVariant ? selectedVariant.id : 0,
            variant_name: selectedVariant ? selectedVariant.name : undefined,
            qty: parsedQty,
            price: parsedCostCents,
            amount: totalAmountCents,
            info: lineInfo.trim(),
        });

        closeModal();
    };

    const filteredProducts = products.filter(p => {
        const query = searchQuery.toLowerCase();
        if (p.name.toLowerCase().includes(query)) return true;
        if (p.info && p.info.toLowerCase().includes(query)) return true;
        if (p.variants && p.variants.some(v => v.name.toLowerCase().includes(query))) return true;
        return false;
    });

    const getPrimaryImage = (imagesStr?: string) => {
        if (!imagesStr) return null;
        const first = imagesStr.split(',')[0].trim();
        return first ? getFilePreviewUrl(first) : null;
    };

    return (
        <div className="p-6 max-w-2xl w-full font-sans">
            {step === 'select_item' ? (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-stone-900 font-display">Select Product for Stock In</h2>
                            <p className="text-xs text-stone-500 mt-0.5">Choose an item or specific variant to receive into stock</p>
                        </div>
                    </div>

                    {/* Search box */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <input
                            type="text"
                            placeholder="Search products or variants..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-[#E1E3DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white transition-all text-stone-900"
                            autoFocus
                        />
                    </div>

                    {/* Product List */}
                    <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
                        {loading ? (
                            <div className="text-center py-12 text-stone-400 text-sm">Loading available products...</div>
                        ) : filteredProducts.length === 0 ? (
                            <div className="text-center py-12 text-stone-400 text-sm">
                                {searchQuery ? 'No matching products found.' : 'No products available. Please create products first.'}
                            </div>
                        ) : (
                            filteredProducts.map((p) => {
                                const img = getPrimaryImage(p.images);
                                const hasVars = p.has_variants && p.variants && p.variants.length > 0;

                                return (
                                    <div
                                        key={p.id}
                                        className="border border-[#E1E3DB] rounded-xl bg-white hover:border-[#2E6E52]/40 transition-all overflow-hidden"
                                    >
                                        <div className="p-3.5 flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                {img ? (
                                                    <img
                                                        src={img}
                                                        alt={p.name}
                                                        className="w-11 h-11 rounded-lg object-cover border border-[#E1E3DB] flex-shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-11 h-11 rounded-lg bg-[#F4F5F1] border border-[#E1E3DB] flex items-center justify-center text-stone-400 flex-shrink-0">
                                                        <Package className="w-5 h-5" />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold text-sm text-stone-900 truncate">{p.name}</h4>
                                                        {hasVars && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#EAF3EE] text-[#2E6E52] border border-[#2E6E52]/20">
                                                                <Layers className="w-3 h-3" />
                                                                {p.variants?.length} variants
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-stone-500 mt-0.5">
                                                        <span>Current Stock: <strong className="text-stone-700 font-semibold">{p.stock_count || 0}</strong></span>
                                                        <span>•</span>
                                                        <span>Price: {getCurrencySymbol()}{(p.sales_price / 100).toFixed(2)}</span>
                                                        {p.track_inventory === false && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-medium text-[10px]">Track disabled</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {!hasVars ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectProduct(p)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    Select
                                                </button>
                                            ) : null}
                                        </div>

                                        {/* Variants Sub-list */}
                                        {hasVars && (
                                            <div className="bg-[#FAFBF9] border-t border-[#E1E3DB] p-2.5 pl-6 space-y-1.5">
                                                <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1">
                                                    Select a Variant:
                                                </p>
                                                {p.variants!.map((v) => (
                                                    <div
                                                        key={v.id}
                                                        className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E1E3DB] hover:border-[#2E6E52] hover:shadow-xs transition-all"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-[#2E6E52]" />
                                                            <span className="text-xs font-semibold text-stone-800">{v.name}</span>
                                                            <span className="text-[11px] text-stone-500">
                                                                (Stock: {v.stock_count || 0}, {getCurrencySymbol()}{(v.sales_price / 100).toFixed(2)})
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSelectProduct(p, v)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#2E6E52] hover:bg-[#255842] text-white rounded text-xs font-medium transition-colors"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                            Add Variant
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            ) : (
                <form onSubmit={handleConfirm}>
                    <div className="flex items-center gap-2 mb-5">
                        <button
                            type="button"
                            onClick={() => setStep('select_item')}
                            className="p-1 hover:bg-stone-100 rounded-lg text-stone-500 transition-colors"
                            title="Back to products"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-stone-900 font-display">Stock In Quantity & Cost</h2>
                            <p className="text-xs text-stone-500">Configure received units and purchase cost</p>
                        </div>
                    </div>

                    {/* Selected Item Card */}
                    <div className="p-4 bg-[#F4F5F1] rounded-xl border border-[#E1E3DB] mb-5 flex items-center justify-between">
                        <div>
                            <span className="text-xs font-semibold text-[#2E6E52] uppercase tracking-wider">Item Details</span>
                            <h3 className="font-bold text-stone-900 text-base">{selectedProduct?.name}</h3>
                            {selectedVariant && (
                                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs font-medium bg-[#EAF3EE] text-[#2E6E52] border border-[#2E6E52]/20">
                                    <Layers className="w-3 h-3" />
                                    Variant: {selectedVariant.name}
                                </span>
                            )}
                        </div>
                        <div className="text-right">
                            <span className="text-xs text-stone-500 block">Current Stock</span>
                            <span className="text-sm font-bold text-stone-800">
                                {selectedVariant ? (selectedVariant.stock_count || 0) : (selectedProduct?.stock_count || 0)} units
                            </span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                                    Quantity to Receive <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    required
                                    value={qty}
                                    onChange={(e) => setQty(e.target.value)}
                                    className="w-full px-3 py-2 bg-stone-50 border border-[#E1E3DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white text-stone-900 font-semibold"
                                    placeholder="1"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                                    Unit Purchase Cost ($) <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        required
                                        value={unitCost}
                                        onChange={(e) => setUnitCost(e.target.value)}
                                        className="w-full pl-7 pr-3 py-2 bg-stone-50 border border-[#E1E3DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white text-stone-900 font-semibold"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                                Line Description / Notes
                            </label>
                            <input
                                type="text"
                                value={lineInfo}
                                onChange={(e) => setLineInfo(e.target.value)}
                                className="w-full px-3 py-2 bg-stone-50 border border-[#E1E3DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white text-stone-900"
                                placeholder="e.g. Batch #102, PO-584, or Supplier delivery note"
                            />
                        </div>

                        {/* Calculated Line Subtotal */}
                        <div className="p-3.5 bg-stone-50 rounded-xl border border-[#E1E3DB] flex items-center justify-between">
                            <span className="text-xs font-medium text-stone-600">Calculated Line Total:</span>
                            <span className="text-base font-bold text-stone-900">
                                {getCurrencySymbol()}{((parseInt(qty, 10) || 0) * (parseFloat(unitCost || '0'))).toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#E1E3DB]">
                        <button
                            type="button"
                            onClick={() => setStep('select_item')}
                            className="px-4 py-2 border border-[#E1E3DB] hover:bg-stone-50 text-stone-700 rounded-lg text-sm font-semibold transition-colors"
                        >
                            Change Product
                        </button>
                        <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                        >
                            <Check className="w-4 h-4" />
                            Add to Stock In
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default StockInItemPicker;
