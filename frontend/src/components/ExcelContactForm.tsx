import React, { useState } from 'react';
import * as XLSX from 'xlsx';

export default function ExcelContactForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  function downloadExcel() {
    const data = [{ Name: name, 'Phone Number': phone, Email: email }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    XLSX.writeFile(wb, 'contacts.xlsx');
  }

  return (
    <div style={{ background: '#fff', padding: 16, borderRadius: 8, marginBottom: 20, border: '1px solid #e6e6e6' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 15 }}>Create Excel (Name · Phone Number · Email)</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
          <span style={{ color: '#6b7280', marginBottom: 6 }}>Name</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sulagna" style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }} />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
          <span style={{ color: '#6b7280', marginBottom: 6 }}>Phone Number</span>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 9830077693" style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }} />
        </label>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ flex: 1, display: 'flex', flexDirection: 'column', fontSize: 13 }}>
            <span style={{ color: '#6b7280', marginBottom: 6 }}>Email</span>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. you@example.com" style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }} />
          </label>

          <button onClick={downloadExcel} style={{ background: '#F4A800', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Download Excel</button>
        </div>
      </div>
    </div>
  );
}
