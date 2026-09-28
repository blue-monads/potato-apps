import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Upload, Image as ImageIcon, X } from 'lucide-react';
import { 
    createProduct, 
    updateProduct, 
    listProductVariants,
    createProductVariant,
    updateProductVariant,
    deleteProductVariant,
    uploadProductImage,
    type Product, 
    type ProductVariant,
    type Category 
} from '../../lib/api';

interface ProductFormProps {
    product?: Product | null;
    categories: Category[];
    onSave: () => void;
}

const ProductForm = ({ product, categories, onSave }: ProductFormProps) => {
    const [name, setName] = useState('');
    const [info, setInfo] = useState('');
    const [categoryId, setCategoryId] = useState(0);
    const [salesPrice, setSalesPrice] = useState('');
    const [stockCount, setStockCount] = useState(0);
    const [images, setImages] = useState<string[]>([]);
    const [newImageUrl, setNewImageUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    // Variants state
    const [variants, setVariants] = useState<ProductVariant[]>([]);
    const [loadingVariants, setLoadingVariants] = useState(false);
    const [editingVariantId, setEditingVariantId] = useState<number | null>(null);
    const [variantName, setVariantName] = useState('');
    const [variantDesc, setVariantDesc] = useState('');
    const [variantPrice, setVariantPrice] = useState('');
    const [variantImage, setVariantImage] = useState('');
    const [isUploadingVariantImg, setIsUploadingVariantImg] = useState(false);
    const [showVariantForm, setShowVariantForm] = useState(false);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (product) {
            setName(product.name || '');
            setInfo(product.info || '');
            setCategoryId(product.catagory_id || 0);
            setSalesPrice(product.sales_price > 0 ? (product.sales_price / 100).toFixed(2) : '');
            setStockCount(product.stock_count || 0);

            // Parse images
            const imgList: string[] = [];
            if (product.images) {
                product.images.split(',').forEach(s => {
                    const trimmed = s.trim();
                    if (trimmed && !imgList.includes(trimmed)) imgList.push(trimmed);
                });
            }
            if (product.image && !imgList.includes(product.image)) {
                imgList.unshift(product.image);
            }
            setImages(imgList);

            // Load variants
            loadVariants(product.id);
        } else {
            setName('');
            setInfo('');
            setCategoryId(categories.length > 0 ? categories[0].id : 0);
            setSalesPrice('');
            setStockCount(0);
            setImages([]);
            setVariants([]);
        }
    }, [product]);

    const loadVariants = async (productId: number) => {
        setLoadingVariants(true);
        try {
            const resp = await listProductVariants(productId);
            if (resp.status === 200) {
                setVariants(resp.data || []);
            }
        } catch (err) {
            console.error('Failed to load variants', err);
        } finally {
            setLoadingVariants(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        setError(null);
        try {
            const url = await uploadProductImage(file);
            setImages(prev => [...prev, url]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload image');
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleAddImageUrl = () => {
        const trimmed = newImageUrl.trim();
        if (trimmed && !images.includes(trimmed)) {
            setImages(prev => [...prev, trimmed]);
            setNewImageUrl('');
        }
    };

    const handleRemoveImage = (indexToRemove: number) => {
        setImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleVariantImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingVariantImg(true);
        try {
            const url = await uploadProductImage(file);
            setVariantImage(url);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to upload variant image');
        } finally {
            setIsUploadingVariantImg(false);
            e.target.value = '';
        }
    };

    const handleSaveVariant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!product?.id) {
            alert('Please save the product first before adding variants.');
            return;
        }
        if (!variantName.trim()) {
            alert('Variant name is required');
            return;
        }

        const priceInCents = Math.round(parseFloat(variantPrice || salesPrice || '0') * 100);
        const variantData: Partial<ProductVariant> = {
            product_id: product.id,
            name: variantName.trim(),
            description: variantDesc.trim(),
            sales_price: priceInCents,
            images: variantImage.trim(),
        };

        try {
            if (editingVariantId) {
                const resp = await updateProductVariant(editingVariantId, variantData);
                if (resp.status === 200) {
                    resetVariantForm();
                    await loadVariants(product.id);
                } else {
                    alert(resp.error || 'Failed to update variant');
                }
            } else {
                const resp = await createProductVariant(product.id, variantData);
                if (resp.status === 200) {
                    resetVariantForm();
                    await loadVariants(product.id);
                } else {
                    alert(resp.error || 'Failed to create variant');
                }
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to save variant');
        }
    };

    const resetVariantForm = () => {
        setEditingVariantId(null);
        setVariantName('');
        setVariantDesc('');
        setVariantPrice('');
        setVariantImage('');
        setShowVariantForm(false);
    };

    const handleEditVariant = (v: ProductVariant) => {
        setEditingVariantId(v.id);
        setVariantName(v.name);
        setVariantDesc(v.description || '');
        setVariantPrice((v.sales_price / 100).toFixed(2));
        setVariantImage(v.images || '');
        setShowVariantForm(true);
    };

    const handleDeleteVariant = async (variantId: number) => {
        if (!confirm('Are you sure you want to delete this variant?')) return;
        try {
            const resp = await deleteProductVariant(variantId);
            if (resp.status === 200 && product?.id) {
                await loadVariants(product.id);
            } else {
                alert(resp.error || 'Failed to delete variant');
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete variant');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const imgString = images.join(',');
            const primaryImg = images.length > 0 ? images[0] : '';
            const productData: Partial<Product> = {
                name: name.trim(),
                info: info.trim(),
                catagory_id: categoryId,
                sales_price: Math.round(parseFloat(salesPrice || '0') * 100),
                stock_count: stockCount,
                image: primaryImg,
                images: imgString,
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
        <div className="font-sans max-h-[80vh] overflow-y-auto pr-1">
            <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                        Product Name *
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors"
                        placeholder="e.g., Organic Honey 500g"
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                        Category *
                    </label>
                    <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(parseInt(e.target.value))}
                        required
                        className="w-full px-3.5 py-2.5 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors bg-white"
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
                        <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                            Sales Price ($) *
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={salesPrice}
                            onChange={(e) => setSalesPrice(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors"
                            placeholder="0.00"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                            Stock Count
                        </label>
                        <input
                            type="number"
                            value={stockCount}
                            onChange={(e) => setStockCount(parseInt(e.target.value) || 0)}
                            className="w-full px-3.5 py-2.5 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors"
                            placeholder="0"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                        Description / Info
                    </label>
                    <textarea
                        value={info}
                        onChange={(e) => setInfo(e.target.value)}
                        rows={3}
                        className="w-full px-3.5 py-2.5 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors"
                        placeholder="Additional details, specifications, or notes about the product"
                    />
                </div>

                {/* PRODUCT PICTURES / IMAGES */}
                <div className="border border-[#E1E3DB] rounded-xl p-4 bg-[#F8F9F6]">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold text-stone-800 flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-[#2E6E52]" />
                            Product Pictures
                        </label>
                        <span className="text-xs text-stone-500">
                            {images.length} {images.length === 1 ? 'image' : 'images'} added
                        </span>
                    </div>

                    {/* Previews */}
                    {images.length > 0 && (
                        <div className="flex flex-wrap gap-3 mb-3">
                            {images.map((imgUrl, idx) => (
                                <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-[#E1E3DB] bg-white shadow-sm">
                                    <img src={imgUrl} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveImage(idx)}
                                        className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Remove picture"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                    {idx === 0 && (
                                        <span className="absolute bottom-0 left-0 right-0 bg-[#2E6E52]/90 text-white text-[10px] text-center font-medium py-0.5">
                                            Cover
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Image Inputs */}
                    <div className="flex flex-col sm:flex-row gap-2">
                        <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-white border border-[#E1E3DB] hover:bg-[#F4F5F1] text-stone-700 text-sm font-medium rounded-lg transition-colors">
                            <Upload className="w-4 h-4 text-[#2E6E52]" />
                            {isUploading ? 'Uploading...' : 'Upload Image'}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                disabled={isUploading}
                                className="hidden"
                            />
                        </label>

                        <div className="flex-1 flex gap-2">
                            <input
                                type="text"
                                value={newImageUrl}
                                onChange={(e) => setNewImageUrl(e.target.value)}
                                placeholder="Or enter image URL..."
                                className="flex-1 px-3 py-2 border border-[#E1E3DB] bg-white rounded-lg text-sm focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none"
                            />
                            <button
                                type="button"
                                onClick={handleAddImageUrl}
                                disabled={!newImageUrl.trim()}
                                className="px-3 py-2 bg-stone-200 hover:bg-stone-300 disabled:opacity-50 text-stone-700 rounded-lg text-sm font-medium transition-colors"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </div>

                {/* SAVE PRODUCT BUTTON */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E1E3DB]">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-5 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg transition-colors font-medium text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Saving Product...' : (product ? 'Update Product' : 'Create Product')}
                    </button>
                </div>
            </form>

            {/* PRODUCT VARIANTS SECTION */}
            {product?.id ? (
                <div className="mt-8 pt-6 border-t border-[#E1E3DB]">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h4 className="text-base font-bold text-stone-900 font-display">Product Variants</h4>
                            <p className="text-xs text-stone-500">Manage size, flavor, color, or other variations</p>
                        </div>
                        {!showVariantForm && (
                            <button
                                type="button"
                                onClick={() => {
                                    resetVariantForm();
                                    setShowVariantForm(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EAF3EE] hover:bg-[#2E6E52] text-[#2E6E52] hover:text-white rounded-lg text-xs font-semibold transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add Variant
                            </button>
                        )}
                    </div>

                    {/* Variant Form */}
                    {showVariantForm && (
                        <div className="mb-4 p-4 border border-[#2E6E52]/30 bg-[#F8F9F6] rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <h5 className="text-sm font-bold text-stone-800">
                                    {editingVariantId ? 'Edit Variant' : 'New Variant'}
                                </h5>
                                <button
                                    type="button"
                                    onClick={resetVariantForm}
                                    className="text-stone-400 hover:text-stone-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                                        Variant Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={variantName}
                                        onChange={(e) => setVariantName(e.target.value)}
                                        placeholder="e.g., Small / 250ml / Red"
                                        className="w-full px-3 py-1.5 text-sm border border-[#E1E3DB] rounded-lg bg-white focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                                        Sales Price ($)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={variantPrice}
                                        onChange={(e) => setVariantPrice(e.target.value)}
                                        placeholder={salesPrice || '0.00'}
                                        className="w-full px-3 py-1.5 text-sm border border-[#E1E3DB] rounded-lg bg-white focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-stone-700 mb-1">
                                    Description / Details
                                </label>
                                <input
                                    type="text"
                                    value={variantDesc}
                                    onChange={(e) => setVariantDesc(e.target.value)}
                                    placeholder="Optional variant description"
                                    className="w-full px-3 py-1.5 text-sm border border-[#E1E3DB] rounded-lg bg-white focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-stone-700 mb-1">
                                    Variant Image
                                </label>
                                <div className="flex gap-2 items-center">
                                    {variantImage && (
                                        <img src={variantImage} alt="Variant" className="w-8 h-8 rounded border border-[#E1E3DB] object-cover" />
                                    )}
                                    <input
                                        type="text"
                                        value={variantImage}
                                        onChange={(e) => setVariantImage(e.target.value)}
                                        placeholder="Image URL or upload..."
                                        className="flex-1 px-3 py-1.5 text-sm border border-[#E1E3DB] rounded-lg bg-white focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none"
                                    />
                                    <label className="cursor-pointer px-2.5 py-1.5 bg-white border border-[#E1E3DB] hover:bg-[#EEF0EA] rounded-lg text-xs font-medium text-stone-700">
                                        {isUploadingVariantImg ? '...' : 'Upload'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleVariantImageUpload}
                                            disabled={isUploadingVariantImg}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={resetVariantForm}
                                    className="px-3 py-1.5 border border-[#E1E3DB] text-stone-600 hover:bg-stone-100 rounded-lg text-xs font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveVariant}
                                    className="px-4 py-1.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-xs font-semibold"
                                >
                                    {editingVariantId ? 'Update Variant' : 'Save Variant'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Variants Table / List */}
                    {loadingVariants ? (
                        <div className="text-center py-4 text-xs text-stone-500">Loading variants...</div>
                    ) : variants.length === 0 ? (
                        <div className="text-center py-4 border border-dashed border-[#E1E3DB] rounded-lg text-xs text-stone-500">
                            No variants yet for this product.
                        </div>
                    ) : (
                        <div className="border border-[#E1E3DB] rounded-lg overflow-hidden bg-white">
                            <table className="min-w-full divide-y divide-[#E1E3DB] text-xs">
                                <thead className="bg-[#F8F9F6] text-stone-600 uppercase font-semibold">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Variant</th>
                                        <th className="px-3 py-2 text-left">Sales Price</th>
                                        <th className="px-3 py-2 text-left">Description</th>
                                        <th className="px-3 py-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E1E3DB]">
                                    {variants.map(v => (
                                        <tr key={v.id} className="hover:bg-[#FAFBF9]">
                                            <td className="px-3 py-2 font-medium text-stone-900 flex items-center gap-2">
                                                {v.images ? (
                                                    <img src={v.images} alt={v.name} className="w-6 h-6 rounded object-cover border border-[#E1E3DB]" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded bg-[#EEF0EA] border border-[#E1E3DB] flex items-center justify-center text-[10px] text-stone-400">
                                                        V
                                                    </div>
                                                )}
                                                <span>{v.name}</span>
                                            </td>
                                            <td className="px-3 py-2 font-semibold text-stone-900">
                                                ${(v.sales_price / 100).toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2 text-stone-500 truncate max-w-[150px]">
                                                {v.description || '-'}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditVariant(v)}
                                                    className="text-stone-600 hover:text-[#2E6E52] p-1"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteVariant(v.id)}
                                                    className="text-red-500 hover:text-red-700 p-1"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                <div className="mt-4 p-3 bg-[#F8F9F6] border border-[#E1E3DB] rounded-lg text-xs text-stone-500">
                    💡 Tip: Save this product first to add and manage specific Product Variants (e.g. sizes, colors).
                </div>
            )}
        </div>
    );
};

export default ProductForm;
