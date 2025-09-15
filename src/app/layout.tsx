import "./globals.css";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/app-sidebar";
import DetectionResult from "./../components/detection-result";
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SidebarProvider className="flex justify-between">
          <AppSidebar />
          <main className="flex-1">
            <SidebarTrigger className="min-sm:hidden fixed" />
            {children}
          </main>
          <DetectionResult />
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
