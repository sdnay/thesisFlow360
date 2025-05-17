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
  { href: '/', label: 'Home', icon: HomeIcon, tooltip: 'Home / Split View' },
  { href: '/tasks', label: 'AI Task Manager', icon: ListTodo, tooltip: 'AI Powered Task Management' },
  // The following items are part of the split view on the main page,
  // but could be deep-linked or have their own pages in a future iteration.
  // For now, they represent sections in the left pane of the split view.
  // { href: '/#dashboard', label: 'Dashboard', icon: LayoutDashboard, tooltip: 'Thesis Dashboard' },
  // { href: '/#brain-dump', label: 'Brain Dump', icon: Brain, tooltip: 'Capture Ideas' },
  // { href: '/#daily-plan', label: 'Daily Plan', icon: Target, tooltip: 'Daily Objectives' },
  // { href: '/#pomodoro', label: 'Pomodoro Log', icon: Timer, tooltip: 'Deep Work Sessions' },
  // { href: '/#sources', label: 'Source Library', icon: Library, tooltip: 'Manage Sources' },
];

// The ChatGPT Prompts log is part of the split view's right panel on '/'
// { href: '/#prompts', label: 'ChatGPT Prompts', icon: Sparkles, tooltip: 'Prompt Engineering Log' },


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
