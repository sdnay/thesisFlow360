// src/components/layout/sidebar-nav.tsx
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react'; // useState pour le hash
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
  ListTree, // Gardé pour "Plan de Thèse"
  // FolderPlus, // Peut être retiré si "Ajouter Chapitre" est intégré ailleurs ou renommé
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const navItems = [
  { href: '/', label: 'Tableau de Bord', icon: LayoutDashboard, tooltip: 'Tableau de Bord & Assistant IA', isPage: true },
  { href: '/tasks', label: 'Gestion Tâches', icon: ListTodo, tooltip: 'Gestion de tâches par IA', isPage: true },
  { href: '/brain-dump', label: 'Vide-Cerveau', icon: Brain, tooltip: 'Capturer les Idées', isPage: true },
  { href: '/daily-plan', label: 'Plan du Jour', icon: Target, tooltip: 'Objectifs Journaliers', isPage: true },
  { href: '/pomodoro', label: 'Pomodoro', icon: Timer, tooltip: 'Sessions de Travail Profond', isPage: true },
  { href: '/sources', label: 'Bibliothèque', icon: Library, tooltip: 'Gérer les Sources', isPage: true },
  { href: '/add-chapter', label: 'Plan de Thèse', icon: ListTree, tooltip: 'Gérer la structure et les chapitres', isPage: true },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { state: sidebarState, isMobile, setOpenMobile } = useSidebar();
  const [currentHash, setCurrentHash] = useState('');

  useEffect(() => {
    const updateHash = () => setCurrentHash(window.location.hash);
    updateHash(); // Initial hash
    window.addEventListener('hashchange', updateHash);
    return () => window.removeEventListener('hashchange', updateHash);
  }, []);

  return (
    <ScrollArea className="flex-1">
      <SidebarMenu>
        {navItems.map((item) => {
          let isActive = false;
          if (item.isPage) { // Pour les pages dédiées
            isActive = pathname === item.href;
          } else { // Pour les ancres sur la page d'accueil
            isActive = pathname === '/' && currentHash === item.href.substring(1); // item.href serait par ex "/#dashboard"
          }
          
          return (
            <SidebarMenuItem key={item.href}>
              <Link 
                href={item.href} 
                passHref 
                legacyBehavior
                onClick={() => {
                  if (isMobile) setOpenMobile(false); // Ferme la sidebar sur mobile après clic
                  if (!item.isPage) { // Si c'est une ancre, s'assurer que le hash change
                    // setTimeout pour laisser le temps à la navigation de se faire avant le hash change
                    setTimeout(() => setCurrentHash(item.href.substring(1)), 0);
                  }
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