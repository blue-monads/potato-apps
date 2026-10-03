import { useState, useEffect } from 'react';
import { createCategory, updateCategory, type Category } from '../../lib/api';
import { SpaceImagePicker } from '../../components/SpaceImagePicker';

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
    const [image, setImage] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (category) {
            setName(category.name || '');
            setInfo(category.info || '');
            setProductClass(category.product_class || 'physical_item');
            setImage(category.image || '');
        } else {
            setName('');
            setInfo('');
            setProductClass('physical_item');
            setImage('');
        }
    }, [category]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const categoryData = {
                name: name.trim(),
                info: info.trim(),
                product_class: productClass,
                image: image.trim(),
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
        <form onSubmit={handleSubmit} className="space-y-4 font-sans">
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                </div>
            )}

            <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                    Category Name *
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors"
                    placeholder="e.g., Pharmaceuticals, Hardware, Office Supplies"
                />
            </div>

            <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                    Product Class *
                </label>
                <select
                    value={productClass}
                    onChange={(e) => setProductClass(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors bg-white"
                >
                    {PRODUCT_CLASSES.map((pc) => (
                        <option key={pc.value} value={pc.value}>
                            {pc.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* CATEGORY IMAGE */}
            <div className="border border-[#E1E3DB] rounded-xl p-4 bg-[#FAFBF9]">
                <SpaceImagePicker
                    label="Category Image"
                    folderPath="cimple-books/categories"
                    value={image}
                    onChange={(val) => setImage(val)}
                />
            </div>

            <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                    Description & Notes
                </label>
                <textarea
                    value={info}
                    onChange={(e) => setInfo(e.target.value)}
                    rows={3}
                    className="w-full px-3.5 py-2.5 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors"
                    placeholder="Additional information about this category"
                />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E1E3DB]">
                <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg transition-colors font-semibold text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? 'Saving...' : (category ? 'Update Category' : 'Create Category')}
                </button>
            </div>
        </form>
    );
};

export default CategoryForm;
