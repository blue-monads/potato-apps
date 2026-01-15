import { useState, useRef, useEffect } from "react";
import type { Form, FormField, FormSection } from "./ftype";
import { renderForm } from "./render";
import api from "../../../lib/api";
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  FileIcon,
  HashIcon,
  ImageIcon,
  MailIcon,
  MapPin,
  PlusIcon,
  RadioIcon,
  SaveIcon,
  StarIcon,
  TextIcon,
  TextSelect,
  TextWrapIcon,
  TrashIcon,
  XIcon
} from "lucide-react";

const makeArray = (data: Record<string, any>, key: string) => {
  const value = data[key];

  if (typeof value === 'object' && value !== null) {
    data[key] = Object.values(value);
  }

  if (Array.isArray(data[key])) {
    return
  }

  if (typeof value === "undefined") {
    data[key] = [];
  }

}

const useFormBuilder = (formId?: number) => {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "saving">('loading');
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [activeFieldId, setActiveFieldId] = useState<number | null>(null);
  const [sections, setSections] = useState<FormSection[]>([]);
  const [activeSectionIndex, setActiveSectionIndex] = useState<number>(-1);

  // Load form data
  useEffect(() => {
    console.log('useEffect called with formId:', formId);

    const loadForm = async () => {
      try {
        setStatus('loading');
        const data = await api.getForm(formId!);
        
        makeArray(data, 'sections');
        makeArray(data, 'fields');
      
      
        const mappedFields: FormField[] = data.fields.map((f: any) => {
          const extrameta = f.extrameta || {};
          if (typeof extrameta === "string") {
            f.extrameta = JSON.parse(extrameta);
          }

          makeArray(f, 'field_options');

          return {
            id: f.id,
            name: f.name,
            field_type: f.field_type,
            default_value: f.default_value || "",
            field_order: f.field_order || 0,
            field_options: f.field_options,
            form_id: f.form_id,
            section_id: f.section_id || 0,
            required: extrameta.required || false,
            placeholder: extrameta.placeholder || "",
            info: extrameta.info || "",
            attributes: extrameta.attributes || {},
          };
        });

        setForm(data.form);
        setSections(data.sections);
        setFields(mappedFields);
        setStatus('ready');
      } catch (error) {
        console.error('Failed to load form:', error);
        setStatus('error');
      }
    };

    loadForm();
  }, [formId]);

  const addSection = (section: FormSection) => {
    const newSection = {
      ...section,
      is_new: true,
    };
    setSections([...sections, newSection]);
    setActiveSectionIndex(sections.length);
  }

  const deleteSection = async (sectionId: number) => {
    const currentSections = Array.isArray(sections) ? sections : [];
    const currentFields = Array.isArray(fields) ? fields : [];
    
    // Check if section exists in DB (not is_new)
    const section = currentSections.find(s => s.id === sectionId);
    if (section && !section.is_new) {
      try {
        await api.deleteSection(sectionId);
      } catch (error) {
        console.error('Failed to delete section:', error);
        return;
      }
    }

    setSections(currentSections.filter(s => s.id !== sectionId));
    setFields(currentFields.filter(f => f.section_id !== sectionId));
    if (activeSectionIndex >= currentSections.length - 1) {
      setActiveSectionIndex(Math.max(-1, currentSections.length - 2));
    }
    if (currentFields.some(f => f.section_id === sectionId && f.id === activeFieldId)) {
      setActiveFieldId(null);
    }
  }

  const addField = (field: FormField) => {
    const currentFields = Array.isArray(fields) ? fields : [];
    const sectionFields = currentFields.filter(f => f.section_id === field.section_id);
    const newField = {
      ...field,
      field_order: sectionFields.length,
      is_new: true,
    };
    setFields([...currentFields, newField]);
    setActiveFieldId(newField.id);
  }

  const deleteField = async (fieldId: number) => {
    const currentFields = Array.isArray(fields) ? fields : [];
    const field = currentFields.find(f => f.id === fieldId);
    if (!field) return;

    // Check if field exists in DB (not is_new)
    if (!field.is_new) {
      try {
        await api.deleteField(fieldId);
      } catch (error) {
        console.error('Failed to delete field:', error);
        return;
      }
    }

    // Reorder remaining fields
    const reorderedFields = currentFields
      .filter(f => f.id !== fieldId)
      .map(f => {
        if (f.section_id === field.section_id && f.field_order > field.field_order) {
          return { ...f, field_order: f.field_order - 1, is_modified: true };
        }
        return f;
      });
    setFields(reorderedFields);
    if (activeFieldId === fieldId) {
      setActiveFieldId(null);
    }
  }

  const updateField = (field: FormField) => {
    const currentFields = Array.isArray(fields) ? fields : [];
    setFields(currentFields.map(f => {
      if (f.id === field.id) {
        // Mark as modified if it's not new
        return { ...field, is_modified: !field.is_new };
      }
      return f;
    }));
  }

  const updateSection = (section: FormSection) => {
    const currentSections = Array.isArray(sections) ? sections : [];
    setSections(currentSections.map(s => {
      if (s.id === section.id) {
        // Mark as modified if it's not new
        return { ...section, is_modified: !section.is_new };
      }
      return s;
    }));
  }

  const saveForm = async () => {
    console.log('saveForm called');
    console.log('Form:', form);
    console.log('Status:', status);
    
    if (!form) {
      const error = 'Cannot save: form is null';
      console.error(error);
      alert(error);
      return;
    }

    console.log('Saving form:', form);
    console.log('Sections:', sections);
    console.log('Fields:', fields);

    try {
      setStatus('saving');
      console.log('Status set to saving');

      let savedFormId = form.id;

      // Save form (create or update)
      if (form.is_new) {
        const { id } = await api.createForm({
          name: form.name,
          description: form.description,
          status: form.status,
        });
        savedFormId = id;
        setForm({ ...form, id: savedFormId, is_new: false });
        // Update form_id in sections and fields
        setSections(sections.map(s => ({ ...s, form_id: savedFormId })));
        setFields(fields.map(f => ({ ...f, form_id: savedFormId })));
      } else if (form.is_modified) {
        await api.updateForm(form.id, {
          name: form.name,
          description: form.description,
          status: form.status,
        });
        setForm({ ...form, is_modified: false });
      }

      // Ensure sections and fields are arrays before mapping
      const sectionsArray = Array.isArray(sections) ? sections : [];
      const fieldsArray = Array.isArray(fields) ? fields : [];
      
      // Prepare sections data
      const sectionsData = sectionsArray.map(s => ({
        ...s,
        form_id: savedFormId,
      }));

      // Save sections and get results (only if there are sections)
      let sectionResults: { results: Array<{ id: number; action: string }> } = { results: [] };
      if (sectionsData.length > 0) {
        sectionResults = await api.bulkUpsertSections(sectionsData);
      }
      const sectionIdMap = new Map<number, number>();
      sectionsArray.forEach((s, idx) => {
        const result = sectionResults.results[idx];
        if (result && s.is_new && result.id) {
          sectionIdMap.set(s.id, result.id);
        }
      });

      // Prepare fields data with updated section IDs
      const fieldsData = fieldsArray.map(f => {
        const newSectionId = sectionIdMap.get(f.section_id) || f.section_id;
        return {
          ...f,
          form_id: savedFormId,
          section_id: newSectionId,
        };
      });

      // Save fields and get results (only if there are fields)
      let fieldResults: { results: Array<{ id: number; action: string }> } = { results: [] };
      if (fieldsData.length > 0) {
        fieldResults = await api.bulkUpsertFields(fieldsData);
      }

      // Update local state with new IDs and clear flags
      setSections(sectionsArray.map((s, idx) => {
        const result = sectionResults.results[idx];
        if (result && s.is_new && result.id) {
          return { ...s, id: result.id, is_new: false, is_modified: false };
        }
        return { ...s, is_modified: false };
      }));

      setFields(fieldsArray.map((f, idx) => {
        const result = fieldResults.results[idx];
        const newSectionId = sectionIdMap.get(f.section_id) || f.section_id;
        if (result && f.is_new && result.id) {
          return { ...f, id: result.id, section_id: newSectionId, is_new: false, is_modified: false };
        }
        return { ...f, section_id: newSectionId, is_modified: false };
      }));

      setForm({ ...form, is_new: false, is_modified: false });
      setStatus('ready');
      console.log('Form saved successfully');
    } catch (error) {
      console.error('Failed to save form:', error);
      alert('Failed to save form: ' + (error instanceof Error ? error.message : String(error)));
      setStatus('error');
    }
  }

  const getFieldsForSection = (sectionId: number) => {
    if (!Array.isArray(fields)) {
      return [];
    }
    return fields
      .filter(f => f.section_id === sectionId)
      .sort((a, b) => a.field_order - b.field_order);
  }

  const moveField = (fieldId: number, direction: 'up' | 'down') => {
    const currentFields = Array.isArray(fields) ? fields : [];
    const field = currentFields.find(f => f.id === fieldId);
    if (!field) return;

    const sectionFields = getFieldsForSection(field.section_id);
    const currentIndex = sectionFields.findIndex(f => f.id === fieldId);
    
    if (direction === 'up' && currentIndex > 0) {
      const prevField = sectionFields[currentIndex - 1];
      setFields(currentFields.map(f => {
        if (f.id === fieldId) return { ...f, field_order: prevField.field_order };
        if (f.id === prevField.id) return { ...f, field_order: field.field_order };
        return f;
      }));
    } else if (direction === 'down' && currentIndex < sectionFields.length - 1) {
      const nextField = sectionFields[currentIndex + 1];
      setFields(currentFields.map(f => {
        if (f.id === fieldId) return { ...f, field_order: nextField.field_order };
        if (f.id === nextField.id) return { ...f, field_order: field.field_order };
        return f;
      }));
    }
  }

  return {
    form,
    fields,
    sections,
    updateField,
    addSection,
    deleteSection,
    activeFieldId,
    setActiveFieldId,
    addField,
    deleteField,
    moveField,
    status,
    setStatus,
    activeSectionIndex,
    setActiveSectionIndex,
    updateSection,
    getFieldsForSection,
    saveForm,
    setForm,
  }
}


interface FormBuilderProps {
  formId?: number;
}

const FormBuilder = (props: FormBuilderProps) => {
  const handle = useFormBuilder(props.formId);
  const [showPreview, setShowPreview] = useState(false);
  const previewModalRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Render form in preview modal
  useEffect(() => {
    if (showPreview && previewContentRef.current && handle.form) {
      // Cleanup previous render
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      // Render the form
      const cleanup = renderForm({
        formSchema: {
          form: handle.form,
          fields: handle.fields,
          sections: handle.sections,
        },
        initialData: {},
        onChange: (data) => {
          console.log('Form data changed:', data);
        },
        target: previewContentRef.current,
      });

      cleanupRef.current = cleanup;

      // Cleanup on unmount
      return () => {
        if (cleanupRef.current) {
          cleanupRef.current();
          cleanupRef.current = null;
        }
      };
    }
  }, [showPreview, handle.form, handle.fields, handle.sections]);

  const handlePreviewClick = () => {
    setShowPreview(true);
  };

  const handleClosePreview = () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setShowPreview(false);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="bg-white border-b border-gray-200 py-3 px-6 flex shadow-sm justify-between items-center">

        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Form Builder</h1>
          {handle.form?.name && (
            <>
              <span className="text-gray-300">•</span>
              <h3 className="text-md text-gray-600 font-medium">{handle.form.name}</h3>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Save button clicked');
              console.log('Form state:', handle.form);
              console.log('Status:', handle.status);
              if (!handle.saveForm) {
                console.error('saveForm function is not available');
                return;
              }
              handle.saveForm().catch(err => {
                console.error('Save failed:', err);
                alert('Failed to save: ' + err.message);
              });
            }}
            disabled={handle.status === 'saving' || handle.status === 'loading'}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            title={!handle.form ? 'Form not loaded' : ''}
          >
            <SaveIcon className="w-5 h-5" />
            {handle.status === 'saving' ? 'Saving...' : 'Save'}
          </button>

          <button 
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors shadow-sm hover:shadow-md"
            onClick={handlePreviewClick}
          >
            <EyeIcon className="w-5 h-5" />
            Preview
          </button>

        </div>

      </header>

      <main className="flex-1 flex overflow-auto p-4 bg-gray-50">
        <LeftSidebar handle={handle} />

        <MainContent handle={handle} />

        <RightSidebar handle={handle}
          field={handle.fields.find(f => f.id === handle.activeFieldId)}
          section={handle.activeSectionIndex >= 0 ? handle.sections[handle.activeSectionIndex] : undefined}
        />

      </main>

      {/* Preview Modal */}
      {showPreview && (
        <div
          ref={previewModalRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => {
            if (e.target === previewModalRef.current) {
              handleClosePreview();
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">Form Preview</h2>
              <button
                onClick={handleClosePreview}
                className="p-2 hover:bg-red-50 hover:text-red-600 hover:shadow-md hover:scale-110 rounded-lg text-gray-500 transition-all duration-200"
              >
                <XIcon className="w-5 h-5 transition-transform duration-200 hover:rotate-90" />
              </button>
            </div>

            {/* Modal Content */}
            <div
              ref={previewContentRef}
              className="flex-1 overflow-y-auto p-4"
            >
              {/* Form will be rendered here */}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}


const MainContent = (props: SharedProps) => {
  const sectionFields = (sectionId: number) => props.handle.getFieldsForSection(sectionId);

  const renderFieldPreview = (field: FormField) => {
    const isActive = field.id === props.handle.activeFieldId;
    const baseClasses = `p-3 border rounded-md transition-all duration-200 cursor-pointer ${
      isActive 
        ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]' 
        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-md hover:scale-[1.01]'
    }`;

    return (
      <div
        key={field.id}
        className={baseClasses}
        onClick={(e) => {
          e.stopPropagation();
          props.handle.setActiveFieldId(field.id);
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">{field.name}</span>
            {field.required && (
              <span className="text-xs text-red-500">*</span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.handle.deleteField(field.id);
            }}
            className="p-1 hover:bg-red-100 hover:shadow-md hover:scale-110 rounded text-red-500 transition-all duration-200"
          >
            <TrashIcon className="w-4 h-4 transition-transform duration-200 hover:scale-125" />
          </button>
        </div>
        <div className="text-xs text-gray-400 mb-2">{field.field_type}</div>
        {renderFieldInput(field)}
      </div>
    );
  };

  const renderFieldInput = (field: FormField) => {
    const disabled = true; // Preview mode
    const attrs = field.attributes || {};
    switch (field.field_type.toLowerCase()) {
      case 'text':
      case 'email':
        return (
          <input
            type={field.field_type === 'email' ? 'email' : 'text'}
            placeholder={field.placeholder || `Enter ${field.name.toLowerCase()}`}
            defaultValue={field.default_value}
            disabled={disabled}
            className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
            minLength={attrs.minLength}
            maxLength={attrs.maxLength}
            pattern={attrs.pattern}
          />
        );
      case 'textarea':
        return (
          <textarea
            placeholder={field.placeholder || `Enter ${field.name.toLowerCase()}`}
            defaultValue={field.default_value}
            disabled={disabled}
            className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
            rows={3}
            minLength={attrs.minLength}
            maxLength={attrs.maxLength}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            placeholder={field.placeholder || `Enter ${field.name.toLowerCase()}`}
            defaultValue={field.default_value}
            disabled={disabled}
            className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
            min={attrs.min}
            max={attrs.max}
            step={attrs.step}
          />
        );
      case 'select':
      case 'radio':
        return (
          <div className="flex flex-col gap-2">
            {field.field_options.length > 0 ? (
              field.field_options.map((option, idx) => (
                <label key={idx} className="flex items-center gap-2 text-sm">
                  {field.field_type === 'radio' ? (
                    <input type="radio" disabled={disabled} className="bg-gray-50" />
                  ) : (
                    <input type="checkbox" disabled={disabled} className="bg-gray-50" />
                  )}
                  <span className="text-gray-600">{option}</span>
                </label>
              ))
            ) : (
              <span className="text-xs text-gray-400 italic">No options defined</span>
            )}
          </div>
        );
      case 'checkbox':
        return (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" disabled={disabled} className="bg-gray-50" />
            <span className="text-gray-600">{field.name}</span>
          </label>
        );
      case 'date':
        return (
          <input
            type="date"
            defaultValue={field.default_value}
            disabled={disabled}
            className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
            min={attrs.min}
            max={attrs.max}
          />
        );
      case 'time':
        return (
          <input
            type="time"
            defaultValue={field.default_value}
            disabled={disabled}
            className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
            min={attrs.min}
            max={attrs.max}
          />
        );
      case 'file':
      case 'image':
        const acceptInfo = attrs.accept ? ` (${attrs.accept})` : '';
        const maxSizeInfo = attrs.maxSize ? ` Max: ${attrs.maxSize}MB` : '';
        return (
          <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center text-sm">
            <div className="text-gray-400">Click to upload {field.field_type}</div>
            {(acceptInfo || maxSizeInfo) && (
              <div className="text-xs text-gray-500 mt-1">{acceptInfo}{maxSizeInfo}</div>
            )}
          </div>
        );
      case 'location':
        return (
          <div className="border border-gray-300 rounded-md p-2 text-sm text-gray-400">
            Map picker (preview)
          </div>
        );
      case 'rating':
        const maxRating = attrs.max ?? 5;
        return (
          <div className="flex gap-1">
            {Array.from({ length: maxRating }, (_, i) => i + 1).map((star) => (
              <StarIcon key={star} className="w-5 h-5 text-gray-300" />
            ))}
          </div>
        );
      case 'multiple_choice':
        return (
          <div className="flex flex-col gap-2">
            {field.field_options.length > 0 ? (
              field.field_options.map((option, idx) => (
                <label key={idx} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" disabled={disabled} className="bg-gray-50" />
                  <span className="text-gray-600">{option}</span>
                </label>
              ))
            ) : (
              <span className="text-xs text-gray-400 italic">No options defined</span>
            )}
          </div>
        );
      default:
        return (
          <div className="text-xs text-gray-400 italic">
            Preview not available for {field.field_type}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col overflow-auto p-2 flex-1 gap-4">
      {props.handle.sections.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 animate-pulse">
          <p className="text-sm mb-4">No sections yet. Add your first section to get started.</p>
        </div>
      )}

      {Array.isArray(props.handle.sections) && props.handle.sections.map((section, index) => {
        const fieldsInSection = sectionFields(section.id);
        return (
          <div
            key={section.id}
            className={`flex flex-col rounded-md shadow p-4 border transition-all duration-200 ${
              index === props.handle.activeSectionIndex 
                ? 'border-green-500 bg-green-50/30 shadow-lg scale-[1.01]' 
                : 'border-gray-200 hover:border-green-300 hover:shadow-lg hover:bg-green-50/20'
            }`}
          >
            <div
              className="flex items-center justify-between mb-3 cursor-pointer group"
              onClick={() => {
                props.handle.setActiveSectionIndex(index);
                props.handle.setActiveFieldId(null);
              }}
            >
              <h3 className="text-lg font-semibold text-gray-700 group-hover:text-green-700 transition-colors duration-200">{section.name}</h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.handle.deleteSection(section.id);
                }}
                className="p-1 hover:bg-red-100 hover:shadow-md hover:scale-110 rounded text-red-500 transition-all duration-200"
              >
                <TrashIcon className="w-4 h-4 transition-transform duration-200 hover:scale-125" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {fieldsInSection.length === 0 ? (
                <div className="text-sm text-gray-400 italic py-4 text-center hover:text-gray-500 transition-colors duration-200">
                  No fields in this section. Add fields from the left sidebar.
                </div>
              ) : (
                fieldsInSection.map((field) => renderFieldPreview(field))
              )}
            </div>
          </div>
        );
      })}

      <div className="flex justify-center">
        <button
          className="p-2 hover:bg-green-50 hover:text-green-600 hover:shadow-lg hover:scale-105 rounded-lg text-gray-500 transition-all duration-200 flex items-center gap-2 border border-transparent hover:border-green-200"
          onClick={() => {
            props.handle.addSection({
              id: new Date().getTime(),
              name: "New Section",
              is_new: true,
              section_order: props.handle.sections.length,
              form_id: props.handle.form?.id ?? 0,
              layout: 'horizontal',
            });
          }}
        >
          <PlusIcon className="w-5 h-5 transition-transform duration-200 hover:rotate-90" />
          Add Section
        </button>
      </div>
    </div>
  );
};



interface SharedProps {
  handle: ReturnType<typeof useFormBuilder>;
}


const FIELD_TYPES = [
  {
    sectionName: "Basic",
    fields: [
      {
        name: "Text",
        icon: <TextIcon className="w-6 h-6" />,
      },
      {
        name: "Textarea",
        icon: <TextWrapIcon className="w-6 h-6" />,
      },
      {
        name: "Number",
        icon: <HashIcon className="w-6 h-6" />,
      },
      {
        name: "Email",
        icon: <MailIcon className="w-6 h-6" />,
      },
      {
        name: "Select",
        icon: <TextSelect className="w-6 h-6" />,
      },
      {
        name: "Checkbox",
        icon: <CheckIcon className="w-6 h-6" />,
      },
      {
        name: "Radio",
        icon: <RadioIcon className="w-6 h-6" />,
      },
    ],
  },
  {
    sectionName: "Advanced",
    fields: [
      {
        name: "Rating",
        icon: <StarIcon className="w-6 h-6" />,
      },
      {
        name: "Multiple Choice",
        icon: <TextSelect className="w-6 h-6" />,
      },
      {
        name: "Date",
        icon: <CalendarIcon className="w-6 h-6" />,
      },
      {
        name: "Time",
        icon: <ClockIcon className="w-6 h-6" />,
      },
      {
        name: "File",
        icon: <FileIcon className="w-6 h-6" />,
      },
      {
        name: "Image",
        icon: <ImageIcon className="w-6 h-6" />,
      },
      {
        name: "Location",
        icon: <MapPin className="w-6 h-6" />,
      }
    ],
  },
]


const LeftSidebar = (props: SharedProps) => {
  const getFieldTypeValue = (name: string): string => {
    const mapping: Record<string, string> = {
      'Text': 'text',
      'Textarea': 'textarea',
      'Number': 'number',
      'Email': 'email',
      'Select': 'select',
      'Checkbox': 'checkbox',
      'Radio': 'radio',
      'Rating': 'rating',
      'Multiple Choice': 'multiple_choice',
      'Date': 'date',
      'Time': 'time',
      'File': 'file',
      'Image': 'image',
      'Location': 'location',
    };
    return mapping[name] || name.toLowerCase();
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 p-2 overflow-y-auto">
      <div className="mb-6">
        <div className="flex flex-col gap-4">
          {FIELD_TYPES.map((section) => (
            <div key={section.sectionName}>
              <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase hover:text-green-700 transition-colors duration-200">{section.sectionName}</h3>
              <div className="grid grid-cols-2 gap-2">
                {section.fields.map((field) => (
                  <button
                    key={field.name}
                    onClick={() => {
                      const activeSection = props.handle.activeSectionIndex >= 0
                        ? props.handle.sections[props.handle.activeSectionIndex]
                        : null;

                      if (!activeSection) {
                        // Create a default section if none exists
                        const newSection: FormSection = {
                          id: new Date().getTime(),
                          name: "New Section",
                          is_new: true,
                          section_order: props.handle.sections.length,
                          form_id: props.handle.form?.id ?? 0,
                          layout: 'horizontal',
                        };
                        props.handle.addSection(newSection);
                        
                        props.handle.addField({
                          id: new Date().getTime() + 1,
                          name: field.name,
                          field_type: getFieldTypeValue(field.name),
                          default_value: "",
                          field_order: 0,
                          field_options: [],
                          form_id: props.handle.form?.id ?? 0,
                          required: false,
                          section_id: newSection.id,
                          attributes: {},
                        });
                      } else {
                        props.handle.addField({
                          id: new Date().getTime(),
                          name: field.name,
                          field_type: getFieldTypeValue(field.name),
                          default_value: "",
                          field_order: 0,
                          field_options: [],
                          form_id: props.handle.form?.id ?? 0,
                          required: false,
                          section_id: activeSection.id,
                          attributes: {},
                        });
                      }
                    }}
                    className="group flex flex-col items-center justify-center p-3 border rounded-md hover:bg-green-50 hover:border-green-300 hover:shadow-lg hover:scale-105 active:bg-green-100 active:scale-95 transition-all duration-200 text-xs disabled:hover:scale-100 disabled:hover:shadow-none disabled:hover:bg-gray-50 disabled:hover:border-gray-200"
                    disabled={props.handle.sections.length === 0 && props.handle.activeSectionIndex < 0}
                  >
                    <span className="transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3">
                      {field.icon}
                    </span>
                    <span className="mt-1 transition-colors duration-200 group-hover:text-green-700 group-hover:font-medium">{field.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

interface RightSidebarProps {
  handle: ReturnType<typeof useFormBuilder>;
  field?: FormField;
  section?: FormSection;
}

const RightSidebar = (props: RightSidebarProps) => {
  return (
    <aside className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto flex flex-col gap-6">
      {!props.section && !props.field && (
        <div className="text-sm text-gray-400 text-center py-8 animate-pulse hover:text-gray-500 transition-colors duration-200">
          Select a section or field to edit its properties
        </div>
      )}

      {props.section && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 uppercase hover:text-green-700 transition-colors duration-200">Section Options</h3>
            <button
              onClick={() => props.handle.setActiveSectionIndex(-1)}
              className="p-1 hover:bg-gray-100 hover:shadow-md hover:scale-110 rounded text-gray-500 transition-all duration-200"
            >
              <XIcon className="w-4 h-4 transition-transform duration-200 hover:rotate-90" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-green-700 transition-colors duration-200 cursor-text">Section Name</label>
              <input
                type="text"
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                value={props.section.name}
                onChange={(e) => props.handle.updateSection({
                  ...props.section!,
                  name: e.target.value,
                })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-green-700 transition-colors duration-200 cursor-text">Layout</label>
              <select
                value={props.section.layout}
                onChange={(e) => props.handle.updateSection({
                  ...props.section!,
                  layout: e.target.value as 'horizontal',
                })}
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 cursor-pointer hover:border-gray-400"
              >
                <option value="horizontal">Horizontal</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {props.field && (() => {
        const needsOptions = ['select', 'radio', 'multiple_choice'].includes(props.field.field_type);
        return (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 uppercase hover:text-blue-700 transition-colors duration-200">Field Options</h3>
              <button
                onClick={() => props.handle.setActiveFieldId(null)}
                className="p-1 hover:bg-gray-100 hover:shadow-md hover:scale-110 rounded text-gray-500 transition-all duration-200"
              >
                <XIcon className="w-4 h-4 transition-transform duration-200 hover:rotate-90" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Field Name</label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  value={props.field.name}
                  onChange={(e) => props.handle.updateField({
                    ...props.field!,
                    name: e.target.value,
                  })}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Field Type</label>
                <select
                  value={props.field.field_type}
                  onChange={(e) => {
                    const field = props.field!;
                    props.handle.updateField({
                      ...field,
                      field_type: e.target.value,
                      field_options: needsOptions && !['select', 'radio', 'multiple_choice'].includes(e.target.value) ? [] : field.field_options,
                    });
                  }}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 cursor-pointer hover:border-gray-400"
                >
                <option value="text">Text</option>
                <option value="textarea">Textarea</option>
                <option value="number">Number</option>
                <option value="email">Email</option>
                <option value="select">Select</option>
                <option value="checkbox">Checkbox</option>
                <option value="radio">Radio</option>
                <option value="rating">Rating</option>
                <option value="multiple_choice">Multiple Choice</option>
                <option value="date">Date</option>
                <option value="time">Time</option>
                <option value="file">File</option>
                <option value="image">Image</option>
                <option value="location">Location</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Placeholder</label>
              <input
                type="text"
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                value={props.field.placeholder || ''}
                onChange={(e) => props.handle.updateField({
                  ...props.field!,
                  placeholder: e.target.value,
                })}
                placeholder="Enter placeholder text"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Default Value</label>
              <input
                type="text"
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                value={props.field.default_value || ''}
                onChange={(e) => props.handle.updateField({
                  ...props.field!,
                  default_value: e.target.value,
                })}
                placeholder="Enter default value"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Info/Help Text</label>
              <input
                type="text"
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                value={props.field.info || ''}
                onChange={(e) => props.handle.updateField({
                  ...props.field!,
                  info: e.target.value,
                })}
                placeholder="Help text for users"
              />
            </div>

            <div className="flex items-center gap-2 p-2 rounded-md hover:bg-blue-50/50 transition-colors duration-200">
              <input
                type="checkbox"
                id="required"
                checked={props.field.required}
                onChange={(e) => props.handle.updateField({
                  ...props.field!,
                  required: e.target.checked,
                })}
                className="w-4 h-4 cursor-pointer accent-blue-600 hover:scale-110 transition-transform duration-200"
              />
              <label htmlFor="required" className="text-sm font-medium text-gray-700 cursor-pointer hover:text-blue-700 transition-colors duration-200">
                Required field
              </label>
            </div>

            {needsOptions && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">
                  Options (one per line)
                </label>
                <textarea
                  className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  rows={6}
                  value={props.field.field_options.join('\n')}
                  onChange={(e) => {
                    const options = e.target.value
                      .split('\n')
                      .map(line => line.trim())
                      .filter(line => line.length > 0);
                    props.handle.updateField({
                      ...props.field!,
                      field_options: options,
                    });
                  }}
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter one option per line
                </p>
              </div>
            )}

            {(() => {
              const field = props.field!;
              const attrs = field.attributes || {};
              const updateAttr = (key: string, value: any) => {
                props.handle.updateField({
                  ...field,
                  attributes: { ...attrs, [key]: value },
                });
              };

              switch (field.field_type) {
                case 'number':
                  return (
                    <div className="flex flex-col gap-3 pt-2 border-t border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-600 uppercase hover:text-blue-700 transition-colors duration-200">Number Attributes</h4>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Minimum Value</label>
                        <input
                          type="number"
                          className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          value={attrs.min ?? ''}
                          onChange={(e) => updateAttr('min', e.target.value ? parseFloat(e.target.value) : undefined)}
                          placeholder="No minimum"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Maximum Value</label>
                        <input
                          type="number"
                          className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          value={attrs.max ?? ''}
                          onChange={(e) => updateAttr('max', e.target.value ? parseFloat(e.target.value) : undefined)}
                          placeholder="No maximum"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Step</label>
                        <input
                          type="number"
                          className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          value={attrs.step ?? ''}
                          onChange={(e) => updateAttr('step', e.target.value ? parseFloat(e.target.value) : undefined)}
                          placeholder="1"
                        />
                        <p className="text-xs text-gray-500 mt-1">Increment/decrement step</p>
                      </div>
                    </div>
                  );

                case 'text':
                case 'textarea':
                  return (
                    <div className="flex flex-col gap-3 pt-2 border-t border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-600 uppercase hover:text-blue-700 transition-colors duration-200">Text Attributes</h4>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Min Length</label>
                        <input
                          type="number"
                          className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          value={attrs.minLength ?? ''}
                          onChange={(e) => updateAttr('minLength', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="No minimum"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Max Length</label>
                        <input
                          type="number"
                          className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          value={attrs.maxLength ?? ''}
                          onChange={(e) => updateAttr('maxLength', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="No maximum"
                          min="1"
                        />
                      </div>
                      {field.field_type === 'text' && (
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Pattern (Regex)</label>
                          <input
                            type="text"
                            className="w-full p-2 border border-gray-300 rounded-md font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                            value={attrs.pattern ?? ''}
                            onChange={(e) => updateAttr('pattern', e.target.value || undefined)}
                            placeholder="^[A-Za-z]+$"
                          />
                          <p className="text-xs text-gray-500 mt-1">Validation pattern (regex)</p>
                        </div>
                      )}
                    </div>
                  );

                case 'date':
                  return (
                    <div className="flex flex-col gap-3 pt-2 border-t border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-600 uppercase hover:text-blue-700 transition-colors duration-200">Date Attributes</h4>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Min Date</label>
                        <input
                          type="date"
                          className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          value={attrs.min ?? ''}
                          onChange={(e) => updateAttr('min', e.target.value || undefined)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Max Date</label>
                        <input
                          type="date"
                          className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          value={attrs.max ?? ''}
                          onChange={(e) => updateAttr('max', e.target.value || undefined)}
                        />
                      </div>
                    </div>
                  );

                case 'time':
                  return (
                    <div className="flex flex-col gap-3 pt-2 border-t border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-600 uppercase hover:text-blue-700 transition-colors duration-200">Time Attributes</h4>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Min Time</label>
                        <input
                          type="time"
                          className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          value={attrs.min ?? ''}
                          onChange={(e) => updateAttr('min', e.target.value || undefined)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Max Time</label>
                        <input
                          type="time"
                          className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          value={attrs.max ?? ''}
                          onChange={(e) => updateAttr('max', e.target.value || undefined)}
                        />
                      </div>
                    </div>
                  );

                case 'file':
                case 'image':
                  return (
                    <div className="flex flex-col gap-3 pt-2 border-t border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-600 uppercase hover:text-blue-700 transition-colors duration-200">File Attributes</h4>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Accepted File Types</label>
                        <input
                          type="text"
                          className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          value={attrs.accept ?? ''}
                          onChange={(e) => updateAttr('accept', e.target.value || undefined)}
                          placeholder=".pdf,.doc,.docx or image/*"
                        />
                        <p className="text-xs text-gray-500 mt-1">Comma-separated MIME types or extensions (e.g., .pdf,.doc or image/*)</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Max File Size (MB)</label>
                        <input
                          type="number"
                          className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          value={attrs.maxSize ?? ''}
                          onChange={(e) => updateAttr('maxSize', e.target.value ? parseFloat(e.target.value) : undefined)}
                          placeholder="10"
                          min="0"
                          step="0.1"
                        />
                      </div>
                      {field.field_type === 'file' && (
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Max Files</label>
                          <input
                            type="number"
                            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                            value={attrs.maxFiles ?? ''}
                            onChange={(e) => updateAttr('maxFiles', e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="1"
                            min="1"
                          />
                          <p className="text-xs text-gray-500 mt-1">Maximum number of files allowed</p>
                        </div>
                      )}
                    </div>
                  );

                case 'rating':
                  return (
                    <div className="flex flex-col gap-3 pt-2 border-t border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-600 uppercase hover:text-blue-700 transition-colors duration-200">Rating Attributes</h4>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Min Rating</label>
                        <input
                          type="number"
                          className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          value={attrs.min ?? '1'}
                          onChange={(e) => updateAttr('min', e.target.value ? parseInt(e.target.value) : 1)}
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Max Rating</label>
                        <input
                          type="number"
                          className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          value={attrs.max ?? '5'}
                          onChange={(e) => updateAttr('max', e.target.value ? parseInt(e.target.value) : 5)}
                          min="1"
                        />
                      </div>
                    </div>
                  );

                case 'email':
                  return (
                    <div className="flex flex-col gap-3 pt-2 border-t border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-600 uppercase hover:text-blue-700 transition-colors duration-200">Email Attributes</h4>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Pattern (Regex)</label>
                        <input
                          type="text"
                          className="w-full p-2 border border-gray-300 rounded-md font-mono text-xs"
                          value={attrs.pattern ?? ''}
                          onChange={(e) => updateAttr('pattern', e.target.value || undefined)}
                          placeholder="Custom email pattern (optional)"
                        />
                        <p className="text-xs text-gray-500 mt-1">Override default email validation</p>
                      </div>
                    </div>
                  );

                case 'location':
                  return (
                    <div className="flex flex-col gap-3 pt-2 border-t border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-600 uppercase hover:text-blue-700 transition-colors duration-200">Location Attributes</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Min Latitude</label>
                          <input
                            type="number"
                            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                            value={attrs.minLat ?? ''}
                            onChange={(e) => updateAttr('minLat', e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder="-90"
                            step="0.000001"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Max Latitude</label>
                          <input
                            type="number"
                            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                            value={attrs.maxLat ?? ''}
                            onChange={(e) => updateAttr('maxLat', e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder="90"
                            step="0.000001"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Min Longitude</label>
                          <input
                            type="number"
                            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                            value={attrs.minLng ?? ''}
                            onChange={(e) => updateAttr('minLng', e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder="-180"
                            step="0.000001"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block hover:text-blue-700 transition-colors duration-200 cursor-text">Max Longitude</label>
                          <input
                            type="number"
                            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                            value={attrs.maxLng ?? ''}
                            onChange={(e) => updateAttr('maxLng', e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder="180"
                            step="0.000001"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">Optional bounds for location picker</p>
                    </div>
                  );

                default:
                  return null;
              }
            })()}

            <div className="pt-2 border-t border-gray-200">
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this field?')) {
                    props.handle.deleteField(props.field!.id);
                  }
                }}
                className="w-full p-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-sm font-medium border border-transparent hover:border-red-200"
              >
                Delete Field
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </aside>
  );
};




export default FormBuilder;