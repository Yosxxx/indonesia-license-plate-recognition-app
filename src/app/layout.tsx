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
        {/* flex-col on small, flex-row on sm+ */}
        <SidebarProvider className="flex flex-col sm:flex-row justify-between">
          <AppSidebar />

          <main className="flex-1">
            <SidebarTrigger className="sm:hidden fixed" />
            {children}
          </main>

          {/* On small, this will drop below main; on sm+ stays on the right */}
          <DetectionResult />
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
