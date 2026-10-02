import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Plus, Trash2, ArrowLeft, Edit2 } from 'lucide-react';
import { createSale, updateSale, getSale, getCurrencySymbol, listAccounts, getSettings, type Sale, type Account } from '../../lib/api';
import { BASE_PATH } from '../../lib/base';
import { useModal } from '../../lib/shared/modal/modal';
import SalesItemPicker from './components/SalesItemPicker';
import ContactPicker from '../../components/ContactPicker';
// import OverallDiscountPicker from './components/OverallDiscountPicker';
// import OverallTaxPicker from './components/OverallTaxPicker';

interface SalesLine {
    info: string;
    qty: number;
    product_id: number;
    variant_id?: number;
    price: number;
    amount: number; // discounted price per unit
    tax_amount: number;
    discount_amount: number;
    total_amount: number;
}

const SalesForm = () => {
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const isEditMode = !!id;
    
    const [sale, setSale] = useState<Sale | null>(null);
    const [loading, setLoading] = useState(isEditMode);
    const [title, setTitle] = useState('');
    const [clientContactId, setClientContactId] = useState<number | null>(null);
    const [clientAltName, setClientAltName] = useState('');
    const [notes, setNotes] = useState('');
    const [salesDate, setSalesDate] = useState(new Date().toISOString().slice(0, 16));
    const [salesStatus, setSalesStatus] = useState('draft');
    const [paymentStatus, setPaymentStatus] = useState('unpaid');
    const [paymentAccountId, setPaymentAccountId] = useState<number | null>(null);
    const [assetAccounts, setAssetAccounts] = useState<Account[]>([]);
    const [lines, setLines] = useState<SalesLine[]>([]);
    const [overallTaxAmount, setOverallTaxAmount] = useState(0);
    const [overallDiscountAmount, setOverallDiscountAmount] = useState(0);
    
    const { openModal } = useModal();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isLocked = isEditMode && (sale?.sales_status || salesStatus) !== 'draft';

    useEffect(() => {
        const loadSale = async () => {
            if (isEditMode && id) {
                setLoading(true);
                try {
                    const resp = await getSale(parseInt(id));
                    if (resp.status === 200 && resp.data) {
                        setSale(resp.data);
                    } else {
                        alert('Failed to load sale');
                        navigate(`${BASE_PATH}sales`);
                    }
                } catch (err) {
                    alert('Failed to load sale');
                    navigate(`${BASE_PATH}sales`);
                } finally {
                    setLoading(false);
                }
            }
        };
        loadSale();
    }, [id, isEditMode, navigate]);

    useEffect(() => {
        if (sale) {
            setTitle(sale.title || '');
            setSalesStatus(sale.sales_status || 'draft');
            setClientContactId(sale.client_contact_id || sale.client_id || null);
            setClientAltName(sale.client_alt_name || sale.client_name || '');
            setNotes(sale.notes || '');
            setSalesDate(sale.sales_date ? new Date(sale.sales_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16));
            setPaymentStatus(sale.payment_status || 'unpaid');
            setOverallTaxAmount(sale.overall_tax_amount || 0);
            setOverallDiscountAmount(sale.overall_discount_amount || 0);
            if (sale.lines && sale.lines.length > 0) {
                setLines(sale.lines.map((line: any) => ({
                    info: line.info || '',
                    qty: line.qty || 0,
                    product_id: line.product_id || 0,
                    variant_id: line.variant_id || 0,
                    price: line.price || 0,
                    amount: line.price - (line.discount_amount || 0), // Calculate discounted price
                    tax_amount: line.tax_amount || 0,
                    discount_amount: line.discount_amount || 0,
                    total_amount: line.total_amount || 0,
                })));
            }
        } else if (!isEditMode) {
            setTitle('');
            setClientContactId(null);
            setClientAltName('');
            setNotes('');
            setSalesDate(new Date().toISOString().slice(0, 16));
            setPaymentStatus('unpaid');
            setOverallTaxAmount(0);
            setOverallDiscountAmount(0);
            setLines([]);
        }
    }, [sale, isEditMode]);

    useEffect(() => {
        const loadAccountsAndSettings = async () => {
            try {
                const [accResp, setResp] = await Promise.all([
                    listAccounts(),
                    getSettings()
                ]);
                if (accResp.status === 200 && Array.isArray(accResp.data)) {
                    const assets = accResp.data.filter(a => !a.is_deleted && a.acc_type === 'assets');
                    setAssetAccounts(assets);
                }
                if (setResp.status === 200 && setResp.data?.default_payment_account_id) {
                    setPaymentAccountId(setResp.data.default_payment_account_id);
                }
            } catch {
                // ignore
            }
        };
        loadAccountsAndSettings();
    }, []);

    // Calculate totals
    const totalItemPrice = lines.reduce((sum, line) => sum + (line.price * line.qty), 0);
    const totalItemTaxAmount = lines.reduce((sum, line) => sum + (line.tax_amount * line.qty), 0);
    const totalItemDiscountAmount = lines.reduce((sum, line) => sum + (line.discount_amount * line.qty), 0);
    const subTotal = lines.reduce((sum, line) => sum + line.total_amount, 0);
    const total = subTotal + overallTaxAmount - overallDiscountAmount;

    const openItemPicker = (editIndex?: number) => {
        const lineToEdit = editIndex !== undefined ? lines[editIndex] : undefined;
        openModal({
            title: editIndex !== undefined ? 'Edit Item' : 'Add Item',
            content: (
                <SalesItemPicker
                    initialLine={lineToEdit}
                    onSave={(line) => {
                        if (editIndex !== undefined) {
                            const updated = [...lines];
                            updated[editIndex] = line;
                            setLines(updated);
                        } else {
                            setLines([...lines, line]);
                        }
                    }}
                />
            ),
        });
    };

    // const openOverallDiscountPicker = () => {
    //     openModal({
    //         title: 'Overall Discount',
    //         content: (
    //             <OverallDiscountPicker
    //                 subTotal={subTotal}
    //                 currentDiscount={overallDiscountAmount}
    //                 onSet={(discount) => setOverallDiscountAmount(discount)}
    //             />
    //         ),
    //     });
    // };

    // const openOverallTaxPicker = () => {
    //     openModal({
    //         title: 'Overall Tax',
    //         content: (
    //             <OverallTaxPicker
    //                 subTotal={subTotal}
    //                 currentTax={overallTaxAmount}
    //                 onSet={(tax) => setOverallTaxAmount(tax)}
    //             />
    //         ),
    //     });
    // };

    const removeLine = (index: number) => {
        setLines(lines.filter((_, i) => i !== index));
    };

    const formatCurrency = (amount: number) => {
        return (amount / 100).toFixed(2);
    };

    const cs = getCurrencySymbol();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        if (isLocked) {
            setError('Cannot edit sale unless it is in draft state.');
            setSaving(false);
            return;
        }

        if (salesStatus === 'scrapped') {
            setError('Cannot set order status to scrapped directly. Use the scrap flow from the Products catalogue instead.');
            setSaving(false);
            return;
        }

        if (lines.length === 0) {
            setError('Sale must have at least one line item');
            setSaving(false);
            return;
        }

        try {
            const saleData = {
                title: title || undefined,
                sales_status: salesStatus,
                client_contact_id: clientContactId,
                client_alt_name: clientAltName.trim(),
                client_id: clientContactId || 0,
                client_name: clientAltName.trim() || undefined,
                notes: notes || undefined,
                total_item_price: totalItemPrice,
                total_item_tax_amount: totalItemTaxAmount,
                total_item_discount_amount: totalItemDiscountAmount,
                sub_total: subTotal,
                overall_discount_amount: overallDiscountAmount,
                overall_tax_amount: overallTaxAmount,
                total: total,
                sales_date: new Date(salesDate).toISOString(),
                payment_status: paymentStatus,
                payment_account_id: paymentStatus === 'paid' ? paymentAccountId : undefined,
                lines: lines.map(line => ({
                    info: line.info,
                    qty: line.qty,
                    product_id: line.product_id,
                    variant_id: line.variant_id || 0,
                    price: line.price,
                    tax_amount: line.tax_amount,
                    discount_amount: line.discount_amount || (line.price - line.amount) * line.qty,
                    total_amount: line.total_amount,
                })),
            };

            let resp;
            if (isEditMode && sale) {
                resp = await updateSale(sale.id, saleData);
            } else {
                resp = await createSale(saleData);
            }
            
            if (resp.status === 200) {
                navigate(`${BASE_PATH}sales`);
            } else {
                setError(resp.error || 'Failed to save sale');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save sale');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg text-gray-500">Loading sale...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F4F5F1] p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex items-center gap-4">
                    <Link
                        to={`${BASE_PATH}sales`}
                        className="p-2 text-[#5C645D] hover:text-[#1B2A21] hover:bg-[#EAECE4] rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-display font-semibold text-[#1B2A21]">
                            {isEditMode ? 'Edit Sale' : 'New Sale'}
                        </h1>
                        <p className="text-xs text-[#5C645D] mt-0.5">
                            {isEditMode ? 'Update sale information' : 'Create a new sale'}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-xl border border-[#E1E3DB] shadow-sm p-6">
                    {isLocked && (
                        <div className={`p-4 rounded-lg text-sm font-medium flex items-center gap-2 border ${
                            salesStatus === 'scrapped'
                                ? 'bg-purple-50 border-purple-200 text-purple-800'
                                : 'bg-amber-50 border-amber-200 text-amber-800'
                        }`}>
                            <span>
                                {salesStatus === 'scrapped' ? (
                                    <>This order is marked as <strong className="uppercase">SCRAPPED</strong> (write-off) and was generated from the product scrap workflow. It cannot be edited directly.</>
                                ) : (
                                    <>This sale is marked as <strong className="uppercase">{salesStatus}</strong> and cannot be edited. Only sales in <strong>draft</strong> state can be modified.</>
                                )}
                            </span>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                        Title
                    </label>
                    <input
                        type="text"
                        disabled={isLocked}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:outline-none focus:border-[#2E6E52] focus:ring-2 focus:ring-[#2E6E52]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                        placeholder="Sale title"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                        Date
                    </label>
                    <input
                        type="datetime-local"
                        disabled={isLocked}
                        value={salesDate}
                        onChange={(e) => setSalesDate(e.target.value)}
                        className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:outline-none focus:border-[#2E6E52] focus:ring-2 focus:ring-[#2E6E52]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <ContactPicker
                        label="Client / Customer"
                        filterRelation="customer"
                        placeholder="Select client (optional)..."
                        required={false}
                        disabled={isLocked}
                        value={clientContactId}
                        altName={clientAltName}
                        onChange={(cid, name) => {
                            if (isLocked) return;
                            setClientContactId(cid);
                            if (cid === null && name) {
                                setClientAltName(name);
                            }
                        }}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                        Payment Status
                    </label>
                    <select
                        value={paymentStatus}
                        disabled={isLocked}
                        onChange={(e) => setPaymentStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:outline-none focus:border-[#2E6E52] focus:ring-2 focus:ring-[#2E6E52]/20 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                    >
                        <option value="unpaid">Unpaid</option>
                        <option value="paid">Paid</option>
                        {paymentStatus === 'refunded' && (
                            <option value="refunded" disabled>Refunded (Legacy)</option>
                        )}
                    </select>

                    {paymentStatus === 'paid' && (
                        <div className="mt-2">
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                                Payment Account (Asset)
                            </label>
                            <select
                                value={paymentAccountId ?? ''}
                                disabled={isLocked}
                                onChange={(e) => setPaymentAccountId(e.target.value ? Number(e.target.value) : null)}
                                className="w-full px-3 py-1.5 border border-[#E1E3DB] rounded-lg focus:outline-none focus:border-[#2E6E52] focus:ring-2 focus:ring-[#2E6E52]/20 disabled:opacity-60 disabled:cursor-not-allowed text-xs bg-white"
                            >
                                <option value="">-- Default Cash / Bank Account --</option>
                                {assetAccounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.name} {acc.info ? `(${acc.info})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                        Client Alt Text
                    </label>
                    <input
                        type="text"
                        disabled={isLocked}
                        value={clientAltName}
                        onChange={(e) => setClientAltName(e.target.value)}
                        className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:outline-none focus:border-[#2E6E52] focus:ring-2 focus:ring-[#2E6E52]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                        placeholder="e.g. Cash Buyer, Walk-in, John Doe"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                        Sale Status
                    </label>
                    <select
                        value={salesStatus}
                        disabled={isLocked || salesStatus === 'scrapped'}
                        onChange={(e) => setSalesStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:outline-none focus:border-[#2E6E52] focus:ring-2 focus:ring-[#2E6E52]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <option value="draft">Draft</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="cancelled">Cancelled</option>
                        {salesStatus === 'scrapped' && (
                            <option value="scrapped" disabled>Scrapped (Created via Product Scrap Flow)</option>
                        )}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                    Notes
                </label>
                <textarea
                    value={notes}
                    disabled={isLocked}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:outline-none focus:border-[#2E6E52] focus:ring-2 focus:ring-[#2E6E52]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="Additional notes"
                />
            </div>

            {/* Sales Lines */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-[#1B2A21]">
                        Line Items *
                    </label>
                    {!isLocked && (
                        <button
                            type="button"
                            onClick={() => openItemPicker()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#2E6E52] text-white rounded-lg hover:bg-[#255842] shadow-sm transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Item
                        </button>
                    )}
                </div>

                {lines.length === 0 ? (
                    <div className="text-center py-8 text-[#5C645D] text-sm border border-[#E1E3DB] rounded-lg">
                        No items added. Click "Add Item" to add products.
                    </div>
                ) : (
                    <div className="border border-[#E1E3DB] rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-[#E1E3DB]">
                                <thead className="bg-[#F4F5F1]">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#5C645D] uppercase">Item</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-[#5C645D] uppercase">Qty</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-[#5C645D] uppercase">Unit Price</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-[#5C645D] uppercase">Tax</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-[#5C645D] uppercase">Subtotal</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-[#5C645D] uppercase"></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-[#E1E3DB]">
                                    {lines.map((line, index) => (
                                        <tr key={index} className="hover:bg-[#F4F5F1]/50">
                                            <td className="px-4 py-3 text-sm text-[#1B2A21]">
                                                {line.info}
                                                {line.discount_amount > 0 && (
                                                    <div className="text-xs text-[#5C645D] mt-1">
                                                        Original: {cs}{formatCurrency(line.price)} - Discount: {cs}{formatCurrency(line.discount_amount)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-[#1B2A21]">
                                                {line.qty}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-[#1B2A21]">
                                                {line.amount === line.price ? (
                                                    <span>{cs}{formatCurrency(line.amount)}</span>
                                                ) : (
                                                    <span>
                                                        <span className="line-through text-stone-400">{cs}{formatCurrency(line.price)}</span>
                                                        {' '}- ({formatCurrency(line.discount_amount)}) = <strong>{cs}{formatCurrency(line.amount)}</strong>
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-[#1B2A21]">
                                                {line.tax_amount > 0 ? `${cs}${formatCurrency(line.tax_amount)}` : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-medium text-[#1B2A21]">
                                                (
                                                <span>
                                                    {cs}{formatCurrency(line.price)}
                                                    {line.discount_amount > 0 && ` - ${cs}${formatCurrency(line.discount_amount)}`}
                                                    {line.tax_amount > 0 && ` + ${cs}${formatCurrency(line.tax_amount)}`}
                                                </span>
                                                ) × {line.qty} = <strong>{cs}{formatCurrency(line.total_amount)}</strong>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {!isLocked ? (
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => openItemPicker(index)}
                                                            className="text-stone-500 hover:text-[#2E6E52] p-1.5 rounded hover:bg-stone-100 transition-colors"
                                                            title="Edit item"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeLine(index)}
                                                            className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition-colors"
                                                            title="Remove item"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="p-1 text-stone-300 inline-block">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Totals */}
            <div className="border-t border-[#E1E3DB] pt-4">
                {/* <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1">
                            Overall Tax Amount
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                step="0.01"
                                value={formatCurrency(overallTaxAmount)}
                                readOnly
                                className="flex-1 px-3 py-2 border border-[#E1E3DB] rounded-lg bg-[#F4F5F1] text-[#1B2A21]"
                            />
                            <button
                                type="button"
                                onClick={openOverallTaxPicker}
                                className="px-4 py-2 bg-[#2E6E52] text-white text-sm font-medium rounded-lg hover:bg-[#255842] shadow-sm transition-colors"
                            >
                                Set
                            </button>
                        </div>
                        {overallTaxAmount > 0 && subTotal > 0 && (
                            <p className="mt-1 text-xs text-[#5C645D]">
                                {((overallTaxAmount / subTotal) * 100).toFixed(2)}% of subtotal
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1">
                            Overall Discount Amount
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                step="0.01"
                                value={formatCurrency(overallDiscountAmount)}
                                readOnly
                                className="flex-1 px-3 py-2 border border-[#E1E3DB] rounded-lg bg-[#F4F5F1] text-[#1B2A21]"
                            />
                            <button
                                type="button"
                                onClick={openOverallDiscountPicker}
                                className="px-4 py-2 bg-[#2E6E52] text-white text-sm font-medium rounded-lg hover:bg-[#255842] shadow-sm transition-colors"
                            >
                                Set
                            </button>
                        </div>
                        {overallDiscountAmount > 0 && subTotal > 0 && (
                            <p className="mt-1 text-xs text-[#5C645D]">
                                {((overallDiscountAmount / subTotal) * 100).toFixed(2)}% of subtotal
                            </p>
                        )}
                    </div>
                </div> */}

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                        <tbody>
                            <tr>
                                <td className="px-2 py-2 border border-gray-400">Total Items Tax</td>
                                <td className="px-2 py-2 border border-gray-400 text-right">
                                    {cs}{formatCurrency(totalItemTaxAmount)}
                                </td>
                            </tr>
                            <tr>
                                <td className="px-2 py-2 border border-gray-400">Total Items Discount</td>
                                <td className="px-2 py-2 border border-gray-400 text-right">
                                    {cs}{formatCurrency(totalItemDiscountAmount)}
                                </td>
                            </tr>
                            <tr>
                                <td className="px-2 py-2 border border-gray-400 border-b-gray-800 font-semibold">Sub Total</td>
                                <td className="px-2 py-2 border border-gray-400 border-b-gray-800 text-right font-semibold">
                                    {cs}{formatCurrency(subTotal)}
                                </td>
                            </tr>
                            {/* <tr>
                                <td className="px-2 py-2 border border-gray-800">
                                    <button
                                        type="button"
                                        onClick={openOverallTaxPicker}
                                        className="underline hover:no-underline"
                                    >
                                        Overall Tax
                                    </button>
                                </td>
                                <td className="px-2 py-2 border border-gray-800 text-right">
                                    <button
                                        type="button"
                                        onClick={openOverallTaxPicker}
                                        className="underline hover:no-underline"
                                    >
                                        <strong>{cs}{formatCurrency(overallTaxAmount)}</strong>
                                        {overallTaxAmount > 0 && subTotal > 0 && (
                                            <span className="text-xs text-gray-500 ml-1">
                                                [{((overallTaxAmount / subTotal) * 100).toFixed(2)}%]
                                            </span>
                                        )}
                                    </button>
                                </td>
                            </tr>
                            <tr>
                                <td className="px-2 py-2 border border-gray-800">
                                    <button
                                        type="button"
                                        onClick={openOverallDiscountPicker}
                                        className="underline hover:no-underline"
                                    >
                                        Overall Discount
                                    </button>
                                </td>
                                <td className="px-2 py-2 border border-gray-800 text-right">
                                    <button
                                        type="button"
                                        onClick={openOverallDiscountPicker}
                                        className="underline hover:no-underline"
                                    >
                                        <strong>{cs}{formatCurrency(overallDiscountAmount)}</strong>
                                        {overallDiscountAmount > 0 && subTotal > 0 && (
                                            <span className="text-xs text-gray-500 ml-1">
                                                [{((overallDiscountAmount / subTotal) * 100).toFixed(2)}%]
                                            </span>
                                        )}
                                    </button>
                                </td>
                            </tr> */}
                            <tr>
                                <td className="px-2 py-2 border border-gray-800 font-semibold text-lg">Total</td>
                                <td className="px-2 py-2 border border-gray-800 text-right font-semibold text-lg">
                                    {cs}{formatCurrency(total)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E1E3DB]">
                <Link
                    to={`${BASE_PATH}sales`}
                    className="px-4 py-2 border border-[#E1E3DB] text-stone-700 bg-white hover:bg-[#F4F5F1] rounded-lg transition-colors text-sm font-medium"
                >
                    {isLocked ? 'Back' : 'Cancel'}
                </Link>
                {!isLocked && (
                    <button
                        type="submit"
                        disabled={saving || lines.length === 0}
                        className="px-4 py-2 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
                    >
                        {saving ? 'Saving...' : isEditMode ? 'Update Sale' : 'Create Sale'}
                    </button>
                )}
            </div>
                </form>
            </div>
        </div>
    );
};

export default SalesForm;

