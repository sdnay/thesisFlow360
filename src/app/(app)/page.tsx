
// src/app/(app)/page.tsx
"use client";

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ThesisDashboardSection } from '@/components/thesis/thesis-dashboard-section';
import { ChatGPTPromptLogPanel } from '@/components/chat/chat-gpt-prompt-log-panel';

export default function HomePage() {
  return (
    // Ensure this container allows children to take full height and manage their own scroll
    <div className="h-full w-full p-2 md:p-4"> 
      <ResizablePanelGroup 
        direction="horizontal" 
        className="h-full w-full rounded-lg border bg-card shadow-sm"
      >
        <ResizablePanel defaultSize={65} minSize={40} className="flex flex-col overflow-y-auto">
          {/* ThesisDashboardSection will now handle its internal scrolling if content overflows */}
          <ThesisDashboardSection />
        </ResizablePanel>
        <ResizableHandle withHandle className="bg-border" />
        <ResizablePanel defaultSize={35} minSize={25} className="flex flex-col overflow-y-auto">
          {/* ChatGPTPromptLogPanel will handle its internal scrolling */}
          <ChatGPTPromptLogPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
