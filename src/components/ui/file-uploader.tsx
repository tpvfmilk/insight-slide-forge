
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";

interface FileUploaderProps {
  onFilesSelected: (files: FileList | null) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in MB
  className?: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFilesSelected,
  accept = "*",
  multiple = false,
  maxSize = 100, // Default 100MB
  className = "",
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  
  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFiles(e.dataTransfer.files);
    }
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcessFiles(e.target.files);
    }
  };
  
  const validateAndProcessFiles = (files: FileList) => {
    // Check file size if maxSize is provided
    if (maxSize) {
      for (let i = 0; i < files.length; i++) {
        const fileSizeInMB = files[i].size / (1024 * 1024);
        if (fileSizeInMB > maxSize) {
          alert(`File ${files[i].name} is too large (${fileSizeInMB.toFixed(2)}MB). Maximum size is ${maxSize}MB.`);
          return;
        }
      }
    }
    
    onFilesSelected(files);
  };
  
  const handleButtonClick = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };
  
  return (
    <div 
      className={`relative ${className}`}
      onDragEnter={handleDrag}
    >
      <Input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />
      <div 
        className={`border-2 border-dashed rounded-lg p-6 transition-colors flex flex-col items-center justify-center cursor-pointer ${
          dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
        onClick={handleButtonClick}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="h-10 w-10 text-muted-foreground mb-2" />
        <p className="font-medium text-center">
          Drop files here or click to browse
        </p>
        <p className="text-sm text-muted-foreground text-center mt-1">
          {multiple ? "Upload files" : "Upload a file"} {accept !== "*" ? `(${accept})` : ""}
        </p>
        <Button 
          type="button" 
          variant="outline" 
          className="mt-4"
          onClick={(e) => {
            e.stopPropagation();
            handleButtonClick();
          }}
        >
          <Upload className="h-4 w-4 mr-2" />
          Select File
        </Button>
      </div>
    </div>
  );
};
