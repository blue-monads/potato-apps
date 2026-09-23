import { useState } from "react";
import IconPickerModal from "./IconPickerModal";

interface IconSelectorProps {
    value?: string;
    defaultValue?: string;
    onChange: (icon: string) => void;
    label?: string;
    title?: string;
    compact?: boolean;
}

export const IconSelector = ({
    value = "",
    defaultValue = "table",
    onChange,
    label,
    title = "Select Icon",
    compact = false,
}: IconSelectorProps) => {
    const [pickerOpen, setPickerOpen] = useState(false);

    const activeIcon = value || defaultValue;

    if (compact) {
        return (
            <>
                <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="w-7 h-7 rounded border border-surface-200 hover:border-accent-400 bg-white hover:bg-accent-50 text-surface-600 hover:text-accent-700 flex items-center justify-center transition-all cursor-pointer shrink-0"
                    title={`Icon: ${activeIcon} (click to change)`}
                >
                    <i className={`fa-solid fa-${activeIcon} text-xs`} />
                </button>

                {pickerOpen && (
                    <IconPickerModal
                        currentIcon={value}
                        defaultIcon={defaultValue}
                        title={title}
                        onSelect={(newIcon) => onChange(newIcon)}
                        onClose={() => setPickerOpen(false)}
                    />
                )}
            </>
        );
    }

    return (
        <div className="space-y-1.5">
            {label && (
                <label className="text-[11px] font-bold text-surface-600 uppercase tracking-wider block">
                    {label}
                </label>
            )}

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="w-9 h-9 rounded-lg bg-surface-50 hover:bg-accent-50 border border-surface-300 hover:border-accent-500 flex items-center justify-center text-surface-700 hover:text-accent-700 transition-all cursor-pointer shrink-0 shadow-2xs group"
                    title="Click to browse all icons"
                >
                    <i className={`fa-solid fa-${activeIcon} text-base group-hover:scale-110 transition-transform`} />
                </button>

                <div className="relative flex-1">
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value.trim())}
                        placeholder={`default: ${defaultValue}`}
                        className="w-full bg-white border border-surface-300 rounded px-2.5 py-1.5 text-xs text-surface-800 font-mono outline-none focus:border-accent-600 pr-16"
                    />
                    <button
                        type="button"
                        onClick={() => setPickerOpen(true)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-bold bg-surface-100 hover:bg-surface-200 text-surface-600 rounded transition-colors cursor-pointer"
                    >
                        Browse
                    </button>
                </div>

                {value && (
                    <button
                        type="button"
                        onClick={() => onChange("")}
                        className="w-7 h-7 rounded hover:bg-coral-50 text-surface-400 hover:text-coral-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        title="Reset to default icon"
                    >
                        <i className="fa-solid fa-xmark text-xs" />
                    </button>
                )}
            </div>

            {pickerOpen && (
                <IconPickerModal
                    currentIcon={value}
                    defaultIcon={defaultValue}
                    title={title}
                    onSelect={(newIcon) => onChange(newIcon)}
                    onClose={() => setPickerOpen(false)}
                />
            )}
        </div>
    );
};

export default IconSelector;
