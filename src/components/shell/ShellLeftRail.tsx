import { useState } from 'react';
import MetricsCard from './MetricsCard';
import SpacesRailCard from './SpacesRailCard';
import type { ShellDaySnapshot } from './daySnapshot';
import type { ShellFocalSummary, ShellItemSummary, ShellListSummary } from './types';

interface ShellLeftRailProps {
  userId: string;
  focals: ShellFocalSummary[];
  lists: ShellListSummary[];
  items: ShellItemSummary[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  daySnapshot: ShellDaySnapshot;
  onRefreshShellData: () => Promise<void>;
  activeFocalId: string | null;
  onSelectFocal: (focalId: string) => void;
  onOpenItem: (itemId: string, listId: string, focalId: string | null) => void;
  onAddSpace: () => void;
  onAddList: (focalId: string | null) => void;
  onExpandSpaces: (payload: { focalId: string | null; listId: string | null; mode: 'space' | 'list' }) => void;
  onAddTask: (date: Date) => void;
}

export default function ShellLeftRail({
  userId,
  focals,
  lists,
  items,
  selectedDate,
  onSelectDate,
  daySnapshot,
  onRefreshShellData,
  activeFocalId,
  onSelectFocal,
  onOpenItem,
  onAddSpace,
  onAddList,
  onExpandSpaces,
  onAddTask
}: ShellLeftRailProps): JSX.Element {
  const [spacesMode, setSpacesMode] = useState<'spaces' | 'lists' | 'items'>('spaces');

  return (
    <aside className={`shell-rail shell-rail-left ${spacesMode === 'items' ? 'mode-items' : 'mode-compact'}`.trim()}>
      <SpacesRailCard
        userId={userId}
        focals={focals}
        lists={lists}
        items={items}
        activeFocalId={activeFocalId}
        onSelectFocal={onSelectFocal}
        onOpenItem={onOpenItem}
        onAddSpace={onAddSpace}
        onAddList={onAddList}
        onExpand={onExpandSpaces}
        onRefreshShellData={onRefreshShellData}
        onModeChange={setSpacesMode}
      />
      <MetricsCard
        userId={userId}
        items={items}
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
        snapshot={daySnapshot}
        onOpenItem={onOpenItem}
        onRefreshShellData={onRefreshShellData}
        onAddTask={onAddTask}
      />
    </aside>
  );
}
