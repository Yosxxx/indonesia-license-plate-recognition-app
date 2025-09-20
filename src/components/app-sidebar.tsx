"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader } from "@/components/ui/sidebar";
import { Database, ImageDown, Shield, Upload, Video, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function AppSidebar() {
  const pathname = usePathname();

  const menus = [
    { name: "Home", icon: <Home />, href: "/" },
    { name: "Live", icon: <Video />, href: "/live" },
    { name: "Video", icon: <Upload />, href: "/video" },
    { name: "Image", icon: <ImageDown />, href: "/image" },
    { name: "Database", icon: <Database />, href: "/database" },
  ] as const;

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <div className="flex items-center gap-x-5">
          <Shield size={50} />
          <div>
            <div className="font-bold">ILPR System</div>
            <div className="text-sm text-muted-foreground">Indonesia License Plate Recognition</div>
          </div>
        </div>
        <Separator />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <div className="flex flex-col gap-y-2">
            {menus.map((item) => {
              const active = pathname === item.href; // 👈 match with URL
              return (
                <Link key={item.name} href={item.href}>
                  <Button
                    className={`justify-start py-5 text-sm shadow-none duration-100 ease-in-out w-full ${
                      active
                        ? "bg-black text-white hover:bg-black"
                        : "bg-transparent text-black hover:bg-black hover:text-white"
                    }`}
                  >
                    {item.icon}
                    <span className="ml-2">{item.name}</span>
                  </Button>
                </Link>
              );
            })}
          </div>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Separator />
        <div className="text-sm text-muted-foreground font-bold">v1</div>
      </SidebarFooter>
    </Sidebar>
  );
}
