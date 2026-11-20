export default function FoundationPage() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="masthead">
        <span className="wordmark">SPORTIFY<span aria-hidden="true">/</span></span>
        <span className="context">Development workspace</span>
      </header>
      <main id="main" tabIndex={-1}>
        <section className="intro" aria-labelledby="foundation-title">
          <p className="eyebrow">Built for the game. Grounded in the details.</p>
          <h1 id="foundation-title">SPORTIFY <span className="separator">— </span><span className="emphasis">Development Foundation</span></h1>
          <p className="purpose">A platform for independent sports businesses in Sri Lanka to manage facilities and accept guest reservations.</p>
          <p className="stage">The web workspace is initialized. Business features are not implemented yet.</p>
          <a className="text-link" href="#workspace">Explore the workspace <span aria-hidden="true">↗</span></a>
        </section>
        <section id="workspace" className="workspace" aria-labelledby="workspace-title">
          <div className="section-heading"><p className="eyebrow">Foundation scope</p><h2 id="workspace-title">One workspace.<br />Separate responsibilities.</h2></div>
          <dl className="process-list">
            <div><dt>Web <span className="tag">Initialized</span></dt><dd>Next.js serves this development foundation page.</dd></div>
            <div><dt>API</dt><dd>NestJS belongs to a separate process. This page does not connect to it.</dd></div>
            <div><dt>Worker</dt><dd>A separate Node.js process remains idle. No jobs are configured.</dd></div>
          </dl>
        </section>
        <aside className="boundary" aria-label="Current implementation boundary"><strong>Foundation only</strong><p>Oracle, authentication, tenant routing and booking workflows are not connected.</p></aside>
      </main>
      <footer><span>SPORTIFY</span><span>Indoor sports booking &amp; business management</span></footer>
    </>
  );
}
