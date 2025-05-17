
"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThesisDashboardSection } from "./thesis-dashboard-section";
import { BrainDumpSection } from "./brain-dump-section";
import { DailyPlanSection } from "./daily-plan-section";
import { PomodoroSection } from "./pomodoro-section";
import { SourceLibrarySection } from "./source-library-section";
import { AiTaskManagerPage } from "@/components/thesis/ai-task-manager-page";
import { LayoutDashboard, Brain, Target, Timer, Library, ListTodo } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";

const workspaceTabs = [
  { value: "dashboard", label: "Tableau de Bord", Icon: LayoutDashboard, Component: ThesisDashboardSection },
  { value: "tasks", label: "Gestion Tâches", Icon: ListTodo, Component: AiTaskManagerPage },
  { value: "brain-dump", label: "Vide-Cerveau", Icon: Brain, Component: BrainDumpSection },
  { value: "daily-plan", label: "Plan du Jour", Icon: Target, Component: DailyPlanSection },
  { value: "pomodoro", label: "Pomodoro", Icon: Timer, Component: PomodoroSection },
  { value: "sources", label: "Bibliothèque", Icon: Library, Component: SourceLibrarySection },
];

export function ThesisWorkspace() {
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    const handleHashChange = () => {
      const hashValue = window.location.hash.replace("#", "");
      const targetTab = workspaceTabs.find(tab => tab.value === hashValue);

      if (targetTab) {
        setActiveTab(targetTab.value);
      } else {
        // Default to dashboard if hash is invalid or empty
        setActiveTab("dashboard");
        // Optionally, update the hash to #dashboard if it was invalid
        // This prevents the URL from staying with an invalid hash.
        // Be careful with this as it can cause loops if not handled well.
        if (window.location.hash && window.location.hash !== "#" && window.location.hash !== "#dashboard" && workspaceTabs.some(tab => tab.value === hashValue)) {
          // Do nothing if it's a valid tab value that just wasn't the initial default
        } else if (hashValue && !workspaceTabs.some(tab => tab.value === hashValue)) {
          // If hash is present but not a valid tab, redirect to default
          // window.location.hash = "dashboard";
        } else if (!window.location.hash || window.location.hash === "#") {
           // If no hash or just '#', default to dashboard
           if (activeTab !== "dashboard") window.location.hash = "dashboard"; // This might be too aggressive
        }
      }
    };

    handleHashChange(); // Set initial tab based on current hash
    window.addEventListener('hashchange', handleHashChange, false);

    return () => {
      window.removeEventListener('hashchange', handleHashChange, false);
    };
  }, [activeTab]); // Re-evaluate if activeTab changes from outside (though hashchange should cover it)

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    window.location.hash = value; 
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full w-full p-1 md:p-2 bg-background">
      <ScrollArea className="shrink-0">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-4 md:grid-cols-6">
          {workspaceTabs.map(({ value, label, Icon }) => (
            <TabsTrigger key={value} value={value} className="flex-col sm:flex-row gap-1.5 h-auto py-2 px-2.5 text-xs sm:text-sm">
              <Icon className="h-4 w-4 sm:mr-1.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </ScrollArea>
      <div className="flex-grow overflow-y-auto mt-2">
        {workspaceTabs.map(({ value, Component }) => (
          <TabsContent key={value} value={value} className="h-full">
            <Component />
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
