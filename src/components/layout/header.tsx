
"use client";

import Link from 'next/link';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/icons/logo';
import { PanelLeft } from 'lucide-react';

export function Header() {
  const { isMobile } = useSidebar();

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 shadow-sm">
      {isMobile && (
         <SidebarTrigger asChild>
           <Button variant="outline" size="icon" className="md:hidden">
             <PanelLeft className="h-5 w-5" />
             <span className="sr-only">Ouvrir/Fermer le menu</span>
           </Button>
         </SidebarTrigger>
      )}
      {!isMobile && (
        <div className="hidden md:flex items-center gap-2">
           <SidebarTrigger asChild>
             <Button variant="ghost" size="icon" className="h-8 w-8">
               <PanelLeft className="h-5 w-5" />
               <span className="sr-only">Ouvrir/Fermer la barre latérale</span>
             </Button>
           </SidebarTrigger>
        </div>
      )}
      <div className="flex items-center md:hidden"> {/* Logo visible sur mobile dans le header */}
        <Link href="/" className="flex items-center gap-2">
          <Logo />
        </Link>
      </div>
      <div className="ml-auto flex items-center gap-4">
        {/* Placeholder pour Menu Utilisateur ou autres actions */}
        {/* <UserMenu /> */}
      </div>
    </header>
  );
}
