import RowCoreModal from "./RowCoreModal";
import { type Datatable, type DatatableRow } from "../../../lib/api";

interface EditRowModalProps {
    table: Datatable;
    row: DatatableRow;
    onSave: (cellUpdates: { column_id: number; value: string }[]) => Promise<void>;
    onDelete: () => Promise<void>;
    onCancel: () => void;
}

const EditRowModal = ({ table, row, onSave, onDelete, onCancel }: EditRowModalProps) => {
    return (
        <RowCoreModal
            table={table}
            row={row}
            onSave={async (cellValues) => {
                const updates = Object.entries(cellValues).map(([columnId, value]) => ({
                    column_id: parseInt(columnId),
                    value: value,
                }));
                await onSave(updates);
            }}
            onCancel={onCancel}
            onDelete={onDelete}
            submitLabel="Save Changes"
        />
    );
};

export default EditRowModal;
