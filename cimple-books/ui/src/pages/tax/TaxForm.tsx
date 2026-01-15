import { useState, useEffect } from 'react';
import { createTax, updateTax, type Tax } from '../../lib/api';

const TAX_TYPES = [
    { value: 'item_percent', label: 'Item Percent' },
    { value: 'category_percent', label: 'Category Percent' },
];

interface TaxFormProps {
    tax?: Tax | null;
    onSave: () => void;
}

const TaxForm = ({ tax, onSave }: TaxFormProps) => {
    const [name, setName] = useState('');
    const [ttype, setTtype] = useState('item_percent');
    const [info, setInfo] = useState('');
    const [rate, setRate] = useState('');
    const [strict, setStrict] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (tax) {
            setName(tax.name || '');
            setTtype(tax.ttype || 'item_percent');
            setInfo(tax.info || '');
            setRate(tax.rate > 0 ? (tax.rate / 100).toFixed(2) : '');
            setStrict(tax.strict || false);
        } else {
            setName('');
            setTtype('item_percent');
            setInfo('');
            setRate('');
            setStrict(false);
        }
    }, [tax]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const taxData = {
                name,
                ttype,
                info,
                rate: Math.round(parseFloat(rate || '0') * 100),
                strict,
            };

            let resp;
            if (tax) {
                resp = await updateTax(tax.id, taxData);
            } else {
                resp = await createTax(taxData);
            }

            if (resp.status === 200) {
                onSave();
            } else {
                setError(resp.error || 'Failed to save tax');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save tax');
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
                    placeholder="Tax name"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type *
                    </label>
                    <select
                        value={ttype}
                        onChange={(e) => setTtype(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        {TAX_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                                {type.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rate (%) *
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0.00"
                    />
                </div>
            </div>

            <div>
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={strict}
                        onChange={(e) => setStrict(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Strict</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                    If strict, this tax must be applied when applicable
                </p>
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
                    placeholder="Additional information about the tax"
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

export default TaxForm;

