import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { listProducts, type Product } from '../../../lib/api';
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

    // Selected product details
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [info, setInfo] = useState('');
    const [qty, setQty] = useState(1);
    const [amount, setAmount] = useState(0); // discounted price per unit
    const [price, setPrice] = useState(0); // original price

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

    const handleProductSelect = (product: Product) => {
        setSelectedProduct(product);
        setPrice(product.price);
        setAmount(product.price); // Start with original price
        setInfo(product.name + (product.variant_id ? ` ${product.variant_id}` : ''));
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
            tax_amount: 0, // Can be set separately later
            total_amount,
        });
        closeModal();
    };

    const formatCurrency = (amount: number) => {
        return (amount / 100).toFixed(2);
    };

    if (loading && mode === 'pick_product') {
        return (
            <div className="p-6 min-w-[600px]">
                <div className="text-center py-8 text-gray-500">Loading products...</div>
            </div>
        );
    }

    if (mode === 'pick_product') {
        return (


            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Info</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Variant</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {products.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                    No products found
                                </td>
                            </tr>
                        ) : (
                            products.map((product) => (
                                <tr key={product.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm text-gray-900">{product.id}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{product.name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{product.info}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900">${formatCurrency(product.price)}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{product.variant_id || '-'}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleProductSelect(product)}
                                            className="text-blue-600 hover:text-blue-700 p-1 inline-flex items-center gap-1 hover:bg-gray-100 rounded-lg"
                                            title="Select product"
                                        >
                                            <Check className="w-4 h-4" />
                                            Pick
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        );
    }

    // Set details mode
    return (
        <div className="p-6 min-w-[500px]">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Item Details</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Product
                    </label>
                    <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm">
                        {selectedProduct?.name} - ${formatCurrency(price)}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity *
                    </label>
                    <input
                        type="number"
                        min="1"
                        value={qty}
                        onChange={(e) => setQty(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Per Unit Amount *
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={formatCurrency(price)}
                        value={formatCurrency(amount)}
                        onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setAmount(Math.round(value * 100));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Original: ${formatCurrency(price)} | Discount: ${formatCurrency(price - amount)}
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                    </label>
                    <textarea
                        value={info}
                        onChange={(e) => setInfo(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Additional information about this item"
                    />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                    <button
                        onClick={() => setMode('pick_product')}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Back
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Add Item
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SalesItemPicker;

