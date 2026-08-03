export default function RootLoading() {
  return (
    <div className="site-intro" role="status" aria-live="polite" aria-busy="true" aria-label="Ahi AI">
      <div className="site-intro__mark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/appicon.png" alt="" width={28} height={28} className="site-intro__icon" />
        <p className="site-intro__brand">Ahi AI</p>
      </div>
    </div>
  );
}
