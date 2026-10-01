import { useState, useEffect, useRef } from 'react';
import { User, Building2, Search, Plus, X, ChevronDown, Check } from 'lucide-react';
import { listContacts, type Contact, type ContactRelationType } from '../lib/api';
import { useModal } from '../lib/shared/modal/modal';
import ContactForm from '../pages/contacts/ContactForm';

interface ContactPickerProps {
    value?: number | null; // contact_id
    altName?: string; // custom or fallback name
    onChange: (contactId: number | null, contactName: string) => void;
    filterRelation?: ContactRelationType;
    label?: string;
    placeholder?: string;
    required?: boolean;
}

const ContactPicker = ({
    value,
    altName = '',
    onChange,
    filterRelation,
    label = 'Contact',
    placeholder = 'Search or enter contact name...',
    required = false,
}: ContactPickerProps) => {
    const { openModal, closeModal } = useModal();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState(altName);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const loadContacts = async () => {
        setLoading(true);
        try {
            const resp = await listContacts();
            if (resp.status === 200 && Array.isArray(resp.data)) {
                setContacts(resp.data);
            }
        } catch (err) {
            console.error('Failed to load contacts', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadContacts();
    }, []);

    // Sync search query when value / altName changes from outside
    useEffect(() => {
        if (value) {
            const found = contacts.find(c => c.id === value);
            if (found) {
                setSearchQuery(found.name);
            } else if (altName) {
                setSearchQuery(altName);
            }
        } else {
            setSearchQuery(altName || '');
        }
    }, [value, altName, contacts]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedContact = contacts.find(c => c.id === value) || null;

    // Filter contacts: match relation if specified; general contacts always show in any case
    const filteredContacts = contacts.filter(c => {
        if (filterRelation && c.relation_type !== filterRelation && c.relation_type !== 'general') {
            return false;
        }
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            c.name.toLowerCase().includes(q) ||
            (c.primary_email && c.primary_email.toLowerCase().includes(q)) ||
            (c.primary_phone && c.primary_phone.toLowerCase().includes(q))
        );
    });

    const handleSelect = (contact: Contact) => {
        onChange(contact.id, contact.name);
        setSearchQuery(contact.name);
        setIsOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null, '');
        setSearchQuery('');
        setIsOpen(false);
    };

    const handleUseManualName = () => {
        const trimmed = searchQuery.trim();
        if (trimmed) {
            onChange(null, trimmed);
        }
        setIsOpen(false);
    };

    const handleOpenCreateModal = () => {
        setIsOpen(false);
        openModal({
            title: `Add New ${filterRelation === 'supplier' ? 'Vendor' : filterRelation === 'customer' ? 'Customer' : 'Contact'}`,
            content: (
                <ContactForm
                    contact={null}
                    initialRelationType={filterRelation || 'customer'}
                    onSave={() => {
                        closeModal();
                        loadContacts().then(() => {
                            // After reload, if we want to auto-select, the list will update
                        });
                    }}
                    onCancel={() => closeModal()}
                />
            ),
        });
    };

    return (
        <div className="relative font-sans" ref={dropdownRef}>
            {label && (
                <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                        {label} {required && <span className="text-red-500">*</span>}
                    </label>
                    <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="text-xs font-semibold text-[#2E6E52] hover:text-[#255842] flex items-center gap-1"
                    >
                        <Plus className="w-3 h-3" />
                        New Contact
                    </button>
                </div>
            )}

            {/* Input / Display Field */}
            <div className="relative">
                <div
                    onClick={() => setIsOpen(true)}
                    className={`w-full flex items-center gap-2 px-3.5 py-2.5 bg-stone-50 border rounded-xl cursor-text transition-all ${
                        isOpen ? 'ring-2 ring-[#2E6E52] bg-white border-[#2E6E52]' : 'border-[#E1E3DB] hover:bg-stone-100/70'
                    }`}
                >
                    {selectedContact ? (
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-6 h-6 rounded-lg bg-[#EAF3EE] text-[#2E6E52] flex items-center justify-center flex-shrink-0 text-xs font-bold">
                                {selectedContact.contact_type === 'company' ? (
                                    <Building2 className="w-3.5 h-3.5" />
                                ) : (
                                    <User className="w-3.5 h-3.5" />
                                )}
                            </div>
                            <span className="text-sm font-semibold text-stone-900 truncate">
                                {selectedContact.name}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-200/70 text-stone-600 capitalize">
                                {selectedContact.relation_type}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Search className="w-4 h-4 text-stone-400 flex-shrink-0" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    if (!isOpen) setIsOpen(true);
                                    // Also set altName as user types
                                    onChange(null, e.target.value);
                                }}
                                onFocus={() => setIsOpen(true)}
                                placeholder={placeholder}
                                className="w-full bg-transparent text-sm focus:outline-none text-stone-900 placeholder-stone-400"
                            />
                        </div>
                    )}

                    <div className="flex items-center gap-1 text-stone-400 flex-shrink-0">
                        {(selectedContact || searchQuery) && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="p-1 hover:text-stone-700 hover:bg-stone-200/60 rounded-md transition-colors"
                                title="Clear selection"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#E1E3DB] rounded-xl shadow-lg z-50 overflow-hidden max-h-72 flex flex-col">
                    {/* Header quick create */}
                    <div className="p-2 border-b border-[#E1E3DB] bg-[#FAFBF9] flex items-center justify-between">
                        <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                            {filterRelation === 'supplier' ? 'Suppliers & General' : filterRelation === 'customer' ? 'Customers & General' : 'Contacts'}
                        </span>
                        <button
                            type="button"
                            onClick={handleOpenCreateModal}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E6E52] hover:text-[#255842] px-2 py-0.5 rounded hover:bg-[#EAF3EE] transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add Contact
                        </button>
                    </div>

                    {/* Contacts List */}
                    <div className="overflow-y-auto flex-1 divide-y divide-stone-100">
                        {loading ? (
                            <div className="p-4 text-center text-xs text-stone-400">Loading contacts...</div>
                        ) : filteredContacts.length === 0 ? (
                            <div className="p-4 text-center">
                                <p className="text-xs text-stone-500 mb-2">No matching contact found.</p>
                                {searchQuery.trim() && (
                                    <button
                                        type="button"
                                        onClick={handleUseManualName}
                                        className="text-xs font-semibold text-[#2E6E52] hover:underline block mx-auto"
                                    >
                                        Use "{searchQuery.trim()}" as one-off name
                                    </button>
                                )}
                            </div>
                        ) : (
                            filteredContacts.map((c) => {
                                const isSelected = c.id === value;
                                return (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => handleSelect(c)}
                                        className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-stone-50 transition-colors ${
                                            isSelected ? 'bg-[#EAF3EE]/50 font-semibold' : ''
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-7 h-7 rounded-lg bg-[#EEF0EA] flex items-center justify-center text-stone-600 flex-shrink-0">
                                                {c.contact_type === 'company' ? (
                                                    <Building2 className="w-3.5 h-3.5" />
                                                ) : (
                                                    <User className="w-3.5 h-3.5" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-semibold text-stone-900 truncate flex items-center gap-1.5">
                                                    {c.name}
                                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-100 text-stone-500 font-normal">
                                                        {c.relation_type}
                                                    </span>
                                                </div>
                                                {(c.primary_email || c.primary_phone) && (
                                                    <div className="text-[11px] text-stone-400 truncate">
                                                        {c.primary_email || c.primary_phone}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {isSelected && (
                                            <Check className="w-4 h-4 text-[#2E6E52] flex-shrink-0" />
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Bottom option to use typed text as one-off name if not exact match */}
                    {searchQuery.trim() && !contacts.some(c => c.name.toLowerCase() === searchQuery.trim().toLowerCase()) && (
                        <div className="p-2 border-t border-[#E1E3DB] bg-[#FAFBF9]">
                            <button
                                type="button"
                                onClick={handleUseManualName}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-stone-100 text-xs text-stone-700 flex items-center gap-2 transition-colors"
                            >
                                <span className="w-2 h-2 rounded-full bg-stone-400" />
                                <span>Use <strong>"{searchQuery.trim()}"</strong> as custom name (not saved to contacts)</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ContactPicker;
