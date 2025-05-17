
"use client";

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Header } from '@/components/layout/header';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Logo } from '@/components/icons/logo';
import { Button } from '@/components/ui/button';
import { PanelLeft } from 'lucide-react';
import Link from 'next/link';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar variant="sidebar" collapsible="icon" side="left">
        <SidebarHeader className="p-4 border-b border-sidebar-border">
           <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
              <Logo className="h-8 w-auto" />
            </Link>
            <SidebarTrigger asChild className="group-data-[collapsible=icon]:hidden ml-auto md:hidden">
               <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                 <PanelLeft />
               </Button>
            </SidebarTrigger>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav />
        </SidebarContent>
        <SidebarFooter className="p-2 border-t border-sidebar-border mt-auto">
          {/* Peut-être un lien vers les paramètres ou une version ici */}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col h-screen">
        <Header />
        <main className="flex-1 flex flex-col overflow-hidden bg-muted/20"> {/* Permet au contenu enfant de gérer son propre défilement */}
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
