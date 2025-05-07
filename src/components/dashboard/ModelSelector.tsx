
import { Check, Cpu } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

const models = [
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    description: "Fast and cost-effective",
    tokenLimit: 16385,
    pricePrompt: 0.0015,
    priceCompletion: 0.002,
  },
  {
    id: "gpt-4",
    name: "GPT-4",
    description: "Most capable, best for complex tasks",
    tokenLimit: 8192,
    pricePrompt: 0.03,
    priceCompletion: 0.06,
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    description: "Latest model with enhanced capabilities",
    tokenLimit: 32768,
    pricePrompt: 0.01,
    priceCompletion: 0.03,
  },
];

export const ModelSelector = () => {
  const [selectedModel, setSelectedModel] = useState("gpt-3.5-turbo");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  
  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    toast.success(`Model changed to ${models.find(m => m.id === value)?.name}`);
  };
  
  const toggleDefaultSetting = () => {
    setSaveAsDefault(!saveAsDefault);
    toast.success(saveAsDefault ? "Default model preference removed" : "Default model preference saved");
  };
  
  // Find the currently selected model
  const currentModel = models.find(model => model.id === selectedModel);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-primary" />
          AI Model Selection
        </CardTitle>
        <CardDescription>
          Choose which OpenAI model to use for slide generation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Select value={selectedModel} onValueChange={handleModelChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Available Models</SelectLabel>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{model.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          
          {currentModel && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Description:</span>
                <p>{currentModel.description}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Token Limit:</span>
                <p>{currentModel.tokenLimit.toLocaleString()} tokens</p>
              </div>
              <div>
                <span className="text-muted-foreground">Pricing:</span>
                <p>
                  ${currentModel.pricePrompt.toFixed(4)}/1K prompt tokens, 
                  ${currentModel.priceCompletion.toFixed(4)}/1K completion tokens
                </p>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <Label htmlFor="save-default" className="text-sm cursor-pointer">
              Save as default model
            </Label>
            <Switch 
              id="save-default" 
              checked={saveAsDefault} 
              onCheckedChange={toggleDefaultSetting} 
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">
          Model selection affects processing speed, quality, and cost.
        </div>
      </CardFooter>
    </Card>
  );
};
