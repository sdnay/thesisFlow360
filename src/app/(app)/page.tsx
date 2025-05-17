// src/app/(app)/page.tsx
"use client";

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ThesisDashboardSection } from '@/components/thesis/thesis-dashboard-section';
import { ChatGPTPromptLogPanel } from '@/components/chat/chat-gpt-prompt-log-panel';

export default function HomePage() {
  return (
    <div className="h-[calc(100vh-theme(space.16))]"> {/* Ajusté pour la hauteur du header (h-16 = 4rem) */}
      <ResizablePanelGroup direction="horizontal" className="h-full w-full rounded-lg border">
        <ResizablePanel defaultSize={65} minSize={30} className="flex flex-col overflow-y-auto">
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
