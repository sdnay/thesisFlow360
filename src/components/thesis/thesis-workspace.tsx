
"use client";

// Ce composant n'est plus utilisé comme conteneur d'onglets principal
// suite à la restructuration vers des pages dédiées.
// Vous pouvez le supprimer ou le réutiliser pour un autre usage si besoin.
// Pour l'instant, je le laisse avec un contenu minimal pour éviter des erreurs d'importation
// si d'autres fichiers y faisaient encore référence (ce qui ne devrait plus être le cas
// après la refonte de src/app/(app)/page.tsx).

// import { useState, useEffect } from "react";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { ThesisDashboardSection } from "./thesis-dashboard-section";
// import { BrainDumpSection } from "./brain-dump-section";
// import { DailyPlanSection } from "./daily-plan-section";
// import { PomodoroSection } from "./pomodoro-section";
// import { SourceLibrarySection } from "./source-library-section";
// import { AiTaskManagerPage } from "@/components/thesis/ai-task-manager-page";
// import { LayoutDashboard, Brain, Target, Timer, Library, ListTodo } from 'lucide-react';
// import { ScrollArea } from "@/components/ui/scroll-area";

// const workspaceTabs = [
//   { value: "dashboard", label: "Tableau de Bord", Icon: LayoutDashboard, Component: ThesisDashboardSection },
//   { value: "tasks", label: "Gestion Tâches", Icon: ListTodo, Component: AiTaskManagerPage },
//   { value: "brain-dump", label: "Vide-Cerveau", Icon: Brain, Component: BrainDumpSection },
//   { value: "daily-plan", label: "Plan du Jour", Icon: Target, Component: DailyPlanSection },
//   { value: "pomodoro", label: "Pomodoro", Icon: Timer, Component: PomodoroSection },
//   { value: "sources", label: "Sources", Icon: Library, Component: SourceLibrarySection },
// ];

export function ThesisWorkspace_DEPRECATED() {
  // const [activeTab, setActiveTab] = useState("dashboard");

  // useEffect(() => {
  //   const handleHashChange = () => {
  //     const hashValue = window.location.hash.replace("#", "");
  //     const targetTab = workspaceTabs.find(tab => tab.value === hashValue);

  //     if (targetTab) {
  //       setActiveTab(targetTab.value);
  //     } else {
  //       setActiveTab("dashboard");
  //       if (window.location.hash && window.location.hash !== "#" && window.location.hash !== "#dashboard") {
  //         // window.location.hash = "dashboard"; 
  //       } else if (!window.location.hash || window.location.hash === "#") {
  //         // if (activeTab !== "dashboard") window.location.hash = "dashboard"; 
  //       }
  //     }
  //   };

  //   handleHashChange(); 
  //   window.addEventListener('hashchange', handleHashChange, false);

  //   return () => {
  //     window.removeEventListener('hashchange', handleHashChange, false);
  //   };
  // }, []);

  // const handleTabChange = (value: string) => {
  //   setActiveTab(value);
  //   window.location.hash = value; 
  // };

  return (
    <div className="p-4 text-center text-muted-foreground">
      <p>L&apos;ancien espace de travail a été remplacé par des pages dédiées.</p>
      <p>Veuillez utiliser la navigation latérale.</p>
    </div>
  );
}
