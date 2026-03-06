export default function Greeting() {
  const getGreeting = () => {
    const now = new Date();
    const denverTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Denver"}));
    const hour = denverTime.getHours();
    
    if (hour <= 11) {
      return "Good morning";
    } else if (hour <= 16) {
      return "Good afternoon";
    } else {
      return "Good evening";
    }
  };

  return (
    <div className="greeting">
      <h2>{getGreeting()}, Grant</h2>
    </div>
  );
}
