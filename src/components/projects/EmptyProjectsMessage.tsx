
import React from "react";
import { AlertCircle } from "lucide-react";

type EmptyProjectsMessageProps = {
  errorMessage?: string;
};

export function EmptyProjectsMessage({ errorMessage }: EmptyProjectsMessageProps) {
  return (
    <tr>
      <td colSpan={7} className="p-8 text-center">
        <div className="flex flex-col items-center justify-center gap-2">
          {errorMessage ? (
            <>
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div className="text-destructive font-medium">{errorMessage}</div>
            </>
          ) : (
            <div className="text-muted-foreground">No projects found</div>
          )}
        </div>
      </td>
    </tr>
  );
}
