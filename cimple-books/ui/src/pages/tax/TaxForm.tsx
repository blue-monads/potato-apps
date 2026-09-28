import { useState, useEffect } from 'react';
import { createTax, updateTax, type Tax } from '../../lib/api';

const TAX_TYPES = [
    { value: 'sales', label: 'Sales' },
    { value: 'purchase', label: 'Purchase' },
];

interface TaxFormProps {
    tax?: Tax | null;
    onSave: () => void;
}

const TaxForm = ({ tax, onSave }: TaxFormProps) => {
    const [name, setName] = useState('');
    const [ttype, setTtype] = useState('sales');
    const [info, setInfo] = useState('');
    const [rate, setRate] = useState('');
    const [strict, setStrict] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (tax) {
            setName(tax.name || '');
            setTtype(tax.ttype || 'sales');
            setInfo(tax.info || '');
            setRate(tax.rate > 0 ? (tax.rate / 100).toFixed(2) : '');
            setStrict(tax.strict || false);
        } else {
            setName('');
            setTtype('sales');
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
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                    Name *
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors"
                    placeholder="e.g., VAT, Sales Tax, GST"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-1">
                        Type *
                    </label>
                    <select
                        value={ttype}
                        onChange={(e) => setTtype(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors bg-white"
                    >
                        {TAX_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                                {type.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-1">
                        Rate (%) *
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 border border-[#E1E3DB] rounded-lg focus:ring-2 focus:ring-[#2E6E52]/20 focus:border-[#2E6E52] outline-none text-stone-900 transition-colors"
                        placeholder="0.00"
                    />
                </div>
            </div>

            <div>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={strict}
                        onChange={(e) => setStrict(e.target.checked)}
                        className="w-4 h-4 text-[#2E6E52] border-[#E1E3DB] rounded focus:ring-[#2E6E52]"
                    />
                    <span className="text-sm font-medium text-stone-700">Strict</span>
                </label>
                <p className="text-xs text-stone-500 mt-1 ml-6">
                    If strict, this tax must be applied automatically when applicable
                </p>
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
                    placeholder="Additional information about the tax rule"
                />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E1E3DB]">
                <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg transition-colors font-semibold text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? 'Saving...' : (tax ? 'Update Tax' : 'Create Tax')}
                </button>
            </div>
        </form>
    );
};

export default TaxForm;

