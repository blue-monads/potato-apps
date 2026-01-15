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
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            {filteredAccount && (
                                <Link
                                    to={`${BASE_PATH}accounts`}
                                    className="text-gray-600 hover:text-gray-900"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </Link>
                            )}
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">
                                    {filteredAccount ? `Transactions - ${filteredAccount.name}` : 'Transactions'}
                                </h1>
                                <p className="text-gray-600 mt-1">
                                    {filteredAccount 
                                        ? `All transactions for ${filteredAccount.name}`
                                        : 'Manage your accounting transactions'
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => openTransactionForm()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        New Transaction
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        {error}
                    </div>
                )}

                {/* Transactions List */}
                <div className="space-y-4">
                    {transactions.length === 0 ? (
                        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                            No transactions found. Create your first transaction to get started.
                        </div>
                    ) : (
                        transactions.map((txn) => (
                            <div key={txn.id} className="bg-white rounded-lg shadow overflow-hidden">
                                <div className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                {txn.title || `Transaction #${txn.id}`}
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-1">
                                                {new Date(txn.txn_date).toLocaleDateString()} • 
                                                {txn.reference_id && ` Ref: ${txn.reference_id}`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEdit(txn)}
                                                className="text-indigo-600 hover:text-indigo-900 p-2"
                                                title="Edit transaction"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            {txn.is_editable && (
                                                <button
                                                    onClick={() => handleDelete(txn.id)}
                                                    className="text-red-600 hover:text-red-900 p-2"
                                                    title="Delete transaction"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {txn.notes && (
                                        <p className="text-sm text-gray-600 mb-4">{txn.notes}</p>
                                    )}

                                    {/* Transaction Lines */}
                                    <div className="border-t pt-4">
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Transaction Lines</h4>
                                        <div className="space-y-2">
                                            {txn.lines && txn.lines.length > 0 ? (
                                                txn.lines.map((line) => (
                                                    <div
                                                        key={line.id}
                                                        className="flex items-center justify-between p-3 bg-gray-50 rounded"
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
