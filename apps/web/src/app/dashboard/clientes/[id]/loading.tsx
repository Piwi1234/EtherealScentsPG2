export default function Loading() {
  return (
    <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="skeleton" style={{ height: 28, width: 220, marginBottom: 24 }} />
      <div className="grid-2" style={{ rowGap: 18 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 38 }} />
        ))}
      </div>
    </div>
  );
}
