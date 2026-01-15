import ColumnCoreModal from "./ColumnCoreModal";
import { type DatatableColumn } from "../../../lib/api";

interface EditColumnModalProps {
    column: DatatableColumn;
    onSave: (data: { name?: string; column_type?: string; info?: string; required?: boolean; options?: string }) => Promise<void>;
    onDelete: () => Promise<void>;
    onCancel: () => void;
}

const EditColumnModal = ({ column, onSave, onDelete, onCancel }: EditColumnModalProps) => {
    return (
        <ColumnCoreModal
            initialValues={{
                name: column.name,
                column_type: column.column_type,
                info: column.info || "",
                required: column.required || false,
                options: column.options || ""
            }}
            onSave={onSave}
            onCancel={onCancel}
            onDelete={onDelete}
            submitLabel="Save"
        />
    );
};

export default EditColumnModal;
