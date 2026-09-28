import { useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, X } from 'lucide-react';
import { createCategory, updateCategory, uploadProductImage, type Category } from '../../lib/api';

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
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [isUploading, setIsUploading] = useState(false);
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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        setError(null);
        try {
            const url = await uploadProductImage(file);
            setImage(url);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload category image');
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleAddImageUrl = () => {
        const trimmed = imageUrlInput.trim();
        if (trimmed) {
            setImage(trimmed);
            setImageUrlInput('');
        }
    };

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
                <label className="block text-xs font-semibold text-stone-800 mb-2 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-[#2E6E52]" />
                    Category Image
                </label>

                {image ? (
                    <div className="flex items-center gap-3 mb-3">
                        <div className="relative group w-16 h-16 rounded-lg overflow-hidden border border-[#E1E3DB] bg-white shadow-sm">
                            <img src={image} alt="Category" className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={() => setImage('')}
                                className="absolute top-1 right-1 bg-red-600/90 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove image"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="text-xs text-stone-500 truncate flex-1">
                            <span className="font-semibold text-stone-700 block">Image attached</span>
                            <span className="truncate block max-w-xs">{image}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setImage('')}
                            className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 border border-red-200 rounded hover:bg-red-50"
                        >
                            Remove
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col sm:flex-row gap-2">
                        <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-[#E1E3DB] hover:bg-[#EEF0EA] text-stone-700 text-xs font-medium rounded-lg transition-colors">
                            <Upload className="w-3.5 h-3.5 text-[#2E6E52]" />
                            {isUploading ? 'Uploading...' : 'Upload Image'}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                disabled={isUploading}
                                className="hidden"
                            />
                        </label>
                        <div className="flex-1 flex gap-1.5">
                            <input
                                type="text"
                                value={imageUrlInput}
                                onChange={(e) => setImageUrlInput(e.target.value)}
                                placeholder="Or enter image URL..."
                                className="flex-1 px-3 py-1.5 border border-[#E1E3DB] bg-white rounded-lg text-xs focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none"
                            />
                            <button
                                type="button"
                                onClick={handleAddImageUrl}
                                disabled={!imageUrlInput.trim()}
                                className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 disabled:opacity-50 text-stone-700 rounded-lg text-xs font-semibold transition-colors"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                )}
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
