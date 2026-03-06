import type { PropsWithChildren } from 'react';

export default function ResponsiveContainer({ children }: PropsWithChildren): JSX.Element {
  return <div className="responsive-container">{children}</div>;
}
