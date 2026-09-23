import ColumnCoreModal from "./ColumnCoreModal";

interface CreateColumnModalProps {
    tableId: number;
    onSave: (data: { table_id: number; name: string; column_type: string; icon?: string; info?: string; required?: boolean; options?: string }) => Promise<void>;
    onCancel: () => void;
}

const CreateColumnModal = ({ tableId, onSave, onCancel }: CreateColumnModalProps) => {
    return (
        <ColumnCoreModal
            currentTableId={tableId}
            onSave={async (values) => {
                await onSave({
                    table_id: tableId,
                    ...values
                });
            }}
            onCancel={onCancel}
            submitLabel="Create"
        />
    );
};

export default CreateColumnModal;
