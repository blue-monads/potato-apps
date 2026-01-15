import { useState, useEffect } from 'react';
import { createProduct, updateProduct, type Product, type Category } from '../../lib/api';

interface ProductFormProps {
    product?: Product | null;
    categories: Category[];
    onSave: () => void;
}

const ProductForm = ({ product, categories, onSave }: ProductFormProps) => {
    const [name, setName] = useState('');
    const [info, setInfo] = useState('');
    const [categoryId, setCategoryId] = useState(0);
    const [price, setPrice] = useState('');
    const [stockCount, setStockCount] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (product) {
            setName(product.name || '');
            setInfo(product.info || '');
            setCategoryId(product.catagory_id || 0);
            setPrice(product.price > 0 ? (product.price / 100).toFixed(2) : '');
            setStockCount(product.stock_count || 0);
        } else {
            setName('');
            setInfo('');
            setCategoryId(0);
            setPrice('');
            setStockCount(0);
        }
    }, [product]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const productData = {
                name,
                info,
                catagory_id: categoryId,
                price: Math.round(parseFloat(price || '0') * 100),
                stock_count: stockCount,
            };

            let resp;
            if (product) {
                resp = await updateProduct(product.id, productData);
            } else {
                resp = await createProduct(productData);
            }

            if (resp.status === 200) {
                onSave();
            } else {
                setError(resp.error || 'Failed to save product');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save product');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {error}
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Product name"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                </label>
                <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(parseInt(e.target.value))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    <option value={0}>Select Category</option>
                    {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                            {cat.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Price *
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0.00"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stock Count
                    </label>
                    <input
                        type="number"
                        value={stockCount}
                        onChange={(e) => setStockCount(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Info
                </label>
                <textarea
                    value={info}
                    onChange={(e) => setInfo(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Additional information about the product"
                />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </form>
    );
};

export default ProductForm;

