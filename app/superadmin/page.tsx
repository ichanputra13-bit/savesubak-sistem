import { Fingerprint, CheckCircle, XCircle, Users } from 'lucide-react'

// Dummy data for visual presentation before connecting to DB
const mockOrgs = [
  { id: 1, name: 'Kelompok Tani Makmur', status: 'active', limit: 100, used: 45, expired: '2027-01-01' },
  { id: 2, name: 'Subak Sangeh', status: 'pending', limit: 100, used: 0, expired: '-' },
  { id: 3, name: 'Koperasi Harapan Jaya', status: 'expired', limit: 100, used: 90, expired: '2026-06-01' },
]

export default function SuperAdminPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <Fingerprint className="w-8 h-8 text-indigo-600" />
              Developer Control Panel
            </h1>
            <p className="text-slate-500 mt-1">Kelola langganan (SaaS) dan kuota Organisasi klien Anda.</p>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 flex items-center gap-3">
            <Users className="w-5 h-5 text-indigo-500" />
            <span className="font-semibold text-slate-700">Total Klien: 3</span>
          </div>
        </header>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                <th className="px-6 py-4 font-semibold">Nama Organisasi</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Kuota (Ha)</th>
                <th className="px-6 py-4 font-semibold">Masa Aktif</th>
                <th className="px-6 py-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {mockOrgs.map((org) => (
                <tr key={org.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4 font-medium text-slate-800">{org.name}</td>
                  <td className="px-6 py-4">
                    {org.status === 'active' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="w-3.5 h-3.5" /> Aktif</span>}
                    {org.status === 'pending' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Menunggu</span>}
                    {org.status === 'expired' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="w-3.5 h-3.5" /> Expired</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-700">{org.used} / {org.limit} Ha</span>
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(org.used / org.limit) * 100}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                    {org.expired}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {org.status === 'pending' && (
                        <button className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded text-sm font-medium transition">
                          Approve
                        </button>
                      )}
                      <button className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded text-sm font-medium transition">
                        Edit Kuota
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
