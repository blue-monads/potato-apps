import { useState, useEffect } from 'react';
import { createAccount, updateAccount, type Account } from '../../lib/api';
import { ACCOUNT_TYPES } from './atypes';



interface AccountFormProps {
    account?: Account | null;
    onSave: () => void;
}

const AccountForm = ({ account, onSave }: AccountFormProps) => {
    const [name, setName] = useState('');
    const [accType, setAccType] = useState('expenses');
    const [info, setInfo] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (account) {
            setName(account.name || '');
            setAccType(account.acc_type || 'expenses');
            setInfo(account.info || '');
        } else {
            setName('');
            setAccType('expenses');
            setInfo('');
        }
    }, [account]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const accountData = {
                name,
                acc_type: accType,
                info,
            };

            let resp;
            if (account) {
                resp = await updateAccount(account.id, accountData);
            } else {
                resp = await createAccount(accountData);
            }

            if (resp.status === 200) {
                onSave();
            } else {
                setError(resp.error || 'Failed to save account');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save account');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {error}
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Account name"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type *
                </label>
                <select
                    value={accType}
                    onChange={(e) => setAccType(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    {ACCOUNT_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                            {type.label}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Info
                </label>
                <textarea
                    value={info}
                    onChange={(e) => setInfo(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Additional information about the account"
                />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </form>
    );
};

export default AccountForm;
