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
  onExpandSpaces
}: ShellLeftRailProps): JSX.Element {
  return (
    <aside className="shell-rail shell-rail-left">
      <SpacesRailCard
        focals={focals}
        lists={lists}
        items={items}
        activeFocalId={activeFocalId}
        onSelectFocal={onSelectFocal}
        onOpenItem={onOpenItem}
        onAddSpace={onAddSpace}
        onAddList={onAddList}
        onExpand={onExpandSpaces}
      />
      <MetricsCard
        userId={userId}
        items={items}
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
        snapshot={daySnapshot}
        onOpenItem={onOpenItem}
        onRefreshShellData={onRefreshShellData}
      />
    </aside>
  );
}
