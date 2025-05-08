
import React from "react";

export function ProjectTableHead() {
  return (
    <thead>
      <tr className="bg-muted/50">
        <th className="text-left p-4 font-medium">Title</th>
        <th className="text-left p-4 font-medium hidden md:table-cell">Created</th>
        <th className="text-left p-4 font-medium hidden md:table-cell">File Name</th>
        <th className="text-left p-4 font-medium hidden md:table-cell">Duration</th>
        <th className="text-left p-4 font-medium hidden lg:table-cell">Slides</th>
        <th className="text-left p-4 font-medium">File Size</th>
        <th className="text-right p-4 font-medium">Actions</th>
      </tr>
    </thead>
  );
}
