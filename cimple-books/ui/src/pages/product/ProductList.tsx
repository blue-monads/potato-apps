import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, Layers } from 'lucide-react';
import { Link } from 'react-router';
import { listProducts, deleteProduct, listCategories, type Product, type Category } from '../../lib/api';
import { BASE_PATH } from '../../lib/base';

const ProductList = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [prodResp, catResp] = await Promise.all([
                listProducts(),
                listCategories(),
            ]);

            if (prodResp.status === 200) {
                setProducts(prodResp.data || []);
            } else {
                setError(prodResp.error || 'Failed to load products');
            }

            if (catResp.status === 200) {
                setCategories(catResp.data || []);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this product?')) {
            return;
        }
        try {
            const resp = await deleteProduct(id);
            if (resp.status === 200) {
                await loadData();
            } else {
                alert(resp.error || 'Failed to delete product');
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete product');
        }
    };

    const getCategoryName = (categoryId: number) => {
        const category = categories.find(c => c.id === categoryId);
        return category?.name || `Category #${categoryId}`;
    };

    const formatPrice = (price: number) => {
        return (price / 100).toFixed(2);
    };

    const getProductThumbnail = (product: Product) => {
        if (product.images) {
            const list = product.images.split(',').map(s => s.trim()).filter(Boolean);
            if (list.length > 0) return list[0];
        }
        return product.image || null;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="text-base text-stone-500 font-sans">Loading products...</div>
            </div>
        );
    }

    return (
        <div className="font-sans">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-stone-900 font-display">Products</h2>
                    <p className="text-xs text-stone-500 mt-0.5">Manage catalogue items, sales pricing, pictures, and variants</p>
                </div>
                <Link
                    to={`${BASE_PATH}products/new`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    New Product
                </Link>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[#E1E3DB]">
                        <thead className="bg-[#F8F9F6]">
                            <tr>
                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                    Product
                                </th>
                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                    Category
                                </th>
                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                    Sales Price
                                </th>
                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                    Stock
                                </th>
                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                    Variants
                                </th>
                                <th className="px-5 py-3.5 text-right text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-[#E1E3DB]">
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-stone-500">
                                        <Package className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                                        No products found. Click "New Product" to get started.
                                    </td>
                                </tr>
                            ) : (
                                products.map((product) => {
                                    const thumb = getProductThumbnail(product);
                                    const variantCount = product.variants ? product.variants.length : 0;
                                    return (
                                        <tr key={product.id} className="hover:bg-[#FAFBF9] transition-colors">
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3.5">
                                                    {thumb ? (
                                                        <img
                                                            src={thumb}
                                                            alt={product.name}
                                                            className="w-11 h-11 object-cover rounded-lg border border-[#E1E3DB]"
                                                        />
                                                    ) : (
                                                        <div className="w-11 h-11 rounded-lg bg-[#EEF0EA] border border-[#E1E3DB] flex items-center justify-center text-stone-400">
                                                            <Package className="w-5 h-5" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="text-sm font-semibold text-stone-900">
                                                            {product.name}
                                                        </div>
                                                        <div className="text-xs text-stone-500 max-w-xs truncate">
                                                            {product.info || 'No description'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-600">
                                                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F4F5F1] text-stone-700 border border-[#E1E3DB]">
                                                    {getCategoryName(product.catagory_id)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-stone-900">
                                                ${formatPrice(product.sales_price)}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-700">
                                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${product.stock_count > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>
                                                    {product.stock_count} in stock
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-600">
                                                {variantCount > 0 ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#EAF3EE] text-[#2E6E52] border border-[#2E6E52]/20">
                                                        <Layers className="w-3 h-3" />
                                                        {variantCount} {variantCount === 1 ? 'variant' : 'variants'}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-stone-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link
                                                        to={`${BASE_PATH}products/${product.id}/edit`}
                                                        className="text-stone-600 hover:text-[#2E6E52] p-1.5 hover:bg-[#EEF0EA] rounded-lg transition-colors"
                                                        title="Edit product & variants"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(product.id)}
                                                        className="text-stone-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete product"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProductList;
