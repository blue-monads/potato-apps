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
                name: name.trim(),
                acc_type: accType,
                info: info.trim(),
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
        <form onSubmit={handleSubmit} className="space-y-4 font-sans">
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                </div>
            )}

            <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                    Account Name *
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors"
                    placeholder="e.g., Office Supplies, Operating Bank Account"
                />
            </div>

            <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                    Account Type *
                </label>
                <select
                    value={accType}
                    onChange={(e) => setAccType(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors bg-white"
                >
                    {ACCOUNT_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                            {type.label}
                        </option>
                    ))}
                </select>
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
                    placeholder="Additional details about this account"
                />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E1E3DB]">
                <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg transition-colors font-semibold text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? 'Saving...' : (account ? 'Update Account' : 'Create Account')}
                </button>
            </div>
        </form>
    );
};

export default AccountForm;
