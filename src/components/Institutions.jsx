import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useInstitutions } from '../institutions.jsx';
import { Badge, Button, EmptyState, Header, Icon } from './ui.jsx';

const ROLE_LABELS = { owner: 'Tulajdonos', admin: 'Admin', teacher: 'Oktató', student: 'Diák' };
const inputClass = 'w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 text-sm outline-none focus:border-brand-400 transition-colors';

function InstitutionDetail({ institution, onBack }) {
  const { token, apiUrl } = useAuth();
  const { refresh } = useInstitutions();
  const [tab, setTab] = useState('classes');
  const [classes, setClasses] = useState([]);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showClassForm, setShowClassForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [createdInvite, setCreatedInvite] = useState(null);
  const [classForm, setClassForm] = useState({ name: '', subject: '', term: '' });
  const [memberForm, setMemberForm] = useState({ email: '', role: 'student', classId: '' });
  const [inviteForm, setInviteForm] = useState({ kind: 'link', email: '', role: 'student', classId: '', maxUses: 1, expiresInDays: 14 });
  const canManage = ['owner', 'admin'].includes(institution.role);
  const canTeach = ['owner', 'admin', 'teacher'].includes(institution.role);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const requests = [apiRequest(apiUrl, token, `/api/institutions/${institution.id}/classes`)];
      if (canTeach) {
        requests.push(apiRequest(apiUrl, token, `/api/institutions/${institution.id}/members`));
        requests.push(apiRequest(apiUrl, token, `/api/institutions/${institution.id}/invitations`));
      }
      const [classData, memberData, invitationData] = await Promise.all(requests);
      setClasses(classData.classes);
      setMembers(memberData?.members || []);
      setInvitations(invitationData?.invitations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [institution.id]);

  const createClass = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await apiRequest(apiUrl, token, `/api/institutions/${institution.id}/classes`, { method: 'POST', body: JSON.stringify(classForm) });
      setClassForm({ name: '', subject: '', term: '' });
      setShowClassForm(false);
      await Promise.all([load(), refresh()]);
    } catch (err) {
      setError(err.message);
    }
  };

  const addMember = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await apiRequest(apiUrl, token, `/api/institutions/${institution.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ ...memberForm, classId: memberForm.classId || null }),
      });
      setMemberForm({ email: '', role: 'student', classId: '' });
      setShowMemberForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateMember = async (member, values) => {
    setError('');
    try {
      await apiRequest(apiUrl, token, `/api/institutions/${institution.id}/members/${member.id}`, { method: 'PATCH', body: JSON.stringify(values) });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const createInvitation = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const payload = {
        ...inviteForm,
        email: inviteForm.kind === 'email' ? inviteForm.email : null,
        classId: inviteForm.classId || null,
        maxUses: inviteForm.kind === 'code' ? Number(inviteForm.maxUses) : 1,
        expiresInDays: Number(inviteForm.expiresInDays),
      };
      const data = await apiRequest(apiUrl, token, `/api/institutions/${institution.id}/invitations`, { method: 'POST', body: JSON.stringify(payload) });
      setCreatedInvite(data.invitation);
      setShowInviteForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const revokeInvitation = async (id) => {
    if (!confirm('Biztosan visszavonod ezt a meghívót?')) return;
    try {
      await apiRequest(apiUrl, token, `/api/institutions/${institution.id}/invitations/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const inviteValue = createdInvite?.token
    ? `${window.location.origin}?invite=${encodeURIComponent(createdInvite.token)}`
    : createdInvite?.code || '';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full pb-28">
      <Header title={institution.name} subtitle={ROLE_LABELS[institution.role]} onBack={onBack} />
      {error && <div className="mb-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3 text-sm text-rose-600 dark:text-rose-300">{error}</div>}

      <div className="flex gap-2 overflow-x-auto mb-5">
        <Button label="Osztályok" variant={tab === 'classes' ? 'primary' : 'secondary'} onClick={() => setTab('classes')} />
        {canTeach && <Button label="Tagok" variant={tab === 'members' ? 'primary' : 'secondary'} onClick={() => setTab('members')} />}
        {canTeach && <Button label="Meghívók" variant={tab === 'invitations' ? 'primary' : 'secondary'} onClick={() => setTab('invitations')} />}
      </div>

      {loading ? <p className="text-center text-sm text-slate-400 py-12">Betöltés...</p> : tab === 'classes' ? (
        <>
          {canTeach && <div className="flex justify-end mb-4"><Button label="Új osztály" onClick={() => setShowClassForm(true)} /></div>}
          {showClassForm && (
            <form onSubmit={createClass} className="card p-4 mb-4 grid sm:grid-cols-3 gap-3">
              <input required value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} placeholder="Osztály neve" className={inputClass} />
              <input value={classForm.subject} onChange={(e) => setClassForm({ ...classForm, subject: e.target.value })} placeholder="Tantárgy" className={inputClass} />
              <input value={classForm.term} onChange={(e) => setClassForm({ ...classForm, term: e.target.value })} placeholder="Időszak / tanév" className={inputClass} />
              <div className="sm:col-span-3 flex justify-end gap-2"><Button type="button" label="Mégse" variant="ghost" onClick={() => setShowClassForm(false)} /><Button type="submit" label="Létrehozás" /></div>
            </form>
          )}
          {classes.length === 0 ? <EmptyState icon={<Icon name="home" />} title="Még nincs osztály" hint="Hozd létre az első osztályt vagy tanfolyamot." /> : (
            <div className="grid sm:grid-cols-2 gap-4">
              {classes.map((item) => (
                <div key={item.id} className="card p-5">
                  <div className="flex justify-between gap-3"><div><h2 className="font-semibold">{item.name}</h2><p className="text-sm text-slate-500 mt-1">{item.subject || 'Nincs tantárgy'}{item.term ? ` • ${item.term}` : ''}</p></div><Badge text={`${item.memberCount} tag`} tone="slate" /></div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : tab === 'members' ? (
        <>
          {canManage && <div className="flex justify-end mb-4"><Button label="Tag hozzáadása" onClick={() => setShowMemberForm(true)} /></div>}
          {showMemberForm && (
            <form onSubmit={addMember} className="card p-4 mb-4 grid sm:grid-cols-3 gap-3">
              <input required type="email" value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} placeholder="Email" className={inputClass} />
              <select value={memberForm.role} onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })} className={inputClass}><option value="student">Diák</option><option value="teacher">Oktató</option>{institution.role === 'owner' && <option value="admin">Admin</option>}</select>
              <select value={memberForm.classId} onChange={(e) => setMemberForm({ ...memberForm, classId: e.target.value })} className={inputClass}><option value="">Intézmény, osztály nélkül</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <div className="sm:col-span-3 flex justify-end gap-2"><Button type="button" label="Mégse" variant="ghost" onClick={() => setShowMemberForm(false)} /><Button type="submit" label="Hozzáadás" /></div>
            </form>
          )}
          <div className="flex flex-col gap-2">
            {members.map((member) => (
              <div key={member.id} className="card p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-200 flex items-center justify-center font-semibold">{member.email[0].toUpperCase()}</div>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{member.displayName || member.email}</p><p className="text-xs text-slate-400 truncate">{member.email}</p></div>
                {canManage && member.role !== 'owner' && (institution.role === 'owner' || member.role !== 'admin') ? (
                  <div className="flex items-center gap-2">
                    <select value={member.role} onChange={(e) => updateMember(member, { role: e.target.value })} className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1.5 text-xs"><option value="student">Diák</option><option value="teacher">Oktató</option>{institution.role === 'owner' && <option value="admin">Admin</option>}</select>
                    <button type="button" onClick={() => updateMember(member, { status: member.status === 'active' ? 'suspended' : 'active' })} className="text-xs text-slate-500 hover:text-rose-500">{member.status === 'active' ? 'Felfüggesztés' : 'Aktiválás'}</button>
                  </div>
                ) : <Badge text={ROLE_LABELS[member.role]} tone={member.role === 'owner' ? 'brand' : 'slate'} />}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-end mb-4"><Button label="Új meghívó" onClick={() => { setShowInviteForm(true); setCreatedInvite(null); }} /></div>
          {showInviteForm && (
            <form onSubmit={createInvitation} className="card p-4 mb-4 grid sm:grid-cols-2 gap-3">
              <select value={inviteForm.kind} onChange={(e) => setInviteForm({ ...inviteForm, kind: e.target.value, maxUses: 1 })} className={inputClass}><option value="link">Meghívó link</option><option value="email">Emailhez kötött link</option><option value="code">Közös meghívókód</option></select>
              <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })} className={inputClass}><option value="student">Diák</option>{institution.role !== 'teacher' && <option value="teacher">Oktató</option>}{institution.role === 'owner' && <option value="admin">Admin</option>}</select>
              {inviteForm.kind === 'email' && <input required type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="Meghívott email címe" className={inputClass} />}
              <select required={institution.role === 'teacher'} value={inviteForm.classId} onChange={(e) => setInviteForm({ ...inviteForm, classId: e.target.value })} className={inputClass}><option value="">Teljes intézmény</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              {inviteForm.kind === 'code' && <input type="number" min="1" max="10000" value={inviteForm.maxUses} onChange={(e) => setInviteForm({ ...inviteForm, maxUses: e.target.value })} placeholder="Felhasználások száma" className={inputClass} />}
              <input type="number" min="1" max="365" value={inviteForm.expiresInDays} onChange={(e) => setInviteForm({ ...inviteForm, expiresInDays: e.target.value })} placeholder="Lejárat napokban" className={inputClass} />
              <div className="sm:col-span-2 flex justify-end gap-2"><Button type="button" label="Mégse" variant="ghost" onClick={() => setShowInviteForm(false)} /><Button type="submit" label="Meghívó létrehozása" /></div>
            </form>
          )}
          {createdInvite && (
            <div className="card p-4 mb-4 border-emerald-300 dark:border-emerald-800">
              <p className="text-sm font-medium mb-2">A meghívó elkészült. Ezt az értéket csak most jelenítjük meg:</p>
              <div className="flex gap-2"><input readOnly value={inviteValue} className={`${inputClass} font-mono`} /><Button label="Másolás" onClick={() => navigator.clipboard.writeText(inviteValue)} /></div>
              {createdInvite.kind === 'email' && <p className="text-xs text-slate-400 mt-2">Az automatikus emailküldés későbbi integráció; most másold és küldd el a linket a címzettnek.</p>}
            </div>
          )}
          <div className="flex flex-col gap-2">
            {invitations.map((invitation) => {
              const expired = new Date(invitation.expiresAt).getTime() <= Date.now();
              const inactive = expired || invitation.revokedAt || invitation.usedCount >= invitation.maxUses;
              return (
                <div key={invitation.id} className="card p-4 flex items-center gap-3">
                  <div className="flex-1"><p className="text-sm font-medium">{invitation.kind === 'code' ? 'Meghívókód' : invitation.kind === 'email' ? invitation.email : 'Meghívó link'} • {ROLE_LABELS[invitation.role]}</p><p className="text-xs text-slate-400">{invitation.className || 'Teljes intézmény'} • {invitation.usedCount}/{invitation.maxUses} használat • {new Date(invitation.expiresAt).toLocaleDateString('hu-HU')}</p></div>
                  <Badge text={inactive ? 'Lezárt' : 'Aktív'} tone={inactive ? 'slate' : 'green'} />
                  {!inactive && <button type="button" onClick={() => revokeInvitation(invitation.id)} className="text-xs text-rose-500">Visszavonás</button>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function Institutions({ onBack }) {
  const { token, apiUrl, isGuest } = useAuth();
  const { institutions, activeInstitution, setActiveInstitutionId, refresh, loading, error: contextError } = useInstitutions();
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState(() => new URLSearchParams(window.location.search).get('invite') || '');
  const [error, setError] = useState('');

  const createInstitution = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const data = await apiRequest(apiUrl, token, '/api/institutions', { method: 'POST', body: JSON.stringify({ name }) });
      await refresh();
      setActiveInstitutionId(data.institution.id);
      setSelected(data.institution);
      setName('');
      setShowCreate(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const acceptInvitation = async (event) => {
    event.preventDefault();
    setError('');
    try {
      let value = inviteCode.trim();
      try {
        const parsedUrl = new URL(value);
        value = parsedUrl.searchParams.get('invite') || value;
      } catch {}
      const isToken = !value.toUpperCase().startsWith('VM-') && value.length > 20;
      const data = await apiRequest(apiUrl, token, '/api/institutions/invitations/accept', { method: 'POST', body: JSON.stringify(isToken ? { token: value } : { code: value }) });
      const list = await refresh();
      const joined = list.find((item) => item.id === data.institution.id);
      if (!joined) throw new Error('A csatlakozott intézmény nem tölthető be.');
      setActiveInstitutionId(data.institution.id);
      setSelected(joined);
      setInviteCode('');
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err) {
      setError(err.message);
    }
  };

  if (selected) return <InstitutionDetail institution={selected} onBack={() => { setSelected(null); refresh(); }} />;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full pb-28">
      <Header title="Intézmények" subtitle="Saját intézmények, osztályok és meghívások" onBack={onBack} />
      {isGuest ? <EmptyState icon={<Icon name="home" />} title="Bejelentkezés szükséges" hint="Intézmény létrehozásához vagy meghívó elfogadásához jelentkezz be." /> : (
        <>
          {(error || contextError) && <div className="mb-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3 text-sm text-rose-600 dark:text-rose-300">{error || contextError}</div>}
          <div className="grid lg:grid-cols-[1fr_auto] gap-4 mb-6">
            <form onSubmit={acceptInvitation} className="card p-4 flex flex-col sm:flex-row gap-2">
              <input required value={inviteCode} onChange={(e) => setInviteCode(e.target.value.trim())} placeholder="Meghívókód vagy meghívó link tokenje" className={`${inputClass} flex-1`} />
              <Button type="submit" label="Csatlakozás" />
            </form>
            <Button label="Új intézmény" onClick={() => setShowCreate(true)} />
          </div>
          {showCreate && (
            <form onSubmit={createInstitution} className="card p-4 mb-5 flex flex-col sm:flex-row gap-2">
              <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Intézmény neve" className={`${inputClass} flex-1`} />
              <Button type="submit" label="Létrehozás" /><Button type="button" label="Mégse" variant="ghost" onClick={() => setShowCreate(false)} />
            </form>
          )}
          {loading ? <p className="text-center text-sm text-slate-400 py-12">Betöltés...</p> : institutions.length === 0 ? <EmptyState icon={<Icon name="home" />} title="Még nem tartozol intézményhez" hint="Hozz létre egy intézményt, vagy csatlakozz meghívóval." /> : (
            <div className="grid sm:grid-cols-2 gap-4">
              {institutions.map((institution) => (
                <button key={institution.id} type="button" onClick={() => { setActiveInstitutionId(institution.id); setSelected(institution); }} className={`card card-hover p-5 text-left ${activeInstitution?.id === institution.id ? 'border-brand-400' : ''}`}>
                  <div className="flex justify-between gap-3"><div><h2 className="font-semibold">{institution.name}</h2><p className="text-sm text-slate-500 mt-1">{institution.memberCount} tag • {institution.classCount} osztály</p></div><Badge text={ROLE_LABELS[institution.role]} tone={institution.role === 'owner' ? 'brand' : 'slate'} /></div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
