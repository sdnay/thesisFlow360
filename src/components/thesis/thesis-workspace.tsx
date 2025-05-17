
"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThesisDashboardSection } from "./thesis-dashboard-section";
import { BrainDumpSection } from "./brain-dump-section";
import { DailyPlanSection } from "./daily-plan-section";
import { PomodoroSection } from "./pomodoro-section";
import { SourceLibrarySection } from "./source-library-section";
import { AiTaskManagerPage } from "@/components/thesis/ai-task-manager-page"; // Importation du gestionnaire de tâches
import { LayoutDashboard, Brain, Target, Timer, Library, ListTodo } from 'lucide-react'; // Ajout de ListTodo
import { ScrollArea } from "@/components/ui/scroll-area";

const workspaceTabs = [
  { value: "dashboard", label: "Tableau de Bord", Icon: LayoutDashboard, Component: ThesisDashboardSection },
  { value: "tasks", label: "Gestion Tâches", Icon: ListTodo, Component: AiTaskManagerPage }, // Nouvel onglet
  { value: "brain-dump", label: "Vide-Cerveau", Icon: Brain, Component: BrainDumpSection },
  { value: "daily-plan", label: "Plan du Jour", Icon: Target, Component: DailyPlanSection },
  { value: "pomodoro", label: "Pomodoro", Icon: Timer, Component: PomodoroSection },
  { value: "sources", label: "Sources", Icon: Library, Component: SourceLibrarySection },
];

export function ThesisWorkspace() {
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash && workspaceTabs.some(tab => tab.value === hash)) {
        setActiveTab(hash);
      } else if (!hash && workspaceTabs.some(tab => tab.value === "dashboard")) {
        // Default to dashboard if no hash or invalid hash
        setActiveTab("dashboard");
      }
    };

    handleHashChange(); // Set initial tab based on hash
    window.addEventListener('hashchange', handleHashChange, false);

    return () => {
      window.removeEventListener('hashchange', handleHashChange, false);
    };
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    window.location.hash = value; // Update hash on tab change
  };

  return (
    <div className="flex flex-col h-full p-1 md:p-2 bg-background">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-grow flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6 mb-1 md:mb-2 sticky top-0 bg-background z-10 p-1 rounded-lg shadow-sm">
          {workspaceTabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm px-2 py-1.5 sm:px-3 sm:py-2 data-[state=active]:shadow-md">
              <tab.Icon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        
        <ScrollArea className="flex-grow rounded-md border bg-card shadow-inner">
          {workspaceTabs.map(tab => (
            <TabsContent key={tab.value} value={tab.value} className="mt-0">
              {/* Render component only if it's the active tab to avoid unnecessary loads */}
              {activeTab === tab.value && <tab.Component />}
            </TabsContent>
          ))}
        </ScrollArea>
      </Tabs>
    </div>
  );
}
