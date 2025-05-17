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
  Target,
  Timer,
  Library,
  Sparkles,
  HomeIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const navItems = [
  { href: '/', label: 'Accueil', icon: HomeIcon, tooltip: 'Accueil / Vue Partagée' },
  { href: '/tasks', label: 'Gestionnaire IA', icon: ListTodo, tooltip: 'Gestion de tâches par IA' },
  // Les éléments suivants font partie de la vue partagée sur la page principale,
  // mais pourraient être des liens profonds ou avoir leurs propres pages dans une future itération.
  // Pour l'instant, ils représentent des sections dans le volet gauche de la vue partagée.
  // { href: '/#dashboard', label: 'Tableau de Bord', icon: LayoutDashboard, tooltip: 'Tableau de Bord de la Thèse' },
  // { href: '/#brain-dump', label: 'Vide-Cerveau', icon: Brain, tooltip: 'Capturer les Idées' },
  // { href: '/#daily-plan', label: 'Plan du Jour', icon: Target, tooltip: 'Objectifs Journaliers' },
  // { href: '/#pomodoro', label: 'Journal Pomodoro', icon: Timer, tooltip: 'Sessions de Travail Profond' },
  // { href: '/#sources', label: 'Bibliothèque', icon: Library, tooltip: 'Gérer les Sources' },
];

// Le journal des Prompts ChatGPT fait partie du panneau droit de la vue partagée sur '/'
// { href: '/#prompts', label: 'Prompts ChatGPT', icon: Sparkles, tooltip: 'Journal d\'Ingénierie de Prompt' },


export function SidebarNav() {
  const pathname = usePathname();
  const { state: sidebarState } = useSidebar();

  return (
    <ScrollArea className="flex-1">
      <SidebarMenu>
        {navItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <Link href={item.href} passHref legacyBehavior>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
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
        ))}
      </SidebarMenu>
    </ScrollArea>
  );
}
