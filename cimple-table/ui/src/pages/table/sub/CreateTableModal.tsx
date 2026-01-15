import { useState } from "react";
import { TABLE_TEMPLATES, type TableTemplate } from "../../../lib/templates";
import TableCoreModal from "./TableCoreModal";

interface CreateTableModalProps {
    onSave: (data: { name: string; info?: string; icon?: string }, templateColumns?: { name: string; column_type: string; info?: string }[]) => Promise<void>;
    onCancel: () => void;
}

const CreateTableModal = ({ onSave, onCancel }: CreateTableModalProps) => {
    const [step, setStep] = useState<"template" | "details">("template");
    const [selectedTemplate, setSelectedTemplate] = useState<TableTemplate | null>(null);

    const handleTemplateSelect = (template: TableTemplate) => {
        setSelectedTemplate(template);
        setStep("details");
    };

    const handleBack = () => {
        setStep("template");
        setSelectedTemplate(null);
    };

    if (step === "template") {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-2">
                    {TABLE_TEMPLATES.map((template) => (
                        <button
                            key={template.id}
                            onClick={() => handleTemplateSelect(template)}
                            className="p-4 bg-white border border-surface-200 rounded hover:border-accent-500 hover:bg-surface-50 transition-all text-left group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-surface-100 rounded flex items-center justify-center group-hover:bg-white transition-all">
                                    <i className={`fa-solid fa-${template.icon} text-surface-400 group-hover:text-accent-600`}></i>
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-sm font-bold text-surface-900 truncate">{template.name}</h4>
                                    <p className="text-[10px] text-surface-400 font-medium uppercase tracking-wider">{template.columns.length} columns</p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t border-surface-100">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 rounded transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    return (
        <TableCoreModal
            initialValues={selectedTemplate ? {
                name: selectedTemplate.name,
                info: selectedTemplate.description,
                icon: selectedTemplate.icon
            } : undefined}
            onSave={(values) => onSave(values, selectedTemplate?.columns)}
            onCancel={onCancel}
            submitLabel="Create Table"
            extraActions={
                <button
                    onClick={handleBack}
                    className="text-[10px] font-bold text-surface-400 hover:text-accent-600 flex items-center gap-1 transition-colors uppercase tracking-widest mb-4"
                >
                    <i className="fa-solid fa-arrow-left"></i>
                    Back to templates
                </button>
            }
        />
    );
};

export default CreateTableModal;
