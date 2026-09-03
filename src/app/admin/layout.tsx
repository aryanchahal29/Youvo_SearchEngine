import { ReactNode } from 'react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const navItems = [
    { name: 'Overview', href: '/admin' },
    { name: 'Tools', href: '/admin/tools' },
    { name: 'Sources & Providers', href: '/admin/sources' },
    { name: 'Evidence', href: '/admin/evidence' },
    { name: 'Rankings', href: '/admin/rankings' },
    { name: 'Jobs (Queue)', href: '/admin/jobs' },
    { name: 'Audit Logs', href: '/admin/audit' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col">
        <div className="p-6">
          <Link href="/" className="text-xl font-bold text-white tracking-wider hover:text-primary transition-colors">
            YouVo <span className="text-indigo-400">Admin</span>
          </Link>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map(item => (
            <Link 
              key={item.href} 
              href={item.href}
              className="block px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors"
            >
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <Link href="/" className="block px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors text-sm">
            ← Back to Search
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white shadow-sm px-8 py-4">
          <h2 className="text-lg font-semibold text-gray-800">Dashboard</h2>
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
