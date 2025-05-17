
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
// useEffect et useState pour currentHash ne sont plus nécessaires
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
  // HomeIcon n'est plus utilisé de la même manière
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// Définition des éléments de navigation de la barre latérale avec les nouvelles routes
const navItems = [
  { href: '/dashboard', label: 'Tableau de Bord', icon: LayoutDashboard, tooltip: 'Tableau de Bord de la Thèse' },
  { href: '/tasks', label: 'Gestion Tâches', icon: ListTodo, tooltip: 'Gestion de tâches par IA' },
  { href: '/brain-dump', label: 'Vide-Cerveau', icon: Brain, tooltip: 'Capturer les Idées' },
  { href: '/daily-plan', label: 'Plan du Jour', icon: Target, tooltip: 'Objectifs Journaliers' },
  { href: '/pomodoro', label: 'Pomodoro', icon: Timer, tooltip: 'Sessions de Travail Profond' },
  { href: '/sources', label: 'Bibliothèque', icon: Library, tooltip: 'Gérer les Sources' },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { state: sidebarState } = useSidebar();
  // currentHash et son useEffect sont supprimés

  return (
    <ScrollArea className="flex-1">
      <SidebarMenu>
        {navItems.map((item) => {
          // La logique isActive est simplifiée pour correspondre au pathname exact
          const isActive = pathname === item.href;

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
