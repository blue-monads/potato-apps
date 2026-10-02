import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { ArrowLeft, Plus, Trash2, Edit2, Upload, Image as ImageIcon, X, Package, Save, Layers, Receipt } from 'lucide-react';
import { 
    getProduct,
    createProduct, 
    updateProduct, 
    listCategories,
    listProductVariants,
    createProductVariant,
    updateProductVariant,
    deleteProductVariant,
    uploadProductImage,
    listAccounts,
    listTaxes,
    getCurrencySymbol,
    type Product, 
    type ProductVariant, 
    type Category,
    type Account,
    type Tax
} from '../../lib/api';
import { BASE_PATH } from '../../lib/base';

const ProductFormPage = () => {
    const { id } = useParams<{ id?: string }>();
    const isEdit = Boolean(id);
    const productId = id ? parseInt(id, 10) : undefined;
    const navigate = useNavigate();

    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [taxes, setTaxes] = useState<Tax[]>([]);
    const [loading, setLoading] = useState(true);

    // Form fields
    const [name, setName] = useState('');
    const [info, setInfo] = useState('');
    const [categoryId, setCategoryId] = useState(0);
    const [salesPrice, setSalesPrice] = useState('');
    const [stockCount, setStockCount] = useState(0);
    const [images, setImages] = useState<string[]>([]);
    const [newImageUrl, setNewImageUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    // Inventory & Variant settings
    const [trackInventory, setTrackInventory] = useState(true);
    const [hasVariants, setHasVariants] = useState(false);

    // Accounting & Tax settings
    const [salesAccountId, setSalesAccountId] = useState<number | undefined>(undefined);
    const [purchaseAccountId, setPurchaseAccountId] = useState<number | undefined>(undefined);
    const [taxId, setTaxId] = useState<number | undefined>(undefined);

    // Variants state
    const [variants, setVariants] = useState<ProductVariant[]>([]);
    const [loadingVariants, setLoadingVariants] = useState(false);
    const [editingVariantId, setEditingVariantId] = useState<number | null>(null);
    const [variantName, setVariantName] = useState('');
    const [variantDesc, setVariantDesc] = useState('');
    const [variantPrice, setVariantPrice] = useState('');
    const [variantStockCount, setVariantStockCount] = useState('0');
    const [variantImage, setVariantImage] = useState('');
    const [isUploadingVariantImg, setIsUploadingVariantImg] = useState(false);
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
        const init = async () => {
            setLoading(true);
            try {
                const [catResp, accResp, taxResp] = await Promise.all([
                    listCategories(),
                    listAccounts(),
                    listTaxes(),
                ]);

                const fetchedCategories = catResp.status === 200 ? (catResp.data || []) : [];
                setCategories(fetchedCategories);

                if (accResp.status === 200) {
                    setAccounts(accResp.data || []);
                }

                if (taxResp.status === 200) {
                    setTaxes(taxResp.data || []);
                }

                if (isEdit && productId) {
                    const prodResp = await getProduct(productId);
                    if (prodResp.status === 200 && prodResp.data) {
                        const prod = prodResp.data;
                        setName(prod.name || '');
                        setInfo(prod.info || '');
                        setCategoryId(prod.catagory_id || 0);
                        setSalesPrice(prod.sales_price > 0 ? (prod.sales_price / 100).toFixed(2) : '');
                        setStockCount(prod.stock_count || 0);
                        setTrackInventory(prod.track_inventory !== false && prod.track_inventory !== (0 as any));
                        setHasVariants(Boolean(prod.has_variants || (prod.variants && prod.variants.length > 0)));
                        setSalesAccountId(prod.sales_account_id ?? undefined);
                        setPurchaseAccountId(prod.purchase_account_id ?? undefined);
                        setTaxId(prod.tax_id ?? undefined);

                        const imgList: string[] = [];
                        if (prod.images) {
                            prod.images.split(',').forEach(s => {
                                const trimmed = s.trim();
                                if (trimmed && !imgList.includes(trimmed)) imgList.push(trimmed);
                            });
                        }
                        if (prod.image && !imgList.includes(prod.image)) {
                            imgList.unshift(prod.image);
                        }
                        setImages(imgList);

                        if (prod.variants && prod.variants.length > 0) {
                            setVariants(prod.variants);
                        } else {
                            loadVariants(productId);
                        }
                    } else {
                        setError(prodResp.error || 'Failed to load product');
                    }
                } else if (fetchedCategories.length > 0) {
                    setCategoryId(fetchedCategories[0].id);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load data');
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [isEdit, productId]);

    const loadVariants = async (prodId: number) => {
        setLoadingVariants(true);
        try {
            const resp = await listProductVariants(prodId);
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
        if (!productId) {
            alert('Please save the product first before adding variants.');
            return;
        }
        if (!variantName.trim()) {
            alert('Variant name is required');
            return;
        }

        const priceInCents = Math.round(parseFloat(variantPrice || salesPrice || '0') * 100);
        const variantData: Partial<ProductVariant> = {
            product_id: productId,
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
                    await loadVariants(productId);
                } else {
                    alert(resp.error || 'Failed to update variant');
                }
            } else {
                const resp = await createProductVariant(productId, variantData);
                if (resp.status === 200) {
                    resetVariantForm();
                    await loadVariants(productId);
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
            if (resp.status === 200 && productId) {
                await loadVariants(productId);
            } else {
                alert(resp.error || 'Failed to delete variant');
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete variant');
        }
    };

    // Derived stock count based on rules:
    // If track_inventory is enabled -> stock comes from stockin / stockinlines (backend handles it)
    // If track_inventory is disabled -> if has_variants, use variants sum; else use direct stock_count
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
            if (isEdit && productId) {
                resp = await updateProduct(productId, productData);
            } else {
                resp = await createProduct(productData);
            }

            if (resp.status === 200) {
                navigate(`${BASE_PATH}products`);
            } else {
                setError(resp.error || 'Failed to save product');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save product');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F4F5F1] p-6 lg:p-8 flex items-center justify-center font-sans">
                <div className="text-stone-500">Loading product...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F4F5F1] p-6 lg:p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                {/* Navigation header */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <Link
                            to={`${BASE_PATH}products`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-[#2E6E52] mb-2 transition-colors"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Back to Products
                        </Link>
                        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 font-display">
                            {isEdit ? `Edit Product: ${name || 'Product'}` : 'New Product'}
                        </h1>
                        <p className="text-xs text-stone-500 mt-1">
                            {isEdit ? 'Update product details, inventory tracking, accounts, and variants' : 'Create a new catalogue item with pricing, inventory controls, and variants'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            to={`${BASE_PATH}products`}
                            className="px-4 py-2 border border-[#E1E3DB] text-stone-700 bg-white hover:bg-[#F4F5F1] rounded-lg transition-colors font-medium text-sm"
                        >
                            Cancel
                        </Link>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg transition-colors font-semibold text-sm shadow-sm disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Product')}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* CARD 1: GENERAL INFORMATION */}
                    <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-sm p-6">
                        <h2 className="text-base font-bold text-stone-900 font-display mb-4 flex items-center gap-2">
                            <Package className="w-4 h-4 text-[#2E6E52]" />
                            General Information
                        </h2>

                        <div className="space-y-4">
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

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                        className="w-full px-3.5 py-2.5 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors"
                                        placeholder="0.00"
                                    />
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
                                    className="w-full px-3.5 py-2.5 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors"
                                    placeholder="Details, ingredients, dimensions, warranty, or other item specifications"
                                />
                            </div>
                        </div>
                    </div>

                    {/* CARD 2: INVENTORY & VARIATION CONFIGURATION */}
                    <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-sm p-6">
                        <h2 className="text-base font-bold text-stone-900 font-display mb-4 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-[#2E6E52]" />
                            Inventory & Variations
                        </h2>

                        <div className="space-y-4">
                            {/* Toggle 1: Track Inventory */}
                            <div className="flex items-center justify-between p-4 bg-[#FAFBF9] rounded-xl border border-[#E1E3DB]">
                                <div className="pr-4">
                                    <label className="text-sm font-bold text-stone-900 flex items-center gap-2">
                                        Track Inventory
                                    </label>
                                    <p className="text-xs text-stone-500 mt-0.5">
                                        {trackInventory 
                                            ? "Inventory tracking is ON: stock count is automatically derived from Stock In vouchers." 
                                            : "Inventory tracking is OFF: stock count is entered directly (or managed via variants)."}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={trackInventory}
                                    onClick={() => setTrackInventory(!trackInventory)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
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

                            {/* Toggle 2: Has Variants */}
                            <div className="flex items-center justify-between p-4 bg-[#FAFBF9] rounded-xl border border-[#E1E3DB]">
                                <div className="pr-4">
                                    <label className="text-sm font-bold text-stone-900 flex items-center gap-2">
                                        Has Variants
                                    </label>
                                    <p className="text-xs text-stone-500 mt-0.5">
                                        Enable if this item has multiple options such as size, color, pack quantity, or flavor.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={hasVariants}
                                    onClick={() => setHasVariants(!hasVariants)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
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

                            {/* Stock Count Field or Notification */}
                            {trackInventory ? (
                                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-3">
                                    <Package className="w-4 h-4 text-[#2E6E52] mt-0.5 flex-shrink-0" />
                                    <div>
                                        <div className="font-semibold text-sm text-[#2E6E52]">
                                            Tracked via Stock In ({stockCount} units in stock)
                                        </div>
                                        <p className="mt-0.5 text-stone-600">
                                            Stock count is automatically calculated from Stock In records. Direct manual edits are disabled when inventory tracking is active.
                                        </p>
                                    </div>
                                </div>
                            ) : hasVariants ? (
                                <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 flex items-start justify-between gap-3">
                                    <div>
                                        <div className="font-semibold text-sm text-stone-900">
                                            Stock Count Managed via Variants
                                        </div>
                                        <p className="mt-0.5 text-stone-600">
                                            Each variant defines its own stock count below. The product's total stock is the sum of all variant stocks.
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0 text-right">
                                        <span className="inline-block px-3 py-1 bg-stone-200 text-stone-800 font-bold rounded-lg text-sm">
                                            {totalVariantStock} units total
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                                        Stock Count
                                    </label>
                                    <input
                                        type="number"
                                        value={stockCount}
                                        onChange={(e) => setStockCount(parseInt(e.target.value) || 0)}
                                        className="w-full px-3.5 py-2.5 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors max-w-xs"
                                        placeholder="0"
                                    />
                                    <p className="text-xs text-stone-500 mt-1">Directly enter the physical inventory on hand.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CARD 3: ACCOUNTING & TAXES */}
                    <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-sm p-6">
                        <h2 className="text-base font-bold text-stone-900 font-display mb-4 flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-[#2E6E52]" />
                            Accounting & Taxes
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                                    Sales Account
                                </label>
                                <select
                                    value={salesAccountId || ''}
                                    onChange={(e) => setSalesAccountId(e.target.value ? parseInt(e.target.value) : undefined)}
                                    className={`w-full px-3.5 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors bg-white text-sm ${currentInvalidSalesAccount ? 'border-amber-400 bg-amber-50/30' : 'border-[#E1E3DB]'}`}
                                >
                                    <option value="">Default Sales Account</option>
                                    {currentInvalidSalesAccount && (
                                        <option value={currentInvalidSalesAccount.id} disabled className="text-red-600 bg-red-50 font-medium">
                                            ⚠️ Current: {currentInvalidSalesAccount.name} ({currentInvalidSalesAccount.acc_type}) - Invalid: must be Revenue
                                        </option>
                                    )}
                                    <optgroup label="REVENUE">
                                        {salesAccounts.map((acc) => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                </select>
                                <p className="text-xs text-stone-500 mt-1">Revenue credited on sales (Revenue accounts only)</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                                    Purchase Account
                                </label>
                                <select
                                    value={purchaseAccountId || ''}
                                    onChange={(e) => setPurchaseAccountId(e.target.value ? parseInt(e.target.value) : undefined)}
                                    className={`w-full px-3.5 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors bg-white text-sm ${currentInvalidPurchaseAccount ? 'border-amber-400 bg-amber-50/30' : 'border-[#E1E3DB]'}`}
                                >
                                    <option value="">Default Purchase Account</option>
                                    {currentInvalidPurchaseAccount && (
                                        <option value={currentInvalidPurchaseAccount.id} disabled className="text-red-600 bg-red-50 font-medium">
                                            ⚠️ Current: {currentInvalidPurchaseAccount.name} ({currentInvalidPurchaseAccount.acc_type}) - Invalid: must be Expense or Asset
                                        </option>
                                    )}
                                    {purchaseExpenseAccounts.length > 0 && (
                                        <optgroup label="EXPENSES (COGS / COST)">
                                            {purchaseExpenseAccounts.map((acc) => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {purchaseAssetAccounts.length > 0 && (
                                        <optgroup label="ASSETS (INVENTORY)">
                                            {purchaseAssetAccounts.map((acc) => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                                <p className="text-xs text-stone-500 mt-1">Cost debited on purchases (Expense or Asset accounts only)</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                                    Tax Rate
                                </label>
                                <select
                                    value={taxId || ''}
                                    onChange={(e) => setTaxId(e.target.value ? parseInt(e.target.value) : undefined)}
                                    className="w-full px-3.5 py-2.5 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors bg-white text-sm"
                                >
                                    <option value="">None / Tax Exempt (0%)</option>
                                    {taxes.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name} ({(t.rate / 100).toFixed(t.rate % 100 === 0 ? 0 : 2)}%)
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-stone-500 mt-1">Applicable sales/VAT tax</p>
                            </div>
                        </div>
                    </div>

                    {/* CARD 4: PRODUCT PICTURES */}
                    <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-bold text-stone-900 font-display flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4 text-[#2E6E52]" />
                                    Product Pictures
                                </h2>
                                <p className="text-xs text-stone-500 mt-0.5">Upload photos or paste public image links</p>
                            </div>
                            <span className="text-xs text-stone-500 font-medium">
                                {images.length} {images.length === 1 ? 'image' : 'images'}
                            </span>
                        </div>

                        {/* Gallery Previews */}
                        {images.length > 0 && (
                            <div className="flex flex-wrap gap-4 mb-4">
                                {images.map((imgUrl, idx) => (
                                    <div key={idx} className="relative group w-24 h-24 rounded-xl overflow-hidden border border-[#E1E3DB] bg-[#F4F5F1] shadow-sm">
                                        <img src={imgUrl} alt={`Product image ${idx + 1}`} className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveImage(idx)}
                                            className="absolute top-1.5 right-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Remove image"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                        {idx === 0 && (
                                            <span className="absolute bottom-0 left-0 right-0 bg-[#2E6E52]/90 text-white text-[10px] text-center font-medium py-0.5 tracking-wider uppercase">
                                                Cover
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Upload & URL input */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FAFBF9] border border-[#E1E3DB] hover:bg-[#EEF0EA] text-stone-700 text-sm font-medium rounded-lg transition-colors">
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
                                    placeholder="Or paste image URL (https://...)..."
                                    className="flex-1 px-3.5 py-2.5 border border-[#E1E3DB] bg-[#FAFBF9] rounded-lg text-sm focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddImageUrl}
                                    disabled={!newImageUrl.trim()}
                                    className="px-4 py-2.5 bg-stone-200 hover:bg-stone-300 disabled:opacity-50 text-stone-700 rounded-lg text-sm font-semibold transition-colors"
                                >
                                    Add URL
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* CARD 5: PRODUCT VARIANTS */}
                    {hasVariants ? (
                        <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-sm p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-base font-bold text-stone-900 font-display">Product Variants</h2>
                                    <p className="text-xs text-stone-500 mt-0.5">Manage variations like size, color, pack size, or flavor</p>
                                </div>
                                {isEdit && !showVariantForm && (
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

                            {/* Variant Form (Only in edit mode) */}
                            {showVariantForm && isEdit && (
                                <div className="mb-4 p-4 border border-[#2E6E52]/30 bg-[#FAFBF9] rounded-xl space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-stone-800">
                                            {editingVariantId ? 'Edit Variant' : 'New Variant'}
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={resetVariantForm}
                                            className="text-stone-400 hover:text-stone-600"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-stone-700 mb-1">
                                                Variant Name *
                                            </label>
                                            <input
                                                type="text"
                                                value={variantName}
                                                onChange={(e) => setVariantName(e.target.value)}
                                                placeholder="e.g., Large / 100-pack / Red"
                                                className="w-full px-3 py-2 text-sm border border-[#E1E3DB] rounded-lg bg-white focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-stone-700 mb-1">
                                                Sales Price ({getCurrencySymbol()})
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={variantPrice}
                                                onChange={(e) => setVariantPrice(e.target.value)}
                                                placeholder={salesPrice || '0.00'}
                                                className="w-full px-3 py-2 text-sm border border-[#E1E3DB] rounded-lg bg-white focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-stone-700 mb-1">
                                                Stock Count {trackInventory ? '(Tracked via Stock In)' : ''}
                                            </label>
                                            <input
                                                type="number"
                                                value={variantStockCount}
                                                onChange={(e) => setVariantStockCount(e.target.value)}
                                                disabled={trackInventory}
                                                placeholder="0"
                                                className={`w-full px-3 py-2 text-sm border border-[#E1E3DB] rounded-lg outline-none ${
                                                    trackInventory ? 'bg-stone-100 text-stone-500 cursor-not-allowed' : 'bg-white focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52]'
                                                }`}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                                            Description
                                        </label>
                                        <input
                                            type="text"
                                            value={variantDesc}
                                            onChange={(e) => setVariantDesc(e.target.value)}
                                            placeholder="Optional description"
                                            className="w-full px-3 py-2 text-sm border border-[#E1E3DB] rounded-lg bg-white focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none"
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
                                                className="flex-1 px-3 py-2 text-sm border border-[#E1E3DB] rounded-lg bg-white focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none"
                                            />
                                            <label className="cursor-pointer px-3 py-2 bg-white border border-[#E1E3DB] hover:bg-[#EEF0EA] rounded-lg text-xs font-medium text-stone-700">
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

                            {/* Variants List or Callout */}
                            {!isEdit ? (
                                <div className="p-4 bg-[#FAFBF9] border border-dashed border-[#E1E3DB] rounded-xl text-center">
                                    <p className="text-xs text-stone-500">
                                        💡 You can add specific product variants (sizes, flavors, bundles) after creating the product.
                                    </p>
                                </div>
                            ) : loadingVariants ? (
                                <div className="text-center py-4 text-xs text-stone-500">Loading variants...</div>
                            ) : variants.length === 0 ? (
                                <div className="p-4 bg-[#FAFBF9] border border-dashed border-[#E1E3DB] rounded-xl text-center">
                                    <p className="text-xs text-stone-500">No variants added yet. Click "Add Variant" to create one.</p>
                                </div>
                            ) : (
                                <div className="border border-[#E1E3DB] rounded-xl overflow-hidden">
                                    <table className="min-w-full divide-y divide-[#E1E3DB] text-sm">
                                        <thead className="bg-[#F8F9F6] text-stone-600 uppercase font-semibold text-xs">
                                            <tr>
                                                <th className="px-4 py-3 text-left">Variant</th>
                                                <th className="px-4 py-3 text-left">Sales Price</th>
                                                <th className="px-4 py-3 text-left">Stock</th>
                                                <th className="px-4 py-3 text-left">Description</th>
                                                <th className="px-4 py-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#E1E3DB] bg-white">
                                            {variants.map(v => (
                                                <tr key={v.id} className="hover:bg-[#FAFBF9]">
                                                    <td className="px-4 py-3 font-semibold text-stone-900 flex items-center gap-2.5">
                                                        {v.images ? (
                                                            <img src={v.images} alt={v.name} className="w-8 h-8 rounded-lg object-cover border border-[#E1E3DB]" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-lg bg-[#EEF0EA] border border-[#E1E3DB] flex items-center justify-center text-xs text-stone-400 font-bold">
                                                                V
                                                            </div>
                                                        )}
                                                        <span>{v.name}</span>
                                                    </td>
                                                    <td className="px-4 py-3 font-semibold text-stone-900">
                                                        {getCurrencySymbol()}{(v.sales_price / 100).toFixed(2)}
                                                    </td>
                                                    <td className="px-4 py-3 text-stone-700">
                                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${(v.stock_count || 0) > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>
                                                            {v.stock_count || 0} {trackInventory ? '(Tracked)' : ''}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-stone-500 text-xs">
                                                        {v.description || '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEditVariant(v)}
                                                                className="text-stone-600 hover:text-[#2E6E52] p-1.5 hover:bg-[#EEF0EA] rounded-lg transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteVariant(v.id)}
                                                                className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-sm p-6">
                            <h2 className="text-base font-bold text-stone-900 font-display mb-1 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-stone-400" />
                                Product Variants
                            </h2>
                            <p className="text-xs text-stone-500">
                                Variations are disabled for this product. Enable the <strong className="text-stone-700">Has Variants</strong> toggle above to manage multiple sizes, colors, or package bundles.
                            </p>
                        </div>
                    )}

                    {/* Bottom Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E1E3DB]">
                        <Link
                            to={`${BASE_PATH}products`}
                            className="px-4 py-2.5 border border-[#E1E3DB] text-stone-700 bg-white hover:bg-[#F4F5F1] rounded-lg transition-colors font-medium text-sm"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg transition-colors font-semibold text-sm shadow-sm disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Product')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductFormPage;
