
// src/components/layout/sidebar-nav.tsx
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react'; // useState pour le hash (bien que moins utilisé maintenant)
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
  Target as TargetIcon, // Renommé pour éviter conflit avec type Target
  Timer,
  Library,
  ListTree,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const navItems = [
  { href: '/', label: 'Tableau de Bord', icon: LayoutDashboard, tooltip: 'Vue d\'ensemble et assistant IA', isPage: true },
  { href: '/tasks', label: 'Tâches', icon: ListTodo, tooltip: 'Gérer vos tâches et priorités', isPage: true },
  { href: '/brain-dump', label: 'Vide-Cerveau', icon: Brain, tooltip: 'Capturer rapidement idées et pensées', isPage: true },
  { href: '/daily-plan', label: 'Plan du Jour', icon: TargetIcon, tooltip: 'Définir et suivre vos objectifs quotidiens', isPage: true },
  { href: '/pomodoro', label: 'Minuteur Pomodoro', icon: Timer, tooltip: 'Sessions de travail focus avec la technique Pomodoro', isPage: true },
  { href: '/sources', label: 'Bibliothèque', icon: Library, tooltip: 'Gérer vos sources bibliographiques et documents', isPage: true },
  { href: '/add-chapter', label: 'Plan de Thèse', icon: ListTree, tooltip: 'Structurer et gérer les chapitres de votre thèse', isPage: true },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { state: sidebarState, isMobile, setOpenMobile } = useSidebar();
  const [currentHash, setCurrentHash] = useState(''); // Gardé pour flexibilité, même si moins utilisé

  useEffect(() => {
    const updateHash = () => setCurrentHash(window.location.hash);
    updateHash();
    window.addEventListener('hashchange', updateHash);
    return () => window.removeEventListener('hashchange', updateHash);
  }, []);

  return (
    <ScrollArea className="flex-1">
      <SidebarMenu>
        {navItems.map((item) => {
          // Puisque chaque lien mène à une page distincte, isActive est simplement la comparaison du href.
          // La logique du hash n'est plus pertinente ici si chaque item.href est une route de page.
          const isActive = pathname === item.href;

          return (
            <SidebarMenuItem key={item.href}>
              <Link
                href={item.href}
                passHref
                legacyBehavior
                onClick={() => {
                  if (isMobile) setOpenMobile(false);
                  // La gestion du hash n'est plus nécessaire ici si ce sont des pages distinctes
                }}
              >
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
