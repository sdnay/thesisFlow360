"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThesisDashboardSection } from "./thesis-dashboard-section";
import { BrainDumpSection } from "./brain-dump-section";
import { DailyPlanSection } from "./daily-plan-section";
import { PomodoroSection } from "./pomodoro-section";
import { SourceLibrarySection } from "./source-library-section";
import { LayoutDashboard, Brain, Target, Timer, Library } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";

const workspaceTabs = [
  { value: "dashboard", label: "Dashboard", Icon: LayoutDashboard, Component: ThesisDashboardSection },
  { value: "brain-dump", label: "Brain Dump", Icon: Brain, Component: BrainDumpSection },
  { value: "daily-plan", label: "Daily Plan", Icon: Target, Component: DailyPlanSection },
  { value: "pomodoro", label: "Pomodoro", Icon: Timer, Component: PomodoroSection },
  { value: "sources", label: "Sources", Icon: Library, Component: SourceLibrarySection },
];

export function ThesisWorkspace() {
  return (
    <div className="flex flex-col h-full p-1 md:p-2 bg-background">
      <Tabs defaultValue="dashboard" className="flex-grow flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 mb-1 md:mb-2 sticky top-0 bg-background z-10 p-1 rounded-lg shadow-sm">
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
              <tab.Component />
            </TabsContent>
          ))}
        </ScrollArea>
      </Tabs>
    </div>
  );
}
