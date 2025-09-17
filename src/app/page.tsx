"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Plate = {
  id: string | number;
  plate_number: string; // adjust to your column
  origin?: string | null;
  detected_at: string;
};

export default function HomePage() {
  const [today, setToday] = useState<Plate[]>([]);
  const [recent, setRecent] = useState<Plate[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);

  useEffect(() => {
    // today's detections
    fetch("/api/get-plates-today")
      .then((r) => r.json())
      .then((r) => r.ok && setToday(r.data ?? []));

    // recent (last 50)
    fetch("/api/get-plates")
      .then((r) => r.json())
      .then((r) => r.ok && setRecent(r.data ?? []));

    // total count
    fetch("/api/count-plates")
      .then((r) => r.json())
      .then((r) => r.ok && setTotalCount(r.count ?? 0));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Welcome to ILPR System</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-600">Online</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Detections</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{today.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Quick Actions</h2>
        <div className="flex gap-3 flex-wrap">
          <Button asChild>
            <a href="/live">Live Detection</a>
          </Button>
          <Button asChild>
            <a href="/image">Upload Image</a>
          </Button>
          <Button asChild>
            <a href="/video">Upload Video</a>
          </Button>
          <Button asChild variant="secondary">
            <a href="/database">Database</a>
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Detections</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recent.slice(0, 5).map((r) => (
                <li key={`${r.id}-${r.detected_at}`} className="p-3 border rounded">
                  <span className="font-semibold">{r.plate_number}</span>
                  {r.origin ? ` — ${r.origin}` : ""} — {new Date(r.detected_at).toLocaleString("id-ID")}
                </li>
              ))}
              {recent.length === 0 && <div className="text-muted-foreground">No records.</div>}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today (Asia/Jakarta)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {today.slice(0, 5).map((r) => (
                <li key={`${r.id}-${r.detected_at}`} className="p-3 border rounded">
                  <span className="font-semibold">{r.plate_number}</span>
                  {r.origin ? ` — ${r.origin}` : ""} — {new Date(r.detected_at).toLocaleTimeString("id-ID")}
                </li>
              ))}
              {today.length === 0 && <div className="text-muted-foreground">No detections today.</div>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
