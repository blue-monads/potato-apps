import { useState, useEffect } from 'react';
import { Check, Package } from 'lucide-react';
import { 
    listProducts, 
    listTaxes, 
    getSettings, 
    getCurrencySymbol, 
    type Product, 
    type ProductVariant, 
    type Tax 
} from '../../../lib/api';
import { useModal } from '../../../lib/shared/modal/modal';

export interface SalesItemLine {
    info: string;
    qty: number;
    product_id: number;
    variant_id?: number;
    price: number;
    amount: number; // discounted price per unit
    discount_amount: number;
    tax_amount: number;
    tax_id?: number | null;
    total_amount: number;
}

interface SalesItemPickerProps {
    initialLine?: SalesItemLine;
    onSave: (line: SalesItemLine) => void;
}

const formatTaxRate = (rate: number) => {
    const pct = rate / 100;
    return (rate % 100 === 0 ? pct.toFixed(0) : pct.toFixed(2)) + '%';
};

const SalesItemPicker = ({ initialLine, onSave }: SalesItemPickerProps) => {
    const { closeModal } = useModal();
    const [mode, setMode] = useState<'pick_product' | 'set_details'>(initialLine ? 'set_details' : 'pick_product');
    const [products, setProducts] = useState<Product[]>([]);
    const [taxes, setTaxes] = useState<Tax[]>([]);
    const [defaultTaxId, setDefaultTaxId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    // Selected product & variant details
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
    const [info, setInfo] = useState(initialLine?.info || '');
    const [qty, setQty] = useState(initialLine?.qty || 1);
    const [amount, setAmount] = useState(initialLine?.amount || 0); // discounted price per unit
    const [price, setPrice] = useState(initialLine?.price || 0); // original sales price
    const [selectedTaxId, setSelectedTaxId] = useState<number | null>(initialLine?.tax_id ?? null);

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            try {
                const [prodResp, taxResp, setResp] = await Promise.all([
                    listProducts(),
                    listTaxes(),
                    getSettings()
                ]);

                const prods = prodResp.status === 200 && Array.isArray(prodResp.data) ? prodResp.data : [];
                setProducts(prods);

                const activeTaxes = taxResp.status === 200 && Array.isArray(taxResp.data) 
                    ? taxResp.data.filter(t => !t.is_deleted) 
                    : [];
                setTaxes(activeTaxes);

                const defTax = setResp.status === 200 && setResp.data?.default_tax_rate_id 
                    ? setResp.data.default_tax_rate_id 
                    : null;
                setDefaultTaxId(defTax);

                if (initialLine) {
                    const prod = prods.find(p => p.id === initialLine.product_id);
                    if (prod) {
                        setSelectedProduct(prod);
                        if (initialLine.variant_id) {
                            const v = prod.variants?.find(vr => vr.id === initialLine.variant_id);
                            if (v) setSelectedVariant(v);
                        }
                    }

                    if (initialLine.tax_id !== undefined && initialLine.tax_id !== null) {
                        setSelectedTaxId(initialLine.tax_id);
                    } else if (initialLine.tax_amount > 0 && initialLine.amount > 0) {
                        const inferredTax = activeTaxes.find(t => 
                            Math.abs(Math.round((initialLine.amount * t.rate) / 10000) - initialLine.tax_amount) <= 1
                        );
                        setSelectedTaxId(inferredTax ? inferredTax.id : (prod?.tax_id ?? defTax));
                    } else if (prod?.tax_id) {
                        setSelectedTaxId(prod.tax_id);
                    } else if (defTax) {
                        setSelectedTaxId(defTax);
                    }
                }
            } catch (err) {
                console.error('Failed to load products/taxes', err);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [initialLine]);

    const handleProductSelect = (product: Product, variant?: ProductVariant) => {
        setSelectedProduct(product);
        setSelectedVariant(variant || null);
        const effectivePrice = variant ? variant.sales_price : product.sales_price;
        setPrice(effectivePrice);
        setAmount(effectivePrice); // Start with original price
        const title = variant ? `${product.name} (${variant.name})` : product.name;
        setInfo(title);

        // Pre-select product's configured tax rate, fallback to system default tax rate
        const prodTaxId = product.tax_id ?? defaultTaxId ?? null;
        setSelectedTaxId(prodTaxId);

        setMode('set_details');
    };

    const currentTax = taxes.find(t => t.id === selectedTaxId) || null;
    const taxRate = currentTax ? currentTax.rate : 0;
    const unitTax = Math.round((amount * taxRate) / 10000);
    const discountPerUnit = price - amount;
    const unitTotalWithTax = amount + unitTax;
    const lineTotal = unitTotalWithTax * qty;

    const handleSubmit = () => {
        if (!selectedProduct) return;

        const discount_amount = discountPerUnit; // discount per unit
        const tax_amount = unitTax; // tax per unit
        const total_amount = lineTotal; // total after discount + tax

        onSave({
            info,
            qty,
            product_id: selectedProduct.id,
            variant_id: selectedVariant?.id,
            price,
            amount,
            discount_amount,
            tax_amount,
            tax_id: selectedTaxId,
            total_amount,
        });
        closeModal();
    };

    const formatCurrency = (amount: number) => {
        return (amount / 100).toFixed(2);
    };

    const cs = getCurrencySymbol();

    const getFirstImage = (item: { image?: string; images?: string }) => {
        if (item.images) {
            const list = item.images.split(',').map(s => s.trim()).filter(Boolean);
            if (list.length > 0) return list[0];
        }
        return item.image || null;
    };

    if (loading && mode === 'pick_product') {
        return (
            <div className="p-6 min-w-[600px]">
                <div className="text-center py-8 text-stone-500 font-sans">Loading products and tax rates...</div>
            </div>
        );
    }

    if (mode === 'pick_product') {
        const defaultTax = taxes.find(t => t.id === defaultTaxId);

        return (
            <div className="overflow-x-auto max-h-[70vh] font-sans">
                <table className="min-w-full divide-y divide-[#E1E3DB]">
                    <thead className="bg-[#F8F9F6]">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">Product</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">Info</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">Sales Price</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">Tax Rate</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">Variants</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-stone-600 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-[#E1E3DB]">
                        {products.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                                    No products found
                                </td>
                            </tr>
                        ) : (
                            products.map((product) => {
                                const img = getFirstImage(product);
                                const hasVariants = product.variants && product.variants.length > 0;
                                const prodTax = taxes.find(t => t.id === product.tax_id);

                                return (
                                    <tr key={product.id} className="hover:bg-[#FAFBF9] transition-colors">
                                        <td className="px-4 py-3 text-sm font-medium text-stone-900 flex items-center gap-3">
                                            {img ? (
                                                <img src={img} alt={product.name} className="w-10 h-10 object-cover rounded-md border border-[#E1E3DB]" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-md bg-[#EEF0EA] border border-[#E1E3DB] flex items-center justify-center text-stone-400">
                                                    <Package className="w-5 h-5" />
                                                </div>
                                            )}
                                            <div>
                                                <div>{product.name}</div>
                                                <div className="text-xs text-stone-400">ID #{product.id}</div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-stone-600 max-w-xs truncate">{product.info || '-'}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-stone-900">{cs}{formatCurrency(product.sales_price)}</td>
                                        <td className="px-4 py-3 text-sm">
                                            {prodTax ? (
                                                <span className="inline-block text-xs font-medium text-[#2E6E52] bg-[#EAF3EE] px-2 py-0.5 rounded border border-[#2E6E52]/20">
                                                    {prodTax.name} ({formatTaxRate(prodTax.rate)})
                                                </span>
                                            ) : defaultTax ? (
                                                <span className="inline-block text-xs font-normal text-stone-600 bg-[#F4F5F1] px-2 py-0.5 rounded border border-[#E1E3DB]">
                                                    Default ({formatTaxRate(defaultTax.rate)})
                                                </span>
                                            ) : (
                                                <span className="text-xs text-stone-400">0%</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-stone-500">
                                            {hasVariants ? (
                                                <div className="flex flex-col gap-1">
                                                    {product.variants!.map(v => (
                                                        <button
                                                            key={v.id}
                                                            type="button"
                                                            onClick={() => handleProductSelect(product, v)}
                                                            className="text-left text-xs px-2 py-1 bg-[#EEF0EA] hover:bg-[#2E6E52] hover:text-white rounded transition-colors text-stone-700 flex justify-between gap-2"
                                                        >
                                                            <span>{v.name}</span>
                                                            <span className="font-semibold">{cs}{formatCurrency(v.sales_price)}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-stone-400">None</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => handleProductSelect(product)}
                                                className="text-[#2E6E52] hover:bg-[#EAF3EE] px-3 py-1.5 inline-flex items-center gap-1 rounded-lg font-medium text-sm transition-colors border border-[#2E6E52]/20"
                                                title="Select base product"
                                            >
                                                <Check className="w-4 h-4" />
                                                Pick
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        );
    }

    // Set details mode
    return (
        <div className="p-6 min-w-[500px] font-sans">
            <h3 className="text-xl font-bold text-stone-900 mb-4 font-display">
                {initialLine ? 'Edit Item Details' : 'Item Details'}
            </h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                        Product
                    </label>
                    <div className="px-3 py-2 bg-[#F4F5F1] border border-[#E1E3DB] rounded-lg text-sm flex justify-between items-center text-stone-900 font-medium">
                        <span>{selectedProduct?.name} {selectedVariant ? `— ${selectedVariant.name}` : ''}</span>
                        <span className="font-semibold">{cs}{formatCurrency(price)}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1">
                            Quantity *
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={qty}
                            onChange={(e) => setQty(parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1">
                            Per Unit Amount *
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formatCurrency(amount)}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setAmount(Math.round(val * 100));
                            }}
                            className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none"
                            required
                        />
                        <p className="mt-1 text-xs text-stone-500">
                            Base: {cs}{formatCurrency(price)} {discountPerUnit > 0 ? `| Discount: ${cs}${formatCurrency(discountPerUnit)}` : ''}
                        </p>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                        Tax Rate
                    </label>
                    <select
                        value={selectedTaxId ?? ''}
                        onChange={(e) => setSelectedTaxId(e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-sm bg-white"
                    >
                        <option value="">None / Tax Exempt (0%)</option>
                        {taxes.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name} ({formatTaxRate(t.rate)})
                            </option>
                        ))}
                    </select>
                    {currentTax ? (
                        <p className="mt-1 text-xs text-[#2E6E52] font-medium">
                            ✓ {currentTax.name} ({formatTaxRate(currentTax.rate)}) — +{cs}{formatCurrency(unitTax)} per unit
                        </p>
                    ) : (
                        <p className="mt-1 text-xs text-stone-500">
                            No sales tax applied (0.00%)
                        </p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                        Item Description / Notes
                    </label>
                    <textarea
                        value={info}
                        onChange={(e) => setInfo(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-sm"
                        placeholder="Additional information about this item"
                    />
                </div>

                {/* Live calculation breakdown summary */}
                <div className="p-3 bg-[#FAFBF9] rounded-lg border border-[#E1E3DB] text-xs space-y-1.5 text-stone-600">
                    <div className="flex justify-between">
                        <span>Net Unit Price:</span>
                        <span className="font-semibold text-stone-900">{cs}{formatCurrency(amount)}</span>
                    </div>
                    {unitTax > 0 && (
                        <div className="flex justify-between text-[#2E6E52]">
                            <span>Unit Tax ({formatTaxRate(taxRate)}):</span>
                            <span className="font-semibold">+{cs}{formatCurrency(unitTax)}</span>
                        </div>
                    )}
                    <div className="flex justify-between pt-1.5 border-t border-[#E1E3DB] font-semibold text-stone-900 text-sm">
                        <span>Line Total ({qty} × {cs}{formatCurrency(unitTotalWithTax)}):</span>
                        <span className="text-[#2E6E52]">{cs}{formatCurrency(lineTotal)}</span>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E1E3DB]">
                    {!initialLine && (
                        <button
                            type="button"
                            onClick={() => setMode('pick_product')}
                            className="px-4 py-2 border border-[#E1E3DB] text-stone-700 bg-white hover:bg-[#F4F5F1] rounded-lg transition-colors font-medium text-sm"
                        >
                            Back
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg transition-colors font-medium text-sm shadow-sm"
                    >
                        {initialLine ? 'Update Item' : 'Add Item'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SalesItemPicker;
