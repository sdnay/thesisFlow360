
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
  HomeIcon, // Conserver HomeIcon pour le lien principal vers l'espace de travail
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// Définition des éléments de navigation de la barre latérale
const navItems = [
  { href: '/', label: 'Espace de Travail', icon: HomeIcon, tooltip: 'Vue d\'ensemble de l\'espace de travail' },
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
    const updateHash = () => {
      setCurrentHash(window.location.hash);
    };

    updateHash(); // Set initial hash
    window.addEventListener('hashchange', updateHash, false);
    return () => {
      window.removeEventListener('hashchange', updateHash, false);
    };
  }, []);

  return (
    <ScrollArea className="flex-1">
      <SidebarMenu>
        {navItems.map((item) => {
          // Le lien principal '/' est actif si le pathname est '/'.
          // Les liens d'ancre sont actifs si le pathname est '/' ET que le hash correspond.
          const isActive = item.href === '/' 
            ? pathname === '/' && (currentHash === '' || currentHash === '#') // Actif si à la racine sans hash spécifique (ou # seul)
            : pathname === '/' && item.href.substring(1) === currentHash; // Comparer l'ancre

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
