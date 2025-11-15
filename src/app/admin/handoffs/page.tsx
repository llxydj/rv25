"use client";

import { useEffect, useState, useRef } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { RefreshCw } from "lucide-react";

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_INTER_LGU_ENABLED === 'true';

export default function AdminHandoffsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const [form, setForm] = useState({
    incident_id: "",
    from_lgu: "",
    to_lgu: "",
    notes: "",
  });

  const fetchHandoffs = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    else setIsRefreshing(true);
    try {
      const res = await fetch('/api/incident-handoffs');
      const json = await res.json();
      if (res.ok && json.success) {
        setItems(json.data);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch handoffs:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!FEATURE_ENABLED) return;
    
    fetchHandoffs(true);
    
    pollingInterval.current = setInterval(() => {
      fetchHandoffs(false);
    }, 10000);
    
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  const renderContent = () => {
    if (!FEATURE_ENABLED) {
      return (
        <div className="p-6">
          <p className="text-gray-600">Inter-LGU handoffs are disabled.</p>
        </div>
      );
    }

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">Incident Handoffs</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-500">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
              {isRefreshing && (
                <div className="flex items-center gap-1 text-xs text-blue-600">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Refreshing...</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              onClick={() => fetchHandoffs(false)}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={async () => {
                setCreateError(null);
                setForm({ incident_id: "", from_lgu: "", to_lgu: "", notes: "" });
                try {
                  const res = await fetch('/api/admin/lgu-contacts');
                  const json = await res.json();
                  if (res.ok && json.success) setContacts(json.data || []);
                  else setContacts([]);
                } catch (error) {
                  console.error('Failed to fetch contacts:', error);
                  setContacts([]);
                }
                setShowCreate(true);
              }}
            >
              New Handoff
            </button>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-gray-600">
                  <th className="py-2">Incident</th>
                  <th className="py-2">From</th>
                  <th className="py-2">To</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Notes</th>
                  <th className="py-2">Date</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((h) => (
                  <tr key={h.id} className="border-t">
                    <td className="py-2">{h.incident_id}</td>
                    <td className="py-2">{h.from_lgu}</td>
                    <td className="py-2">{h.to_lgu}</td>
                    <td className="py-2">{h.status}</td>
                    <td className="py-2 max-w-md truncate" title={h.notes || ''}>{h.notes || '-'}</td>
                    <td className="py-2">{new Date(h.created_at).toLocaleString()}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        {['ACCEPTED','REJECTED','COMPLETED'].map(s => (
                          <button
                            key={s}
                            className={`px-2 py-1 rounded text-white text-xs ${
                              s==='ACCEPTED' ? 'bg-green-600 hover:bg-green-700' :
                              s==='REJECTED' ? 'bg-red-600 hover:bg-red-700' :
                              'bg-indigo-600 hover:bg-indigo-700'
                            } disabled:opacity-50`}
                            disabled={updatingId === h.id || h.status === s}
                            onClick={async ()=>{
                              setUpdatingId(h.id);
                              try {
                                const res = await fetch('/api/incident-handoffs',{
                                  method:'PATCH',
                                  headers:{'Content-Type':'application/json'},
                                  body: JSON.stringify({ id: h.id, status: s })
                                });
                                const json = await res.json();
                                if (res.ok && json.success) {
                                  setItems(prev => prev.map(x => x.id===h.id ? { ...x, status: s } : x));
                                }
                              } finally {
                                setUpdatingId(null);
                              }
                            }}
                          >{s}</button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td className="py-4 text-gray-500" colSpan={7}>No handoffs yet</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {showCreate && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white w-full max-w-lg rounded shadow-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">New Handoff</h2>
                <button onClick={()=>setShowCreate(false)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>

              {createError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700">{createError}</div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Incident ID</label>
                  <input
                    value={form.incident_id}
                    onChange={e=>setForm(f=>({...f, incident_id: e.target.value}))}
                    className="w-full border rounded px-3 py-2"
                    placeholder="e.g., UUID of the incident"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From LGU</label>
                  <input
                    value={form.from_lgu}
                    onChange={e=>setForm(f=>({...f, from_lgu: e.target.value}))}
                    className="w-full border rounded px-3 py-2"
                    placeholder="e.g., TALISAY CDRRMO"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To LGU</label>
                  <select
                    value={form.to_lgu}
                    onChange={e=>setForm(f=>({...f, to_lgu: e.target.value}))}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Select LGU</option>
                    {contacts.map((c)=> (
                      <option key={c.id} value={c.agency_name}>{c.agency_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={e=>setForm(f=>({...f, notes: e.target.value}))}
                    rows={3}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button className="px-4 py-2 border rounded" onClick={()=>setShowCreate(false)}>Cancel</button>
                <button
                  className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
                  disabled={creating}
                  onClick={async ()=>{
                    setCreateError(null);
                    if (!form.incident_id || !form.to_lgu) {
                      setCreateError('Incident ID and To LGU are required');
                      return;
                    }
                    try {
                      setCreating(true);
                      const res = await fetch('/api/incident-handoffs', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          incident_id: form.incident_id,
                          from_lgu: form.from_lgu || undefined,
                          to_lgu: form.to_lgu,
                          notes: form.notes || undefined
                        })
                      });
                      const json = await res.json();
                      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to create handoff');
                      setShowCreate(false);
                      fetchHandoffs(false);
                    } catch (e: any) {
                      setCreateError(e?.message || 'Failed to create handoff');
                    } finally {
                      setCreating(false);
                    }
                  }}
                >{creating ? 'Creating...' : 'Create'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return <AdminLayout>{renderContent()}</AdminLayout>;
}
