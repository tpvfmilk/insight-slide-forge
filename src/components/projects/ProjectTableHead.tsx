
import React from "react";

export function ProjectTableHead() {
  return (
    <thead>
      <tr className="bg-muted/50">
        <th className="text-left p-4 font-medium">Project</th>
        <th className="text-left p-4 font-medium hidden lg:table-cell">Duration</th>
        <th className="text-left p-4 font-medium">Size</th>
        <th className="text-right p-4 font-medium">Actions</th>
      </tr>
    </thead>
  );
}
