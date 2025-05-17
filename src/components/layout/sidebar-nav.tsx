"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  ListTodo,
  Brain,
  Target,
  Timer,
  Library,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// Navigation items point to hashes on the main page
const navItems = [
  { href: '/#dashboard', label: 'Tableau de Bord', icon: LayoutDashboard, tooltip: 'Tableau de Bord de la Thèse' },
  { href: '/#tasks', label: 'Gestion Tâches', icon: ListTodo, tooltip: 'Gestion de tâches par IA' },
  { href: '/#brain-dump', label: 'Vide-Cerveau', icon: Brain, tooltip: 'Capturer les Idées' },
  { href: '/#daily-plan', label: 'Plan du Jour', icon: Target, tooltip: 'Objectifs Journaliers' },
  { href: '/#pomodoro', label: 'Pomodoro', icon: Timer, tooltip: 'Sessions de Travail Profond' },
  { href: '/#sources', label: 'Bibliothèque', icon: Library, tooltip: 'Gérer les Sources' },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { state: sidebarState } = useSidebar();
  const [currentHash, setCurrentHash] = useState('');

  useEffect(() => {
    const handleHashChange = () => {
      // Default to #dashboard if hash is empty or just '/', otherwise use the actual hash
      const hash = window.location.hash || '#dashboard';
      setCurrentHash(hash);
    };

    handleHashChange(); // Set initial hash based on URL
    window.addEventListener('hashchange', handleHashChange);

    // Also update hash if pathname changes to ensure consistency, though for this app structure it might be less critical
    // if all these links point to the same page ('/').
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [pathname]);


  return (
    <ScrollArea className="flex-1">
      <SidebarMenu>
        {navItems.map((item) => {
          // isActive if current path is root AND item's href (e.g., /#dashboard) matches current full hash path (e.g., /#dashboard)
          const isActive = pathname === '/' && item.href === `/${currentHash}`;
          
          return (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} passHref legacyBehavior>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.tooltip}
                  className={cn(
                    sidebarState === 'collapsed' && 'justify-center',
                  )}
                >
                  <a>
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className={cn(sidebarState === 'collapsed' && 'sr-only')}>
                      {item.label}
                    </span>
                  </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </ScrollArea>
  );
}