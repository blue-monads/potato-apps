import RowCoreModal from "./RowCoreModal";
import { type Datatable } from "../../../lib/api";

interface CreateRowModalProps {
    table: Datatable;
    onSave: (data: { table_id: number; data: Record<string, string> }) => Promise<void>;
    onCancel: () => void;
}

const CreateRowModal = ({ table, onSave, onCancel }: CreateRowModalProps) => {
    return (
        <RowCoreModal
            table={table}
            onSave={async (values) => {
                await onSave({
                    table_id: table.id,
                    data: values,
                });
            }}
            onCancel={onCancel}
            submitLabel="Create Row"
        />
    );
};

export default CreateRowModal;
