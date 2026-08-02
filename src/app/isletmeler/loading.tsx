export default function IsletmelerLoading() {
  return (
    <div className="site-root flex min-h-[40vh] items-center justify-center">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2"
        style={{
          borderColor: "var(--ahi-line-strong)",
          borderTopColor: "var(--ahi-brand)",
        }}
        aria-hidden
      />
      <span className="sr-only">Yükleniyor</span>
    </div>
  );
}
