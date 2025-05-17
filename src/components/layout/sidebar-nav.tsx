
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
  FolderPlus, // Ajout de l'icône
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const navItems = [
  { href: '/#dashboard', label: 'Tableau de Bord', icon: LayoutDashboard, tooltip: 'Tableau de Bord de la Thèse' },
  { href: '/#tasks', label: 'Gestion Tâches', icon: ListTodo, tooltip: 'Gestion de tâches par IA' },
  { href: '/#brain-dump', label: 'Vide-Cerveau', icon: Brain, tooltip: 'Capturer les Idées' },
  { href: '/#daily-plan', label: 'Plan du Jour', icon: Target, tooltip: 'Objectifs Journaliers' },
  { href: '/#pomodoro', label: 'Pomodoro', icon: Timer, tooltip: 'Sessions de Travail Profond' },
  { href: '/#sources', label: 'Bibliothèque', icon: Library, tooltip: 'Gérer les Sources' },
  { href: '/add-chapter', label: 'Ajouter Chapitre', icon: FolderPlus, tooltip: 'Ajouter un nouveau chapitre' }, // Nouvelle page
];

export function SidebarNav() {
  const pathname = usePathname();
  const { state: sidebarState } = useSidebar();
  const [currentHash, setCurrentHash] = useState('');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash; // Includes '#'
      setCurrentHash(hash);
    };

    handleHashChange(); 
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []); // Pas de dépendance à pathname pour éviter les re-render inutiles si seul le hash change


  return (
    <ScrollArea className="flex-1">
      <SidebarMenu>
        {navItems.map((item) => {
          let isActive = false;
          if (item.href.startsWith('/#')) {
            // C'est un lien d'ancrage pour la page d'accueil
            isActive = pathname === '/' && item.href === currentHash;
             // Gérer le cas où le hash est vide ou juste '#' et que l'item est dashboard
            if (!currentHash || currentHash === '#') {
              isActive = pathname === '/' && item.href === '/#dashboard';
            }
          } else {
            // C'est un lien vers une page distincte
            isActive = pathname === item.href;
          }
          
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
