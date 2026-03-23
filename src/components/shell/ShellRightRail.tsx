import type { ChatContext, ChatProposal } from '../../types/chat';
import type { Event } from '../../types/Event';
import { useEffect, useState } from 'react';
import AiRailCard from './AiRailCard';
import CalendarSnapshotCard from './CalendarSnapshotCard';

interface ShellAiRequest {
  id: string;
  prompt: string;
  context?: ChatContext | null;
  label?: {
    kicker: string;
    title: string;
  };
}

interface ShellRightRailProps {
  currentBlock: Event | null;
  onOpenCalendar: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  aiThreadEvent: Event | null;
  onClearAiThread: () => void;
  aiRequest: ShellAiRequest | null;
  onPushProposal: (proposal: ChatProposal, assistantText: string) => void;
  onAiExpandedChange?: (expanded: boolean) => void;
}

export default function ShellRightRail({
  currentBlock,
  onOpenCalendar,
  selectedDate,
  onSelectDate,
  aiThreadEvent,
  onClearAiThread,
  aiRequest,
  onPushProposal,
  onAiExpandedChange
}: ShellRightRailProps): JSX.Element {
  const [aiExpanded, setAiExpanded] = useState(false);

  useEffect(() => {
    onAiExpandedChange?.(aiExpanded);
  }, [aiExpanded, onAiExpandedChange]);

  useEffect(() => {
    if (aiThreadEvent || aiRequest) {
      setAiExpanded(true);
    }
  }, [aiRequest, aiThreadEvent]);

  return (
    <aside className={`shell-rail shell-rail-right ${aiExpanded ? 'ai-expanded' : ''}`.trim()}>
      <AiRailCard
        currentBlock={currentBlock}
        expanded={aiExpanded}
        threadEvent={aiThreadEvent}
        threadMode={aiThreadEvent ? 'block' : 'general'}
        request={aiRequest}
        onPushProposal={onPushProposal}
        onExpandedChange={(next) => {
          setAiExpanded(next);
          if (!next) {
            onClearAiThread();
          }
        }}
      />
      <CalendarSnapshotCard
        onOpen={onOpenCalendar}
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
        dimmed={aiExpanded}
      />
    </aside>
  );
}
