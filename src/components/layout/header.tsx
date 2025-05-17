
"use client";

import Link from 'next/link';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/icons/logo';
import { PanelLeft, LogOut, UserCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth'; // Ajouté
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Header() {
  const { isMobile } = useSidebar();
  const { user, signOut, isLoading: isAuthLoading } = useAuth(); // Ajouté

  const handleSignOut = async () => {
    await signOut();
    // La redirection est gérée par onAuthStateChange dans AuthContext et le middleware
  };

  const getUserInitials = (email?: string | null) => {
    if (!email) return "?";
    const parts = email.split("@")[0].split(/[._-]/);
    return parts.map(p => p[0]).join("").toUpperCase().substring(0, 2);
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 shadow-sm">
      {isMobile && (
         <SidebarTrigger asChild>
           <Button variant="outline" size="icon" className="md:hidden shrink-0">
             <PanelLeft className="h-5 w-5" />
             <span className="sr-only">Ouvrir/Fermer le menu</span>
           </Button>
         </SidebarTrigger>
      )}
      {!isMobile && (
        <div className="hidden md:flex items-center gap-2">
           <SidebarTrigger asChild>
             <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
               <PanelLeft className="h-5 w-5" />
               <span className="sr-only">Ouvrir/Fermer la barre latérale</span>
             </Button>
           </SidebarTrigger>
        </div>
      )}
      
      <div className={cn("flex items-center", isMobile ? "ml-2" : "md:hidden")}>
        <Link href="/" className="flex items-center gap-2">
          <Logo />
        </Link>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {isAuthLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  {/* TODO: Remplacer par user.user_metadata?.avatar_url si disponible */}
                  <AvatarImage src={user.user_metadata?.avatar_url || ""} alt={user.email || "Utilisateur"} />
                  <AvatarFallback>{getUserInitials(user.email)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {/* <DropdownMenuItem>
                <UserCircle className="mr-2 h-4 w-4" />
                Profil (à venir)
              </DropdownMenuItem> */}
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href="/auth/login">Se Connecter</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
