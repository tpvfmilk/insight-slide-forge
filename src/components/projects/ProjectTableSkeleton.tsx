
import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function ProjectTableSkeleton() {
  return (
    <>
      {[1, 2, 3, 4].map(i => (
        <tr key={i} className="border-t">
          <td className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </td>
          <td className="p-4 hidden md:table-cell">
            <Skeleton className="h-4 w-[100px]" />
          </td>
          <td className="p-4 hidden md:table-cell">
            <Skeleton className="h-4 w-[180px]" />
          </td>
          <td className="p-4 hidden md:table-cell">
            <Skeleton className="h-4 w-[80px]" />
          </td>
          <td className="p-4 hidden lg:table-cell">
            <Skeleton className="h-4 w-[60px]" />
          </td>
          <td className="p-4">
            <Skeleton className="h-4 w-[100px]" />
          </td>
          <td className="p-4 text-right">
            <div className="flex justify-end gap-2">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
