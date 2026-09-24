export interface DocumentMeta {
  id: number;
  parent_id: number | null;
  title: string;
  icon: string;
  position: number;
  is_starred: number;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentDetail extends DocumentMeta {
  content: string;
  children_count?: number;
}

export interface DocumentTreeNode extends DocumentMeta {
  children: DocumentTreeNode[];
  level: number;
}

export interface BreadcrumbItem {
  id: number;
  title: string;
  icon: string;
}

export interface CreateDocumentInput {
  title?: string;
  parent_id?: number | null;
  icon?: string;
  content?: string;
  position?: number;
}

export interface UpdateDocumentInput {
  title?: string;
  content?: string;
  parent_id?: number | null;
  icon?: string;
  is_starred?: number;
  position?: number;
}
