import { useMemo, useState } from "react";
import { encodeCode128B } from "../../../lib/barcode";

export const BarcodeSvg = ({
    value,
    height = 40,
    moduleWidth = 2,
    showText = true,
    className = "",
}: {
    value: string;
    height?: number;
    moduleWidth?: number;
    showText?: boolean;
    className?: string;
}) => {
    const encoded = useMemo(() => encodeCode128B(value, moduleWidth), [value, moduleWidth]);

    if (!encoded) {
        return (
            <div className="flex items-center justify-center p-2 text-xs text-surface-400 bg-surface-100 rounded">
                Invalid Barcode
            </div>
        );
    }

    const svgHeight = showText ? height + 16 : height;

    return (
        <div className={`inline-block bg-white p-1 rounded border border-surface-200 ${className}`}>
            <svg
                viewBox={`0 0 ${encoded.totalWidth} ${svgHeight}`}
                className="w-full h-auto block select-none"
                style={{ maxHeight: `${svgHeight}px`, minWidth: `${Math.min(encoded.totalWidth, 100)}px` }}
            >
                <rect x="0" y="0" width={encoded.totalWidth} height={svgHeight} fill="#ffffff" />
                {encoded.bars.map((bar, i) => (
                    <rect key={i} x={bar.x} y="0" width={bar.width} height={height} fill="#000000" />
                ))}
                {showText && (
                    <text
                        x={encoded.totalWidth / 2}
                        y={height + 12}
                        textAnchor="middle"
                        fill="#1e293b"
                        fontFamily="monospace"
                        fontSize="11"
                        fontWeight="600"
                        letterSpacing="1"
                    >
                        {value}
                    </text>
                )}
            </svg>
        </div>
    );
};

export const BarcodeModal = ({
    value,
    columnName,
    onClose,
}: {
    value: string;
    columnName?: string;
    onClose: () => void;
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-surface-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-surface-200 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center text-surface-700">
                            <i className="fa-solid fa-barcode text-sm" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-surface-900">
                                {columnName || "Barcode"}
                            </h3>
                            <p className="text-[11px] text-surface-500 font-mono">Code 128</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-surface-400 hover:text-surface-700 w-8 h-8 rounded flex items-center justify-center hover:bg-surface-100 cursor-pointer transition-colors"
                    >
                        <i className="fa-solid fa-xmark text-sm" />
                    </button>
                </div>

                <div className="p-6 flex flex-col items-center justify-center space-y-4 bg-surface-50/50">
                    <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm max-w-full overflow-x-auto">
                        <BarcodeSvg
                            value={value}
                            height={80}
                            moduleWidth={2.5}
                            showText={true}
                            className="border-none p-0"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="px-3 py-1.5 bg-white border border-surface-200 rounded-lg text-xs font-mono font-bold text-surface-800 tracking-wider">
                            {value}
                        </div>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="px-3 py-1.5 bg-surface-100 hover:bg-surface-200 text-surface-700 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                            <i className={`fa-solid ${copied ? 'fa-check text-emerald-600' : 'fa-copy'}`} />
                            <span>{copied ? "Copied!" : "Copy"}</span>
                        </button>
                    </div>
                </div>

                <div className="px-5 py-3 border-t border-surface-200 flex justify-end bg-white">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 bg-surface-100 hover:bg-surface-200 text-surface-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BarcodeModal;
