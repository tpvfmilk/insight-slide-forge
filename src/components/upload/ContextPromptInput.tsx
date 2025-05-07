
import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

interface ContextPromptInputProps {
  value: string;
  onChange: (value: string) => void;
}

// Preset buttons for quick context additions
const PRESETS = [
  { label: "Skip intros and outros", value: "Skip intros and outros" },
  { label: "Ignore ads or sponsor segments", value: "Ignore ads or sponsor segments" },
  { label: "Focus on main teaching points only", value: "Focus on main teaching points only" },
  { label: "Preserve terminology from previous videos", value: "Preserve terminology from previous videos" }
];

export const ContextPromptInput = ({ value, onChange }: ContextPromptInputProps) => {
  const [charCount, setCharCount] = useState(0);
  const CHARACTER_LIMIT = 500;

  useEffect(() => {
    setCharCount(value.length);
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    if (newText.length <= CHARACTER_LIMIT) {
      onChange(newText);
    }
  };

  const handlePresetClick = (presetValue: string) => {
    const updatedValue = value ? `${value}\n${presetValue}` : presetValue;
    if (updatedValue.length <= CHARACTER_LIMIT) {
      onChange(updatedValue);
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor="context-prompt" className="text-sm font-medium">
        Add series or content context (optional)
      </label>
      
      <Textarea
        id="context-prompt"
        placeholder="Use this to describe recurring content, what to skip, or what to emphasize. This helps AI tailor slides across similar videos."
        value={value}
        onChange={handleTextChange}
        maxLength={CHARACTER_LIMIT}
        className="min-h-[100px] resize-y"
      />
      
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <div className="flex items-center space-x-1">
          <Info className="h-3 w-3" />
          <span>This context will be used to improve results across related videos.</span>
        </div>
        <span className={charCount > CHARACTER_LIMIT * 0.9 ? "text-orange-500" : ""}>
          {charCount}/{CHARACTER_LIMIT}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-2 mt-2">
        {PRESETS.map((preset, index) => (
          <Badge 
            key={index} 
            variant="outline" 
            className="cursor-pointer hover:bg-secondary"
            onClick={() => handlePresetClick(preset.value)}
          >
            {preset.label}
          </Badge>
        ))}
      </div>
    </div>
  );
};
