import { useState, useEffect } from 'react';
import { useModal } from '../../../lib/shared/modal/modal';

interface OverallDiscountPickerProps {
    subTotal: number;
    currentDiscount: number;
    onSet: (discount: number) => void;
}

const OverallDiscountPicker = ({ subTotal, currentDiscount, onSet }: OverallDiscountPickerProps) => {
    const { closeModal } = useModal();
    const [discountedAmount, setDiscountedAmount] = useState(subTotal - currentDiscount);
    const [discountPercentage, setDiscountPercentage] = useState(0);

    useEffect(() => {
        if (subTotal > 0) {
            const discount = subTotal - discountedAmount;
            const percentage = (discount / subTotal) * 100;
            setDiscountPercentage(percentage);
        }
    }, [discountedAmount, subTotal]);

    const formatCurrency = (amount: number) => {
        return (amount / 100).toFixed(2);
    };

    const handleSubmit = () => {
        const discount = subTotal - discountedAmount;
        onSet(discount);
        closeModal();
    };

    return (
        <div className="p-6 min-w-[400px]">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Overall Discount</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Overall Discounted Amount *
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={formatCurrency(subTotal)}
                        value={formatCurrency(discountedAmount)}
                        onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setDiscountedAmount(Math.round(value * 100));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Subtotal: ${formatCurrency(subTotal)}
                    </p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Overall Discount Percentage:</span>
                        <span className="font-semibold text-gray-900">
                            {discountPercentage.toFixed(2)}%
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
                        Set Discount
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OverallDiscountPicker;

