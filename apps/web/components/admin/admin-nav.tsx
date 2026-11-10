'use client';

import { usePathname } from 'next/navigation';

const links = [
  { href: '/admin/warehouses', label: '仓库' },
  { href: '/admin/locations', label: '库位' },
  { href: '/admin/staff', label: '员工' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="w-44 shrink-0 border-r border-[#d5dee6] bg-white p-4">
      <p className="px-3 text-xs font-medium tracking-wide text-[#3d4d5c]">基础资料</p>
      <ul className="mt-3 space-y-1">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <li key={link.href}>
              <a
                href={link.href}
                className={`block rounded-lg px-3 py-2 text-sm ${
                  active ? 'bg-[#0f6e6b] text-white' : 'text-[#122033] hover:bg-[#f4f6f8]'
                }`}
              >
                {link.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
