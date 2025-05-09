
import React from "react";
import { Slider } from "@/components/ui/slider";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Info } from "lucide-react";

interface SliderControlProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean; // Added disabled prop
}

export const SliderControl: React.FC<SliderControlProps> = ({ value, onChange, disabled = false }) => {
  return (
    <div className={`space-y-2 ${disabled ? 'opacity-70' : ''}`}>
      <div className="flex items-center">
        <label className="text-sm font-medium mr-2">Slides Per Minute</label>
        <HoverCard>
          <HoverCardTrigger asChild>
            <button className="inline-flex">
              <Info className="h-4 w-4 text-muted-foreground" />
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-2">
              <h4 className="font-medium">Slide Density Control</h4>
              <p className="text-sm text-muted-foreground">
                Controls how many slides will be generated per minute of content.
                Higher values result in more detailed slides, while lower values create
                more summarized slides.
              </p>
            </div>
          </HoverCardContent>
        </HoverCard>
      </div>

      <div className="flex items-center space-x-2">
        <span className="text-sm text-muted-foreground">1</span>
        <Slider
          value={[value]}
          min={1}
          max={20}
          step={1}
          onValueChange={(values) => onChange(values[0])}
          className="flex-1"
          disabled={disabled}
        />
        <span className="text-sm text-muted-foreground">20</span>
        <span className="w-8 text-right text-sm font-medium">{value}</span>
      </div>
    </div>
  );
};
