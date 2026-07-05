import AppShell from "@/components/layout/AppShell";
import BottomNav from "@/components/layout/BottomNav";
import InactivityTimer from "@/components/shared/InactivityTimer";
import PageTransition from "@/components/shared/PageTransition";
import ScrollToTop from "@/components/shared/ScrollToTop";
import CommandPalette from "@/components/shared/CommandPalette";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <InactivityTimer />
      <CommandPalette />
      <AppShell>
        <PageTransition>
          <div className="pb-16 md:pb-0">
            {children}
          </div>
        </PageTransition>
      </AppShell>
      <BottomNav />
      <ScrollToTop />
    </>
  );
}
