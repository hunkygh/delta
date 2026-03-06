import type { PropsWithChildren } from 'react';

interface CardProps extends PropsWithChildren {
  title?: string;
}

export default function Card({ title, children }: CardProps): JSX.Element {
  return (
    <section className="card">
      {title ? <h3 className="card-title">{title}</h3> : null}
      {children}
    </section>
  );
}
