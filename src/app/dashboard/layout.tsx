import DashboardShell from "./DashboardShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (children == null) {
    return <DashboardShell>{null}</DashboardShell>;
  }
  return <DashboardShell>{children}</DashboardShell>;
}
