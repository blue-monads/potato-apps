import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

declare global {
    interface Window {
        spaceGetToken?: (spaceKey: string) => string | null;
        spaceRedirrectToAuth?: (spaceUrl: string, actualPage: string) => void;
    }
}

interface WithAuthProps {
    children: React.ReactNode
    spaceKey: string
}

const WithSpaceAuth = (props: WithAuthProps) => {
    const [authChecked, setAuthChecked] = useState(false);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        const checkAuth = () => {
            if (typeof window === 'undefined') return;

            // Wait for libspace.js to load
            if (!window.spaceGetToken || !window.spaceRedirrectToAuth) {
                // Retry after a short delay if libspace.js hasn't loaded yet
                setTimeout(checkAuth, 100);
                return;
            }

            const BASE_PATH = `/zz/space/${props.spaceKey}/`;

            const token = window.spaceGetToken(props.spaceKey);
            if (token) {
                // Check if we have an actual_page query parameter (redirect back from auth)
                const actualPage = searchParams.get('actual_page');
                if (actualPage) {
                    // Remove the query parameter
                    const newSearchParams = new URLSearchParams(searchParams);
                    newSearchParams.delete('actual_page');
                    setSearchParams(newSearchParams, { replace: true });
                    // Navigate to the page relative to BASE_PATH

                   

                    const targetPath = actualPage ? `${BASE_PATH}${actualPage}` : BASE_PATH;
                    navigate(targetPath, { replace: true });
                }
                setAuthChecked(true);
            } else {
                // Get current page path for redirect back
                const currentPath = window.location.pathname;
                // Extract the route relative to BASE_PATH
                let actualPage = '';
                if (currentPath.startsWith(BASE_PATH)) {
                    const routePath = currentPath.slice(BASE_PATH.length);
                    actualPage = routePath || '';
                } else {
                    // Fallback: get the last segment if BASE_PATH doesn't match
                    actualPage = currentPath.split('/').pop() || '';
                }
                window.spaceRedirrectToAuth(`/zz/space/${props.spaceKey}`, actualPage);
            }
        };

        checkAuth();
    }, [navigate, searchParams, setSearchParams, props.spaceKey]);

    if (!authChecked) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-gray-500">Checking authentication...</div>
            </div>
        );
    }

    return <>{props.children}</>;
};

export default WithSpaceAuth;

