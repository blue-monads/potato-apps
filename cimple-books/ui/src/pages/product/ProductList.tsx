import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, Layers, ArrowDownToLine, PackageX, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router';
import { listProducts, deleteProduct, listCategories, getCurrencySymbol, type Product, type Category, type Sale } from '../../lib/api';
import { BASE_PATH } from '../../lib/base';
import { ScrapProductModal } from './components/ScrapProductModal';

const ProductList = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Scrap Modal state
    const [scrapModalOpen, setScrapModalOpen] = useState(false);
    const [scrapTargetProduct, setScrapTargetProduct] = useState<Product | null>(null);
    const [scrapBannerMessage, setScrapBannerMessage] = useState<string | null>(null);

    const handleOpenScrapModal = (product?: Product) => {
        setScrapTargetProduct(product || null);
        setScrapModalOpen(true);
    };

    const handleScrapSuccess = (sale: Sale, updatedProduct: Product) => {
        setScrapBannerMessage(`Successfully scrapped item(s). Scrap order #${sale.id} created.`);
        setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
        loadData();
        setTimeout(() => setScrapBannerMessage(null), 8000);
    };

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
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={() => handleOpenScrapModal()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-[#E1E3DB] hover:bg-amber-50 hover:border-amber-300 text-stone-700 hover:text-amber-800 rounded-lg text-sm font-semibold transition-colors shadow-xs"
                        title="Scrap damaged goods or lost items (creates scrap sale record)"
                    >
                        <PackageX className="w-4 h-4 text-amber-600" />
                        Scrap Product
                    </button>
                    <Link
                        to={`${BASE_PATH}stockin/new`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-[#E1E3DB] hover:bg-stone-50 text-stone-700 rounded-lg text-sm font-semibold transition-colors shadow-xs"
                    >
                        <ArrowDownToLine className="w-4 h-4 text-[#2E6E52]" />
                        Stock In
                    </Link>
                    <Link
                        to={`${BASE_PATH}products/new`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        New Product
                    </Link>
                </div>
            </div>

            {scrapBannerMessage && (
                <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span>{scrapBannerMessage}</span>
                    </div>
                    <Link
                        to={`${BASE_PATH}sales`}
                        className="text-xs font-semibold text-emerald-700 hover:underline shrink-0"
                    >
                        View in Sales →
                    </Link>
                </div>
            )}

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
                                                {getCurrencySymbol()}{formatPrice(product.sales_price)}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-700">
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${product.stock_count > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>
                                                        {product.stock_count} in stock
                                                    </span>
                                                    <span className="text-[10px] text-stone-400">
                                                        {product.track_inventory !== false ? 'Tracked via Stock In' : 'Direct Stock'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-600">
                                                {product.has_variants || variantCount > 0 ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#EAF3EE] text-[#2E6E52] border border-[#2E6E52]/20">
                                                        <Layers className="w-3 h-3" />
                                                        {variantCount > 0 ? `${variantCount} ${variantCount === 1 ? 'variant' : 'variants'}` : 'Has Variants'}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-stone-400">Single item</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenScrapModal(product)}
                                                        className="text-stone-400 hover:text-amber-700 p-1.5 hover:bg-amber-50 rounded-lg transition-colors"
                                                        title="Scrap product (damaged / lost write-off)"
                                                    >
                                                        <PackageX className="w-4 h-4 text-amber-600" />
                                                    </button>
                                                    <Link
                                                        to={`${BASE_PATH}stockin/new`}
                                                        className="text-stone-500 hover:text-[#2E6E52] p-1.5 hover:bg-[#EEF0EA] rounded-lg transition-colors"
                                                        title="Receive stock"
                                                    >
                                                        <ArrowDownToLine className="w-4 h-4" />
                                                    </Link>
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

            {/* Scrap Product Modal */}
            <ScrapProductModal
                isOpen={scrapModalOpen}
                onClose={() => setScrapModalOpen(false)}
                onSuccess={handleScrapSuccess}
                products={products}
                initialProduct={scrapTargetProduct}
            />
        </div>
    );
};

export default ProductList;
