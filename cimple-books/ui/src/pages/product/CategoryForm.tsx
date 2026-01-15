import { useState, useEffect } from 'react';
import { createCategory, updateCategory, type Category } from '../../lib/api';

const PRODUCT_CLASSES = [
    { value: 'physical_item', label: 'Physical Item' },
    { value: 'service', label: 'Service' },
    { value: 'digital_item', label: 'Digital Item' },
];

interface CategoryFormProps {
    category?: Category | null;
    onSave: () => void;
}

const CategoryForm = ({ category, onSave }: CategoryFormProps) => {
    const [name, setName] = useState('');
    const [info, setInfo] = useState('');
    const [productClass, setProductClass] = useState('physical_item');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (category) {
            setName(category.name || '');
            setInfo(category.info || '');
            setProductClass(category.product_class || 'physical_item');
        } else {
            setName('');
            setInfo('');
            setProductClass('physical_item');
        }
    }, [category]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const categoryData = {
                name,
                info,
                product_class: productClass,
            };

            let resp;
            if (category) {
                resp = await updateCategory(category.id, categoryData);
            } else {
                resp = await createCategory(categoryData);
            }

            if (resp.status === 200) {
                onSave();
            } else {
                setError(resp.error || 'Failed to save category');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save category');
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
                    placeholder="Category name"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Class *
                </label>
                <select
                    value={productClass}
                    onChange={(e) => setProductClass(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    {PRODUCT_CLASSES.map((pc) => (
                        <option key={pc.value} value={pc.value}>
                            {pc.label}
                        </option>
                    ))}
                </select>
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
                    placeholder="Additional information about the category"
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

export default CategoryForm;

