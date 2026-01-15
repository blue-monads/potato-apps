export type FormStatus = 'draft' | 'published' | 'archived';

export interface Form {
  id: number;
  name: string;
  description: string;
  status: FormStatus;
  is_new?: boolean;
  is_modified?: boolean;
}

export interface FormField {
  id: number;
  name: string;
  info?: string;
  field_type: string;
  default_value: string;
  placeholder?: string;
  field_order: number;
  field_options: string[];
  form_id: number;
  required: boolean;
  section_id: number;
  attributes?: Record<string, any>;

  is_new?: boolean;
  is_modified?: boolean;
}

export interface FormSection {
  id: number;
  name: string;
  section_order: number;
  form_id: number;
  layout: 'horizontal'
  attributes?: Record<string, any>;

  is_new?: boolean;
  is_modified?: boolean;
}

export interface FormSubmission {
  id: number;
  form_id: number;
  data: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  response_messages: string;
}
