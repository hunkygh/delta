export default function FilterStrip() {
  return (
    <div className="filter-strip">
      <div className="filter-buttons">
        <button className="filter-btn" aria-label="Domain 1">
          Domain 1
        </button>
        <button className="filter-btn selected" aria-label="Domain 2">
          Domain 2
        </button>
        <button className="filter-btn" aria-label="Domain 3">
          Domain 3
        </button>
      </div>
    </div>
  );
}
