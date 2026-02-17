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
       className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000]"
        onClick={handleOverlayClick}
        // style={{
        //   position: 'fixed',
        //   top: 0,
        //   left: 0,
        //   width: '100%',
        //   height: '100%',
        //   backgroundColor: 'rgba(0, 0, 0, 0.5)',
        //   display: 'flex',
        //   justifyContent: 'center',
        //   alignItems: 'center',
        //   zIndex: 1000,
        // }}
      >
       <div className="bg-white p-6 rounded-2xl shadow-2xl w-[90%] max-w-md animate-in fade-in zoom-in duration-200">
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '10px' }}>
            <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
            {isClosable && (
              <button 
                onClick={handleCloseClick} 
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            )}
          </header>
          <div>{content}</div>
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