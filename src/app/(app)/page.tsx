import { ThesisWorkspace } from "@/components/thesis/thesis-workspace";
import { ChatGPTPromptLogPanel } from "@/components/chat/chat-gpt-prompt-log-panel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export default function HomePage() {
  return (
    <div className="h-[calc(100vh-4rem)]"> {/* Full viewport height minus header height */}
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        <ResizablePanel defaultSize={65} minSize={30}>
          <ThesisWorkspace />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={35} minSize={25}>
          <ChatGPTPromptLogPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
