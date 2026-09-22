import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { basePath } from '../../lib/base';
import api from '../../lib/api';
import type { Form, FormField, FormSubmission } from '../Builder/sub/ftype';
import {
  getFilePreviewUrl,
  getFileDownloadUrl,
  getFileIconClass,
  isImageFile,
  formatFileSize,
} from '../../lib/spaceFile';

interface DetailedSubmission extends FormSubmission {
  formName?: string;
}

const Submissions = () => {
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<Form[]>([]);
  const [formFieldsMap, setFormFieldsMap] = useState<Record<number, FormField[]>>({});
  const [submissions, setSubmissions] = useState<DetailedSubmission[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<DetailedSubmission | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [formsData, subsData] = await Promise.all([
          api.getForms().catch(() => []),
          api.getSubmissions().catch(() => []),
        ]);

        const formsList: Form[] = Array.isArray(formsData) ? formsData : Object.values(formsData || {}) as Form[];
        setForms(formsList);

        // Map form names to submissions
        const formsMap = new Map(formsList.map(f => [f.id, f.name]));
        const rawSubs: any[] = Array.isArray(subsData) ? subsData : Object.values(subsData || {}) as any[];
        const enrichedSubs: DetailedSubmission[] = rawSubs.map(s => ({
          ...s,
          formName: formsMap.get(s.form_id) || `Form #${s.form_id}`,
        }));

        setSubmissions(enrichedSubs);

        // Preload fields for all forms to display question labels
        const fieldsMap: Record<number, FormField[]> = {};
        for (const f of formsList) {
          try {
            const formData = await api.getForm(f.id);
            if (formData && formData.fields) {
              const rawFields: FormField[] = Array.isArray(formData.fields)
                ? formData.fields
                : (Object.values(formData.fields || {}) as FormField[]);
              fieldsMap[f.id] = rawFields;
            }
          } catch {}
        }
        setFormFieldsMap(fieldsMap);
      } catch (err) {
        console.error('Failed to load submissions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDelete = async (subId: number) => {
    if (!confirm('Are you sure you want to delete this submission?')) return;
    try {
      await api.deleteSubmission(subId);
      setSubmissions(prev => prev.filter(s => s.id !== subId));
      if (selectedSubmission?.id === subId) {
        setSelectedSubmission(null);
      }
    } catch (err) {
      console.error('Failed to delete submission:', err);
    }
  };

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      if (selectedFormId !== 'all' && sub.form_id !== selectedFormId) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesForm = sub.formName?.toLowerCase().includes(query);
        const matchesData = JSON.stringify(sub.data || {}).toLowerCase().includes(query);
        const matchesId = String(sub.id).includes(query);
        return matchesForm || matchesData || matchesId;
      }
      return true;
    });
  }, [submissions, selectedFormId, searchQuery]);

  const handleExportCSV = () => {
    if (filteredSubmissions.length === 0) return;

    // Collect all field names
    const allFieldNames = new Set<string>();
    filteredSubmissions.forEach(sub => {
      const fields = formFieldsMap[sub.form_id] || [];
      fields.forEach(f => allFieldNames.add(f.name));
      // In case fields aren't preloaded, also collect data keys
      Object.keys(sub.data || {}).forEach(k => allFieldNames.add(k));
    });

    const fieldList = Array.from(allFieldNames);
    const headers = ['ID', 'Form ID', 'Form Name', 'Submitted At', 'Status', ...fieldList.map(name => `"${name.replace(/"/g, '""')}"`)];

    const rows = filteredSubmissions.map(sub => {
      const dateStr = sub.created_at || (sub.extrameta?.submitted_at ? sub.extrameta.submitted_at : '');
      const fields = formFieldsMap[sub.form_id] || [];
      const fieldIdToName = new Map(fields.map(f => [String(f.id), f.name]));

      const values = fieldList.map(fieldName => {
        // Find matching key in data (could be field ID or field name)
        let val: any = undefined;
        if (sub.data) {
          if (sub.data[fieldName] !== undefined) {
            val = sub.data[fieldName];
          } else {
            // Find by field ID
            for (const [k, v] of Object.entries(sub.data)) {
              if (fieldIdToName.get(k) === fieldName) {
                val = v;
                break;
              }
            }
          }
        }

        if (val === undefined || val === null) return '""';
        if (typeof val === 'object') {
          return `"${(val.name || val.url || JSON.stringify(val)).replace(/"/g, '""')}"`;
        }
        return `"${String(val).replace(/"/g, '""')}"`;
      });

      return [
        sub.id,
        sub.form_id,
        `"${(sub.formName || '').replace(/"/g, '""')}"`,
        `"${dateStr}"`,
        `"${sub.status}"`,
        ...values,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cimple_form_submissions_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSubmissionDate = (sub: FormSubmission) => {
    const raw = sub.created_at || sub.extrameta?.submitted_at;
    if (!raw) return 'Recently';
    try {
      return new Date(raw).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(raw);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)]">
      {/* Top Header */}
      <header className="bg-white border-b border-[#E1E3DB] py-3 px-8 flex shadow-sm items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to={`${basePath}forms`}
            className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-900 bg-[#FAFAF7] hover:bg-[#EEF0EA] border border-[#E1E3DB] px-2.5 py-1.5 rounded-md transition-colors"
          >
            <i className="fa-solid fa-arrow-left text-xs"></i>
            <span>Forms</span>
          </Link>
          <span className="text-gray-300 font-light select-none">/</span>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-[#2E6E52] text-white flex items-center justify-center text-xs">
              <i className="fa-solid fa-inbox"></i>
            </span>
            <h1 className="text-lg font-bold font-heading text-gray-900 tracking-tight">Submissions</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {submissions.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-100 border border-[#CBCEC3] rounded-lg shadow-2xs transition-colors"
            >
              <i className="fa-solid fa-file-csv text-emerald-600 text-xs"></i>
              <span>Export All CSV</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 overflow-auto p-8 max-w-6xl mx-auto w-full">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-[#E1E3DB] rounded-xl p-4 shadow-2xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#2E6E52]/10 text-[#2E6E52] flex items-center justify-center text-lg">
              <i className="fa-solid fa-inbox"></i>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Responses</p>
              <p className="text-2xl font-bold font-heading text-gray-900">{submissions.length}</p>
            </div>
          </div>

          <div className="bg-white border border-[#E1E3DB] rounded-xl p-4 shadow-2xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#3E6DA8]/10 text-[#3E6DA8] flex items-center justify-center text-lg">
              <i className="fa-solid fa-file-lines"></i>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Active Forms</p>
              <p className="text-2xl font-bold font-heading text-gray-900">{forms.length}</p>
            </div>
          </div>

          <div className="bg-white border border-[#E1E3DB] rounded-xl p-4 shadow-2xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#AA4A62]/10 text-[#AA4A62] flex items-center justify-center text-lg">
              <i className="fa-solid fa-clock"></i>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Latest Activity</p>
              <p className="text-xs font-semibold text-gray-800 mt-1 truncate">
                {submissions.length > 0 ? getSubmissionDate(submissions[0]) : 'None yet'}
              </p>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white border border-[#E1E3DB] rounded-xl p-4 mb-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Filter form:</label>
            <select
              value={selectedFormId}
              onChange={e => setSelectedFormId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="text-xs font-medium p-2 rounded-lg border border-[#CBCEC3] bg-[#FAFAF7] text-gray-800 outline-none focus:border-[#2E6E52]"
            >
              <option value="all">All Forms ({submissions.length})</option>
              {forms.map(f => {
                const count = submissions.filter(s => s.form_id === f.id).length;
                return (
                  <option key={f.id} value={f.id}>
                    {f.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-xs text-gray-400"></i>
            <input
              type="text"
              placeholder="Search responses..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-[#CBCEC3] bg-[#FAFAF7] outline-none focus:border-[#2E6E52]"
            />
          </div>
        </div>

        {/* Submissions List / Empty State */}
        {loading ? (
          <div className="bg-white border border-[#E1E3DB] rounded-2xl p-16 text-center flex flex-col items-center justify-center gap-3 shadow-sm">
            <i className="fa-solid fa-circle-notch fa-spin text-2xl text-[#2E6E52]"></i>
            <p className="text-xs font-medium text-gray-500">Loading submissions...</p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="bg-white border border-[#E1E3DB] rounded-2xl p-16 text-center flex flex-col items-center justify-center gap-3 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-[#EEF0EA] flex items-center justify-center text-gray-400 text-2xl mb-2">
              <i className="fa-solid fa-inbox"></i>
            </div>
            <h3 className="font-heading font-bold text-lg text-gray-900">No submissions found</h3>
            <p className="text-xs text-gray-500 max-w-sm">
              {searchQuery || selectedFormId !== 'all'
                ? 'Try clearing your filter or search query.'
                : 'Responses submitted via your forms will be listed here.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#E1E3DB] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#EEF0EA] border-b border-[#E1E3DB] text-gray-600 font-semibold">
                    <th className="py-3 px-4 whitespace-nowrap">ID</th>
                    <th className="py-3 px-4 whitespace-nowrap">Form</th>
                    <th className="py-3 px-4 whitespace-nowrap">Submitted</th>
                    <th className="py-3 px-4">Responses Preview</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Status</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E3DB]">
                  {filteredSubmissions.map(sub => {
                    const fields = formFieldsMap[sub.form_id] || [];
                    const fieldIdToName = new Map(fields.map(f => [String(f.id), f.name]));

                    return (
                      <tr key={sub.id} className="hover:bg-[#FAFAF7] transition-colors">
                        <td className="py-3 px-4 text-gray-400 whitespace-nowrap font-mono text-[11px]">
                          #{sub.id}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <Link
                            to={`${basePath}forms/${sub.form_id}`}
                            className="font-semibold text-gray-900 hover:text-[#2E6E52] transition-colors"
                          >
                            {sub.formName}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-gray-500 whitespace-nowrap text-[11px]">
                          {getSubmissionDate(sub)}
                        </td>
                        <td className="py-3 px-4 max-w-md">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {Object.entries(sub.data || {}).slice(0, 3).map(([key, val]) => {
                              const label = fieldIdToName.get(key) || key;
                              if (val && typeof val === 'object' && val.id) {
                                return (
                                  <span
                                    key={key}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[11px]"
                                  >
                                    <i className={getFileIconClass(val.name || val.mime)}></i>
                                    <span className="truncate max-w-[90px]">{val.name || 'File'}</span>
                                  </span>
                                );
                              }
                              if (val && typeof val === 'object' && typeof val.lat === 'number' && typeof val.lng === 'number') {
                                return (
                                  <span
                                    key={key}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]"
                                  >
                                    <i className="fa-solid fa-location-dot"></i>
                                    <span className="truncate max-w-[100px]">{val.address || `${val.lat.toFixed(2)}, ${val.lng.toFixed(2)}`}</span>
                                  </span>
                                );
                              }
                              return (
                                <span
                                  key={key}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px] truncate max-w-[140px]"
                                >
                                  <strong className="font-semibold text-gray-500">{label}:</strong>
                                  <span className="truncate">{String(val)}</span>
                                </span>
                              );
                            })}
                            {Object.keys(sub.data || {}).length > 3 && (
                              <span className="text-[10px] text-gray-400 font-semibold">
                                +{Object.keys(sub.data || {}).length - 3} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {sub.status || 'completed'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setSelectedSubmission(sub)}
                              className="px-2.5 py-1 text-xs font-semibold text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-100 border border-[#CBCEC3] rounded-md transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleDelete(sub.id)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Delete"
                            >
                              <i className="fa-regular fa-trash-can text-xs"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#E1E3DB] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#E1E3DB] flex items-center justify-between bg-[#FAFAF7]">
              <div>
                <h3 className="font-heading font-bold text-base text-gray-900">
                  Submission #{selectedSubmission.id}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedSubmission.formName} • {getSubmissionDate(selectedSubmission)}
                </p>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Modal Body: Answer list */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              {(() => {
                const fields = formFieldsMap[selectedSubmission.form_id] || [];
                const fieldIdToName = new Map(fields.map(f => [String(f.id), f.name]));
                const entries = Object.entries(selectedSubmission.data || {});

                if (entries.length === 0) {
                  return <p className="text-xs text-gray-400 italic">No responses in this submission.</p>;
                }

                return entries.map(([key, val]) => {
                  const label = fieldIdToName.get(key) || key;

                  // Render file answer
                  if (val && typeof val === 'object' && val.id) {
                    const isImg = isImageFile(val.name || val.mime);
                    const previewUrl = val.url || getFilePreviewUrl(val.id);
                    const downloadUrl = val.download_url || getFileDownloadUrl(val.id);

                    return (
                      <div key={key} className="p-3 bg-[#FAFAF7] border border-[#E1E3DB] rounded-xl">
                        <p className="text-xs font-semibold text-gray-600 mb-2">{label}</p>
                        <div className="flex items-center justify-between p-2.5 bg-white border border-[#E1E3DB] rounded-lg">
                          <div className="flex items-center gap-3 min-w-0">
                            {isImg && previewUrl ? (
                              <img
                                src={previewUrl}
                                alt={val.name}
                                className="w-10 h-10 rounded object-cover border border-[#E1E3DB]"
                              />
                            ) : (
                              <span className="w-10 h-10 rounded bg-[#FAFAF7] border border-[#E1E3DB] flex items-center justify-center text-lg">
                                <i className={getFileIconClass(val.name || val.mime)}></i>
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-900 truncate">{val.name || 'File'}</p>
                              {val.size > 0 && (
                                <p className="text-[11px] text-gray-400 font-mono">{formatFileSize(val.size)}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {previewUrl && (
                              <a
                                href={previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                              >
                                View
                              </a>
                            )}
                            {downloadUrl && (
                              <a
                                href={downloadUrl}
                                download={val.name}
                                className="px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 border border-[#CBCEC3] rounded-md transition-colors"
                              >
                                Download
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Render location answer
                  if (val && typeof val === 'object' && typeof val.lat === 'number' && typeof val.lng === 'number') {
                    const mapLink = `https://www.openstreetmap.org/?mlat=${val.lat}&mlon=${val.lng}#map=16/${val.lat}/${val.lng}`;
                    return (
                      <div key={key} className="p-3 bg-[#FAFAF7] border border-[#E1E3DB] rounded-xl">
                        <p className="text-xs font-semibold text-gray-600 mb-2">{label}</p>
                        <div className="flex items-center justify-between p-2.5 bg-white border border-[#E1E3DB] rounded-lg">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center text-sm flex-shrink-0">
                              <i className="fa-solid fa-location-dot"></i>
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-900 truncate">
                                {val.address || `Latitude: ${val.lat}, Longitude: ${val.lng}`}
                              </p>
                              <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                                {val.lat.toFixed(6)}, {val.lng.toFixed(6)}
                              </p>
                            </div>
                          </div>
                          <a
                            href={mapLink}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-md transition-colors flex items-center gap-1.5 flex-shrink-0 ml-2"
                          >
                            <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                            <span>Open Map</span>
                          </a>
                        </div>
                      </div>
                    );
                  }

                  // Render text/standard answer
                  return (
                    <div key={key} className="p-3 bg-[#FAFAF7] border border-[#E1E3DB] rounded-xl">
                      <p className="text-xs font-semibold text-gray-600 mb-1">{label}</p>
                      <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                        {Array.isArray(val) ? val.join(', ') : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val ?? '—')}
                      </p>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E1E3DB] bg-[#FAFAF7] flex items-center justify-between">
              <button
                onClick={() => handleDelete(selectedSubmission.id)}
                className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <i className="fa-regular fa-trash-can text-xs"></i>
                <span>Delete submission</span>
              </button>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 bg-white border border-[#CBCEC3] rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Submissions;