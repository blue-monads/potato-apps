import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, FolderTree, Search, X, Filter } from 'lucide-react';
import { listCategories, deleteCategory, type Category } from '../../lib/api';
import { useModal } from '../../lib/shared/modal/modal';
import CategoryForm from './CategoryForm';
import { Pagination } from '../../components/Pagination';
import { getFilePreviewUrl } from '../../lib/spaceFile';

const PRODUCT_CLASSES = [
    { value: 'all', label: 'All Classes' },
    { value: 'physical_item', label: 'Physical Item' },
    { value: 'service', label: 'Service' },
    { value: 'digital_item', label: 'Digital Item' },
];

const CategoryList = () => {
    const { openModal, closeModal } = useModal();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Search and filter states (server-side)
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [productClassFilter, setProductClassFilter] = useState('all');

    // Pagination state (server-side)
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(15);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 280);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Reset page to 1 on filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, productClassFilter]);

    const loadCategories = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await listCategories({
                page: currentPage,
                pageSize,
                search: debouncedSearch,
                productClass: productClassFilter,
            });
            if (resp.status === 200 && resp.data) {
                setCategories(resp.data.items || []);
                setTotalCount(resp.data.total || 0);
                setTotalPages(resp.data.total_pages || 1);
            } else {
                setError(resp.error || 'Failed to load categories');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load categories');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCategories();
    }, [currentPage, pageSize, debouncedSearch, productClassFilter]);

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this category?')) {
            return;
        }
        try {
            const resp = await deleteCategory(id);
            if (resp.status === 200) {
                await loadCategories();
            } else {
                alert(resp.error || 'Failed to delete category');
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete category');
        }
    };

    const openCategoryForm = (category?: Category | null) => {
        openModal({
            title: category ? `Edit Category: ${category.name}` : 'Create New Category',
            content: (
                <CategoryForm
                    category={category || null}
                    onSave={() => {
                        closeModal();
                        loadCategories();
                    }}
                />
            ),
            onClose: () => {
                loadCategories();
            },
        });
    };

    const getProductClassLabel = (val: string) => {
        const found = PRODUCT_CLASSES.find(c => c.value === val);
        return found ? found.label : val;
    };

    return (
        <div className="font-sans">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-stone-900 font-display">Categories</h2>
                    <p className="text-xs text-stone-500 mt-0.5">Organize catalogue items by classification and category</p>
                </div>
                <button
                    onClick={() => openCategoryForm()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    New Category
                </button>
            </div>

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
                        placeholder="Search categories by name or description..."
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

                {/* Product Class Filter */}
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-stone-400 hidden sm:block" />
                    <select
                        value={productClassFilter}
                        onChange={(e) => setProductClassFilter(e.target.value)}
                        className="bg-white border border-[#E1E3DB] rounded-lg px-3 py-2 text-sm font-medium text-stone-800 focus:outline-hidden focus:border-[#2E6E52] cursor-pointer"
                    >
                        {PRODUCT_CLASSES.map((pc) => (
                            <option key={pc.value} value={pc.value}>
                                {pc.label}
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
                                    Category
                                </th>
                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                    Product Class
                                </th>
                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                    Description
                                </th>
                                <th className="px-5 py-3.5 text-right text-xs font-semibold text-stone-600 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-[#E1E3DB]">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-stone-500 animate-pulse">
                                        Loading categories...
                                    </td>
                                </tr>
                            ) : categories.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-stone-500">
                                        <FolderTree className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                                        {debouncedSearch || productClassFilter !== 'all'
                                            ? 'No categories match the current filters.'
                                            : 'No categories found. Click "New Category" to create one.'}
                                    </td>
                                </tr>
                            ) : (
                                categories.map((category) => (
                                    <tr key={category.id} className="hover:bg-[#FAFBF9] transition-colors">
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3.5">
                                                {category.image ? (
                                                    <img
                                                        src={getFilePreviewUrl(category.image)}
                                                        alt={category.name}
                                                        className="w-10 h-10 object-cover rounded-lg border border-[#E1E3DB]"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-[#EEF0EA] border border-[#E1E3DB] flex items-center justify-center text-stone-400">
                                                        <FolderTree className="w-5 h-5 text-stone-500" />
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="text-sm font-semibold text-stone-900">
                                                        {category.name}
                                                    </div>
                                                    <div className="text-xs text-stone-400">
                                                        ID #{category.id}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-600">
                                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F4F5F1] text-stone-700 border border-[#E1E3DB]">
                                                {getProductClassLabel(category.product_class)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-sm text-stone-500 max-w-xs truncate">
                                            {category.info || '—'}
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openCategoryForm(category)}
                                                    className="text-stone-600 hover:text-[#2E6E52] p-1.5 hover:bg-[#EEF0EA] rounded-lg transition-colors cursor-pointer"
                                                    title="Edit category"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(category.id)}
                                                    className="text-stone-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                    title="Delete category"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
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
                    itemLabel="categories"
                />
            </div>
        </div>
    );
};

export default CategoryList;
