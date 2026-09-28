import { useState } from 'react';
import { useModal } from '../../../lib/shared/modal/modal';

interface OverallTaxPickerProps {
    subTotal: number;
    currentTax: number;
    onSet: (tax: number) => void;
}

const OverallTaxPicker = ({ subTotal, currentTax, onSet }: OverallTaxPickerProps) => {
    const { closeModal } = useModal();
    const [taxAmount, setTaxAmount] = useState(currentTax);
    const [taxPercentage, setTaxPercentage] = useState(0);

    const formatCurrency = (amount: number) => {
        return (amount / 100).toFixed(2);
    };

    const handleTaxAmountChange = (value: number) => {
        setTaxAmount(value);
        if (subTotal > 0) {
            setTaxPercentage((value / subTotal) * 100);
        }
    };

    const handleTaxPercentageChange = (percentage: number) => {
        setTaxPercentage(percentage);
        setTaxAmount(Math.round((subTotal * percentage) / 100));
    };

    const handleSubmit = () => {
        onSet(taxAmount);
        closeModal();
    };

    return (
        <div className="p-6 min-w-[400px]">
            <h3 className="text-xl font-display font-semibold text-[#1B2A21] mb-4">Overall Tax</h3>
            <div className="space-y-4 font-sans">
                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                        Tax Amount
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formatCurrency(taxAmount)}
                        onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            handleTaxAmountChange(Math.round(value * 100));
                        }}
                        className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:outline-none focus:border-[#2E6E52] focus:ring-2 focus:ring-[#2E6E52]/20"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                        Tax Percentage (%)
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={taxPercentage.toFixed(2)}
                        onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            handleTaxPercentageChange(value);
                        }}
                        className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:outline-none focus:border-[#2E6E52] focus:ring-2 focus:ring-[#2E6E52]/20"
                    />
                </div>

                <div className="p-3 bg-[#F4F5F1] rounded-lg border border-[#E1E3DB]">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-stone-600">Subtotal:</span>
                        <span className="font-semibold text-[#1B2A21]">
                            ${formatCurrency(subTotal)}
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E1E3DB]">
                    <button
                        onClick={closeModal}
                        className="px-4 py-2 border border-[#E1E3DB] text-stone-700 bg-white hover:bg-[#F4F5F1] rounded-lg transition-colors font-medium text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg transition-colors font-medium text-sm shadow-sm"
                    >
                        Set Tax
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OverallTaxPicker;

