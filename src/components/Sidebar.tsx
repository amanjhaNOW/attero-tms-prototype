import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  Boxes,
  Truck,
  Warehouse,
  Settings,
  Users,
  Building2,
  MapPin,
  ChevronDown,
  Recycle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  children?: { label: string; href: string }[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Pickup Requests', href: '/pickup-requests', icon: ClipboardList },
  { label: 'Loads', href: '/loads', icon: Boxes },
  { label: 'Shipments', href: '/shipments', icon: Truck },
  { label: 'Warehouse', href: '/warehouse', icon: Warehouse },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    children: [
      { label: 'Clients', href: '/settings/clients' },
      { label: 'Transporters', href: '/settings/transporters' },
      { label: 'Vehicles', href: '/settings/vehicles' },
      { label: 'Locations', href: '/settings/locations' },
    ],
  },
];

export function Sidebar() {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(
    new Set(
      navItems
        .filter(
          (item) =>
            item.children &&
            item.children.some((child) => location.pathname.startsWith(child.href))
        )
        .map((item) => item.label)
    )
  );

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-gray-200 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Recycle className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-text-primary leading-tight">
            Attero TMS
          </h1>
          <p className="text-[10px] font-medium text-text-muted uppercase tracking-widest">
            Transport Management
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 scrollbar-thin">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isExpanded = expandedItems.has(item.label);
            const Icon = item.icon;
            const isActive =
              location.pathname === item.href ||
              (item.children &&
                item.children.some((c) => location.pathname.startsWith(c.href)));

            if (item.children) {
              return (
                <li key={item.label}>
                  <button
                    onClick={() => toggleExpand(item.label)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'text-primary bg-primary-50'
                        : 'text-text-secondary hover:bg-gray-50 hover:text-text-primary'
                    )}
                  >
                    <Icon className="h-4.5 w-4.5 flex-shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform',
                        isExpanded && 'rotate-180'
                      )}
                    />
                  </button>
                  {isExpanded && (
                    <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-200 pl-3">
                      {item.children.map((child) => {
                        const childIcon =
                          child.label === 'Clients'
                            ? Users
                            : child.label === 'Transporters'
                            ? Truck
                            : child.label === 'Vehicles'
                            ? Building2
                            : MapPin;
                        const ChildIcon = childIcon;
                        return (
                          <li key={child.href}>
                            <NavLink
                              to={child.href}
                              className={({ isActive: active }) =>
                                cn(
                                  'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                                  active
                                    ? 'text-primary font-medium bg-primary-50'
                                    : 'text-text-muted hover:bg-gray-50 hover:text-text-primary'
                                )
                              }
                            >
                              <ChildIcon className="h-3.5 w-3.5" />
                              {child.label}
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            }

            return (
              <li key={item.label}>
                <NavLink
                  to={item.href}
                  end={item.href === '/'}
                  className={({ isActive: active }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'text-primary bg-primary-50'
                        : 'text-text-secondary hover:bg-gray-50 hover:text-text-primary'
                    )
                  }
                >
                  <Icon className="h-4.5 w-4.5 flex-shrink-0" />
                  {item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 px-4 py-3">
        <p className="text-xs text-text-muted">v0.1.0 — Slice 0</p>
      </div>
    </aside>
  );
}
