import TableCoreModal from "./TableCoreModal";
import { type Datatable } from "../../../lib/api";

interface EditTableModalProps {
    table: Datatable;
    onSave: (data: { name?: string; info?: string; icon?: string; color?: string }) => Promise<void>;
    onDelete: () => Promise<void>;
    onCancel: () => void;
}

const EditTableModal = ({ table, onSave, onDelete, onCancel }: EditTableModalProps) => {
    return (
        <TableCoreModal
            initialValues={{
                name: table.name,
                info: table.info || "",
                icon: table.icon || "table",
                color: table.color || "blue",
            }}
            onSave={onSave}
            onCancel={onCancel}
            onDelete={onDelete}
            submitLabel="Save"
        />
    );
};

export default EditTableModal;
