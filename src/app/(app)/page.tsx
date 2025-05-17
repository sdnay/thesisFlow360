// src/app/(app)/page.tsx
"use client";

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ThesisDashboardSection } from '@/components/thesis/thesis-dashboard-section';
import { ChatGPTPromptLogPanel } from '@/components/chat/chat-gpt-prompt-log-panel';

export default function HomePage() {
  return (
    // Assurez-vous que ce div parent a une hauteur définie pour que 'h-full' sur ResizablePanelGroup fonctionne.
    // h-16 est la hauteur typique d'un header.
    <div className="h-[calc(100vh-theme(space.16))] w-full"> 
      <ResizablePanelGroup 
        direction="horizontal" 
        className="h-full w-full rounded-lg border"
      >
        <ResizablePanel defaultSize={65} minSize={40} className="flex flex-col overflow-y-auto">
          <ThesisDashboardSection />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={35} minSize={25} className="flex flex-col overflow-y-auto">
          <ChatGPTPromptLogPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
