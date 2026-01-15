import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createTransaction, updateTransaction, type Transaction, type Account } from '../../lib/api';

interface TransactionLine {
    account_id: number;
    debit_amount: number;
    credit_amount: number;
}

interface TransactionFormProps {
    transaction?: Transaction | null;
    accounts: Account[];
    onSave: () => void;
}

const TransactionForm = ({ transaction, accounts, onSave }: TransactionFormProps) => {
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [referenceId, setReferenceId] = useState('');
    const [txnDate, setTxnDate] = useState(new Date().toISOString().split('T')[0]);
    const [lines, setLines] = useState<TransactionLine[]>([
        { account_id: 0, debit_amount: 0, credit_amount: 0 },
        { account_id: 0, debit_amount: 0, credit_amount: 0 },
    ]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (transaction) {
            setTitle(transaction.title || '');
            setNotes(transaction.notes || '');
            setReferenceId(transaction.reference_id || '');
            setTxnDate(transaction.txn_date ? new Date(transaction.txn_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
            if (transaction.lines && transaction.lines.length > 0) {
                setLines(transaction.lines.map(line => ({
                    account_id: line.account_id,
                    debit_amount: line.debit_amount,
                    credit_amount: line.credit_amount,
                })));
            }
        } else {
            setTitle('');
            setNotes('');
            setReferenceId('');
            setTxnDate(new Date().toISOString().split('T')[0]);
            setLines([
                { account_id: 0, debit_amount: 0, credit_amount: 0 },
                { account_id: 0, debit_amount: 0, credit_amount: 0 },
            ]);
        }
    }, [transaction]);

    const addLine = () => {
        setLines([...lines, { account_id: 0, debit_amount: 0, credit_amount: 0 }]);
    };

    const removeLine = (index: number) => {
        if (lines.length > 2) {
            setLines(lines.filter((_, i) => i !== index));
        }
    };

    const updateLine = (index: number, field: keyof TransactionLine, value: number) => {
        const newLines = [...lines];
        newLines[index] = { ...newLines[index], [field]: value };
        
        // If debit is set, clear credit and vice versa
        if (field === 'debit_amount' && value > 0) {
            newLines[index].credit_amount = 0;
        } else if (field === 'credit_amount' && value > 0) {
            newLines[index].debit_amount = 0;
        }
        
        setLines(newLines);
    };

    const calculateTotal = () => {
        const totalDebit = lines.reduce((sum, line) => sum + line.debit_amount, 0);
        const totalCredit = lines.reduce((sum, line) => sum + line.credit_amount, 0);
        return { totalDebit, totalCredit, balanced: totalDebit === totalCredit };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const { totalDebit, totalCredit, balanced } = calculateTotal();
        
        if (!balanced) {
            setError(`Transaction must balance. Debits: ${(totalDebit / 100).toFixed(2)}, Credits: ${(totalCredit / 100).toFixed(2)}`);
            setSaving(false);
            return;
        }

        const validLines = lines.filter(line => line.account_id > 0 && (line.debit_amount > 0 || line.credit_amount > 0));
        
        if (validLines.length < 2) {
            setError('Transaction must have at least 2 lines');
            setSaving(false);
            return;
        }

        try {
            const txnData = {
                title: title || undefined,
                notes: notes || undefined,
                reference_id: referenceId || undefined,
                txn_date: Math.floor(new Date(txnDate).getTime() / 1000),
                is_editable: true,
                lines: validLines.map(line => ({
                    account_id: line.account_id,
                    debit_amount: line.debit_amount,
                    credit_amount: line.credit_amount,
                })),
            };

            let resp;
            if (transaction) {
                resp = await updateTransaction(transaction.id, txnData);
            } else {
                resp = await createTransaction(txnData);
            }
            
            if (resp.status === 200) {
                onSave();
            } else {
                setError(resp.error || 'Failed to save transaction');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save transaction');
        } finally {
            setSaving(false);
        }
    };

    const { totalDebit, totalCredit, balanced } = calculateTotal();

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
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
                                placeholder="Transaction title"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Date
                            </label>
                            <input
                                type="date"
                                value={txnDate}
                                onChange={(e) => setTxnDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Reference ID
                        </label>
                        <input
                            type="text"
                            value={referenceId}
                            onChange={(e) => setReferenceId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Reference number"
                        />
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

                    {/* Transaction Lines */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <label className="block text-sm font-medium text-gray-700">
                                Transaction Lines *
                            </label>
                            <button
                                type="button"
                                onClick={addLine}
                                className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700"
                            >
                                <Plus className="w-4 h-4" />
                                Add Line
                            </button>
                        </div>

                        <div className="space-y-3">
                            {lines.map((line, index) => (
                                <div key={index} className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg">
                                    <div className="flex-1">
                                        <select
                                            value={line.account_id}
                                            onChange={(e) => updateLine(index, 'account_id', parseInt(e.target.value))}
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value={0}>Select Account</option>
                                            {accounts.map((acc) => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.name} ({acc.acc_type})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-32">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={line.debit_amount > 0 ? (line.debit_amount / 100).toFixed(2) : ''}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value) || 0;
                                                updateLine(index, 'debit_amount', Math.round(value * 100));
                                            }}
                                            placeholder="Debit"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div className="w-32">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={line.credit_amount > 0 ? (line.credit_amount / 100).toFixed(2) : ''}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value) || 0;
                                                updateLine(index, 'credit_amount', Math.round(value * 100));
                                            }}
                                            placeholder="Credit"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                    {lines.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => removeLine(index)}
                                            className="text-red-600 hover:text-red-700 p-2"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Balance Summary */}
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-sm font-medium text-gray-700">Total Debit:</span>
                                    <span className="ml-2 text-sm text-red-600 font-semibold">
                                        {(totalDebit / 100).toFixed(2)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-gray-700">Total Credit:</span>
                                    <span className="ml-2 text-sm text-green-600 font-semibold">
                                        {(totalCredit / 100).toFixed(2)}
                                    </span>
                                </div>
                                <div>
                                    {balanced ? (
                                        <span className="text-sm text-green-600 font-semibold">✓ Balanced</span>
                                    ) : (
                                        <span className="text-sm text-red-600 font-semibold">
                                            Difference: {Math.abs(totalDebit - totalCredit) / 100}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t">
                        <button
                            type="submit"
                            disabled={saving || !balanced}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Saving...' : 'Save Transaction'}
                        </button>
                    </div>
                </form>
    );
};

export default TransactionForm;

