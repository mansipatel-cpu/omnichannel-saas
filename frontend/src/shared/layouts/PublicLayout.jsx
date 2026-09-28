import { ScrollToTop } from "@/shared/components/ScrollToTop";

export function PublicLayout({ children }) {
  return (
    <>
      <ScrollToTop />
      {children}
    </>
  );
}
