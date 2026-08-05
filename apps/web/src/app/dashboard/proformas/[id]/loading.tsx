export default function Loading() {
  return (
    <div className="card" style={{ maxWidth: 960, margin: "0 auto" }}>
      <div className="skeleton" style={{ height: 28, width: 240, marginBottom: 20 }} />
      <div className="skeleton" style={{ height: 68, marginBottom: 18 }} />
      <div className="skeleton" style={{ height: 40, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 40, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 40 }} />
    </div>
  );
}
