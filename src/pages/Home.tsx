import LaunchpadCard from '../components/LaunchpadCard';
import Greeting from '../components/Greeting';

const cardDefinitions = [
  { title: 'Tasks' as const, subtitle: 'Action items and to-dos.' },
  { title: 'Bookmarks' as const, subtitle: 'Saved links and references.' },
  { title: 'Notes' as const, subtitle: 'Quick captures and running notes.' },
  { title: 'Resources' as const, subtitle: 'File uploads and attachments.' }
];

export default function Home(): JSX.Element {
  return (
    <section className="app-page launchpad-page" aria-label="Launchpad">
      <div className="calendar-toolbar">
        <div className="calendar-toolbar-left">
          <Greeting />
        </div>
      </div>
      <div className="app-page-scroll">
        <div className="launchpad-grid" aria-label="Launchpad modules">
          {cardDefinitions.map((card) => (
            <LaunchpadCard key={card.title} title={card.title} subtitle={card.subtitle} />
          ))}
        </div>
      </div>
    </section>
  );
}
