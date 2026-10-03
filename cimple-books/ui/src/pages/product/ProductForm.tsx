import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit2, X, Receipt, Package } from 'lucide-react';
import { 
    createProduct, 
    updateProduct, 
    listProductVariants,
    createProductVariant,
    updateProductVariant,
    deleteProductVariant,
    listAccounts,
    listTaxes,
    getCurrencySymbol,
    type Product, 
    type ProductVariant, 
    type Category,
    type Account,
    type Tax
} from '../../lib/api';
import { SpaceImagePicker } from '../../components/SpaceImagePicker';

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

    // Inventory & Variant settings
    const [trackInventory, setTrackInventory] = useState(true);
    const [hasVariants, setHasVariants] = useState(false);

    // Accounting & Tax settings
    const [salesAccountId, setSalesAccountId] = useState<number | undefined>(undefined);
    const [purchaseAccountId, setPurchaseAccountId] = useState<number | undefined>(undefined);
    const [taxId, setTaxId] = useState<number | undefined>(undefined);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [taxes, setTaxes] = useState<Tax[]>([]);

    // Variants state
    const [variants, setVariants] = useState<ProductVariant[]>([]);
    const [loadingVariants, setLoadingVariants] = useState(false);
    const [editingVariantId, setEditingVariantId] = useState<number | null>(null);
    const [variantName, setVariantName] = useState('');
    const [variantDesc, setVariantDesc] = useState('');
    const [variantPrice, setVariantPrice] = useState('');
    const [variantStockCount, setVariantStockCount] = useState('0');
    const [variantImage, setVariantImage] = useState('');
    const [showVariantForm, setShowVariantForm] = useState(false);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const salesAccounts = useMemo(
        () => accounts.filter((a) => !a.is_deleted && a.acc_type === 'revenue'),
        [accounts]
    );

    const purchaseExpenseAccounts = useMemo(
        () => accounts.filter((a) => !a.is_deleted && a.acc_type === 'expenses'),
        [accounts]
    );

    const purchaseAssetAccounts = useMemo(
        () => accounts.filter((a) => !a.is_deleted && a.acc_type === 'assets'),
        [accounts]
    );

    const currentInvalidSalesAccount = useMemo(() => {
        if (!salesAccountId) return null;
        if (salesAccounts.some((a) => a.id === salesAccountId)) return null;
        return accounts.find((a) => a.id === salesAccountId) || null;
    }, [salesAccountId, salesAccounts, accounts]);

    const currentInvalidPurchaseAccount = useMemo(() => {
        if (!purchaseAccountId) return null;
        if (purchaseExpenseAccounts.some((a) => a.id === purchaseAccountId)) return null;
        if (purchaseAssetAccounts.some((a) => a.id === purchaseAccountId)) return null;
        return accounts.find((a) => a.id === purchaseAccountId) || null;
    }, [purchaseAccountId, purchaseExpenseAccounts, purchaseAssetAccounts, accounts]);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [accResp, taxResp] = await Promise.all([
                    listAccounts(),
                    listTaxes(),
                ]);
                if (accResp.status === 200) setAccounts(accResp.data || []);
                if (taxResp.status === 200) setTaxes(taxResp.data || []);
            } catch (err) {
                console.error('Failed to load accounts/taxes', err);
            }
        };
        loadInitialData();
    }, []);

    useEffect(() => {
        if (product) {
            setName(product.name || '');
            setInfo(product.info || '');
            setCategoryId(product.catagory_id || 0);
            setSalesPrice(product.sales_price > 0 ? (product.sales_price / 100).toFixed(2) : '');
            setStockCount(product.stock_count || 0);
            setTrackInventory(product.track_inventory !== false && product.track_inventory !== (0 as any));
            setHasVariants(Boolean(product.has_variants || (product.variants && product.variants.length > 0)));
            setSalesAccountId(product.sales_account_id ?? undefined);
            setPurchaseAccountId(product.purchase_account_id ?? undefined);
            setTaxId(product.tax_id ?? undefined);

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
            setTrackInventory(true);
            setHasVariants(false);
            setSalesAccountId(undefined);
            setPurchaseAccountId(undefined);
            setTaxId(undefined);
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
            stock_count: parseInt(variantStockCount, 10) || 0,
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
        setVariantStockCount('0');
        setVariantImage('');
        setShowVariantForm(false);
    };

    const handleEditVariant = (v: ProductVariant) => {
        setEditingVariantId(v.id);
        setVariantName(v.name);
        setVariantDesc(v.description || '');
        setVariantPrice((v.sales_price / 100).toFixed(2));
        setVariantStockCount(String(v.stock_count || 0));
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

    const totalVariantStock = variants.reduce((sum, v) => sum + (v.stock_count || 0), 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const imgString = images.join(',');
 
            let effectiveStockCount = stockCount;
            if (!trackInventory && hasVariants) {
                effectiveStockCount = totalVariantStock;
            }

            const productData: Partial<Product> = {
                name: name.trim(),
                info: info.trim(),
                catagory_id: categoryId,
                sales_price: Math.round(parseFloat(salesPrice || '0') * 100),
                stock_count: effectiveStockCount,
                track_inventory: trackInventory,
                has_variants: hasVariants,
                sales_account_id: salesAccountId || null,
                purchase_account_id: purchaseAccountId || null,
                tax_id: taxId || null,
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
                        className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors"
                        placeholder="e.g., Organic Honey 500g"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                            Category *
                        </label>
                        <select
                            value={categoryId}
                            onChange={(e) => setCategoryId(parseInt(e.target.value))}
                            required
                            className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors bg-white"
                        >
                            <option value={0}>Select Category</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                            Sales Price ({getCurrencySymbol()}) *
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={salesPrice}
                            onChange={(e) => setSalesPrice(e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors"
                            placeholder="0.00"
                        />
                    </div>
                </div>

                {/* Inventory & Variations */}
                <div className="p-4 bg-[#FAFBF9] rounded-xl border border-[#E1E3DB] space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-sm font-bold text-stone-900">Track Inventory</span>
                            <p className="text-xs text-stone-500">
                                {trackInventory ? "Automatic from Stock In" : "Direct manual stock entry"}
                            </p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={trackInventory}
                            onClick={() => setTrackInventory(!trackInventory)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                trackInventory ? 'bg-[#2E6E52]' : 'bg-stone-300'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    trackInventory ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#E1E3DB] pt-3">
                        <div>
                            <span className="text-sm font-bold text-stone-900">Has Variants</span>
                            <p className="text-xs text-stone-500">Enable multiple variations (size, color, pack)</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={hasVariants}
                            onClick={() => setHasVariants(!hasVariants)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                hasVariants ? 'bg-[#2E6E52]' : 'bg-stone-300'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    hasVariants ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    {trackInventory ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
                            <Package className="w-4 h-4 text-[#2E6E52] flex-shrink-0" />
                            <span>Tracked via Stock In ({stockCount} units in stock)</span>
                        </div>
                    ) : hasVariants ? (
                        <div className="p-3 bg-stone-100 border border-stone-200 rounded-lg text-xs text-stone-800 flex items-center justify-between">
                            <span>Total Variant Stock:</span>
                            <span className="font-bold">{totalVariantStock} units</span>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-semibold text-stone-700 mb-1">
                                Stock Count
                            </label>
                            <input
                                type="number"
                                value={stockCount}
                                onChange={(e) => setStockCount(parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg text-sm bg-white"
                                placeholder="0"
                            />
                        </div>
                    )}
                </div>

                {/* Accounting & Taxes */}
                <div className="p-4 bg-[#FAFBF9] rounded-xl border border-[#E1E3DB] space-y-3">
                    <span className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-[#2E6E52]" />
                        Accounting & Taxes
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-stone-700 mb-1">Sales Account</label>
                            <select
                                value={salesAccountId || ''}
                                onChange={(e) => setSalesAccountId(e.target.value ? parseInt(e.target.value) : undefined)}
                                className={`w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white ${currentInvalidSalesAccount ? 'border-amber-400 bg-amber-50/30' : 'border-[#E1E3DB]'}`}
                            >
                                <option value="">Default Sales</option>
                                {currentInvalidSalesAccount && (
                                    <option value={currentInvalidSalesAccount.id} disabled className="text-red-600 bg-red-50 font-medium">
                                        ⚠️ Current: {currentInvalidSalesAccount.name} ({currentInvalidSalesAccount.acc_type}) - Invalid: must be Revenue
                                    </option>
                                )}
                                <optgroup label="REVENUE">
                                    {salesAccounts.map((a) => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-stone-700 mb-1">Purchase Account</label>
                            <select
                                value={purchaseAccountId || ''}
                                onChange={(e) => setPurchaseAccountId(e.target.value ? parseInt(e.target.value) : undefined)}
                                className={`w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white ${currentInvalidPurchaseAccount ? 'border-amber-400 bg-amber-50/30' : 'border-[#E1E3DB]'}`}
                            >
                                <option value="">Default Purchase</option>
                                {currentInvalidPurchaseAccount && (
                                    <option value={currentInvalidPurchaseAccount.id} disabled className="text-red-600 bg-red-50 font-medium">
                                        ⚠️ Current: {currentInvalidPurchaseAccount.name} ({currentInvalidPurchaseAccount.acc_type}) - Invalid: must be Expense or Asset
                                    </option>
                                )}
                                {purchaseExpenseAccounts.length > 0 && (
                                    <optgroup label="EXPENSES (COGS / COST)">
                                        {purchaseExpenseAccounts.map((a) => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </optgroup>
                                )}
                                {purchaseAssetAccounts.length > 0 && (
                                    <optgroup label="ASSETS (INVENTORY)">
                                        {purchaseAssetAccounts.map((a) => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-stone-700 mb-1">Tax Rate</label>
                            <select
                                value={taxId || ''}
                                onChange={(e) => setTaxId(e.target.value ? parseInt(e.target.value) : undefined)}
                                className="w-full px-2.5 py-1.5 border border-[#E1E3DB] rounded-lg text-xs bg-white"
                            >
                                <option value="">None (0%)</option>
                                {taxes.map((t) => (
                                    <option key={t.id} value={t.id}>{t.name} ({(t.rate / 100).toFixed(t.rate % 100 === 0 ? 0 : 2)}%)</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                        Description & Notes
                    </label>
                    <textarea
                        value={info}
                        onChange={(e) => setInfo(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors"
                        placeholder="Details, ingredients, dimensions, warranty, or other specifications"
                    />
                </div>

                {/* Product Pictures */}
                <div className="border border-[#E1E3DB] rounded-lg p-4 bg-stone-50/50">
                    <SpaceImagePicker
                        multiple
                        label="Product Pictures"
                        description="Upload photos from device, browse Potatoverse Space files, or link URLs"
                        folderPath="cimple-books/products"
                        value={images}
                        onChange={(val) => setImages(val as string[])}
                    />
                </div>

                {/* Variants Section */}
                {hasVariants && (
                    <div className="border border-[#E1E3DB] rounded-lg p-4 bg-stone-50/50">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <label className="block text-sm font-semibold text-stone-700">
                                    Product Variants
                                </label>
                                <span className="text-xs text-stone-500">
                                    {variants.length} variations
                                </span>
                            </div>
                            {product?.id && !showVariantForm && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        resetVariantForm();
                                        setShowVariantForm(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#2E6E52] text-white rounded-lg text-xs font-semibold"
                                >
                                    <Plus className="w-3 h-3" />
                                    Add Variant
                                </button>
                            )}
                        </div>

                        {showVariantForm && product?.id && (
                            <div className="mb-3 p-3 bg-white border border-[#2E6E52]/40 rounded-lg space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-stone-800">
                                        {editingVariantId ? 'Edit Variant' : 'New Variant'}
                                    </span>
                                    <button type="button" onClick={resetVariantForm} className="text-stone-400">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <input
                                        type="text"
                                        value={variantName}
                                        onChange={(e) => setVariantName(e.target.value)}
                                        placeholder="Variant name *"
                                        className="px-2.5 py-1.5 text-xs border rounded-lg"
                                        required
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={variantPrice}
                                        onChange={(e) => setVariantPrice(e.target.value)}
                                        placeholder={`Price (${getCurrencySymbol()})`}
                                        className="px-2.5 py-1.5 text-xs border rounded-lg"
                                    />
                                    <input
                                        type="number"
                                        value={variantStockCount}
                                        onChange={(e) => setVariantStockCount(e.target.value)}
                                        disabled={trackInventory}
                                        placeholder="Stock Count"
                                        className={`px-2.5 py-1.5 text-xs border rounded-lg ${trackInventory ? 'bg-stone-100 text-stone-400' : ''}`}
                                    />
                                </div>
                                <div className="flex justify-end gap-1.5 pt-1">
                                    <button
                                        type="button"
                                        onClick={resetVariantForm}
                                        className="px-2.5 py-1 border text-stone-600 rounded text-xs"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveVariant}
                                        className="px-3 py-1 bg-[#2E6E52] text-white rounded text-xs font-semibold"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        )}

                        {!product?.id ? (
                            <p className="text-xs text-stone-400">
                                Save product first to manage specific variants.
                            </p>
                        ) : loadingVariants ? (
                            <p className="text-xs text-stone-400">Loading variants...</p>
                        ) : variants.length === 0 ? (
                            <p className="text-xs text-stone-400">No variants added yet.</p>
                        ) : (
                            <div className="space-y-1.5">
                                {variants.map(v => (
                                    <div key={v.id} className="flex items-center justify-between p-2 bg-white rounded border border-[#E1E3DB] text-xs">
                                        <div className="font-semibold text-stone-800">{v.name}</div>
                                        <div className="flex items-center gap-3">
                                            <span>{getCurrencySymbol()}{(v.sales_price / 100).toFixed(2)}</span>
                                            <span className="px-1.5 py-0.5 bg-stone-100 rounded text-stone-600">
                                                {v.stock_count || 0} in stock
                                            </span>
                                            <button type="button" onClick={() => handleEditVariant(v)} className="text-stone-500 hover:text-stone-800">
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button type="button" onClick={() => handleDeleteVariant(v.id)} className="text-red-500 hover:text-red-700">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E1E3DB]">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-5 py-2 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : (product ? 'Save Changes' : 'Create Product')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ProductForm;
