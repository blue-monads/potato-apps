export {}

declare global {
    interface Window {
        spaceGetToken?: (spaceKey: string) => string | null;
        spaceRedirrectToAuth?: (spaceUrl: string, actualPage: string) => void;
        spaceFilePicker?: (spaceToken: string) => {
            showModal: (callback: (file: any) => void) => void;
            closeModal: () => void;
        } | null;
    }
}