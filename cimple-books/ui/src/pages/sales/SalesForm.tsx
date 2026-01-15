import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { createSale, updateSale, getSale, type Sale } from '../../lib/api';
import { BASE_PATH } from '../../lib/base';
import { useModal } from '../../lib/modal/modal';
import SalesItemPicker from './components/SalesItemPicker';
import OverallDiscountPicker from './components/OverallDiscountPicker';
import OverallTaxPicker from './components/OverallTaxPicker';

interface SalesLine {
    info: string;
    qty: number;
    product_id: number;
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
    const [clientId, setClientId] = useState(0);
    const [clientName, setClientName] = useState('');
    const [notes, setNotes] = useState('');
    const [salesDate, setSalesDate] = useState(new Date().toISOString().slice(0, 16));
    const [paymentStatus, setPaymentStatus] = useState('unpaid');
    const [lines, setLines] = useState<SalesLine[]>([]);
    const [overallTaxAmount, setOverallTaxAmount] = useState(0);
    const [overallDiscountAmount, setOverallDiscountAmount] = useState(0);
    
    const { openModal } = useModal();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            setClientId(sale.client_id || 0);
            setClientName(sale.client_name || '');
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
                    price: line.price || 0,
                    amount: line.price - (line.discount_amount || 0), // Calculate discounted price
                    tax_amount: line.tax_amount || 0,
                    discount_amount: line.discount_amount || 0,
                    total_amount: line.total_amount || 0,
                })));
            }
        } else if (!isEditMode) {
            setTitle('');
            setClientId(0);
            setClientName('');
            setNotes('');
            setSalesDate(new Date().toISOString().slice(0, 16));
            setPaymentStatus('unpaid');
            setOverallTaxAmount(0);
            setOverallDiscountAmount(0);
            setLines([]);
        }
    }, [sale, isEditMode]);

    // Calculate totals
    const totalItemPrice = lines.reduce((sum, line) => sum + (line.price * line.qty), 0);
    const totalItemTaxAmount = lines.reduce((sum, line) => sum + (line.tax_amount * line.qty), 0);
    const totalItemDiscountAmount = lines.reduce((sum, line) => sum + (line.discount_amount * line.qty), 0);
    const subTotal = lines.reduce((sum, line) => sum + line.total_amount, 0);
    const total = subTotal + overallTaxAmount - overallDiscountAmount;

    const openItemPicker = () => {
        openModal({
            title: 'Add Item',
            content: (
                <SalesItemPicker
                    onSave={(line) => {
                        setLines([...lines, line]);
                    }}
                />
            ),
        });
    };

    const openOverallDiscountPicker = () => {
        openModal({
            title: 'Overall Discount',
            content: (
                <OverallDiscountPicker
                    subTotal={subTotal}
                    currentDiscount={overallDiscountAmount}
                    onSet={(discount) => setOverallDiscountAmount(discount)}
                />
            ),
        });
    };

    const openOverallTaxPicker = () => {
        openModal({
            title: 'Overall Tax',
            content: (
                <OverallTaxPicker
                    subTotal={subTotal}
                    currentTax={overallTaxAmount}
                    onSet={(tax) => setOverallTaxAmount(tax)}
                />
            ),
        });
    };

    const removeLine = (index: number) => {
        setLines(lines.filter((_, i) => i !== index));
    };

    const formatCurrency = (amount: number) => {
        return (amount / 100).toFixed(2);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        if (lines.length === 0) {
            setError('Sale must have at least one line item');
            setSaving(false);
            return;
        }

        if (!clientId && !clientName) {
            setError('Please select or enter a client');
            setSaving(false);
            return;
        }

        try {
            const saleData = {
                title: title || undefined,
                client_id: clientId || 0,
                client_name: clientName || undefined,
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
                lines: lines.map(line => ({
                    info: line.info,
                    qty: line.qty,
                    product_id: line.product_id,
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
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex items-center gap-4">
                    <Link
                        to={`${BASE_PATH}sales`}
                        className="text-gray-600 hover:text-gray-900"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {isEditMode ? 'Edit Sale' : 'New Sale'}
                        </h1>
                        <p className="text-gray-600 mt-1">
                            {isEditMode ? 'Update sale information' : 'Create a new sale'}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-lg shadow p-6">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                            {error}
                        </div>
                    )}

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Title
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Sale title"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date
                    </label>
                    <input
                        type="datetime-local"
                        value={salesDate}
                        onChange={(e) => setSalesDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Client Name
                    </label>
                    <input
                        type="text"
                        value={clientName}
                        onChange={(e) => {
                            setClientName(e.target.value);
                            if (!clientId) setClientId(0);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Client name"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Status
                    </label>
                    <select
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="unpaid">Unpaid</option>
                        <option value="paid">Paid</option>
                        <option value="partially_paid">Partially Paid</option>
                        <option value="refunded">Refunded</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                </label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Additional notes"
                />
            </div>

            {/* Sales Lines */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                        Line Items *
                    </label>
                    <button
                        type="button"
                        onClick={openItemPicker}
                        className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Item
                    </button>
                </div>

                {lines.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm border border-gray-200 rounded-lg">
                        No items added. Click "Add Item" to add products.
                    </div>
                ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tax</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {lines.map((line, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {line.info}
                                                {line.discount_amount > 0 && (
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        Original: ${formatCurrency(line.price)} - Discount: ${formatCurrency(line.discount_amount)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                                                {line.qty}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                                                {line.amount === line.price ? (
                                                    <span>${formatCurrency(line.amount)}</span>
                                                ) : (
                                                    <span>
                                                        <span className="line-through text-gray-400">${formatCurrency(line.price)}</span>
                                                        {' '}- ({formatCurrency(line.discount_amount)}) = <strong>${formatCurrency(line.amount)}</strong>
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                                                {line.tax_amount > 0 ? `$${formatCurrency(line.tax_amount)}` : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                                                (
                                                <span>
                                                    ${formatCurrency(line.price)}
                                                    {line.discount_amount > 0 && ` - $${formatCurrency(line.discount_amount)}`}
                                                    {line.tax_amount > 0 && ` + $${formatCurrency(line.tax_amount)}`}
                                                </span>
                                                ) × {line.qty} = <strong>${formatCurrency(line.total_amount)}</strong>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => removeLine(index)}
                                                    className="text-red-600 hover:text-red-700 p-1"
                                                    title="Remove item"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
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
            <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Overall Tax Amount
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                step="0.01"
                                value={formatCurrency(overallTaxAmount)}
                                readOnly
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                            />
                            <button
                                type="button"
                                onClick={openOverallTaxPicker}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Set
                            </button>
                        </div>
                        {overallTaxAmount > 0 && subTotal > 0 && (
                            <p className="mt-1 text-xs text-gray-500">
                                {((overallTaxAmount / subTotal) * 100).toFixed(2)}% of subtotal
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Overall Discount Amount
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                step="0.01"
                                value={formatCurrency(overallDiscountAmount)}
                                readOnly
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                            />
                            <button
                                type="button"
                                onClick={openOverallDiscountPicker}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Set
                            </button>
                        </div>
                        {overallDiscountAmount > 0 && subTotal > 0 && (
                            <p className="mt-1 text-xs text-gray-500">
                                {((overallDiscountAmount / subTotal) * 100).toFixed(2)}% of subtotal
                            </p>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                        <tbody>
                            <tr>
                                <td className="px-2 py-2 border border-gray-400">Total Items Tax</td>
                                <td className="px-2 py-2 border border-gray-400 text-right">
                                    ${formatCurrency(totalItemTaxAmount)}
                                </td>
                            </tr>
                            <tr>
                                <td className="px-2 py-2 border border-gray-400">Total Items Discount</td>
                                <td className="px-2 py-2 border border-gray-400 text-right">
                                    ${formatCurrency(totalItemDiscountAmount)}
                                </td>
                            </tr>
                            <tr>
                                <td className="px-2 py-2 border border-gray-400 border-b-gray-800 font-semibold">Sub Total</td>
                                <td className="px-2 py-2 border border-gray-400 border-b-gray-800 text-right font-semibold">
                                    ${formatCurrency(subTotal)}
                                </td>
                            </tr>
                            <tr>
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
                                        <strong>${formatCurrency(overallTaxAmount)}</strong>
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
                                        <strong>${formatCurrency(overallDiscountAmount)}</strong>
                                        {overallDiscountAmount > 0 && subTotal > 0 && (
                                            <span className="text-xs text-gray-500 ml-1">
                                                [{((overallDiscountAmount / subTotal) * 100).toFixed(2)}%]
                                            </span>
                                        )}
                                    </button>
                                </td>
                            </tr>
                            <tr>
                                <td className="px-2 py-2 border border-gray-800 font-semibold text-lg">Total</td>
                                <td className="px-2 py-2 border border-gray-800 text-right font-semibold text-lg">
                                    ${formatCurrency(total)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Link
                    to={`${BASE_PATH}sales`}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    Cancel
                </Link>
                <button
                    type="submit"
                    disabled={saving || lines.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? 'Saving...' : isEditMode ? 'Update Sale' : 'Create Sale'}
                </button>
            </div>
                </form>
            </div>
        </div>
    );
};

export default SalesForm;

