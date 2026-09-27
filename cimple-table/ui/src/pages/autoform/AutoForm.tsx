import { useParams, useNavigate } from "react-router";
import AutoFormPanel from "./AutoFormPanel";
import { BASE_PATH } from "../../lib/base";

export default function AutoForm() {
    const { formId } = useParams<{ formId?: string }>();
    const navigate = useNavigate();

    const selectedId = formId ? parseInt(formId, 10) : null;

    return (
        <AutoFormPanel
            formId={selectedId}
            onSelectFormId={(id) => {
                if (id) {
                    navigate(`${BASE_PATH}autoform/${id}`);
                } else {
                    navigate(`${BASE_PATH}autoform`);
                }
            }}
            isSidebar={false}
        />
    );
}
