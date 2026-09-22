import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import api from "../../lib/api";
import type { Form, FormField } from "../Builder/sub/ftype";
import { ACCENTS } from "../Builder/sub/FormBuilder";
import { FileInput } from "../../components/FileInput";
import { LocationPicker } from "../../components/LocationPicker";

function getFieldOptions(fieldOptions: any): string[] {
  if (Array.isArray(fieldOptions)) return fieldOptions;
  if (typeof fieldOptions === "string") {
    try {
      const parsed = JSON.parse(fieldOptions);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === "object" && parsed !== null) return Object.values(parsed);
    } catch {}
  } else if (typeof fieldOptions === "object" && fieldOptions !== null) {
    return Object.values(fieldOptions);
  }
  return [];
}

export default function SubmitterPage() {
  const [searchParams] = useSearchParams();
  const formIdParam = searchParams.get("form_id");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<number, any>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});

  const firstErrorRef = useRef<HTMLDivElement | null>(null);

  // Load form on mount or when form_id changes
  useEffect(() => {
    if (!formIdParam) {
      setLoadError("No form specified. Please use a link that includes ?form_id=...");
      setLoading(false);
      return;
    }

    const formId = parseInt(formIdParam, 10);
    if (isNaN(formId)) {
      setLoadError("Invalid form ID specified.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    api.getPublicForm(formId)
      .then(res => {
        if (!res || !res.form) {
          setLoadError("Form not found or no longer available.");
          return;
        }

        // Parse meta if accent is embedded in extra info
        let formAccent = res.form.accent || "teal";
        const rawForm: any = res.form;
        if (rawForm.extrameta) {
          try {
            const meta = typeof rawForm.extrameta === "string" ? JSON.parse(rawForm.extrameta) : rawForm.extrameta;
            if (meta?.accent) formAccent = meta.accent;
          } catch {}
        }

        const rawFields = Array.isArray(res.fields) ? res.fields : Object.values(res.fields || {});
        const mappedFields: FormField[] = rawFields.map((f: any, idx: number) => {
          let extrameta = f.extrameta || {};
          if (typeof extrameta === "string") {
            try { extrameta = JSON.parse(extrameta); } catch { extrameta = {}; }
          }
          const options = getFieldOptions(f.field_options);

          return {
            id: f.id || Date.now() + idx,
            name: f.name || "Untitled question",
            field_type: f.field_type || "text",
            default_value: f.default_value || "",
            placeholder: extrameta.placeholder || f.placeholder || "",
            help: extrameta.help || extrameta.info || f.help || f.info || "",
            required: extrameta.required !== undefined ? !!extrameta.required : !!f.required,
            field_order: f.field_order !== undefined ? f.field_order : idx,
            field_options: options,
            form_id: f.form_id || formId,
            section_id: f.section_id || 0,
            attributes: extrameta.attributes || f.attributes || {},
          };
        }).sort((a, b) => (a.field_order || 0) - (b.field_order || 0));

        setForm({ ...res.form, accent: formAccent });
        setFields(mappedFields);

        // Prepopulate default values if any
        const initialVals: Record<number, any> = {};
        mappedFields.forEach(f => {
          if (f.default_value !== undefined && f.default_value !== "") {
            initialVals[f.id] = f.default_value;
          }
        });
        setValues(initialVals);
      })
      .catch(err => {
        console.error("Failed to load public form:", err);
        setLoadError(err.message || "Failed to load form. Please check the link or try again later.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [formIdParam]);

  const activeAccent = ACCENTS[form?.accent || "teal"] || ACCENTS.teal;

  const handleInputChange = (fieldId: number, val: any) => {
    setValues(prev => ({ ...prev, [fieldId]: val }));
    if (errors[fieldId]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[fieldId];
        return copy;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<number, string> = {};
    firstErrorRef.current = null;

    fields.forEach(f => {
      const val = values[f.id];

      // Required validation
      if (f.required) {
        if (val === undefined || val === null || val === "") {
          newErrors[f.id] = `${f.name || "This field"} is required.`;
          return;
        }

        if (f.field_type === "checkbox") {
          if (!Array.isArray(val) || val.length === 0) {
            newErrors[f.id] = `Please select at least one option.`;
            return;
          }
        }

        if (f.field_type === "file") {
          if (!val || (Array.isArray(val) && val.length === 0)) {
            newErrors[f.id] = `Please upload a file.`;
            return;
          }
        }

        if (f.field_type === "location") {
          if (!val || typeof val.lat !== "number" || typeof val.lng !== "number") {
            newErrors[f.id] = `Please select a location pin.`;
            return;
          }
        }

        if (f.field_type === "rating") {
          if (typeof val !== "number" || val <= 0) {
            newErrors[f.id] = `Please select a rating.`;
            return;
          }
        }
      }

      // Format validations
      if (f.field_type === "email" && val && typeof val === "string") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(val.trim())) {
          newErrors[f.id] = "Please enter a valid email address.";
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    if (!validate()) {
      // Scroll to the first error if any
      const firstErrEl = document.querySelector(".field-error");
      if (firstErrEl) {
        firstErrEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const submittedAt = new Date().toISOString();
      await api.addSubmission({
        form_id: form.id,
        data: values,
        status: "completed",
        extrameta: {
          submitted_at: submittedAt,
          source: "submitter",
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        },
      });

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      console.error("Submission failed:", err);
      setSubmitError(err.message || "Failed to submit response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setSubmitError(null);
    setErrors({});
    const initialVals: Record<number, any> = {};
    fields.forEach(f => {
      if (f.default_value !== undefined && f.default_value !== "") {
        initialVals[f.id] = f.default_value;
      }
    });
    setValues(initialVals);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F4] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-gray-500"></i>
          <span className="text-sm font-medium text-gray-600">Loading form...</span>
        </div>
      </div>
    );
  }

  // Load error state
  if (loadError || !form) {
    return (
      <div className="min-h-screen bg-[#F7F7F4] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-[#E1E3DB] rounded-2xl shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-2xl mx-auto mb-4">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h2 className="font-heading font-bold text-xl text-gray-900 mb-2">Form Unavailable</h2>
          <p className="text-sm text-gray-600 mb-6">{loadError || "The requested form could not be loaded."}</p>
          <div className="text-xs text-gray-400">
            If you received this link from someone, please verify with them that the link is correct.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#F7F7F4] py-8 sm:py-12 px-4 sm:px-6 flex flex-col justify-between"
      style={{
        "--accent": activeAccent.main,
        "--accent-soft": activeAccent.soft,
      } as React.CSSProperties}
    >
      <div className="max-w-xl w-full mx-auto">
        {submitted ? (
          // Success State
          <div className="bg-white border border-[#E1E3DB] rounded-2xl overflow-hidden shadow-md p-10 text-center flex flex-col items-center animate-fade-in">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4"
              style={{ backgroundColor: activeAccent.soft, color: activeAccent.main }}
            >
              <i className="fa-solid fa-check"></i>
            </div>
            <h2 className="font-heading font-bold text-2xl text-gray-900 mb-2">Response recorded</h2>
            <p className="text-sm text-gray-600 mb-8 max-w-sm">
              Thank you! Your response has been securely submitted.
            </p>
            <button
              onClick={handleReset}
              className="px-6 py-2.5 text-xs font-bold text-gray-700 bg-[#FAFAF7] hover:bg-[#EEF0EA] border border-[#CBCEC3] rounded-lg transition-colors cursor-pointer"
            >
              Submit another response
            </button>
          </div>
        ) : (
          // Form View
          <div className="bg-white border border-[#E1E3DB] rounded-2xl overflow-hidden shadow-md">
            {/* Top Accent Stripe */}
            <div className="h-2 w-full" style={{ backgroundColor: activeAccent.main }}></div>

            <div className="p-6 sm:p-10">
              {/* Form Title & Description */}
              <div className="mb-8">
                <h1 className="font-heading font-bold text-2xl sm:text-3xl text-gray-900 mb-2">
                  {form.name || "Untitled form"}
                </h1>
                {form.description && (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {form.description}
                  </p>
                )}
              </div>

              {submitError && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
                  <i className="fa-solid fa-circle-exclamation mt-0.5 text-red-500"></i>
                  <div className="flex-1">
                    <p className="font-semibold text-xs uppercase tracking-wider mb-0.5">Submission Error</p>
                    <p className="text-xs">{submitError}</p>
                  </div>
                </div>
              )}

              {fields.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  This form does not have any questions yet.
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
                  {fields.map(f => {
                    const error = errors[f.id];
                    const val = values[f.id];

                    return (
                      <div
                        key={f.id}
                        className={`flex flex-col gap-1.5 transition-colors ${
                          error ? "field-error" : ""
                        }`}
                      >
                        <label className="text-sm font-semibold text-gray-800 flex items-center justify-between">
                          <span>
                            {f.name}
                            {f.required && (
                              <span className="text-red-500 ml-1 font-bold" title="Required">*</span>
                            )}
                          </span>
                        </label>

                        {renderSubmitterInput(f, val, (newVal: any) => handleInputChange(f.id, newVal))}

                        {f.help && (
                          <span className="text-xs text-gray-500">{f.help}</span>
                        )}

                        {error && (
                          <span className="text-xs text-red-600 font-medium flex items-center gap-1.5 mt-0.5">
                            <i className="fa-solid fa-circle-exclamation text-[10px]"></i>
                            <span>{error}</span>
                          </span>
                        )}
                      </div>
                    );
                  })}

                  <div className="pt-6 flex items-center justify-between border-t border-[#E1E3DB] mt-4">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-7 py-3 rounded-lg text-sm font-bold text-white shadow-sm transition-all hover:brightness-105 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                      style={{ backgroundColor: activeAccent.main }}
                    >
                      {submitting ? (
                        <>
                          <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <span>Submit</span>
                      )}
                    </button>

                    <span className="text-xs text-gray-400 font-medium">
                      Never submit passwords through forms
                    </span>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Minimal Footer */}
        <div className="text-center mt-6 text-xs text-gray-400 font-medium flex items-center justify-center gap-1.5">
          <span>Powered by</span>
          <span className="text-gray-600 font-semibold">Cimple Form</span>
        </div>
      </div>
    </div>
  );
}

// Input component rendering helper
function renderSubmitterInput(f: FormField, value: any, onChange: (val: any) => void) {
  switch (f.field_type) {
    case "textarea":
      return (
        <textarea
          rows={3}
          value={value || ""}
          placeholder={f.placeholder || ""}
          onChange={e => onChange(e.target.value)}
          className="w-full text-sm p-3 rounded-lg border border-[#CBCEC3] focus:border-[var(--accent)] outline-none transition-colors"
        />
      );

    case "select": {
      const options = getFieldOptions(f.field_options);
      return (
        <select
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          className="w-full text-sm p-3 rounded-lg border border-[#CBCEC3] focus:border-[var(--accent)] outline-none bg-white transition-colors"
        >
          <option value="">Choose an option...</option>
          {options.map((opt, i) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    case "radio": {
      const options = getFieldOptions(f.field_options);
      return (
        <div className="flex flex-col gap-2 pt-1">
          {options.map((opt, i) => (
            <label
              key={i}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer text-sm transition-all ${
                value === opt
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-gray-900"
                  : "border-[#E1E3DB] hover:border-[#CBCEC3] text-gray-700 bg-white"
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
    }

    case "checkbox": {
      const selected = Array.isArray(value) ? value : [];
      const options = getFieldOptions(f.field_options);
      return (
        <div className="flex flex-col gap-2 pt-1">
          {options.map((opt, i) => {
            const isChecked = selected.includes(opt);
            return (
              <label
                key={i}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer text-sm transition-all ${
                  isChecked
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-gray-900"
                    : "border-[#E1E3DB] hover:border-[#CBCEC3] text-gray-700 bg-white"
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
    }

    case "boolean":
      return (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onChange(true)}
            className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${
              value === true
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[#CBCEC3] text-gray-700 bg-white hover:bg-[#EEF0EA]"
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${
              value === false
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[#CBCEC3] text-gray-700 bg-white hover:bg-[#EEF0EA]"
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
              className="hover:scale-110 transition-transform cursor-pointer"
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
          className="w-full text-sm p-3 rounded-lg border border-[#CBCEC3] focus:border-[var(--accent)] outline-none bg-white transition-colors"
        />
      );

    case "number":
      return (
        <input
          type="number"
          value={value || ""}
          placeholder={f.placeholder || ""}
          onChange={e => onChange(e.target.value)}
          className="w-full text-sm p-3 rounded-lg border border-[#CBCEC3] focus:border-[var(--accent)] outline-none bg-white transition-colors"
        />
      );

    case "email":
      return (
        <input
          type="email"
          value={value || ""}
          placeholder={f.placeholder || "name@example.com"}
          onChange={e => onChange(e.target.value)}
          className="w-full text-sm p-3 rounded-lg border border-[#CBCEC3] focus:border-[var(--accent)] outline-none bg-white transition-colors"
        />
      );

    case "file":
      return (
        <FileInput
          value={value}
          onChange={onChange}
          placeholder={f.placeholder || "Upload a document, image, or file"}
          accept={f.attributes?.accept}
        />
      );

    case "location":
      return (
        <LocationPicker
          value={value}
          onChange={onChange}
          placeholder={f.placeholder || "Search address or city..."}
        />
      );

    default:
      return (
        <input
          type="text"
          value={value || ""}
          placeholder={f.placeholder || ""}
          onChange={e => onChange(e.target.value)}
          className="w-full text-sm p-3 rounded-lg border border-[#CBCEC3] focus:border-[var(--accent)] outline-none bg-white transition-colors"
        />
      );
  }
}
