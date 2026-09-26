export default function LoadingManufacturers() {
  return (
    <main id="main" className="directory-content" aria-busy="true">
      <p role="status">Loading manufacturers…</p>
      <div className="directory-grid directory-skeleton" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <div className="directory-card" key={n}>
            <div />
            <div />
            <div />
          </div>
        ))}
      </div>
    </main>
  );
}
