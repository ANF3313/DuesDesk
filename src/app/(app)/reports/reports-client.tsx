"use client";

import { Button } from "@/components/ui/button";
import { IconDownload, IconPrinter } from "@/components/ui/icons";

export function ExportButtons({ year }: { year: number }) {
  return (
    <span className="flex flex-wrap gap-2 print:hidden">
      <a href={`/api/reports/export?year=${year}&type=summary`} download>
        <Button variant="secondary" size="sm">
          <IconDownload width={15} height={15} />
          Summary CSV
        </Button>
      </a>
      <a href={`/api/reports/export?year=${year}&type=invoices`} download>
        <Button variant="secondary" size="sm">
          <IconDownload width={15} height={15} />
          Invoices CSV
        </Button>
      </a>
      <a href={`/api/reports/export?year=${year}&type=expenses`} download>
        <Button variant="secondary" size="sm">
          <IconDownload width={15} height={15} />
          Expenses CSV
        </Button>
      </a>
      <Button variant="secondary" size="sm" onClick={() => window.print()}>
        <IconPrinter width={15} height={15} />
        Print / PDF
      </Button>
    </span>
  );
}
