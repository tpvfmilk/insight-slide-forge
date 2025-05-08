
import { Clock } from "lucide-react";

interface ExpirationBadgeProps {
  hours: number;
}

export function ExpirationBadge({ hours }: ExpirationBadgeProps) {
  let color = "";
  let text = "";
  
  if (hours <= 6) {
    color = "text-red-500";
    text = `${hours}h remaining`;
  } else if (hours <= 24) {
    color = "text-amber-500";
    text = `${hours}h remaining`;
  } else {
    color = "text-green-500";
    text = `${hours}h remaining`;
  }
  
  return (
    <div className="flex items-center">
      <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
      <span className={color}>{text}</span>
    </div>
  );
}
