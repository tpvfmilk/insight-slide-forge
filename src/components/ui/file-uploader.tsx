
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X } from "lucide-react";

interface FileUploaderProps {
  onFilesSelected: (files: FileList | null) => void;
  selectedFiles?: File[]; // Added to track externally managed files
  onRemoveFile?: (index: number) => void; // Added to remove individual files
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in MB
  className?: string;
  disabled?: boolean; 
  showPreview?: boolean; // Added to control file preview display
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFilesSelected,
  selectedFiles,
  onRemoveFile,
  accept = "*",
  multiple = false,
  maxSize = 100, // Default 100MB
  className = "",
  disabled = false,
  showPreview = true,
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
    
    if (disabled) return; // Don't process drops when disabled
    
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };
  
  return (
    <div 
      className={`relative ${className}`}
      onDragEnter={disabled ? undefined : handleDrag}
    >
      <Input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
      
      {/* Drop area */}
      <div 
        className={`border-2 border-dashed rounded-lg p-6 transition-colors flex flex-col items-center justify-center ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${
          dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
        onClick={disabled ? undefined : handleButtonClick}
        onDragOver={disabled ? undefined : handleDrag}
        onDragLeave={disabled ? undefined : handleDrag}
        onDrop={disabled ? undefined : handleDrop}
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
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) handleButtonClick();
          }}
        >
          <Upload className="h-4 w-4 mr-2" />
          Select {multiple ? "Files" : "File"}
        </Button>
      </div>

      {/* File previews section */}
      {showPreview && selectedFiles && selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">Selected Files ({selectedFiles.length})</p>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div 
                key={`${file.name}-${index}`}
                className="flex items-center justify-between bg-muted/50 rounded-md p-2 group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                {onRemoveFile && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 opacity-70 hover:opacity-100"
                    onClick={() => onRemoveFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
