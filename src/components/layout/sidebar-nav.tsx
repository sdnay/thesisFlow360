
// src/components/layout/sidebar-nav.tsx
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
  Target as TargetIcon,
  Timer,
  Library,
  ListTree,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const navItems = [
  { href: '/', label: 'Tableau de Bord', icon: LayoutDashboard, tooltip: "Aperçu général de votre projet et assistant IA", isPage: true },
  { href: '/tasks', label: 'Gestion des Tâches', icon: ListTodo, tooltip: "Organiser, prioriser et suivre vos tâches", isPage: true },
  { href: '/brain-dump', label: 'Vide-Cerveau', icon: Brain, tooltip: "Capturer rapidement vos idées, notes et pensées", isPage: true },
  { href: '/daily-plan', label: 'Planification Quotidienne', icon: TargetIcon, tooltip: "Définir et suivre vos objectifs pour la journée", isPage: true },
  { href: '/pomodoro', label: 'Minuteur Pomodoro', icon: Timer, tooltip: "Gérer vos sessions de travail focus et consulter l'historique", isPage: true },
  { href: '/sources', label: 'Bibliothèque de Sources', icon: Library, tooltip: "Gérer vos références bibliographiques et documents de recherche", isPage: true },
  { href: '/add-chapter', label: 'Structure de la Thèse', icon: ListTree, tooltip: "Organiser et suivre l'avancement des chapitres de votre thèse", isPage: true },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { state: sidebarState, isMobile, setOpenMobile } = useSidebar();
  const [currentHash, setCurrentHash] = useState(''); // Maintenu pour flexibilité

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
          // Pour les pages simples, isActive est une comparaison directe du pathname.
          // Si la page d'accueil (href: '/') utilise des ancres, une logique plus complexe est nécessaire.
          // Pour l'instant, on suppose que '/' est une page et que les autres sont aussi des pages distinctes.
          let isActive = pathname === item.href;
          if (item.href === '/' && pathname === '/' && currentHash === '') {
             // Cas spécifique pour le tableau de bord sur la page d'accueil sans hash
             isActive = true;
          } else if (item.href === '/' && currentHash && pathname === '/') {
             // Si l'item est le tableau de bord (href='/') mais qu'il y a un hash,
             // alors le tableau de bord n'est pas l'élément actif si ce hash correspond à un autre item
             // Ceci est plus pour les cas où les tabs étaient sur la page d'accueil
             // Pour des pages distinctes, cette logique est moins pertinente.
          }


          return (
            <SidebarMenuItem key={item.href}>
              <Link
                href={item.href}
                passHref
                legacyBehavior // requis si le composant enfant n'est pas un simple <a>
                onClick={() => {
                  if (isMobile) setOpenMobile(false);
                }}
              >
                <SidebarMenuButton
                  asChild // Permet à Link de contrôler le comportement de clic
                  isActive={isActive}
                  tooltip={item.tooltip}
                  className={cn(
                    sidebarState === 'collapsed' && 'justify-center',
                  )}
                >
                  <a> {/* L'enfant direct de Link avec legacyBehavior */}
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
