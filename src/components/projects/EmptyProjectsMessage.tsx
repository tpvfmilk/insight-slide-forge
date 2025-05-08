
import React from "react";

export function EmptyProjectsMessage() {
  return (
    <tr>
      <td colSpan={7} className="p-8 text-center">
        <div className="text-muted-foreground">No projects found</div>
      </td>
    </tr>
  );
}
