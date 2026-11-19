export default function PlaceholderPage({ title, message }) {
  return (
    <main className="content">
      <header className="content-header">
        <h1>{title}</h1>
        <p className="lede">{message}</p>
      </header>
      <section className="card">
        <p>This screen is reserved for a later phase. Authentication and navigation are active now.</p>
      </section>
    </main>
  );
}
