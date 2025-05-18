
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  Target as TargetIcon, // Renommé pour clarté
  Timer,
  Library,
  ListTree,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const navItems = [
  { href: '/', label: 'Tableau de Bord', icon: LayoutDashboard, tooltip: "Aperçu général de votre projet et assistant IA" },
  { href: '/tasks', label: 'Gestion des Tâches', icon: ListTodo, tooltip: "Organiser, prioriser et suivre vos tâches" },
  { href: '/brain-dump', label: 'Vide-Cerveau', icon: Brain, tooltip: "Capturer rapidement vos idées et pensées" },
  { href: '/daily-plan', label: 'Planification Quotidienne', icon: TargetIcon, tooltip: "Définir et suivre vos objectifs pour la journée" },
  { href: '/pomodoro', label: 'Minuteur Pomodoro', icon: Timer, tooltip: "Sessions de travail focus avec la technique Pomodoro" },
  { href: '/sources', label: 'Bibliothèque de Sources', icon: Library, tooltip: "Gérer vos références bibliographiques et documents" },
  { href: '/thesis-plan', label: 'Structure de la Thèse', icon: ListTree, tooltip: "Organiser et gérer les chapitres de votre thèse" }, // Modifié ici
];

export function SidebarNav() {
  const pathname = usePathname();
  const { state: sidebarState, isMobile, setOpenMobile } = useSidebar();

  return (
    <ScrollArea className="flex-1">
      <SidebarMenu>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href === '/thesis-plan' && pathname.startsWith('/thesis-plan/')); // Pour activer le lien parent quand on est sur une page enfant
          
          return (
            <SidebarMenuItem key={item.href}>
              <Link
                href={item.href}
                passHref
                legacyBehavior
                onClick={() => {
                  if (isMobile) setOpenMobile(false);
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
