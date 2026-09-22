import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Save, Clock, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const emptyFacility = () => ({
  id: '', slug: '', name: '', type: 'sport', status: 'draft', bookingEnabled: true,
  defaultSlotMinutes: 60, capacity: '', shortDescription: '', description: '',
  amenities: [], rules: [], coverImageUrl: '', displayOrder: 0, schedules: [],
});

const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60) % 24;
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};
const timeToMinutes = (time) => {
  const [hours, minutes] = String(time).split(':').map(Number);
  return Number.isInteger(hours) && Number.isInteger(minutes) ? hours * 60 + minutes : 0;
};

export default function FacilityManager({ onToast }) {
  const [facilities, setFacilities] = useState([]);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.getAdminFacilities();
      if (!result?.success) throw new Error(result?.error || 'Could not load facilities.');
      setFacilities(result.data.facilities || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const isCreate = !draft?.id || !facilities.some((facility) => facility.id === draft.id);
  const activeScheduleDays = useMemo(() => new Set((draft?.schedules || []).map((schedule) => schedule.dayOfWeek)), [draft]);
  const update = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const updateSchedule = (dayOfWeek, patch) => setDraft((current) => ({
    ...current,
    schedules: current.schedules.map((schedule) => schedule.dayOfWeek === dayOfWeek ? { ...schedule, ...patch } : schedule),
  }));
  const toggleDay = (dayOfWeek, enabled) => setDraft((current) => ({
    ...current,
    schedules: enabled
      ? [...current.schedules, { dayOfWeek, opensAtMinutes: 360, closesAtMinutes: 1320, slotMinutes: current.defaultSlotMinutes || 60, isBookable: true }]
      : current.schedules.filter((schedule) => schedule.dayOfWeek !== dayOfWeek),
  }));
  const save = async (event) => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = { ...draft, capacity: draft.capacity === '' ? null : Number(draft.capacity),
        amenities: draft.amenitiesText ? draft.amenitiesText.split('\n').map((value) => value.trim()).filter(Boolean) : draft.amenities,
        rules: draft.rulesText ? draft.rulesText.split('\n').map((value) => value.trim()).filter(Boolean) : draft.rules };
      const result = await api.saveFacility(payload, isCreate);
      if (!result?.success) throw new Error(result?.error || 'Could not save facility.');
      onToast(`${result.data.facility.name} saved.`);
      setDraft(null); await load();
    } catch (saveError) { setError(saveError.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="card-arena" style={{ padding: '2rem' }}>Loading facility management…</div>;
  return <div className="grid grid-2" style={{ alignItems: 'start', gap: '1.25rem' }}>
    <div className="card-arena" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
        <div><h2 style={{ margin: 0, fontSize: '1.35rem' }}>Facilities</h2><p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Profiles and per-facility availability.</p></div>
        <button className="btn btn-primary" onClick={() => setDraft(emptyFacility())}><Plus size={16} /> Add</button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {facilities.map((facility) => <button key={facility.id} type="button" onClick={() => setDraft({ ...facility, amenitiesText: facility.amenities.join('\n'), rulesText: facility.rules.join('\n') })} className="btn btn-outline" style={{ width: '100%', justifyContent: 'space-between', marginBottom: '0.5rem', textAlign: 'left' }}>
        <span><strong>{facility.name}</strong><small style={{ display: 'block', color: 'var(--text-muted)' }}>{facility.schedules.length} scheduled days · {facility.status}</small></span><Building2 size={17} />
      </button>)}
      <button className="btn btn-outline" onClick={load} style={{ marginTop: '0.5rem' }}><RefreshCw size={15} /> Refresh</button>
    </div>
    {draft ? <form className="card-arena" onSubmit={save} style={{ padding: '1.25rem' }}>
      <h2 style={{ marginTop: 0, fontSize: '1.35rem' }}>{isCreate ? 'New facility' : `Edit ${draft.name}`}</h2>
      <div className="grid grid-2" style={{ gap: '0.75rem' }}>
        {[['id', 'ID (kebab-case)'], ['slug', 'Public slug'], ['name', 'Name'], ['type', 'Type']].map(([key, label]) => <label key={key}>{label}<input required disabled={!isCreate && key === 'id'} className="form-input" value={draft[key] || ''} onChange={(event) => update({ [key]: event.target.value })} /></label>)}
        <label>Status<select className="form-select" value={draft.status} onChange={(event) => update({ status: event.target.value })}><option value="draft">Draft</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <label>Capacity<input className="form-input" type="number" min="1" value={draft.capacity ?? ''} onChange={(event) => update({ capacity: event.target.value })} /></label>
        <label>Default slot minutes<select className="form-select" value={draft.defaultSlotMinutes} onChange={(event) => update({ defaultSlotMinutes: Number(event.target.value) })}>{[30, 45, 60, 90, 120].map((value) => <option key={value} value={value}>{value} minutes</option>)}</select></label>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}><input type="checkbox" checked={draft.bookingEnabled} onChange={(event) => update({ bookingEnabled: event.target.checked })} /> Booking enabled</label>
      </div>
      <label style={{ display: 'block', marginTop: '0.75rem' }}>Short description<textarea className="form-textarea" rows="2" value={draft.shortDescription || ''} onChange={(event) => update({ shortDescription: event.target.value })} /></label>
      <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}><strong><Clock size={15} /> Weekly schedule</strong><p style={{ margin: '0.25rem 0 0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Each facility owns its own schedule. Overnight close times are supported.</p>
        {DAYS.map((day, dayOfWeek) => { const schedule = draft.schedules.find((item) => item.dayOfWeek === dayOfWeek); return <div key={day} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr', gap: '0.4rem', alignItems: 'center', marginBottom: '0.35rem' }}><label><input type="checkbox" checked={activeScheduleDays.has(dayOfWeek)} onChange={(event) => toggleDay(dayOfWeek, event.target.checked)} /> {day}</label>{schedule ? <><input className="form-input" type="time" value={minutesToTime(schedule.opensAtMinutes)} onChange={(event) => updateSchedule(dayOfWeek, { opensAtMinutes: timeToMinutes(event.target.value) })} /><input className="form-input" type="time" value={minutesToTime(schedule.closesAtMinutes % 1440)} onChange={(event) => updateSchedule(dayOfWeek, { closesAtMinutes: timeToMinutes(event.target.value) || 1440 })} /></> : <span style={{ gridColumn: 'span 2', color: 'var(--text-muted)' }}>Closed</span>}</div>; })}
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}><button className="btn btn-primary" disabled={saving} type="submit"><Save size={16} /> {saving ? 'Saving…' : 'Save facility'}</button><button className="btn btn-outline" type="button" onClick={() => setDraft(null)}>Cancel</button></div>
    </form> : <div className="card-arena" style={{ padding: '2rem', color: 'var(--text-muted)' }}>Choose a facility or add a new one to configure its profile and schedule.</div>}
  </div>;
}
