export default function RootLoading() {
  return (
    <div className="site-intro" role="status" aria-live="polite" aria-busy="true" aria-label="Yükleniyor">
      <div className="site-intro__glow" aria-hidden />
      <div className="site-intro__mark">
        <span className="site-intro__ring" aria-hidden />
        {/* loading.tsx sunucu bileşeni — next/image yerine hafif img */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/appicon.png" alt="" width={56} height={56} className="site-intro__icon" />
      </div>
      <p className="site-intro__brand site-display">Ahi AI</p>
      <p className="site-intro__status">Yükleniyor</p>
      <div className="site-intro__track" aria-hidden>
        <div className="site-intro__bar" />
      </div>
    </div>
  );
}
