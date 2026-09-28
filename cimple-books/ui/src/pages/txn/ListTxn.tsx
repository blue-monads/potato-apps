import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router';
import { Plus, Trash2, Edit, ArrowLeft } from 'lucide-react';
import { listTransactions, deleteTransaction, listAccounts, type Transaction, type Account } from '../../lib/api';
import { BASE_PATH } from '../../lib/base';
import { useModal } from '../../lib/shared/modal/modal';
import TransactionForm from './TransactionForm';

const ListTxn = () => {
    const { openModal, closeModal } = useModal();
    const [searchParams] = useSearchParams();
    const accountId = searchParams.get('accountId');

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filteredAccount, setFilteredAccount] = useState<Account | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [txnResp, accResp] = await Promise.all([
                listTransactions(),
                listAccounts(),
            ]);

            if (txnResp.status === 200) {
                let txnData = txnResp.data || [];
                
                // Filter by account if accountId is provided
                if (accountId) {
                    const accIdNum = parseInt(accountId);
                    txnData = txnData.filter(txn => 
                        txn.lines?.some(line => line.account_id === accIdNum)
                    );
                    const account = accResp.data?.find(a => a.id === accIdNum);
                    setFilteredAccount(account || null);
                }
                
                setTransactions(txnData);
            } else {
                setError(txnResp.error || 'Failed to load transactions');
            }

            if (accResp.status === 200) {
                setAccounts(accResp.data || []);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [accountId]);

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this transaction?')) {
            return;
        }
        try {
            const resp = await deleteTransaction(id);
            if (resp.status === 200) {
                await loadData();
            } else {
                alert(resp.error || 'Failed to delete transaction');
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete transaction');
        }
    };

    const openTransactionForm = (transaction?: Transaction | null) => {
        openModal({
            title: transaction ? 'Edit Transaction' : 'New Transaction',
            content: (
                <TransactionForm
                    transaction={transaction || null}
                    accounts={accounts}
                    onSave={() => {
                        closeModal();
                        loadData();
                    }}
                />
            ),
            onClose: () => {
                loadData();
            },
        });
    };

    const handleEdit = (txn: Transaction) => {
        openTransactionForm(txn);
    };

    const getAccountName = (accountId: number) => {
        const account = accounts.find(a => a.id === accountId);
        return account?.name || `Account #${accountId}`;
    };

    const formatAmount = (amount: number) => {
        return (amount / 100).toFixed(2);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg text-gray-500">Loading transactions...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F4F5F1] p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            {filteredAccount && (
                                <Link
                                    to={`${BASE_PATH}accounts`}
                                    className="p-1.5 text-stone-600 hover:text-[#2E6E52] hover:bg-[#EEF0EA] rounded-lg transition-colors"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </Link>
                            )}
                            <div>
                                <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 font-display">
                                    {filteredAccount ? `Transactions: ${filteredAccount.name}` : 'Transactions'}
                                </h1>
                                <p className="text-stone-500 mt-1 text-sm">
                                    {filteredAccount 
                                        ? `All journal entries for ${filteredAccount.name}`
                                        : 'Manage your accounting journal entries'
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => openTransactionForm()}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        New Transaction
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {error}
                    </div>
                )}

                {/* Transactions List */}
                <div className="space-y-4">
                    {transactions.length === 0 ? (
                        <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-sm p-12 text-center text-stone-500">
                            No transactions found. Create your first transaction to get started.
                        </div>
                    ) : (
                        transactions.map((txn) => (
                            <div key={txn.id} className="bg-white rounded-xl border border-[#E1E3DB] shadow-sm overflow-hidden">
                                <div className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="text-base font-bold text-stone-900 font-display">
                                                {txn.title || `Transaction #${txn.id}`}
                                            </h3>
                                            <p className="text-xs text-stone-500 mt-1">
                                                {new Date(txn.txn_date).toLocaleDateString()} • 
                                                {txn.reference_id && ` Ref: ${txn.reference_id}`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleEdit(txn)}
                                                className="text-stone-600 hover:text-[#2E6E52] p-1.5 hover:bg-[#EEF0EA] rounded-lg transition-colors"
                                                title="Edit transaction"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            {txn.is_editable && (
                                                <button
                                                    onClick={() => handleDelete(txn.id)}
                                                    className="text-stone-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete transaction"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {txn.notes && (
                                        <p className="text-sm text-stone-600 mb-4">{txn.notes}</p>
                                    )}

                                    {/* Transaction Lines */}
                                    <div className="border-t border-[#E1E3DB] pt-4">
                                        <h4 className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-2">Transaction Lines</h4>
                                        <div className="space-y-2">
                                            {txn.lines && txn.lines.length > 0 ? (
                                                txn.lines.map((line) => (
                                                    <div
                                                        key={line.id}
                                                        className="flex items-center justify-between p-3 bg-[#FAFBF9] border border-[#E1E3DB] rounded-lg"
                                                    >
                                                        <div className="flex-1">
                                                            <span className="text-sm font-medium text-gray-900">
                                                                {getAccountName(line.account_id)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            {line.debit_amount > 0 && (
                                                                <span className="text-sm text-red-600 font-medium">
                                                                    Dr: {formatAmount(line.debit_amount)}
                                                                </span>
                                                            )}
                                                            {line.credit_amount > 0 && (
                                                                <span className="text-sm text-green-600 font-medium">
                                                                    Cr: {formatAmount(line.credit_amount)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-gray-500">No lines found</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

        </div>
    );
};

export default ListTxn;
