import RowCoreModal from "./RowCoreModal";
import { type Datatable, type DatatableRow } from "../../../lib/api";

interface EditRowModalProps {
    table: Datatable;
    row: DatatableRow;
    onSave: (values: Record<string, string>) => Promise<void>;
    onDelete: () => Promise<void>;
    onCancel: () => void;
}

const EditRowModal = ({ table, row, onSave, onDelete, onCancel }: EditRowModalProps) => {
    return (
        <RowCoreModal
            table={table}
            row={row}
            onSave={onSave}
            onCancel={onCancel}
            onDelete={onDelete}
            submitLabel="Save Changes"
        />
    );
};

export default EditRowModal;
