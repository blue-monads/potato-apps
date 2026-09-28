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
            <h3 className="text-xl font-display font-semibold text-[#1B2A21] mb-4">Overall Discount</h3>
            <div className="space-y-4 font-sans">
                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
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
                        className="w-full px-3 py-2 border border-[#E1E3DB] rounded-lg focus:outline-none focus:border-[#2E6E52] focus:ring-2 focus:ring-[#2E6E52]/20"
                        required
                    />
                    <p className="mt-1 text-xs text-stone-500">
                        Subtotal: ${formatCurrency(subTotal)}
                    </p>
                </div>

                <div className="p-3 bg-[#F4F5F1] rounded-lg border border-[#E1E3DB]">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-stone-600">Overall Discount Percentage:</span>
                        <span className="font-semibold text-[#1B2A21]">
                            {discountPercentage.toFixed(2)}%
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
                        Set Discount
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OverallDiscountPicker;

