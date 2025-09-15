"use client";

import { ChartColumnDecreasing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";

const plates = [
  {
    plateNumber: "ABC-123",
    plateOrigin: "Jakarta",
    expiryDate: "2-27",
    remaining: "45",
    timestamp: "01-01-2024 | 08:15:32",
  },
  {
    plateNumber: "BXY-456",
    plateOrigin: "Jakarta",
    expiryDate: "5-28",
    remaining: "12",
    timestamp: "05-01-2024 | 12:45:10",
  },
  {
    plateNumber: "DTR-789",
    plateOrigin: "Jakarta",
    expiryDate: "7-29",
    remaining: "89",
    timestamp: "10-02-2024 | 06:20:54",
  },
  {
    plateNumber: "EFG-321",
    plateOrigin: "Jakarta",
    expiryDate: "11-30",
    remaining: "5",
    timestamp: "15-02-2024 | 17:40:22",
  },
  {
    plateNumber: "HJK-654",
    plateOrigin: "Jakarta",
    expiryDate: "1-31",
    remaining: "120",
    timestamp: "20-03-2024 | 09:05:11",
  },
  {
    plateNumber: "LMN-987",
    plateOrigin: "Jakarta",
    expiryDate: "4-32",
    remaining: "67",
    timestamp: "25-03-2024 | 14:28:37",
  },
  {
    plateNumber: "PQR-159",
    plateOrigin: "Jakarta",
    expiryDate: "9-33",
    remaining: "200",
    timestamp: "30-04-2024 | 19:50:48",
  },
  {
    plateNumber: "STU-753",
    plateOrigin: "Jakarta",
    expiryDate: "12-34",
    remaining: "30",
    timestamp: "05-05-2024 | 11:10:05",
  },
  {
    plateNumber: "VWX-852",
    plateOrigin: "Jakarta",
    expiryDate: "6-35",
    remaining: "75",
    timestamp: "10-06-2024 | 22:33:59",
  },
  {
    plateNumber: "YZA-963",
    plateOrigin: "Jakarta",
    expiryDate: "3-36",
    remaining: "150",
    timestamp: "15-06-2024 | 07:42:16",
  },
];

export default function DetectionResult() {
  return (
    <div className="h-screen flex flex-col border-l bg-white w-80">
      {/* Header */}
      <div className="p-3 border-b flex items-center font-bold gap-x-2">
        <ChartColumnDecreasing />
        Detection Result
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-y-2">
        {plates.map((plate) => (
          <div
            key={plate.plateNumber}
            className="border border-border/50 p-2 rounded-md bg-muted/50 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow transition-all hover:cursor-pointer"
          >
            <div className="font-bold">{plate.plateNumber}</div>
            <div className="text-muted-foreground text-sm">
              <div>Plate Origin: {plate.plateOrigin}</div>
              <div>Expiry Date: {plate.expiryDate}</div>
              <div>Remaining: {plate.remaining} days</div>
            </div>
            <Separator className="my-1" />
            <div className="text-muted-foreground text-sm">{plate.timestamp}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-5 border-t flex flex-col gap-2 justify-center items-center">
        <Input placeholder="Search plate..." />
        <div className="flex gap-2 w-full">
          <Button className="flex-1">Sync</Button>
          <Button variant="secondary" className="flex-1">
            Clear
          </Button>
        </div>
        <div className="text-green-500 hidden">Sync success!</div>
      </div>
    </div>
  );
}
