"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Edit2, X } from "lucide-react";
import { getSystemSettings, upsertSystemSetting, type SystemConfig } from "@/lib/admin";

type EditState = { key: string; value: string; label: string };

const DEFAULT_SETTINGS: Array<{ key: string; label: string; placeholder: string }> = [
  { key: "max_clubs_per_student",      label: "Max clubs per student",        placeholder: "e.g. 5" },
  { key: "max_events_per_club_month",  label: "Max events per club per month", placeholder: "e.g. 10" },
  { key: "registration_open",          label: "Event registration open",       placeholder: "true / false" },
  { key: "maintenance_mode",           label: "Maintenance mode",              placeholder: "true / false" },
  { key: "support_email",              label: "Support email",                 placeholder: "support@university.edu" },
  { key: "platform_name",              label: "Platform name",                 placeholder: "Club Connect" },
];

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<EditState | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: getSystemSettings,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["system-settings"] });

  const saveMut = useMutation({
    mutationFn: ({ key, value, label }: EditState) => upsertSystemSetting(key, value, label),
    onSuccess: () => { setEditing(null); invalidate(); },
  });

  const addMut = useMutation({
    mutationFn: () => upsertSystemSetting(newKey, newValue, newLabel || newKey),
    onSuccess: () => { setNewKey(""); setNewValue(""); setNewLabel(""); setShowAddForm(false); invalidate(); },
  });

  const existingMap = data?.map ?? {};

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure platform-wide settings. Changes take effect immediately.</p>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-400 text-sm">Loading settings…</div>}

      {/* Well-known settings */}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {DEFAULT_SETTINGS.map((def) => {
          const cfg = data?.settings.find((s) => s.key === def.key);
          const isEditing = editing?.key === def.key;
          return (
            <div key={def.key} className="px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{def.label}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{def.key}</p>
                </div>
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="text"
                      value={editing.value}
                      onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                      placeholder={def.placeholder}
                      className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
                    />
                    <button
                      onClick={() => saveMut.mutate(editing)}
                      disabled={saveMut.isPending}
                      className="p-1.5 rounded-lg bg-[#EBA814] text-white hover:bg-[#d9970f] disabled:opacity-60"
                    >
                      <Save size={14} />
                    </button>
                    <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm text-gray-700 font-mono bg-gray-50 px-3 py-1 rounded-lg min-w-24 text-right">
                      {cfg?.value ?? <span className="text-gray-300 italic">not set</span>}
                    </span>
                    <button
                      onClick={() => setEditing({ key: def.key, value: cfg?.value ?? "", label: cfg?.label ?? def.label })}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[#EBA814] hover:bg-[#EBA814]/10"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom settings */}
      {data && data.settings.filter((s) => !DEFAULT_SETTINGS.find((d) => d.key === s.key)).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-6 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Custom Settings</p>
          </div>
          <div className="divide-y divide-gray-50">
            {data.settings
              .filter((s) => !DEFAULT_SETTINGS.find((d) => d.key === s.key))
              .map((cfg: SystemConfig) => {
                const isEditing = editing?.key === cfg.key;
                return (
                  <div key={cfg.key} className="px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{cfg.label || cfg.key}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{cfg.key}</p>
                      </div>
                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <input
                            type="text"
                            value={editing.value}
                            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
                          />
                          <button onClick={() => saveMut.mutate(editing)} disabled={saveMut.isPending} className="p-1.5 rounded-lg bg-[#EBA814] text-white hover:bg-[#d9970f]">
                            <Save size={14} />
                          </button>
                          <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-sm text-gray-700 font-mono bg-gray-50 px-3 py-1 rounded-lg">{cfg.value}</span>
                          <button onClick={() => setEditing({ key: cfg.key, value: cfg.value, label: cfg.label })} className="p-1.5 rounded-lg text-gray-400 hover:text-[#EBA814] hover:bg-[#EBA814]/10">
                            <Edit2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Add new setting */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 text-sm text-[#EBA814] font-medium hover:underline"
          >
            <Plus size={16} /> Add custom setting
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-900">New Setting</p>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="key (snake_case)"
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
              />
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="value"
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
              />
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="label (optional)"
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => addMut.mutate()}
                disabled={!newKey || !newValue || addMut.isPending}
                className="px-4 py-2 rounded-xl bg-[#EBA814] text-white text-sm font-medium hover:bg-[#d9970f] disabled:opacity-60"
              >
                {addMut.isPending ? "Saving…" : "Save Setting"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
