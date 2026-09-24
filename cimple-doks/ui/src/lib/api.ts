import { API_BASE_PATH } from "./base";
import type { DocumentMeta, DocumentDetail, CreateDocumentInput, UpdateDocumentInput, DocumentTreeNode, BreadcrumbItem } from "../types";

const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return (window as any).spaceGetToken?.("cimple-doks") || null;
};

interface ApiResponse<T> {
  status: number;
  data: T;
  error?: string;
}

export async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = token;
  }

  const response = await fetch(`${API_BASE_PATH}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({ error: "Unknown error" }));

  return {
    status: response.status,
    data: response.ok ? data : (undefined as T),
    error: response.ok ? undefined : (data.error || `HTTP ${response.status}`),
  };
}

export const documentsApi = {
  list: async (): Promise<DocumentMeta[]> => {
    const res = await apiRequest<DocumentMeta[]>("/documents", { method: "GET" });
    if (res.error) throw new Error(res.error);
    return res.data || [];
  },

  get: async (id: number): Promise<DocumentDetail> => {
    const res = await apiRequest<DocumentDetail>(`/documents/${id}`, { method: "GET" });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  create: async (doc: CreateDocumentInput): Promise<DocumentDetail> => {
    const res = await apiRequest<DocumentDetail>("/documents", {
      method: "POST",
      body: JSON.stringify(doc),
    });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  update: async (id: number, doc: UpdateDocumentInput): Promise<DocumentDetail> => {
    const res = await apiRequest<DocumentDetail>(`/documents/${id}`, {
      method: "PUT",
      body: JSON.stringify(doc),
    });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  delete: async (id: number): Promise<{ message: string; id: number }> => {
    const res = await apiRequest<{ message: string; id: number }>(`/documents/${id}`, {
      method: "DELETE",
    });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  setup: async (): Promise<{ message: string }> => {
    const res = await apiRequest<{ message: string }>("/setup", {
      method: "POST",
    });
    if (res.error) throw new Error(res.error);
    return res.data;
  },
};

/**
 * Builds a hierarchical tree from a flat list of documents.
 */
export function buildDocumentTree(docs: DocumentMeta[]): DocumentTreeNode[] {
  const map = new Map<number, DocumentTreeNode>();
  const roots: DocumentTreeNode[] = [];

  // Create node wrappers
  for (const doc of docs) {
    map.set(doc.id, {
      ...doc,
      children: [],
      level: 0,
    });
  }

  // Assign children to parents
  for (const doc of docs) {
    const node = map.get(doc.id)!;
    if (doc.parent_id && map.has(doc.parent_id)) {
      const parent = map.get(doc.parent_id)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Recursively set level and sort children by position / title
  function assignLevelsAndSort(nodes: DocumentTreeNode[], level: number) {
    nodes.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return a.title.localeCompare(b.title);
    });

    for (const node of nodes) {
      node.level = level;
      if (node.children.length > 0) {
        assignLevelsAndSort(node.children, level + 1);
      }
    }
  }

  assignLevelsAndSort(roots, 0);
  return roots;
}

/**
 * Compute the breadcrumb trail from root to the active document.
 */
export function getBreadcrumbTrail(docs: DocumentMeta[], activeId: number | null): BreadcrumbItem[] {
  if (!activeId) return [];
  const map = new Map<number, DocumentMeta>();
  for (const doc of docs) {
    map.set(doc.id, doc);
  }

  const trail: BreadcrumbItem[] = [];
  let curr = map.get(activeId);

  // Guard against cycles
  const seen = new Set<number>();
  while (curr && !seen.has(curr.id)) {
    seen.add(curr.id);
    trail.unshift({
      id: curr.id,
      title: curr.title || "Untitled",
      icon: curr.icon || "📄",
    });
    if (curr.parent_id) {
      curr = map.get(curr.parent_id);
    } else {
      break;
    }
  }

  return trail;
}