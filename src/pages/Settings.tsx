import Button from '../components/Button';

export default function Settings(): JSX.Element {
  return (
    <section className="app-page">
      <h1 className="page-title">Settings</h1>
      <div className="app-page-scroll">
        <div className="card">
          <h3>Calendar Account</h3>
          <p>Google Calendar integration will be configured in backend phase.</p>
          <Button variant="secondary">Connect Account</Button>
        </div>
      </div>
    </section>
  );
}
