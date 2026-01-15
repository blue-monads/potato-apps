import type { Form, FormField, FormSection } from "./ftype";


interface Schema {
    form: Form;
    fields: FormField[];
    sections: FormSection[];
}


export interface Options {
    formSchema: Schema;
    initialData: Record<string, any>;
    onChange: (data: Record<string, any>) => void;
    target: string | HTMLElement
}

// Helper to get target element
function getTargetElement(target: string | HTMLElement): HTMLElement {
    if (target instanceof HTMLElement) {
        return target;
    }
    const element = document.querySelector(target);
    if (!element) {
        throw new Error(`Target element not found: ${target}`);
    }
    return element as HTMLElement;
}

// Helper to create element with attributes
function createElement(tag: string, attributes: Record<string, any> = {}, textContent?: string): HTMLElement {
    const element = document.createElement(tag);
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('data-')) {
            element.setAttribute(key, String(value));
        } else if (value !== null && value !== undefined) {
            (element as any)[key] = value;
        }
    });
    if (textContent !== undefined) {
        element.textContent = textContent;
    }
    return element;
}

// Helper to get field value from form data
function getFieldValue(field: FormField, data: Record<string, any>): any {
    const key = `field_${field.id}`;
    return data[key] !== undefined ? data[key] : field.default_value || '';
}

// Helper to set field value in form data
function setFieldValue(field: FormField, value: any, data: Record<string, any>): void {
    const key = `field_${field.id}`;
    data[key] = value;
}

// Render a single field input
function renderFieldInput(field: FormField, data: Record<string, any>, onChange: (value: any) => void): HTMLElement {
    const attrs = field.attributes || {};
    const fieldType = field.field_type.toLowerCase();
    const currentValue = getFieldValue(field, data);
    const fieldId = `field_${field.id}`;
    const fieldName = field.name;

    switch (fieldType) {
        case 'text':
        case 'email': {
            const input = createElement('input', {
                type: fieldType === 'email' ? 'email' : 'text',
                id: fieldId,
                name: fieldId,
                placeholder: field.placeholder || `Enter ${fieldName.toLowerCase()}`,
                value: currentValue,
                required: field.required,
                minLength: attrs.minLength,
                maxLength: attrs.maxLength,
                pattern: attrs.pattern,
                className: 'w-full p-2 border border-gray-300 rounded-md text-sm'
            });
            input.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                onChange(target.value);
            });
            return input;
        }

        case 'textarea': {
            const textarea = createElement('textarea', {
                id: fieldId,
                name: fieldId,
                placeholder: field.placeholder || `Enter ${fieldName.toLowerCase()}`,
                required: field.required,
                minLength: attrs.minLength,
                maxLength: attrs.maxLength,
                rows: attrs.rows || 3,
                className: 'w-full p-2 border border-gray-300 rounded-md text-sm'
            });
            textarea.textContent = currentValue;
            textarea.addEventListener('input', (e) => {
                const target = e.target as HTMLTextAreaElement;
                onChange(target.value);
            });
            return textarea;
        }

        case 'number': {
            const input = createElement('input', {
                type: 'number',
                id: fieldId,
                name: fieldId,
                placeholder: field.placeholder || `Enter ${fieldName.toLowerCase()}`,
                value: currentValue,
                required: field.required,
                min: attrs.min,
                max: attrs.max,
                step: attrs.step,
                className: 'w-full p-2 border border-gray-300 rounded-md text-sm'
            });
            input.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                onChange(target.value ? parseFloat(target.value) : '');
            });
            return input;
        }

        case 'select': {
            const select = createElement('select', {
                id: fieldId,
                name: fieldId,
                required: field.required,
                className: 'w-full p-2 border border-gray-300 rounded-md text-sm'
            });
            
            if (!field.required) {
                const defaultOption = createElement('option', { value: '' }, '-- Select --');
                select.appendChild(defaultOption);
            }

            field.field_options.forEach((option) => {
                const optionEl = createElement('option', { value: option }, option) as HTMLOptionElement;
                if (option === currentValue) {
                    optionEl.selected = true;
                }
                select.appendChild(optionEl);
            });

            select.addEventListener('change', (e) => {
                const target = e.target as HTMLSelectElement;
                onChange(target.value);
            });
            return select;
        }

        case 'radio': {
            const container = createElement('div', { className: 'flex flex-col gap-2' });
            const selectedValue = currentValue;
            
            field.field_options.forEach((option) => {
                const label = createElement('label', { className: 'flex items-center gap-2 text-sm' });
                const radio = createElement('input', {
                    type: 'radio',
                    name: fieldId,
                    value: option,
                    required: field.required,
                    checked: option === selectedValue
                });
                radio.addEventListener('change', () => {
                    onChange(option);
                });
                label.appendChild(radio);
                label.appendChild(createElement('span', { className: 'text-gray-600' }, option));
                container.appendChild(label);
            });
            return container;
        }

        case 'checkbox': {
            const label = createElement('label', { className: 'flex items-center gap-2 text-sm' });
            const checkbox = createElement('input', {
                type: 'checkbox',
                id: fieldId,
                name: fieldId,
                checked: Boolean(currentValue)
            });
            checkbox.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                onChange(target.checked);
            });
            label.appendChild(checkbox);
            label.appendChild(createElement('span', { className: 'text-gray-600' }, fieldName));
            return label;
        }

        case 'date': {
            const dateInput = createElement('input', {
                type: 'date',
                id: fieldId,
                name: fieldId,
                value: currentValue,
                required: field.required,
                min: attrs.min,
                max: attrs.max,
                className: 'w-full p-2 border border-gray-300 rounded-md text-sm'
            });
            dateInput.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                onChange(target.value);
            });
            return dateInput;
        }

        case 'time': {
            const timeInput = createElement('input', {
                type: 'time',
                id: fieldId,
                name: fieldId,
                value: currentValue,
                required: field.required,
                min: attrs.min,
                max: attrs.max,
                className: 'w-full p-2 border border-gray-300 rounded-md text-sm'
            });
            timeInput.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                onChange(target.value);
            });
            return timeInput;
        }

        case 'file':
        case 'image': {
            const container = createElement('div', {
                className: 'border-2 border-dashed border-gray-300 rounded-md p-4 text-center text-sm'
            });
            const acceptInfo = attrs.accept ? ` (${attrs.accept})` : '';
            const maxSizeInfo = attrs.maxSize ? ` Max: ${attrs.maxSize}MB` : '';
            
            const fileInput = createElement('input', {
                type: 'file',
                id: fieldId,
                name: fieldId,
                required: field.required,
                accept: attrs.accept,
                className: 'hidden'
            });
            
            const label = createElement('label', {
                htmlFor: fieldId,
                className: 'cursor-pointer block'
            });
            label.appendChild(createElement('div', { className: 'text-gray-400' }, `Click to upload ${fieldType}`));
            if (acceptInfo || maxSizeInfo) {
                label.appendChild(createElement('div', { className: 'text-xs text-gray-500 mt-1' }, acceptInfo + maxSizeInfo));
            }
            
            fileInput.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                const file = target.files?.[0];
                if (file) {
                    onChange(file);
                }
            });
            
            container.appendChild(fileInput);
            container.appendChild(label);
            return container;
        }

        case 'location': {
            const container = createElement('div', {
                className: 'border border-gray-300 rounded-md p-2 text-sm text-gray-400'
            });
            container.textContent = 'Map picker (not implemented)';
            // TODO: Implement location picker
            return container;
        }

        case 'rating': {
            const container = createElement('div', { className: 'flex gap-1' });
            const maxRating = attrs.max ?? 5;
            const currentRating = typeof currentValue === 'number' ? currentValue : 0;
            
            for (let i = 1; i <= maxRating; i++) {
                const star = createElement('span', {
                    className: `cursor-pointer text-2xl ${i <= currentRating ? 'text-yellow-400' : 'text-gray-300'}`,
                    'data-rating': i
                }, '★');
                star.addEventListener('click', () => {
                    onChange(i);
                    // Update visual state
                    container.querySelectorAll('span').forEach((s, idx) => {
                        if (idx + 1 <= i) {
                            s.className = 'cursor-pointer text-2xl text-yellow-400';
                        } else {
                            s.className = 'cursor-pointer text-2xl text-gray-300';
                        }
                    });
                });
                container.appendChild(star);
            }
            return container;
        }

        case 'multiple_choice': {
            const container = createElement('div', { className: 'flex flex-col gap-2' });
            const selectedValues = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
            
            field.field_options.forEach((option) => {
                const label = createElement('label', { className: 'flex items-center gap-2 text-sm' });
                const checkbox = createElement('input', {
                    type: 'checkbox',
                    name: `${fieldId}_${option}`,
                    value: option,
                    checked: selectedValues.includes(option)
                });
                checkbox.addEventListener('change', () => {
                    const newValues = Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
                        .map(cb => (cb as HTMLInputElement).value);
                    onChange(newValues);
                });
                label.appendChild(checkbox);
                label.appendChild(createElement('span', { className: 'text-gray-600' }, option));
                container.appendChild(label);
            });
            return container;
        }

        default:
            return createElement('div', {
                className: 'text-xs text-gray-400 italic'
            }, `Field type "${fieldType}" not supported`);
    }
}

// Render a single field with label
function renderField(field: FormField, data: Record<string, any>, onChange: (data: Record<string, any>) => void): HTMLElement {
    const fieldContainer = createElement('div', { className: 'mb-4' });
    
    const label = createElement('label', {
        htmlFor: `field_${field.id}`,
        className: 'block text-sm font-medium text-gray-700 mb-1'
    });
    label.appendChild(createElement('span', {}, field.name));
    if (field.required) {
        label.appendChild(createElement('span', { className: 'text-red-500 ml-1' }, '*'));
    }
    
    if (field.info) {
        const info = createElement('p', { className: 'text-xs text-gray-500 mb-2' }, field.info);
        fieldContainer.appendChild(info);
    }
    
    const input = renderFieldInput(field, data, (value) => {
        const newData = { ...data };
        setFieldValue(field, value, newData);
        onChange(newData);
    });
    
    fieldContainer.appendChild(label);
    fieldContainer.appendChild(input);
    
    return fieldContainer;
}

// Render a section with its fields
function renderSection(section: FormSection, fields: FormField[], data: Record<string, any>, onChange: (data: Record<string, any>) => void): HTMLElement {
    const sectionContainer = createElement('div', {
        className: 'flex flex-col rounded-md shadow p-4 border border-gray-200 mb-4'
    });
    
    const sectionTitle = createElement('h3', {
        className: 'text-lg font-semibold text-gray-700 mb-3'
    }, section.name);
    sectionContainer.appendChild(sectionTitle);
    
    const fieldsContainer = createElement('div', { className: 'flex flex-col gap-2' });
    
    const sectionFields = fields
        .filter(f => f.section_id === section.id)
        .sort((a, b) => a.field_order - b.field_order);
    
    sectionFields.forEach(field => {
        fieldsContainer.appendChild(renderField(field, data, onChange));
    });
    
    sectionContainer.appendChild(fieldsContainer);
    return sectionContainer;
}

export const renderForm = (opts: Options) => {
    const targetElement = getTargetElement(opts.target);
    
    // Clear target element
    targetElement.innerHTML = '';
    
    // Create form container
    const formContainer = createElement('form', {
        className: 'max-w-2xl mx-auto p-4',
        id: `form_${opts.formSchema.form.id}`
    });
    
    // Add form title and description if available
    if (opts.formSchema.form.name) {
        const title = createElement('h2', {
            className: 'text-2xl font-bold text-gray-800 mb-2'
        }, opts.formSchema.form.name);
        formContainer.appendChild(title);
    }
    
    if (opts.formSchema.form.description) {
        const description = createElement('p', {
            className: 'text-gray-600 mb-6'
        }, opts.formSchema.form.description);
        formContainer.appendChild(description);
    }
    
    // Sort sections by order
    const sortedSections = [...opts.formSchema.sections].sort((a, b) => a.section_order - b.section_order);
    
    // Render sections
    sortedSections.forEach(section => {
        const sectionEl = renderSection(
            section,
            opts.formSchema.fields,
            opts.initialData,
            opts.onChange
        );
        formContainer.appendChild(sectionEl);
    });
    
    // Handle fields without sections (orphaned fields)
    const sectionIds = new Set(opts.formSchema.sections.map(s => s.id));
    const orphanedFields = opts.formSchema.fields
        .filter(f => !sectionIds.has(f.section_id))
        .sort((a, b) => a.field_order - b.field_order);
    
    if (orphanedFields.length > 0) {
        const orphanedContainer = createElement('div', { className: 'mb-4' });
        orphanedFields.forEach(field => {
            orphanedContainer.appendChild(renderField(field, opts.initialData, opts.onChange));
        });
        formContainer.appendChild(orphanedContainer);
    }
    
    // Append form to target
    targetElement.appendChild(formContainer);
    
    // Return cleanup function
    return () => {
        formContainer.remove();
    };
}