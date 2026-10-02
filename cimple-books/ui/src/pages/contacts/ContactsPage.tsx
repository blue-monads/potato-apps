import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users, Search, Building2, User, Mail, Phone, MapPin, X } from 'lucide-react';
import { listContacts, deleteContact, type Contact, type ContactRelationType } from '../../lib/api';
import { useModal } from '../../lib/shared/modal/modal';
import ContactForm from './ContactForm';
import { Pagination } from '../../components/Pagination';

type FilterTab = 'all' | 'customer' | 'supplier' | 'general';

const ContactsPage = () => {
    const { openModal, closeModal } = useModal();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Pagination state (server-side)
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(15);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);

    // Summary counts from server
    const [counts, setCounts] = useState({
        all: 0,
        customer: 0,
        supplier: 0,
        general: 0,
    });

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 280);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Reset to page 1 on tab or search change
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, debouncedSearch]);

    const loadContacts = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await listContacts({
                page: currentPage,
                pageSize,
                search: debouncedSearch,
                relationType: activeTab,
            });
            if (resp.status === 200 && resp.data) {
                setContacts(resp.data.items || []);
                setTotalCount(resp.data.total || 0);
                setTotalPages(resp.data.total_pages || 1);
                if (resp.data.counts) {
                    setCounts(resp.data.counts);
                }
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
    }, [currentPage, pageSize, debouncedSearch, activeTab]);

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
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E6E52] hover:bg-[#255842] text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
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
                        <span className="text-2xl font-black text-stone-900 font-display mt-1 block">{counts.all}</span>
                        <span className="text-xs text-stone-400 mt-0.5 block">Total entities</span>
                    </div>

                    <div
                        onClick={() => setActiveTab('customer')}
                        className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer ${
                            activeTab === 'customer' ? 'border-[#2E6E52] ring-1 ring-[#2E6E52] shadow-xs' : 'border-[#E1E3DB] hover:border-stone-400'
                        }`}
                    >
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Customers</span>
                        <span className="text-2xl font-black text-emerald-800 font-display mt-1 block">{counts.customer}</span>
                        <span className="text-xs text-stone-400 mt-0.5 block">Sales clients</span>
                    </div>

                    <div
                        onClick={() => setActiveTab('supplier')}
                        className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer ${
                            activeTab === 'supplier' ? 'border-[#2E6E52] ring-1 ring-[#2E6E52] shadow-xs' : 'border-[#E1E3DB] hover:border-stone-400'
                        }`}
                    >
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Vendors / Suppliers</span>
                        <span className="text-2xl font-black text-blue-800 font-display mt-1 block">{counts.supplier}</span>
                        <span className="text-xs text-stone-400 mt-0.5 block">Stock In vendors</span>
                    </div>

                    <div
                        onClick={() => setActiveTab('general')}
                        className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer ${
                            activeTab === 'general' ? 'border-[#2E6E52] ring-1 ring-[#2E6E52] shadow-xs' : 'border-[#E1E3DB] hover:border-stone-400'
                        }`}
                    >
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">General</span>
                        <span className="text-2xl font-black text-purple-800 font-display mt-1 block">{counts.general}</span>
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
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                                activeTab === 'all'
                                    ? 'bg-white text-stone-900 shadow-xs'
                                    : 'text-stone-600 hover:text-stone-900'
                            }`}
                        >
                            All ({counts.all})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('customer')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                                activeTab === 'customer'
                                    ? 'bg-white text-stone-900 shadow-xs'
                                    : 'text-stone-600 hover:text-stone-900'
                            }`}
                        >
                            Customers ({counts.customer})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('supplier')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                                activeTab === 'supplier'
                                    ? 'bg-white text-stone-900 shadow-xs'
                                    : 'text-stone-600 hover:text-stone-900'
                            }`}
                        >
                            Vendors & Suppliers ({counts.supplier})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('general')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                                activeTab === 'general'
                                    ? 'bg-white text-stone-900 shadow-xs'
                                    : 'text-stone-600 hover:text-stone-900'
                            }`}
                        >
                            General ({counts.general})
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
                            className="w-full pl-10 pr-9 py-2 bg-white border border-[#E1E3DB] rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#2E6E52] text-stone-900 placeholder-stone-400 shadow-xs"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Contacts Table */}
                <div className="bg-white rounded-2xl border border-[#E1E3DB] shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-[#E1E3DB]">
                            <thead>
                                <tr className="bg-[#FAFBF9] text-left text-xs font-bold text-stone-600 uppercase tracking-wider">
                                    <th className="px-5 py-3.5">Contact</th>
                                    <th className="px-5 py-3.5">Type</th>
                                    <th className="px-5 py-3.5">Role</th>
                                    <th className="px-5 py-3.5">Email</th>
                                    <th className="px-5 py-3.5">Phone</th>
                                    <th className="px-5 py-3.5">Address</th>
                                    <th className="px-5 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E1E3DB]">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-stone-500 animate-pulse">
                                            Loading contacts...
                                        </td>
                                    </tr>
                                ) : contacts.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-stone-500">
                                            {debouncedSearch || activeTab !== 'all'
                                                ? 'No contacts match the current search / filter.'
                                                : 'No contacts found. Click "Add Contact" to create one.'}
                                        </td>
                                    </tr>
                                ) : (
                                    contacts.map((c) => {
                                        const isCompany = c.contact_type === 'company';
                                        return (
                                            <tr key={c.id} className="hover:bg-[#FAFBF9] transition-colors">
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                                                                isCompany
                                                                    ? 'bg-blue-100 text-blue-800'
                                                                    : 'bg-[#E1EFE7] text-[#205C41]'
                                                            }`}
                                                        >
                                                            {getAvatarInitials(c.name)}
                                                        </div>
                                                        <div>
                                                            <span className="font-semibold text-stone-900 block text-sm">
                                                                {c.name}
                                                            </span>
                                                            {c.info && (
                                                                <span className="text-xs text-stone-400 block line-clamp-1">
                                                                    {c.info}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1.5 text-xs text-stone-600 font-medium capitalize">
                                                        {isCompany ? (
                                                            <Building2 className="w-3.5 h-3.5 text-stone-400" />
                                                        ) : (
                                                            <User className="w-3.5 h-3.5 text-stone-400" />
                                                        )}
                                                        {c.contact_type || 'Individual'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    {getRelationBadge(c.relation_type)}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-600">
                                                    {c.primary_email ? (
                                                        <a
                                                            href={`mailto:${c.primary_email}`}
                                                            className="inline-flex items-center gap-1.5 hover:text-[#2E6E52] transition-colors"
                                                        >
                                                            <Mail className="w-3.5 h-3.5 text-stone-400" />
                                                            {c.primary_email}
                                                        </a>
                                                    ) : (
                                                        <span className="text-stone-300">—</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-sm text-stone-600">
                                                    {c.primary_phone ? (
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <Phone className="w-3.5 h-3.5 text-stone-400" />
                                                            {c.primary_phone}
                                                        </span>
                                                    ) : (
                                                        <span className="text-stone-300">—</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-sm text-stone-600 max-w-xs truncate">
                                                    {c.primary_address ? (
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                                                            <span className="truncate">{c.primary_address}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-stone-300">—</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => openContactModal(c)}
                                                            className="p-1.5 text-stone-500 hover:text-[#2E6E52] hover:bg-[#EEF0EA] rounded-lg transition-colors cursor-pointer"
                                                            title="Edit Contact"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(c.id)}
                                                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                            title="Delete Contact"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Server-side Pagination */}
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalCount={totalCount}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setCurrentPage(1);
                        }}
                        itemLabel="contacts"
                    />
                </div>
            </div>
        </div>
    );
};

export default ContactsPage;
