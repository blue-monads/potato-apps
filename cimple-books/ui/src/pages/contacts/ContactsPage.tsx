import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users, Search, Building2, User, Mail, Phone, MapPin } from 'lucide-react';
import { listContacts, deleteContact, type Contact, type ContactRelationType } from '../../lib/api';
import { useModal } from '../../lib/shared/modal/modal';
import ContactForm from './ContactForm';

type FilterTab = 'all' | 'customer' | 'supplier' | 'general';

const ContactsPage = () => {
    const { openModal, closeModal } = useModal();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const loadContacts = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await listContacts();
            if (resp.status === 200) {
                setContacts(resp.data || []);
            } else {
                setError(resp.error || 'Failed to load contacts');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load contacts');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadContacts();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this contact?')) {
            return;
        }
        try {
            const resp = await deleteContact(id);
            if (resp.status === 200) {
                await loadContacts();
            } else {
                alert(resp.error || 'Failed to delete contact');
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete contact');
        }
    };

    const openContactModal = (contact?: Contact | null, defaultRelation?: ContactRelationType) => {
        openModal({
            title: contact ? 'Edit Contact' : 'New Contact',
            content: (
                <ContactForm
                    contact={contact || null}
                    initialRelationType={defaultRelation || (activeTab !== 'all' ? (activeTab as ContactRelationType) : 'customer')}
                    onSave={() => {
                        closeModal();
                        loadContacts();
                    }}
                    onCancel={() => closeModal()}
                />
            ),
        });
    };

    const getRelationBadge = (relation: string) => {
        switch (relation) {
            case 'customer':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Customer
                    </span>
                );
            case 'supplier':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                        Supplier / Vendor
                    </span>
                );
            case 'general':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                        General
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                        {relation || 'General'}
                    </span>
                );
        }
    };

    const getAvatarInitials = (name: string) => {
        const parts = name.trim().split(' ').filter(Boolean);
        if (parts.length === 0) return '?';
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    const filteredContacts = contacts.filter((c) => {
        // Tab filter: general contacts show in any case
        if (activeTab === 'customer' && c.relation_type !== 'customer' && c.relation_type !== 'general') return false;
        if (activeTab === 'supplier' && c.relation_type !== 'supplier' && c.relation_type !== 'general') return false;
        if (activeTab === 'general' && c.relation_type !== 'general') return false;

        // Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const inName = c.name && c.name.toLowerCase().includes(q);
            const inEmail = c.primary_email && c.primary_email.toLowerCase().includes(q);
            const inPhone = c.primary_phone && c.primary_phone.toLowerCase().includes(q);
            const inAddr = c.primary_address && c.primary_address.toLowerCase().includes(q);
            const inInfo = c.info && c.info.toLowerCase().includes(q);
            if (!inName && !inEmail && !inPhone && !inAddr && !inInfo) return false;
        }

        return true;
    });

    const totalCount = contacts.length;
    const customerCount = contacts.filter((c) => c.relation_type === 'customer').length;
    const supplierCount = contacts.filter((c) => c.relation_type === 'supplier').length;
    const generalCount = contacts.filter((c) => c.relation_type === 'general').length;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#F4F5F1]">
                <div className="text-stone-500 font-sans">Loading contacts...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F4F5F1] p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 font-display flex items-center gap-2.5">
                            <Users className="w-7 h-7 text-[#2E6E52]" />
                            Contacts Directory
                        </h1>
                        <p className="text-stone-500 mt-1 text-sm">
                            Manage vendors, suppliers, customers, clients, and team members
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => openContactModal(null)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Add Contact
                    </button>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div
                        onClick={() => setActiveTab('all')}
                        className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer ${
                            activeTab === 'all' ? 'border-[#2E6E52] ring-1 ring-[#2E6E52] shadow-xs' : 'border-[#E1E3DB] hover:border-stone-400'
                        }`}
                    >
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">All Contacts</span>
                        <span className="text-2xl font-black text-stone-900 font-display mt-1 block">{totalCount}</span>
                        <span className="text-xs text-stone-400 mt-0.5 block">Total entities</span>
                    </div>

                    <div
                        onClick={() => setActiveTab('customer')}
                        className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer ${
                            activeTab === 'customer' ? 'border-[#2E6E52] ring-1 ring-[#2E6E52] shadow-xs' : 'border-[#E1E3DB] hover:border-stone-400'
                        }`}
                    >
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Customers</span>
                        <span className="text-2xl font-black text-emerald-800 font-display mt-1 block">{customerCount}</span>
                        <span className="text-xs text-stone-400 mt-0.5 block">Sales clients</span>
                    </div>

                    <div
                        onClick={() => setActiveTab('supplier')}
                        className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer ${
                            activeTab === 'supplier' ? 'border-[#2E6E52] ring-1 ring-[#2E6E52] shadow-xs' : 'border-[#E1E3DB] hover:border-stone-400'
                        }`}
                    >
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Vendors / Suppliers</span>
                        <span className="text-2xl font-black text-blue-800 font-display mt-1 block">{supplierCount}</span>
                        <span className="text-xs text-stone-400 mt-0.5 block">Stock In vendors</span>
                    </div>

                    <div
                        onClick={() => setActiveTab('general')}
                        className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer ${
                            activeTab === 'general' ? 'border-[#2E6E52] ring-1 ring-[#2E6E52] shadow-xs' : 'border-[#E1E3DB] hover:border-stone-400'
                        }`}
                    >
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">General</span>
                        <span className="text-2xl font-black text-purple-800 font-display mt-1 block">{generalCount}</span>
                        <span className="text-xs text-stone-400 mt-0.5 block">Customer & Supplier</span>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                        {error}
                    </div>
                )}

                {/* Filters & Search Toolbar */}
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1 bg-[#EEF0EA] p-1 rounded-xl border border-[#E1E3DB] overflow-x-auto">
                        <button
                            type="button"
                            onClick={() => setActiveTab('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                activeTab === 'all'
                                    ? 'bg-white text-stone-900 shadow-xs'
                                    : 'text-stone-600 hover:text-stone-900'
                            }`}
                        >
                            All ({totalCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('customer')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                activeTab === 'customer'
                                    ? 'bg-white text-stone-900 shadow-xs'
                                    : 'text-stone-600 hover:text-stone-900'
                            }`}
                        >
                            Customers ({customerCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('supplier')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                activeTab === 'supplier'
                                    ? 'bg-white text-stone-900 shadow-xs'
                                    : 'text-stone-600 hover:text-stone-900'
                            }`}
                        >
                            Vendors & Suppliers ({supplierCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('general')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                activeTab === 'general'
                                    ? 'bg-white text-stone-900 shadow-xs'
                                    : 'text-stone-600 hover:text-stone-900'
                            }`}
                        >
                            General ({generalCount})
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative min-w-[260px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <input
                            type="text"
                            placeholder="Search contacts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-[#E1E3DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] text-stone-900 placeholder-stone-400 shadow-xs"
                        />
                    </div>
                </div>

                {/* Contacts Table */}
                <div className="bg-white rounded-2xl border border-[#E1E3DB] shadow-xs overflow-hidden">
                    {filteredContacts.length === 0 ? (
                        <div className="text-center py-16 px-4">
                            <div className="w-12 h-12 rounded-full bg-[#EAF3EE] text-[#2E6E52] flex items-center justify-center mx-auto mb-3">
                                <Users className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-bold text-stone-900 font-display">No contacts found</h3>
                            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1 mb-5">
                                {searchQuery ? 'Try adjusting your search criteria.' : 'Start adding vendors, customers, or team members to your directory.'}
                            </p>
                            {!searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => openContactModal(null)}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add First Contact
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#FAFBF9] border-b border-[#E1E3DB] text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                                        <th className="px-5 py-3.5">Contact Entity</th>
                                        <th className="px-5 py-3.5">Role / Relation</th>
                                        <th className="px-5 py-3.5">Email & Phone</th>
                                        <th className="px-5 py-3.5">Address</th>
                                        <th className="px-5 py-3.5">Remarks / Notes</th>
                                        <th className="px-5 py-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E1E3DB] text-sm text-stone-900">
                                    {filteredContacts.map((c) => {
                                        const isCompany = c.contact_type === 'company';

                                        return (
                                            <tr key={c.id} className="hover:bg-stone-50/60 transition-colors">
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-[#EEF0EA] border border-[#E1E3DB] flex items-center justify-center font-bold text-xs text-stone-700 font-display flex-shrink-0">
                                                            {getAvatarInitials(c.name)}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-stone-900 flex items-center gap-1.5">
                                                                {c.name}
                                                                {isCompany ? (
                                                                    <span title="Company"><Building2 className="w-3.5 h-3.5 text-stone-400" /></span>
                                                                ) : (
                                                                    <span title="Individual"><User className="w-3.5 h-3.5 text-stone-400" /></span>
                                                                )}
                                                            </div>
                                                            {c.info ? (
                                                                <div className="text-xs text-stone-500">{c.info}</div>
                                                            ) : (
                                                                <div className="text-[11px] text-stone-400 capitalize">{c.contact_type}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    {getRelationBadge(c.relation_type)}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-0.5 text-xs">
                                                        {c.primary_email && (
                                                            <div className="text-stone-700 flex items-center gap-1">
                                                                <Mail className="w-3 h-3 text-stone-400" />
                                                                <a href={`mailto:${c.primary_email}`} className="hover:underline text-stone-800">
                                                                    {c.primary_email}
                                                                </a>
                                                            </div>
                                                        )}
                                                        {c.primary_phone && (
                                                            <div className="text-stone-500 flex items-center gap-1">
                                                                <Phone className="w-3 h-3 text-stone-400" />
                                                                <span>{c.primary_phone}</span>
                                                            </div>
                                                        )}
                                                        {!c.primary_email && !c.primary_phone && (
                                                            <span className="text-stone-400 italic">No contact details</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 max-w-xs truncate text-xs text-stone-600">
                                                    {c.primary_address ? (
                                                        <div className="flex items-center gap-1.5 truncate">
                                                            <MapPin className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                                                            <span className="truncate">{c.primary_address}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-stone-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 max-w-xs truncate text-xs text-stone-500">
                                                    {c.notes || '—'}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => openContactModal(c)}
                                                            className="p-1.5 text-stone-500 hover:text-[#2E6E52] hover:bg-[#EEF0EA] rounded-lg transition-colors"
                                                            title="Edit Contact"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(c.id)}
                                                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete Contact"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContactsPage;
