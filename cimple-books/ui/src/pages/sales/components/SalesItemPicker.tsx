import { useState, useEffect } from 'react';
import { Check, Package } from 'lucide-react';
import { listProducts, type Product, type ProductVariant } from '../../../lib/api';
import { useModal } from '../../../lib/shared/modal/modal';

interface SalesItemLine {
    info: string;
    qty: number;
    product_id: number;
    price: number;
    amount: number; // discounted price per unit
    discount_amount: number;
    tax_amount: number;
    total_amount: number;
}

interface SalesItemPickerProps {
    onSave: (line: SalesItemLine) => void;
}

const SalesItemPicker = ({ onSave }: SalesItemPickerProps) => {
    const { closeModal } = useModal();
    const [mode, setMode] = useState<'pick_product' | 'set_details'>('pick_product');
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    // Selected product & variant details
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
    const [info, setInfo] = useState('');
    const [qty, setQty] = useState(1);
    const [amount, setAmount] = useState(0); // discounted price per unit
    const [price, setPrice] = useState(0); // original sales price

    useEffect(() => {
        const loadProducts = async () => {
            setLoading(true);
            try {
                const resp = await listProducts();
                if (resp.status === 200) {
                    setProducts(resp.data || []);
                }
            } catch (err) {
                console.error('Failed to load products', err);
            } finally {
                setLoading(false);
            }
        };
        loadProducts();
    }, []);

    const handleProductSelect = (product: Product, variant?: ProductVariant) => {
        setSelectedProduct(product);
        setSelectedVariant(variant || null);
        const effectivePrice = variant ? variant.sales_price : product.sales_price;
        setPrice(effectivePrice);
        setAmount(effectivePrice); // Start with original price
        const title = variant ? `${product.name} (${variant.name})` : product.name;
        setInfo(title);
        setMode('set_details');
    };

    const handleSubmit = () => {
        if (!selectedProduct) return;

        const discount_amount = price - amount; // discount per unit
        const total_amount = amount * qty; // total after discount, before tax

        onSave({
            info,
            qty,
            product_id: selectedProduct.id,
            price,
            amount,
            discount_amount,
            tax_amount: 0,
            total_amount,
        });
        closeModal();
    };

    const formatCurrency = (amount: number) => {
        return (amount / 100).toFixed(2);
    };

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
                <div className="text-center py-8 text-stone-500 font-sans">Loading products...</div>
            </div>
        );
    }

    if (mode === 'pick_product') {
        return (
            <div className="overflow-x-auto max-h-[70vh] font-sans">
                <table className="min-w-full divide-y divide-[#E1E3DB]">
                    <thead className="bg-[#F8F9F6]">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">Product</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">Info</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">Sales Price</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">Variants</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-stone-600 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-[#E1E3DB]">
                        {products.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-stone-500">
                                    No products found
                                </td>
                            </tr>
                        ) : (
                            products.map((product) => {
                                const img = getFirstImage(product);
                                const hasVariants = product.variants && product.variants.length > 0;
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
                                        <td className="px-4 py-3 text-sm font-semibold text-stone-900">${formatCurrency(product.sales_price)}</td>
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
                                                            <span className="font-semibold">${formatCurrency(v.sales_price)}</span>
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
            <h3 className="text-xl font-bold text-stone-900 mb-4 font-display">Item Details</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                        Product
                    </label>
                    <div className="px-3 py-2 bg-[#F4F5F1] border border-[#E1E3DB] rounded-lg text-sm flex justify-between items-center text-stone-900 font-medium">
                        <span>{selectedProduct?.name} {selectedVariant ? `— ${selectedVariant.name}` : ''}</span>
                        <span className="font-semibold">${formatCurrency(price)}</span>
                    </div>
                </div>

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
                        max={formatCurrency(price)}
                        value={formatCurrency(amount)}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setAmount(Math.round(val * 100));
                        }}
                        className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none"
                        required
                    />
                    <p className="mt-1 text-xs text-stone-500">
                        Sales Price: ${formatCurrency(price)} | Discount: ${formatCurrency(price - amount)}
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                        Item Description / Notes
                    </label>
                    <textarea
                        value={info}
                        onChange={(e) => setInfo(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none"
                        placeholder="Additional information about this item"
                    />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E1E3DB]">
                    <button
                        type="button"
                        onClick={() => setMode('pick_product')}
                        className="px-4 py-2 border border-[#E1E3DB] text-stone-700 bg-white hover:bg-[#F4F5F1] rounded-lg transition-colors font-medium text-sm"
                    >
                        Back
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg transition-colors font-medium text-sm shadow-sm"
                    >
                        Add Item
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SalesItemPicker;
