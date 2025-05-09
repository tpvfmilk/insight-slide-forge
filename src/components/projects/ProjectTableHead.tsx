
import React from "react";
import { TableHead, TableRow, TableHeader } from "@/components/ui/table";

export function ProjectTableHead() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-[40%]">Project</TableHead>
        <TableHead className="w-[15%]">Created</TableHead>
        <TableHead className="hidden lg:table-cell">Duration</TableHead>
        <TableHead>Size</TableHead>
        <TableHead className="text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
  );
}
