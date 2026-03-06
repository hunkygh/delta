import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import ResponsiveContainer from './ResponsiveContainer';

export default function AppShell({ children }: PropsWithChildren): JSX.Element {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(196);

  return (
    <div
      className={`app-shell ${isSidebarExpanded ? 'sidebar-expanded' : ''}`}
      style={{ '--sidebar-expanded-width': `${sidebarWidth}px` } as CSSProperties}
    >
      <Sidebar
        isExpanded={isSidebarExpanded}
        setIsExpanded={setIsSidebarExpanded}
        sidebarWidth={sidebarWidth}
        setSidebarWidth={setSidebarWidth}
      />
      <Navbar />
      <ResponsiveContainer>
        <main>{children}</main>
      </ResponsiveContainer>
    </div>
  );
}
