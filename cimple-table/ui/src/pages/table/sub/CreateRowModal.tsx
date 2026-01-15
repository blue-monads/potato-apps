import RowCoreModal from "./RowCoreModal";
import { type Datatable } from "../../../lib/api";

interface CreateRowModalProps {
    table: Datatable;
    onSave: (data: { table_id: number; row_data?: string; cells?: { column_id: number; value: string }[] }) => Promise<void>;
    onCancel: () => void;
}

const CreateRowModal = ({ table, onSave, onCancel }: CreateRowModalProps) => {
    return (
        <RowCoreModal
            table={table}
            onSave={async (cellValues, rowData) => {
                const cells = Object.entries(cellValues)
                    .filter(([_, value]) => value.trim())
                    .map(([columnId, value]) => ({
                        column_id: parseInt(columnId),
                        value: value.trim(),
                    }));
                await onSave({
                    table_id: table.id,
                    row_data: rowData || undefined,
                    cells: cells.length > 0 ? cells : undefined,
                });
            }}
            onCancel={onCancel}
            submitLabel="Create Row"
        />
    );
};

export default CreateRowModal;
