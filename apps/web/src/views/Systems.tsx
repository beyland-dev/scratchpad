import { loaded, systems } from "../store.ts";

export function Systems() {
  if (!loaded.value) return <p class="page-message">Loading…</p>;
  const list = systems.value;
  return (
    <div class="page">
      <div class="page-head">
        <h1>Design systems</h1>
        <p class="muted">
          Libraries of verified web components and themed tokens codified from real products. Agents
          use them to build prototypes that match.
        </p>
      </div>
      {list.length === 0 ? (
        <section class="empty">
          <h2>No design systems yet</h2>
          <p>
            Ask an agent to audit a registered source. It follows the{" "}
            <code>design-system-audit</code> skill (MCP prompt <code>audit_design_system</code>, or
            install it with <code>dt skills.install</code>).
          </p>
        </section>
      ) : (
        <div class="grid">
          {list.map((s) => (
            <a class="card system-card" href={`/systems/${encodeURIComponent(s.id)}`} key={s.id}>
              <div class="card-body">
                <div class="card-title">{s.name}</div>
                <p class="muted small">{s.description ?? `Design system "${s.id}"`}</p>
                <div class="card-meta">
                  <span class="chip">{s.components} components</span>
                  <span class="chip">{s.tokens} tokens</span>
                  {s.sourceId && <span class="chip muted">source: {s.sourceId}</span>}
                  {s.issues?.length ? <span class="chip warn">⚠ {s.issues.length}</span> : null}
                </div>
                <div class="card-footer">
                  <code>&lt;{s.prefix}-…&gt;</code>
                  <span>skill: {s.skill}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
