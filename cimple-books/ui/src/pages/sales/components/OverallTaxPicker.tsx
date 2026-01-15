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
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Overall Tax</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-semibold text-gray-900">
                            ${formatCurrency(subTotal)}
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                    <button
                        onClick={closeModal}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Set Tax
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OverallTaxPicker;

