import { useParams, useNavigate } from "react-router";
import AutoDashPanel from "./AutoDashPanel";
import { BASE_PATH } from "../../lib/base";

export default function AutoDash() {
    const { dashId } = useParams<{ dashId?: string }>();
    const navigate = useNavigate();

    const selectedId = dashId ? parseInt(dashId, 10) : null;

    return (
        <AutoDashPanel
            dashId={selectedId}
            onSelectDashId={(id) => {
                if (id) {
                    navigate(`${BASE_PATH}autodash/${id}`);
                } else {
                    navigate(`${BASE_PATH}autodash`);
                }
            }}
            isSidebar={false}
        />
    );
}
