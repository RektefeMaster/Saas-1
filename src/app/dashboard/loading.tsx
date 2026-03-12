import { Loading } from "@/components/ui/Loading";

export default function DashboardLoading() {
  return (
    <Loading
      fullScreen={false}
      variant="spinner"
      size="md"
      message="Yükleniyor…"
    />
  );
}
