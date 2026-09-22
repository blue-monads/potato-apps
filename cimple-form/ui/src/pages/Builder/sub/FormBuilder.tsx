import { useState, useEffect } from "react";
import { Link } from "react-router";
import type { Form, FormField, FormStatus } from "./ftype";
import api from "../../../lib/api";
import { basePath } from "../../../lib/base";

// Accent palettes matching demo design
export const ACCENTS: Record<string, { main: string; soft: string; name: string }> = {
  teal:   { main: "#2E6E52", soft: "#E1EFE7", name: "Teal" },
  blue:   { main: "#3E6DA8", soft: "#E6EDF6", name: "Blue" },
  purple: { main: "#7A5CA6", soft: "#EFE9F5", name: "Purple" },
  amber:  { main: "#A9782B", soft: "#F5EEDE", name: "Amber" },
  rose:   { main: "#AA4A62", soft: "#F5E5E9", name: "Rose" },
  slate:  { main: "#565C6B", soft: "#E9EAEE", name: "Slate" },
};

export type AccentKey = keyof typeof ACCENTS;

export interface FieldTypeDef {
  id: string;
  label: string;
  color: "blue" | "purple" | "teal" | "amber" | "rose" | "slate";
  iconClass: string;
}

export const FIELD_TYPES: FieldTypeDef[] = [
  { id: "text",            label: "Short text",      color: "blue",   iconClass: "fa-solid fa-font" },
  { id: "textarea",        label: "Long text",       color: "purple", iconClass: "fa-solid fa-paragraph" },
  { id: "email",           label: "Email",           color: "teal",   iconClass: "fa-solid fa-at" },
  { id: "number",          label: "Number",          color: "amber",  iconClass: "fa-solid fa-hashtag" },
  { id: "date",            label: "Date",            color: "rose",   iconClass: "fa-solid fa-calendar-days" },
  { id: "select",          label: "Dropdown",        color: "slate",  iconClass: "fa-solid fa-square-caret-down" },
  { id: "radio",           label: "Single choice",   color: "blue",   iconClass: "fa-solid fa-circle-dot" },
  { id: "checkbox",        label: "Multiple choice", color: "purple", iconClass: "fa-solid fa-square-check" },
  { id: "boolean",         label: "Yes / no",        color: "teal",   iconClass: "fa-solid fa-toggle-on" },
  { id: "rating",          label: "Rating",          color: "amber",  iconClass: "fa-solid fa-star" },
  { id: "file",            label: "File upload",     color: "rose",   iconClass: "fa-solid fa-paperclip" },
  { id: "location",        label: "Location",        color: "slate",  iconClass: "fa-solid fa-location-dot" },
];

function getTypeDef(typeId: string): FieldTypeDef {
  return FIELD_TYPES.find(t => t.id === typeId) || FIELD_TYPES[0];
}

interface FormBuilderProps {
  formId?: number;
  initialTab?: "build" | "preview" | "responses";
}

interface SubmissionRecord {
  id: string;
  submittedAt: number;
  values: Record<number | string, any>;
}

export default function FormBuilder({ formId, initialTab = "build" }: FormBuilderProps) {
  const [viewMode, setViewMode] = useState<"build" | "preview" | "responses">(initialTab);

  useEffect(() => {
    if (initialTab) {
      setViewMode(initialTab);
    }
  }, [initialTab]);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "saving">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [form, setForm] = useState<Form>({
    id: formId || 0,
    name: "Untitled form",
    description: "",
    status: "draft",
    accent: "teal",
  });

  const [fields, setFields] = useState<FormField[]>([]);
  const [activeFieldId, setActiveFieldId] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Drag and drop state
  const [draggedFieldId, setDraggedFieldId] = useState<number | null>(null);
  const [dragOverFieldId, setDragOverFieldId] = useState<number | null>(null);

  // Submissions state (stored locally per form)
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);

  // Preview form draft state
  const [draftValues, setDraftValues] = useState<Record<number, any>>({});
  const [draftErrors, setDraftErrors] = useState<Record<number, string>>({});
  const [justSubmitted, setJustSubmitted] = useState<boolean>(false);

  // Load existing form or initialize
  useEffect(() => {
    if (!formId) {
      // New form
      const sampleFields: FormField[] = [
        {
          id: 1,
          name: "Full name",
          field_type: "text",
          default_value: "",
          placeholder: "Jamie Rivera",
          required: true,
          field_order: 0,
          field_options: [],
          form_id: 0,
          is_new: true,
        },
        {
          id: 2,
          name: "Email address",
          field_type: "email",
          default_value: "",
          placeholder: "you@example.com",
          help: "We'll send updates to this address.",
          required: true,
          field_order: 1,
          field_options: [],
          form_id: 0,
          is_new: true,
        },
        {
          id: 3,
          name: "How did you hear about us?",
          field_type: "select",
          default_value: "",
          required: false,
          field_order: 2,
          field_options: ["Social Media", "Friend or Colleague", "Search Engine", "Other"],
          form_id: 0,
          is_new: true,
        },
      ];
      setFields(sampleFields);
      setStatus("ready");
      return;
    }

    const loadData = async () => {
      try {
        setStatus("loading");
        setErrorMessage(null);
        const data = await api.getForm(formId);

        let accent = "teal";
        if (data.form) {
          const formMeta = (data.form as any).extrameta;
          if (typeof formMeta === "string") {
            try { accent = JSON.parse(formMeta).accent || "teal"; } catch {}
          } else if (typeof formMeta === "object" && formMeta?.accent) {
            accent = formMeta.accent;
          }
          setForm({
            ...data.form,
            accent: accent || "teal",
          });
        }

        const rawFields = Array.isArray(data.fields) ? data.fields : Object.values(data.fields || {});
        const mappedFields: FormField[] = rawFields.map((f: any, idx: number) => {
          let extrameta = f.extrameta || {};
          if (typeof extrameta === "string") {
            try { extrameta = JSON.parse(extrameta); } catch { extrameta = {}; }
          }
          let options: string[] = [];
          if (Array.isArray(f.field_options)) {
            options = f.field_options;
          } else if (typeof f.field_options === "string") {
            try { options = JSON.parse(f.field_options); } catch { options = []; }
          } else if (typeof f.field_options === "object" && f.field_options !== null) {
            options = Object.values(f.field_options);
          }

          return {
            id: f.id || Date.now() + idx,
            name: f.name || "Untitled field",
            field_type: f.field_type || "text",
            default_value: f.default_value || "",
            placeholder: extrameta.placeholder || f.placeholder || "",
            help: extrameta.help || extrameta.info || f.help || f.info || "",
            required: extrameta.required !== undefined ? !!extrameta.required : !!f.required,
            field_order: f.field_order !== undefined ? f.field_order : idx,
            field_options: options,
            form_id: f.form_id || formId,
            section_id: 0,
            attributes: extrameta.attributes || {},
          };
        }).sort((a, b) => a.field_order - b.field_order);

        setFields(mappedFields);

        // Load local submissions cache if any
        try {
          const subsRaw = localStorage.getItem(`form_submissions_${formId}`);
          if (subsRaw) {
            setSubmissions(JSON.parse(subsRaw));
          }
        } catch {}

        setStatus("ready");
      } catch (err: any) {
        console.error("Failed to load form:", err);
        setErrorMessage(err.message || "Failed to load form");
        setStatus("error");
      }
    };

    loadData();
  }, [formId]);

  // Save form and fields
  const handleSave = async () => {
    try {
      setStatus("saving");
      let savedId = form.id;

      if (!savedId) {
        const createRes = await api.createForm({
          name: form.name,
          description: form.description,
          status: form.status,
          accent: form.accent,
        });
        savedId = createRes.id;
        setForm(prev => ({ ...prev, id: savedId, is_new: false, is_modified: false }));
      } else {
        await api.updateForm(savedId, {
          name: form.name,
          description: form.description,
          status: form.status,
          accent: form.accent,
        });
        setForm(prev => ({ ...prev, is_modified: false }));
      }

      // Upsert fields
      if (fields.length > 0) {
        const payloadFields = fields.map((f, idx) => ({
          ...f,
          form_id: savedId,
          field_order: idx,
          section_id: 0,
        }));
        const results = await api.bulkUpsertFields(payloadFields);
        if (results && results.results) {
          setFields(prev => prev.map((f, idx) => {
            const res = results.results[idx];
            return {
              ...f,
              id: (res && res.id) ? res.id : f.id,
              is_new: false,
              is_modified: false,
            };
          }));
        }
      }

      setIsDirty(false);
      setStatus("ready");
    } catch (err: any) {
      console.error("Save error:", err);
      alert("Failed to save: " + (err.message || String(err)));
      setStatus("ready");
    }
  };

  // Add field
  const handleAddField = (typeId: string) => {
    const t = getTypeDef(typeId);
    const newField: FormField = {
      id: Date.now(),
      name: `${t.label} question`,
      field_type: typeId,
      default_value: "",
      placeholder: "",
      help: "",
      required: false,
      field_order: fields.length,
      field_options: ["select", "radio", "checkbox"].includes(typeId) ? ["Option 1", "Option 2"] : [],
      form_id: form.id,
      section_id: 0,
      is_new: true,
    };

    setFields(prev => [...prev, newField]);
    setActiveFieldId(newField.id);
    setIsDirty(true);
  };

  // Duplicate field
  const handleDuplicateField = (fieldId: number) => {
    const idx = fields.findIndex(f => f.id === fieldId);
    if (idx === -1) return;
    const original = fields[idx];
    const copy: FormField = {
      ...JSON.parse(JSON.stringify(original)),
      id: Date.now(),
      name: `${original.name} (Copy)`,
      field_order: idx + 1,
      is_new: true,
    };
    const updated = [...fields];
    updated.splice(idx + 1, 0, copy);
    setFields(updated);
    setActiveFieldId(copy.id);
    setIsDirty(true);
  };

  // Delete field
  const handleDeleteField = async (fieldId: number) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    if (!field.is_new && field.id) {
      try {
        await api.deleteField(field.id);
      } catch (err) {
        console.error("Failed to delete field on backend:", err);
      }
    }

    setFields(prev => prev.filter(f => f.id !== fieldId));
    if (activeFieldId === fieldId) {
      setActiveFieldId(null);
    }
    setIsDirty(true);
  };

  // Update field property
  const handleUpdateField = (fieldId: number, patch: Partial<FormField>) => {
    setFields(prev => prev.map(f => {
      if (f.id === fieldId) {
        return { ...f, ...patch, is_modified: !f.is_new };
      }
      return f;
    }));
    setIsDirty(true);
  };

  // Drag and drop reordering
  const handleDragStart = (id: number) => {
    setDraggedFieldId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    setDragOverFieldId(id);
  };

  const handleDrop = (targetId: number) => {
    if (draggedFieldId === null || draggedFieldId === targetId) {
      setDraggedFieldId(null);
      setDragOverFieldId(null);
      return;
    }

    const fromIdx = fields.findIndex(f => f.id === draggedFieldId);
    const toIdx = fields.findIndex(f => f.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const updated = [...fields];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);

    // Update order
    const reordered = updated.map((f, i) => ({ ...f, field_order: i, is_modified: true }));
    setFields(reordered);
    setDraggedFieldId(null);
    setDragOverFieldId(null);
    setIsDirty(true);
  };

  // Preview Submission
  const handlePreviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<number, string> = {};

    fields.forEach(f => {
      if (!f.required) return;
      const val = draftValues[f.id];
      const empty = val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0);
      if (empty) {
        errors[f.id] = "This field is required.";
      }
    });

    setDraftErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // Record submission
    const newSub: SubmissionRecord = {
      id: Math.random().toString(36).slice(2, 10),
      submittedAt: Date.now(),
      values: { ...draftValues },
    };

    const updatedSubs = [newSub, ...submissions];
    setSubmissions(updatedSubs);
    if (form.id) {
      try {
        localStorage.setItem(`form_submissions_${form.id}`, JSON.stringify(updatedSubs));
      } catch {}
    }

    setJustSubmitted(true);
    setDraftValues({});
    setDraftErrors({});
  };

  const handleClearSubmissions = () => {
    if (confirm("Delete all responses for this form? This cannot be undone.")) {
      setSubmissions([]);
      if (form.id) {
        localStorage.removeItem(`form_submissions_${form.id}`);
      }
    }
  };

  const activeField = fields.find(f => f.id === activeFieldId);
  const activeAccent = ACCENTS[form.accent || "teal"] || ACCENTS.teal;

  if (status === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <i className="fa-solid fa-circle-notch fa-spin text-2xl text-[var(--accent)]"></i>
          <span className="text-sm font-medium">Loading form...</span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex-1 flex items-center justify-center p-6 h-full">
        <div className="bg-white border border-red-200 rounded-xl p-8 max-w-md text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 text-xl">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Failed to load form</h2>
          <p className="text-sm text-gray-500 mb-6">{errorMessage || "Something went wrong."}</p>
          <Link
            to={`${basePath}forms`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-black transition-colors"
          >
            <i className="fa-solid fa-arrow-left"></i>
            Back to Forms
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]" style={{ "--accent": activeAccent.main, "--accent-soft": activeAccent.soft } as any}>
      {/* Top Header matching demo design */}
      <header className="bg-white border-b border-[#E1E3DB] px-6 py-2.5 flex items-center justify-between gap-4 flex-shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={`${basePath}forms`}
            className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-900 bg-[#FAFAF7] hover:bg-[#EEF0EA] border border-[#E1E3DB] px-2.5 py-1.5 rounded-md transition-colors"
          >
            <i className="fa-solid fa-arrow-left text-xs"></i>
            <span>Forms</span>
          </Link>

          <span className="text-gray-300 font-light select-none">/</span>

          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: activeAccent.main }}
            ></span>
            <span className="font-heading font-semibold text-gray-900 truncate max-w-xs md:max-w-md text-sm md:text-base">
              {form.name || "Untitled form"}
            </span>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center bg-[#EEF0EA] p-1 rounded-lg gap-1 text-xs font-semibold">
          <button
            onClick={() => setViewMode("build")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              viewMode === "build"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <i className="fa-solid fa-hammer text-xs"></i>
            <span>Build</span>
          </button>
          <button
            onClick={() => setViewMode("preview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              viewMode === "preview"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <i className="fa-solid fa-eye text-xs"></i>
            <span>Preview</span>
          </button>
          <button
            onClick={() => setViewMode("responses")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              viewMode === "responses"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <i className="fa-solid fa-inbox text-xs"></i>
            <span>Responses</span>
            {submissions.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-black/10 text-gray-800 rounded-full text-[10px]">
                {submissions.length}
              </span>
            )}
          </button>
        </div>

        {/* Save Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={status === "saving"}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold text-white transition-all shadow-sm disabled:opacity-50"
            style={{ backgroundColor: activeAccent.main }}
          >
            {status === "saving" ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                <span>Saving...</span>
              </>
            ) : isDirty ? (
              <>
                <i className="fa-solid fa-floppy-disk text-xs"></i>
                <span>Save</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-check text-xs"></i>
                <span>Saved</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace based on current viewMode */}
      {viewMode === "build" && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Palette */}
          <aside className="w-56 bg-white border-r border-[#E1E3DB] flex flex-col p-4 overflow-y-auto flex-shrink-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3 select-none">
              Add a field
            </div>
            <div className="flex flex-col gap-1">
              {FIELD_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleAddField(t.id)}
                  className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg hover:bg-[#EEF0EA] border border-transparent hover:border-[#E1E3DB] text-gray-700 text-xs font-medium transition-all group"
                >
                  <span className={`field-badge ${t.color}`}>
                    <i className={`${t.iconClass} text-[10px]`}></i>
                  </span>
                  <span className="truncate group-hover:text-gray-900">{t.label}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* Center: Canvas */}
          <main className="flex-1 overflow-y-auto px-6 py-8">
            <div className="max-w-2xl mx-auto flex flex-col gap-6">
              {/* Form Title & Description Block */}
              <div className="bg-white border border-[#E1E3DB] rounded-xl p-6 shadow-sm flex flex-col gap-3">
                <input
                  type="text"
                  value={form.name}
                  onChange={e => {
                    setForm(prev => ({ ...prev, name: e.target.value, is_modified: true }));
                    setIsDirty(true);
                  }}
                  placeholder="Untitled form"
                  className="font-heading font-bold text-2xl text-gray-900 border-b-2 border-transparent focus:border-[var(--accent)] outline-none bg-transparent w-full transition-colors pb-1"
                />
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => {
                    setForm(prev => ({ ...prev, description: e.target.value, is_modified: true }));
                    setIsDirty(true);
                  }}
                  placeholder="Add a description for this form..."
                  className="text-sm text-gray-600 border-b-2 border-transparent focus:border-[var(--accent)] outline-none bg-transparent w-full resize-none transition-colors"
                />
              </div>

              {/* Form Fields Canvas */}
              {fields.length === 0 ? (
                <div className="border-2 border-dashed border-[#CBCEC3] rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3 text-gray-400">
                  <div className="w-12 h-12 rounded-full bg-[#EEF0EA] flex items-center justify-center text-gray-400 text-lg">
                    <i className="fa-solid fa-plus"></i>
                  </div>
                  <h3 className="font-heading font-semibold text-gray-800 text-base">This form has no fields yet</h3>
                  <p className="text-xs text-gray-500 max-w-sm">
                    Click a field type from the left palette to start building your questions.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {fields.map(f => {
                    const isSelected = f.id === activeFieldId;
                    const isOver = f.id === dragOverFieldId;
                    const t = getTypeDef(f.field_type);

                    return (
                      <div
                        key={f.id}
                        draggable
                        onDragStart={() => handleDragStart(f.id)}
                        onDragOver={e => handleDragOver(e, f.id)}
                        onDragLeave={() => setDragOverFieldId(null)}
                        onDrop={() => handleDrop(f.id)}
                        onClick={() => setActiveFieldId(f.id)}
                        className={`bg-white rounded-xl border p-4 transition-all cursor-pointer relative ${
                          isOver ? "border-t-4 border-t-[var(--accent)]" : ""
                        } ${
                          isSelected
                            ? "border-[var(--accent)] shadow-md ring-2 ring-[var(--accent-soft)]"
                            : "border-[#E1E3DB] hover:border-[#CBCEC3] hover:shadow-sm"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Drag handle */}
                          <div className="cursor-grab text-gray-300 hover:text-gray-600 pt-1">
                            <i className="fa-solid fa-grip-vertical text-xs"></i>
                          </div>

                          {/* Body */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`field-badge ${t.color}`}>
                                <i className={`${t.iconClass} text-[10px]`}></i>
                              </span>
                              <span className="font-semibold text-sm text-gray-900 truncate">
                                {f.name || "Untitled question"}
                              </span>
                              {f.required && (
                                <span className="text-red-500 font-bold text-xs" title="Required">*</span>
                              )}
                            </div>

                            {/* Input preview rendering */}
                            <div className="pointer-events-none opacity-80 pt-1">
                              {renderFieldPreviewInput(f)}
                            </div>

                            {f.help && (
                              <div className="text-[11px] text-gray-400 mt-2">
                                {f.help}
                              </div>
                            )}
                          </div>

                          {/* Card actions */}
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleDuplicateField(f.id);
                              }}
                              title="Duplicate"
                              className="w-7 h-7 rounded-md text-gray-400 hover:text-gray-900 hover:bg-[#EEF0EA] flex items-center justify-center transition-colors"
                            >
                              <i className="fa-regular fa-copy text-xs"></i>
                            </button>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleDeleteField(f.id);
                              }}
                              title="Delete"
                              className="w-7 h-7 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors"
                            >
                              <i className="fa-regular fa-trash-can text-xs"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>

          {/* Right: Settings Panel */}
          <aside className="w-80 bg-white border-l border-[#E1E3DB] flex flex-col p-5 overflow-y-auto flex-shrink-0">
            {activeField ? (
              // Field Settings
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-[#E1E3DB] pb-3">
                  <div className="flex items-center gap-2">
                    <span className={`field-badge ${getTypeDef(activeField.field_type).color}`}>
                      <i className={`${getTypeDef(activeField.field_type).iconClass} text-[10px]`}></i>
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                      Field Settings
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveFieldId(null)}
                    className="w-6 h-6 rounded hover:bg-[#EEF0EA] text-gray-400 hover:text-gray-900 flex items-center justify-center"
                    title="Close field settings"
                  >
                    <i className="fa-solid fa-xmark text-xs"></i>
                  </button>
                </div>

                {/* Question Label */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Question label</label>
                  <input
                    type="text"
                    value={activeField.name}
                    onChange={e => handleUpdateField(activeField.id, { name: e.target.value })}
                    className="w-full text-xs p-2 rounded-md border border-[#CBCEC3] focus:border-[var(--accent)] outline-none transition-colors"
                    placeholder="e.g. What is your email?"
                  />
                </div>

                {/* Placeholder input for text types */}
                {["text", "textarea", "email", "number"].includes(activeField.field_type) && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Placeholder</label>
                    <input
                      type="text"
                      value={activeField.placeholder || ""}
                      onChange={e => handleUpdateField(activeField.id, { placeholder: e.target.value })}
                      className="w-full text-xs p-2 rounded-md border border-[#CBCEC3] focus:border-[var(--accent)] outline-none transition-colors"
                      placeholder="e.g. user@example.com"
                    />
                  </div>
                )}

                {/* Options Manager for select, radio, checkbox */}
                {["select", "radio", "checkbox"].includes(activeField.field_type) && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Options</label>
                    <div className="flex flex-col gap-1.5 mb-2">
                      {(activeField.field_options || []).map((opt, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={opt}
                            onChange={e => {
                              const newOpts = [...(activeField.field_options || [])];
                              newOpts[i] = e.target.value;
                              handleUpdateField(activeField.id, { field_options: newOpts });
                            }}
                            className="flex-1 text-xs p-1.5 rounded border border-[#CBCEC3] focus:border-[var(--accent)] outline-none"
                          />
                          <button
                            onClick={() => {
                              const newOpts = (activeField.field_options || []).filter((_, idx) => idx !== i);
                              handleUpdateField(activeField.id, { field_options: newOpts });
                            }}
                            className="w-6 h-6 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center"
                            title="Remove option"
                          >
                            <i className="fa-solid fa-xmark text-xs"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        const newOpts = [...(activeField.field_options || []), `Option ${(activeField.field_options || []).length + 1}`];
                        handleUpdateField(activeField.id, { field_options: newOpts });
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)] rounded-md border border-dashed border-[#CBCEC3] transition-colors"
                    >
                      <i className="fa-solid fa-plus text-xs"></i>
                      <span>Add option</span>
                    </button>
                  </div>
                )}

                {/* Help text */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Help text</label>
                  <textarea
                    rows={2}
                    value={activeField.help || ""}
                    onChange={e => handleUpdateField(activeField.id, { help: e.target.value })}
                    className="w-full text-xs p-2 rounded-md border border-[#CBCEC3] focus:border-[var(--accent)] outline-none resize-none transition-colors"
                    placeholder="Optional guidance shown below the field"
                  />
                </div>

                {/* Required toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-[#E1E3DB]">
                  <div>
                    <div className="text-xs font-semibold text-gray-800">Required field</div>
                    <div className="text-[11px] text-gray-400">Users must answer this question</div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={activeField.required}
                      onChange={e => handleUpdateField(activeField.id, { required: e.target.checked })}
                    />
                    <span className="track"></span>
                  </label>
                </div>

                {/* Delete Field */}
                <div className="pt-4 border-t border-[#E1E3DB] mt-2">
                  <button
                    onClick={() => handleDeleteField(activeField.id)}
                    className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1.5"
                  >
                    <i className="fa-regular fa-trash-can text-xs"></i>
                    <span>Delete this field</span>
                  </button>
                </div>
              </div>
            ) : (
              // Form Settings
              <div className="flex flex-col gap-5">
                <div className="border-b border-[#E1E3DB] pb-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Form Settings
                  </div>
                </div>

                {/* Accent Color Picker */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Accent Color</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {Object.entries(ACCENTS).map(([key, item]) => {
                      const isSelected = (form.accent || "teal") === key;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setForm(prev => ({ ...prev, accent: key, is_modified: true }));
                            setIsDirty(true);
                          }}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                            isSelected ? "ring-2 ring-offset-2 ring-gray-900 scale-105" : "hover:scale-105"
                          }`}
                          style={{ backgroundColor: item.main }}
                          title={item.name}
                        >
                          {isSelected && <i className="fa-solid fa-check text-white text-[10px]"></i>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Form Status */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Publish Status</label>
                  <select
                    value={form.status || "draft"}
                    onChange={e => {
                      setForm(prev => ({ ...prev, status: e.target.value as FormStatus, is_modified: true }));
                      setIsDirty(true);
                    }}
                    className="w-full text-xs p-2 rounded-md border border-[#CBCEC3] focus:border-[var(--accent)] outline-none bg-white font-medium"
                  >
                    <option value="draft">Draft (Private)</option>
                    <option value="published">Published (Live)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                {/* Summary stats */}
                <div className="bg-[#FAFAF7] border border-[#E1E3DB] rounded-lg p-3 grid grid-cols-2 gap-2 text-center">
                  <div>
                    <div className="font-heading font-bold text-lg text-gray-900">{fields.length}</div>
                    <div className="text-[11px] text-gray-400">Total Fields</div>
                  </div>
                  <div>
                    <div className="font-heading font-bold text-lg text-gray-900">{submissions.length}</div>
                    <div className="text-[11px] text-gray-400">Responses</div>
                  </div>
                </div>

                {/* Shortcuts */}
                <div className="flex flex-col gap-2 pt-2 border-t border-[#E1E3DB]">
                  <button
                    onClick={() => setViewMode("preview")}
                    className="w-full py-2 px-3 text-xs font-semibold text-gray-700 bg-[#FAFAF7] hover:bg-[#EEF0EA] border border-[#CBCEC3] rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-eye text-xs"></i>
                    <span>Preview form</span>
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Preview View Mode */}
      {viewMode === "preview" && (
        <div className="flex-1 overflow-y-auto px-4 py-8">
          <div className="max-w-xl mx-auto">
            {justSubmitted ? (
              <div className="bg-white border border-[#E1E3DB] rounded-2xl overflow-hidden shadow-lg p-10 text-center flex flex-col items-center">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-4"
                  style={{ backgroundColor: activeAccent.soft, color: activeAccent.main }}
                >
                  <i className="fa-solid fa-check"></i>
                </div>
                <h2 className="font-heading font-bold text-2xl text-gray-900 mb-2">Response recorded</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Thank you! Your submission has been saved to the browser responses list.
                </p>
                <button
                  onClick={() => setJustSubmitted(false)}
                  className="px-5 py-2 text-xs font-bold text-gray-700 bg-[#FAFAF7] hover:bg-[#EEF0EA] border border-[#CBCEC3] rounded-lg transition-colors"
                >
                  Submit another response
                </button>
              </div>
            ) : (
              <div className="bg-white border border-[#E1E3DB] rounded-2xl overflow-hidden shadow-lg">
                {/* Accent top stripe */}
                <div className="h-2 w-full" style={{ backgroundColor: activeAccent.main }}></div>

                <div className="p-8">
                  <h1 className="font-heading font-bold text-2xl text-gray-900 mb-1">{form.name || "Untitled form"}</h1>
                  {form.description && (
                    <p className="text-sm text-gray-500 mb-8 whitespace-pre-wrap">{form.description}</p>
                  )}

                  {fields.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-sm">
                      This form has no fields yet. Switch back to Build to add questions.
                    </div>
                  ) : (
                    <form onSubmit={handlePreviewSubmit} className="flex flex-col gap-6">
                      {fields.map(f => {
                        const error = draftErrors[f.id];
                        const val = draftValues[f.id];

                        return (
                          <div key={f.id} className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-gray-800">
                              {f.name}
                              {f.required && <span className="text-red-500 ml-1">*</span>}
                            </label>

                            {renderInteractivePreviewInput(f, val, (newVal: any) => {
                              setDraftValues(prev => ({ ...prev, [f.id]: newVal }));
                              if (draftErrors[f.id]) {
                                setDraftErrors(prev => {
                                  const c = { ...prev };
                                  delete c[f.id];
                                  return c;
                                });
                              }
                            })}

                            {f.help && <span className="text-xs text-gray-400">{f.help}</span>}
                            {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
                          </div>
                        );
                      })}

                      <div className="pt-4 flex items-center justify-between border-t border-[#E1E3DB] mt-2">
                        <button
                          type="submit"
                          className="px-6 py-2.5 rounded-lg text-sm font-bold text-white shadow transition-all hover:brightness-105 active:scale-95"
                          style={{ backgroundColor: activeAccent.main }}
                        >
                          Submit
                        </button>
                        <span className="text-xs text-gray-400">Stored in this browser</span>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Responses View Mode */}
      {viewMode === "responses" && (
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-heading font-bold text-2xl text-gray-900">Responses</h2>
                <p className="text-xs text-gray-500 mt-1">
                  {submissions.length} response{submissions.length === 1 ? "" : "s"} recorded
                </p>
              </div>

              {submissions.length > 0 && (
                <button
                  onClick={handleClearSubmissions}
                  className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                >
                  Clear all responses
                </button>
              )}
            </div>

            {submissions.length === 0 ? (
              <div className="bg-white border border-[#E1E3DB] rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3 text-gray-400">
                <div className="w-12 h-12 rounded-full bg-[#EEF0EA] flex items-center justify-center text-gray-400 text-lg">
                  <i className="fa-solid fa-inbox"></i>
                </div>
                <h3 className="font-heading font-semibold text-gray-800 text-base">No responses yet</h3>
                <p className="text-xs text-gray-500 max-w-sm">
                  Switch to the Preview tab to submit a test response and see it here.
                </p>
                <button
                  onClick={() => setViewMode("preview")}
                  className="mt-2 px-4 py-2 text-xs font-bold text-white rounded-md shadow-sm transition-all"
                  style={{ backgroundColor: activeAccent.main }}
                >
                  Open Preview
                </button>
              </div>
            ) : (
              <div className="bg-white border border-[#E1E3DB] rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#EEF0EA] border-b border-[#E1E3DB] text-gray-600 font-semibold">
                      <th className="py-3 px-4 whitespace-nowrap">Submitted</th>
                      {fields.map(f => (
                        <th key={f.id} className="py-3 px-4 whitespace-nowrap max-w-xs truncate">
                          {f.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E1E3DB]">
                    {submissions.map(s => (
                      <tr key={s.id} className="hover:bg-[#FAFAF7]">
                        <td className="py-3 px-4 text-gray-400 whitespace-nowrap font-mono text-[11px]">
                          {new Date(s.submittedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        {fields.map(f => {
                          const val = s.values[f.id];
                          let rendered = "—";
                          if (val !== undefined && val !== null && val !== "") {
                            if (Array.isArray(val)) {
                              rendered = val.join(", ");
                            } else if (typeof val === "boolean") {
                              rendered = val ? "Yes" : "No";
                            } else {
                              rendered = String(val);
                            }
                          }
                          return (
                            <td key={f.id} className="py-3 px-4 text-gray-800 max-w-xs truncate">
                              {rendered}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helpers for canvas input previews
function renderFieldPreviewInput(f: FormField) {
  switch (f.field_type) {
    case "textarea":
      return (
        <textarea
          rows={2}
          disabled
          placeholder={f.placeholder || "Long answer text"}
          className="w-full text-xs p-2 rounded border border-[#E1E3DB] bg-[#FAFAF7] resize-none"
        />
      );
    case "select":
      return (
        <div className="flex items-center justify-between w-full text-xs p-2 rounded border border-[#E1E3DB] bg-[#FAFAF7] text-gray-500">
          <span>{f.field_options?.[0] || "Select an option..."}</span>
          <i className="fa-solid fa-chevron-down text-[10px]"></i>
        </div>
      );
    case "radio":
    case "checkbox":
      return (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {(f.field_options || []).slice(0, 4).map((opt, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-[#FAFAF7] border border-[#E1E3DB] text-gray-600 font-medium"
            >
              <i className={f.field_type === "radio" ? "fa-regular fa-circle text-[10px]" : "fa-regular fa-square text-[10px]"}></i>
              {opt}
            </span>
          ))}
          {(!f.field_options || f.field_options.length === 0) && (
            <span className="text-xs text-gray-400 italic">No options defined</span>
          )}
        </div>
      );
    case "boolean":
      return (
        <div className="flex gap-2 w-48">
          <div className="flex-1 py-1.5 text-center text-xs font-semibold rounded border border-[#E1E3DB] bg-[#FAFAF7] text-gray-600">
            Yes
          </div>
          <div className="flex-1 py-1.5 text-center text-xs font-semibold rounded border border-[#E1E3DB] bg-[#FAFAF7] text-gray-600">
            No
          </div>
        </div>
      );
    case "rating":
      return (
        <div className="flex gap-1 text-amber-400 text-sm">
          {[1, 2, 3, 4, 5].map(star => (
            <i key={star} className="fa-regular fa-star"></i>
          ))}
        </div>
      );
    case "file":
      return (
        <div className="border border-dashed border-[#CBCEC3] rounded-lg p-2.5 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
          <i className="fa-solid fa-cloud-arrow-up text-xs"></i>
          <span>Upload file</span>
        </div>
      );
    case "location":
      return (
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-[#FAFAF7] border border-[#E1E3DB] p-2 rounded">
          <i className="fa-solid fa-map-pin text-gray-400"></i>
          <span>Pick location on map</span>
        </div>
      );
    case "date":
      return (
        <div className="flex items-center justify-between w-full text-xs p-2 rounded border border-[#E1E3DB] bg-[#FAFAF7] text-gray-500">
          <span>YYYY-MM-DD</span>
          <i className="fa-regular fa-calendar text-xs"></i>
        </div>
      );
    default:
      return (
        <input
          type="text"
          disabled
          placeholder={f.placeholder || "Short answer text"}
          className="w-full text-xs p-2 rounded border border-[#E1E3DB] bg-[#FAFAF7]"
        />
      );
  }
}

// Helpers for interactive preview inputs
function renderInteractivePreviewInput(f: FormField, value: any, onChange: (val: any) => void) {
  switch (f.field_type) {
    case "textarea":
      return (
        <textarea
          rows={3}
          value={value || ""}
          placeholder={f.placeholder || ""}
          onChange={e => onChange(e.target.value)}
          className="w-full text-sm p-2.5 rounded-lg border border-[#CBCEC3] focus:border-[var(--accent)] outline-none transition-colors"
        />
      );
    case "select":
      return (
        <select
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          className="w-full text-sm p-2.5 rounded-lg border border-[#CBCEC3] focus:border-[var(--accent)] outline-none bg-white transition-colors"
        >
          <option value="">Choose an option...</option>
          {(f.field_options || []).map((opt, i) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    case "radio":
      return (
        <div className="flex flex-col gap-2 pt-1">
          {(f.field_options || []).map((opt, i) => (
            <label
              key={i}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer text-sm transition-all ${
                value === opt
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-gray-900"
                  : "border-[#E1E3DB] hover:border-[#CBCEC3] text-gray-700"
              }`}
            >
              <input
                type="radio"
                name={`field_${f.id}`}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="accent-[var(--accent)]"
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      );
    case "checkbox":
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-col gap-2 pt-1">
          {(f.field_options || []).map((opt, i) => {
            const isChecked = selected.includes(opt);
            return (
              <label
                key={i}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer text-sm transition-all ${
                  isChecked
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-gray-900"
                    : "border-[#E1E3DB] hover:border-[#CBCEC3] text-gray-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {
                    if (isChecked) {
                      onChange(selected.filter(s => s !== opt));
                    } else {
                      onChange([...selected, opt]);
                    }
                  }}
                  className="accent-[var(--accent)]"
                />
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
      );
    case "boolean":
      return (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onChange(true)}
            className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
              value === true
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[#CBCEC3] text-gray-700 hover:bg-[#EEF0EA]"
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
              value === false
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[#CBCEC3] text-gray-700 hover:bg-[#EEF0EA]"
            }`}
          >
            No
          </button>
        </div>
      );
    case "rating":
      const rating = typeof value === "number" ? value : 0;
      return (
        <div className="flex gap-2 text-2xl text-amber-400 py-1">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              type="button"
              key={star}
              onClick={() => onChange(star)}
              className="hover:scale-110 transition-transform"
            >
              <i className={star <= rating ? "fa-solid fa-star" : "fa-regular fa-star text-gray-300"}></i>
            </button>
          ))}
        </div>
      );
    case "date":
      return (
        <input
          type="date"
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          className="w-full text-sm p-2.5 rounded-lg border border-[#CBCEC3] focus:border-[var(--accent)] outline-none transition-colors"
        />
      );
    case "number":
      return (
        <input
          type="number"
          value={value || ""}
          placeholder={f.placeholder || ""}
          onChange={e => onChange(e.target.value)}
          className="w-full text-sm p-2.5 rounded-lg border border-[#CBCEC3] focus:border-[var(--accent)] outline-none transition-colors"
        />
      );
    case "email":
      return (
        <input
          type="email"
          value={value || ""}
          placeholder={f.placeholder || "name@example.com"}
          onChange={e => onChange(e.target.value)}
          className="w-full text-sm p-2.5 rounded-lg border border-[#CBCEC3] focus:border-[var(--accent)] outline-none transition-colors"
        />
      );
    default:
      return (
        <input
          type="text"
          value={value || ""}
          placeholder={f.placeholder || ""}
          onChange={e => onChange(e.target.value)}
          className="w-full text-sm p-2.5 rounded-lg border border-[#CBCEC3] focus:border-[var(--accent)] outline-none transition-colors"
        />
      );
  }
}