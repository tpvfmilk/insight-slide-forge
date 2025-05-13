
import React from "react";
import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";
import { useSlideEditor } from "./SlideEditorContext";
import { exportToPDF, exportToCSV, exportToAnki, downloadFile } from "@/services/exportService";
import { ExportFormat } from "./SlideEditorTypes";

export const SlideExportDialog: React.FC = () => {
  const { 
    slides, 
    projectTitle, 
    isGenerating, 
    generateSlides, 
    isExporting 
  } = useSlideEditor();

  // Export functions
  const handleExport = async (format: ExportFormat) => {
    if (!slides || slides.length === 0) {
      toast({
        title: "Error",
        description: "No slides to export",
        variant: "destructive"
      });
      return;
    }

    const toastId = `export-${format}`;
    
    try {
      // Show loading toast
      toast({
        id: toastId,
        title: `Generating ${format.toUpperCase()}...`,
        description: "Please wait while your file is being prepared."
      });

      let exportedBlob: Blob;
      let fileName: string;

      // Generate the appropriate export format
      switch (format) {
        case 'pdf':
          exportedBlob = await exportToPDF(slides, projectTitle);
          fileName = `${projectTitle || 'presentation'}.pdf`;
          break;
        case 'anki':
          exportedBlob = exportToAnki(slides, projectTitle);
          fileName = `${projectTitle || 'anki-cards'}.csv`;
          break;
        case 'csv':
          exportedBlob = exportToCSV(slides, projectTitle);
          fileName = `${projectTitle || 'slides'}.csv`;
          break;
      }

      // Download the file
      downloadFile(exportedBlob, fileName);
      
      // Show success toast
      toast({
        id: toastId,
        title: `${format.toUpperCase()} exported successfully!`,
        description: "Your file is ready.",
        variant: "default"
      });
    } catch (error) {
      console.error(`Error exporting ${format}:`, error);
      toast({
        id: toastId,
        title: `Failed to export ${format}`,
        description: "An error occurred while exporting.",
        variant: "destructive"
      });
    }
  };

  return (
    <DialogContent>
      <div className="space-y-4 p-4">
        <h3 className="text-lg font-semibold">Export Options</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button 
            onClick={generateSlides} 
            variant="outline" 
            className="justify-start" 
            disabled={isGenerating}
          >
            {isGenerating ? 
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : 
              <RefreshCw className="h-4 w-4 mr-2" />
            }
            {slides.length <= 1 ? "Generate Slides" : "Regenerate Slides"}
          </Button>
          
          <Button 
            onClick={() => handleExport('pdf')} 
            variant="outline" 
            className="justify-start" 
            disabled={isExporting.pdf}
          >
            {isExporting.pdf ? 
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : 
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            }
            PDF
          </Button>
          
          <Button 
            onClick={() => handleExport('anki')} 
            variant="outline" 
            className="justify-start" 
            disabled={isExporting.anki}
          >
            {isExporting.anki ? 
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : 
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            }
            Anki
          </Button>
          
          <Button 
            onClick={() => handleExport('csv')} 
            variant="outline" 
            className="justify-start" 
            disabled={isExporting.csv}
          >
            {isExporting.csv ? 
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : 
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="8 17 12 21 16 17"></polyline>
                <line x1="12" y1="12" x2="12" y2="21"></line>
                <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path>
              </svg>
            }
            CSV
          </Button>
        </div>
      </div>
    </DialogContent>
  );
};
