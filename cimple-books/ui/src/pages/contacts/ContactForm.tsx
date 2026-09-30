import { useState, useEffect } from 'react';
import { User, Building2, Mail, Phone, MapPin, FileText, Check } from 'lucide-react';
import { createContact, updateContact, type Contact, type ContactType, type ContactRelationType } from '../../lib/api';

interface ContactFormProps {
    contact?: Contact | null;
    initialRelationType?: ContactRelationType;
    onSave: () => void;
    onCancel?: () => void;
}

const RELATION_OPTIONS: { value: ContactRelationType; label: string; desc: string }[] = [
    { value: 'customer', label: 'Customer / Client', desc: 'Buyer of products or services' },
    { value: 'supplier', label: 'Supplier / Vendor', desc: 'Provides goods or services for stock in' },
    { value: 'employee', label: 'Employee / Staff', desc: 'Internal team member or contractor' },
    { value: 'partner', label: 'Partner', desc: 'Business collaborator or affiliate' },
    { value: 'other', label: 'Other', desc: 'General contact' },
];

const ContactForm = ({ contact, initialRelationType = 'customer', onSave, onCancel }: ContactFormProps) => {
    const isEdit = Boolean(contact);

    const [name, setName] = useState(contact?.name || '');
    const [contactType, setContactType] = useState<ContactType>(contact?.contact_type || 'individual');
    const [relationType, setRelationType] = useState<ContactRelationType>(
        contact?.relation_type || initialRelationType
    );
    const [primaryEmail, setPrimaryEmail] = useState(contact?.primary_email || '');
    const [primaryPhone, setPrimaryPhone] = useState(contact?.primary_phone || '');
    const [primaryAddress, setPrimaryAddress] = useState(contact?.primary_address || '');
    const [info, setInfo] = useState(contact?.info || '');
    const [notes, setNotes] = useState(contact?.notes || '');

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (contact) {
            setName(contact.name || '');
            setContactType(contact.contact_type || 'individual');
            setRelationType(contact.relation_type || 'customer');
            setPrimaryEmail(contact.primary_email || '');
            setPrimaryPhone(contact.primary_phone || '');
            setPrimaryAddress(contact.primary_address || '');
            setInfo(contact.info || '');
            setNotes(contact.notes || '');
        }
    }, [contact]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Contact name is required');
            return;
        }

        setSaving(true);
        setError(null);

        const payload: Partial<Contact> = {
            name: name.trim(),
            contact_type: contactType,
            relation_type: relationType,
            primary_email: primaryEmail.trim(),
            primary_phone: primaryPhone.trim(),
            primary_address: primaryAddress.trim(),
            info: info.trim(),
            notes: notes.trim(),
        };

        try {
            let resp;
            if (isEdit && contact) {
                resp = await updateContact(contact.id, payload);
            } else {
                resp = await createContact(payload);
            }

            if (resp.status === 200) {
                onSave();
            } else {
                setError(resp.error || 'Failed to save contact');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save contact');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-6 max-w-xl w-full font-sans">
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-stone-900 font-display">
                        {isEdit ? `Edit Contact: ${contact?.name}` : 'New Contact'}
                    </h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                        Add customers, vendors, suppliers, or partner details
                    </p>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
                    {error}
                </div>
            )}

            <div className="space-y-4">
                {/* Contact Type Toggle: Individual vs Company */}
                <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Entity Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setContactType('individual')}
                            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                                contactType === 'individual'
                                    ? 'bg-[#2E6E52] text-white border-[#2E6E52] shadow-xs'
                                    : 'bg-stone-50 border-[#E1E3DB] text-stone-600 hover:bg-stone-100'
                            }`}
                        >
                            <User className="w-4 h-4" />
                            Individual
                        </button>
                        <button
                            type="button"
                            onClick={() => setContactType('company')}
                            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                                contactType === 'company'
                                    ? 'bg-[#2E6E52] text-white border-[#2E6E52] shadow-xs'
                                    : 'bg-stone-50 border-[#E1E3DB] text-stone-600 hover:bg-stone-100'
                            }`}
                        >
                            <Building2 className="w-4 h-4" />
                            Company / Organization
                        </button>
                    </div>
                </div>

                {/* Name */}
                <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={contactType === 'company' ? 'Company Name (e.g. Acme Corp)' : 'Full Name (e.g. John Doe)'}
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-[#E1E3DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white text-stone-900 font-semibold"
                        autoFocus
                    />
                </div>

                {/* Relationship Type */}
                <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Relationship Role
                    </label>
                    <select
                        value={relationType}
                        onChange={(e) => setRelationType(e.target.value as ContactRelationType)}
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-[#E1E3DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white text-stone-900 font-medium"
                    >
                        {RELATION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label} — {opt.desc}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-stone-400" />
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={primaryEmail}
                            onChange={(e) => setPrimaryEmail(e.target.value)}
                            placeholder="contact@domain.com"
                            className="w-full px-3.5 py-2 bg-stone-50 border border-[#E1E3DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white text-stone-900"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-stone-400" />
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            value={primaryPhone}
                            onChange={(e) => setPrimaryPhone(e.target.value)}
                            placeholder="+1 (555) 000-0000"
                            className="w-full px-3.5 py-2 bg-stone-50 border border-[#E1E3DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white text-stone-900"
                        />
                    </div>
                </div>

                {/* Address */}
                <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-stone-400" />
                        Address
                    </label>
                    <input
                        type="text"
                        value={primaryAddress}
                        onChange={(e) => setPrimaryAddress(e.target.value)}
                        placeholder="Street, City, State, Country"
                        className="w-full px-3.5 py-2 bg-stone-50 border border-[#E1E3DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white text-stone-900"
                    />
                </div>

                {/* Title / Info */}
                <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-stone-400" />
                        Title / Role / Department
                    </label>
                    <input
                        type="text"
                        value={info}
                        onChange={(e) => setInfo(e.target.value)}
                        placeholder="e.g. Purchasing Manager, Lead Contact, or Procurement Dept."
                        className="w-full px-3.5 py-2 bg-stone-50 border border-[#E1E3DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white text-stone-900"
                    />
                </div>

                {/* Internal Notes */}
                <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Internal Notes
                    </label>
                    <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Additional remarks, tax ID, payment terms, or shipping notes..."
                        className="w-full px-3.5 py-2 bg-stone-50 border border-[#E1E3DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6E52] focus:bg-white text-stone-900 resize-none"
                    />
                </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#E1E3DB]">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 border border-[#E1E3DB] hover:bg-stone-50 text-stone-700 rounded-lg text-sm font-semibold transition-colors"
                    >
                        Cancel
                    </button>
                )}
                <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#2E6E52] hover:bg-[#255842] disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                >
                    <Check className="w-4 h-4" />
                    {saving ? 'Saving...' : isEdit ? 'Update Contact' : 'Create Contact'}
                </button>
            </div>
        </form>
    );
};

export default ContactForm;
