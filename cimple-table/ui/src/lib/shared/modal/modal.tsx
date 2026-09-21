import React, { 
    createContext, 
    useContext, 
    useState, 
    useCallback, 
    useMemo, 
    type ReactNode 
  } from 'react';
  import ReactDOM from 'react-dom';
  
  interface ModalContent {
    title: string;
    content: ReactNode;
    onClose?: () => void;
    isClosable?: boolean;
    maxWidth?: string;
  }
  
  interface ModalContextType {
    openModal: (content: ModalContent) => void;
    closeModal: () => void;
    isModalOpen: boolean;
  }
  
  const ModalContext = createContext<ModalContextType | undefined>(undefined);
  
  export const useModal = (): ModalContextType => {
    const context = useContext(ModalContext);
    if (!context) {
      throw new Error('useModal must be used within a ModalProvider');
    }
    return context;
  };
  
  interface ModalProps {
    modalContent: ModalContent | null;
    isOpen: boolean;
    close: () => void;
  }
  
  const Modal: React.FC<ModalProps> = ({ modalContent, isOpen, close }) => {
    if (!isOpen || !modalContent) return null;
  
    const { title, content, isClosable = true, maxWidth = '500px' } = modalContent;
  
    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && isClosable) {
        close();
      }
    };
  
    const handleCloseClick = () => {
      if (isClosable) {
        if (modalContent.onClose) {
          modalContent.onClose();
        }
        close();
      }
    };
  
    return ReactDOM.createPortal(
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-surface-900/40 p-4 animate-fade-in"
        onClick={handleOverlayClick}
      >
        <div
          className="w-full min-w-[300px] rounded-lg bg-white shadow-2xl"
          style={{ maxWidth }}
        >
          <header className="flex items-center justify-between gap-4 border-b border-surface-200 px-5 py-3">
            <h3 className="text-[15px] font-semibold text-surface-900">{title}</h3>
            {isClosable && (
              <button
                onClick={handleCloseClick}
                className="flex h-6 w-6 items-center justify-center rounded text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-900"
              >
                <i className="fa-solid fa-xmark text-[13px]" />
              </button>
            )}
          </header>
          <div className="px-5 py-4">{content}</div>
        </div>
      </div>,
      document.body // Target element for the portal
    );
  };
  
  interface ModalProviderProps {
    children: ReactNode;
  }
  
  export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState<ModalContent | null>(null);
  
    const openModal = useCallback((content: ModalContent) => {
      setModalContent(content);
      setIsModalOpen(true);
    }, []);
  
    const closeModal = useCallback(() => {
      if (modalContent?.onClose) {
          modalContent.onClose();
      }
      setIsModalOpen(false);
      setModalContent(null);
    }, [modalContent]);
  
    const contextValue = useMemo(() => ({
      openModal,
      closeModal,
      isModalOpen,
    }), [openModal, closeModal, isModalOpen]);
  
    return (
      <ModalContext.Provider value={contextValue}>
        {children}
        <Modal 
          modalContent={modalContent} 
          isOpen={isModalOpen} 
          close={closeModal} 
        />
      </ModalContext.Provider>
    );
  };