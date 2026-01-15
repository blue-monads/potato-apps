import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { listCategories, deleteCategory, type Category } from '../../lib/api';
import { useModal } from '../../lib/shared/modal/modal';
import CategoryForm from './CategoryForm';

const PRODUCT_CLASSES = [
    { value: 'physical_item', label: 'Physical Item' },
    { value: 'service', label: 'Service' },
    { value: 'digital_item', label: 'Digital Item' },
];

const CategoryList = () => {
    const { openModal, closeModal } = useModal();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadCategories = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await listCategories();
            if (resp.status === 200) {
                setCategories(resp.data || []);
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
    }, []);

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
            title: category ? 'Edit Category' : 'New Category',
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

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-lg text-gray-500">Loading categories...</div>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Categories</h2>
                <button
                    onClick={() => openCategoryForm()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Category
                </button>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Class
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Info
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {categories.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        No categories found. Create your first category to get started.
                                    </td>
                                </tr>
                            ) : (
                                categories.map((category) => (
                                    <tr key={category.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {category.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {category.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {PRODUCT_CLASSES.find(c => c.value === category.product_class)?.label || category.product_class}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                            {category.info || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openCategoryForm(category)}
                                                    className="text-indigo-600 hover:text-indigo-900 p-1"
                                                    title="Edit category"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(category.id)}
                                                    className="text-red-600 hover:text-red-900 p-1"
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
            </div>
        </div>
    );
};

export default CategoryList;

