export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Null check ekle
  if (children == null) {
    return null;
  }
  return <>{children}</>;
}
