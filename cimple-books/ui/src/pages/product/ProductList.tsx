import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, Layers, ArrowDownToLine, PackageX, CheckCircle2, Search, X, Filter } from 'lucide-react';
import { Link } from 'react-router';
import { listProducts, deleteProduct, listCategories, getCurrencySymbol, type Product, type Category, type Sale } from '../../lib/api';
import { BASE_PATH } from '../../lib/base';
import { ScrapProductModal } from './components/ScrapProductModal';
import { Pagination } from '../../components/Pagination';

const ProductList = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter & search states (server-side)
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // Pagination state (server-side)
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(15);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);

    // Scrap Modal state
    const [scrapModalOpen, setScrapModalOpen] = useState(false);
    const [scrapTargetProduct, setScrapTargetProduct] = useState<Product | null>(null);
    const [scrapBannerMessage, setScrapBannerMessage] = useState<string | null>(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 280);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Reset page to 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, selectedCategory]);

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

    // Load categories once
    useEffect(() => {
        listCategories().then((res) => {
            if (res.status === 200) {
                setCategories(res.data || []);
            }
        });
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const prodResp = await listProducts({
                page: currentPage,
                pageSize,
                search: debouncedSearch,
                categoryId: selectedCategory,
            });

            if (prodResp.status === 200 && prodResp.data) {
                setProducts(prodResp.data.items || []);
                setTotalCount(prodResp.data.total || 0);
                setTotalPages(prodResp.data.total_pages || 1);
            } else {
                setError(prodResp.error || 'Failed to load products');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentPage, pageSize, debouncedSearch, selectedCategory]);

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
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-[#E1E3DB] hover:bg-amber-50 hover:border-amber-300 text-stone-700 hover:text-amber-800 rounded-lg text-sm font-semibold transition-colors shadow-xs cursor-pointer"
                        title="Scrap damaged goods or lost items (creates scrap sale record)"
                    >
                        <PackageX className="w-4 h-4 text-amber-600" />
                        Scrap Product
                    </button>
                    <Link
                        to={`${BASE_PATH}stockin/new`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-[#E1E3DB] hover:bg-stone-50 text-stone-700 rounded-lg text-sm font-semibold transition-colors shadow-xs cursor-pointer"
                    >
                        <ArrowDownToLine className="w-4 h-4 text-[#2E6E52]" />
                        Stock In
                    </Link>
                    <Link
                        to={`${BASE_PATH}products/new`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
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

            {/* Filter and Search Bar */}
            <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search products by name, description, SKU, or barcode..."
                        className="w-full pl-9 pr-9 py-2 bg-white border border-[#E1E3DB] rounded-lg text-sm placeholder-stone-400 focus:outline-hidden focus:border-[#2E6E52] focus:ring-1 focus:ring-[#2E6E52] transition-colors"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-stone-400 hidden sm:block" />
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="bg-white border border-[#E1E3DB] rounded-lg px-3 py-2 text-sm font-medium text-stone-800 focus:outline-hidden focus:border-[#2E6E52] cursor-pointer"
                    >
                        <option value="all">All Categories</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

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
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-stone-500 animate-pulse">
                                        Loading products...
                                    </td>
                                </tr>
                            ) : products.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-stone-500">
                                        {debouncedSearch || selectedCategory !== 'all'
                                            ? 'No products match the current filters.'
                                            : 'No products found. Click "New Product" to add one.'}
                                    </td>
                                </tr>
                            ) : (
                                products.map((product) => {
                                    const thumb = getProductThumbnail(product);
                                    const hasVars = product.has_variants || (product.variants && product.variants.length > 0);
                                    const varCount = product.variants ? product.variants.length : 0;
                                    const isTracked = product.track_inventory !== false;

                                    return (
                                        <tr key={product.id} className="hover:bg-[#FAFBF9] transition-colors">
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-[#FAFBF9] border border-[#E1E3DB] flex items-center justify-center shrink-0 overflow-hidden">
                                                        {thumb ? (
                                                            <img
                                                                src={thumb}
                                                                alt={product.name}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    (e.target as HTMLElement).style.display = 'none';
                                                                }}
                                                            />
                                                        ) : (
                                                            <Package className="w-5 h-5 text-stone-400" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold text-stone-900 block text-sm">
                                                            {product.name}
                                                        </span>
                                                        {product.info && (
                                                            <p className="text-xs text-stone-400 mt-0.5 line-clamp-1">
                                                                {product.info}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-600">
                                                {product.catagory_id ? (
                                                    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-md bg-[#FAFBF9] border border-[#E1E3DB] text-stone-700">
                                                        {getCategoryName(product.catagory_id)}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-stone-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-stone-900">
                                                {getCurrencySymbol()}{formatPrice(product.sales_price || 0)}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm">
                                                {isTracked ? (
                                                    <div className="flex flex-col">
                                                        <span className={`font-semibold ${
                                                            (product.stock_count || 0) <= 0
                                                                ? 'text-rose-600'
                                                                : (product.stock_count || 0) <= 5
                                                                    ? 'text-amber-600'
                                                                    : 'text-[#2E6E52]'
                                                        }`}>
                                                            {product.stock_count || 0} in stock
                                                        </span>
                                                        <span className="text-[11px] text-stone-400">
                                                            +{product.total_stockin_qty || 0} in / -{product.total_sold_qty || 0} out
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-stone-400">Untracked</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm">
                                                {hasVars ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E1EFE7] text-[#205C41] border border-[#2E6E52]/20">
                                                        <Layers className="w-3 h-3" />
                                                        {varCount} {varCount === 1 ? 'variant' : 'variants'}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-stone-400">Single item</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenScrapModal(product)}
                                                        className="text-stone-400 hover:text-amber-700 p-1.5 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                                        title="Scrap product (damaged / lost write-off)"
                                                    >
                                                        <PackageX className="w-4 h-4 text-amber-600" />
                                                    </button>
                                                    <Link
                                                        to={`${BASE_PATH}stockin/new`}
                                                        className="text-stone-500 hover:text-[#2E6E52] p-1.5 hover:bg-[#EEF0EA] rounded-lg transition-colors cursor-pointer"
                                                        title="Receive stock"
                                                    >
                                                        <ArrowDownToLine className="w-4 h-4" />
                                                    </Link>
                                                    <Link
                                                        to={`${BASE_PATH}products/${product.id}/edit`}
                                                        className="text-stone-600 hover:text-[#2E6E52] p-1.5 hover:bg-[#EEF0EA] rounded-lg transition-colors cursor-pointer"
                                                        title="Edit product & variants"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(product.id)}
                                                        className="text-stone-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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

                {/* Server-side Pagination */}
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(newSize) => {
                        setPageSize(newSize);
                        setCurrentPage(1);
                    }}
                    itemLabel="products"
                />
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
