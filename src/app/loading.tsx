import { Loading } from "@/components/ui/Loading";

export default function RootLoading() {
  return (
    <Loading
      fullScreen
      variant="spinner"
      size="lg"
      message="Yükleniyor..."
    />
  );
}
