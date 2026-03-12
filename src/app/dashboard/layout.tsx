import DashboardShell from "./DashboardShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Null check ekle
  if (children == null) {
    return <DashboardShell>{null}</DashboardShell>;
  }
  return <DashboardShell>{children}</DashboardShell>;
}
