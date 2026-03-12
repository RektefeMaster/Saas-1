import { Loading } from "@/components/ui/Loading";

export default function DashboardTenantLoading() {
  return (
    <Loading
      fullScreen={false}
      variant="bars"
      size="md"
      message="Veriler yükleniyor..."
    />
  );
}
