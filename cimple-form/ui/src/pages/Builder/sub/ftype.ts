export type FormStatus = 'draft' | 'published' | 'archived';

export interface Form {
  id: number;
  name: string;
  description: string;
  status: FormStatus;
  accent?: string;
  is_new?: boolean;
  is_modified?: boolean;
}

export interface FormField {
  id: number;
  name: string;
  label?: string;
  info?: string;
  help?: string;
  field_type: string;
  default_value: string;
  placeholder?: string;
  field_order: number;
  field_options: string[];
  form_id: number;
  required: boolean;
  section_id?: number;
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

export interface FileValue {
  id: string;
  name: string;
  size: number;
  mime?: string;
  url?: string;
  download_url?: string;
}

export interface LocationValue {
  lat: number;
  lng: number;
  address?: string;
}

export interface FormSubmission {
  id: number;
  form_id: number;
  data: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | string;
  response_messages: string;
  created_at?: string;
  extrameta?: Record<string, any>;
}
