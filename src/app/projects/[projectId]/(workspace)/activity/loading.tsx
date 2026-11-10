import { PageLoading } from "@/components/page-loading";

// Its own boundary, so switching tabs shows this at once instead of waiting on the data (instant navigation).
export default function Loading() {
  return <PageLoading label="Loading activity…" />;
}
