
import { RefreshCw, Download, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { exportToPDF, exportToCSV, exportToAnki, downloadFile } from "@/services/exportService";
import { useState } from "react";
import { toast } from "sonner";
import { Slide } from "@/hooks/useSlides";

interface SlideActionsProps {
  slides: Slide[];
  projectTitle: string;
  projectId?: string;
  isGenerating: boolean;
  generateSlides: () => Promise<void>;
}

export const SlideActions = ({
  slides,
  projectTitle,
  projectId,
  isGenerating,
  generateSlides
}: SlideActionsProps) => {
  const [isExporting, setIsExporting] = useState<Record<string, boolean>>({
    pdf: false,
    anki: false,
    csv: false
  });
  
  const exportPDF = async () => {
    if (!slides || slides.length === 0) {
      toast.error("No slides to export");
      return;
    }
    
    try {
      setIsExporting((prev) => ({
        ...prev,
        pdf: true
      }));
      
      toast.loading("Generating PDF...", {
        id: "export-pdf"
      });
      
      const pdfBlob = await exportToPDF(slides, projectTitle);
      downloadFile(pdfBlob, `${projectTitle || 'presentation'}.pdf`);
      
      toast.success("PDF exported successfully!", {
        id: "export-pdf"
      });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Failed to export PDF", {
        id: "export-pdf"
      });
    } finally {
      setIsExporting((prev) => ({
        ...prev,
        pdf: false
      }));
    }
  };
  
  const exportAnki = async () => {
    if (!slides || slides.length === 0) {
      toast.error("No slides to export");
      return;
    }
    
    try {
      setIsExporting((prev) => ({
        ...prev,
        anki: true
      }));
      
      toast.loading("Generating Anki deck...", {
        id: "export-anki"
      });
      
      const ankiBlob = exportToAnki(slides, projectTitle);
      downloadFile(ankiBlob, `${projectTitle || 'anki-cards'}.csv`);
      
      toast.success("Anki cards exported successfully!", {
        id: "export-anki"
      });
    } catch (error) {
      console.error("Error exporting Anki cards:", error);
      toast.error("Failed to export Anki cards", {
        id: "export-anki"
      });
    } finally {
      setIsExporting((prev) => ({
        ...prev,
        anki: false
      }));
    }
  };
  
  const exportCSV = async () => {
    if (!slides || slides.length === 0) {
      toast.error("No slides to export");
      return;
    }
    
    try {
      setIsExporting((prev) => ({
        ...prev,
        csv: true
      }));
      
      toast.loading("Generating CSV...", {
        id: "export-csv"
      });
      
      const csvBlob = exportToCSV(slides, projectTitle);
      downloadFile(csvBlob, `${projectTitle || 'slides'}.csv`);
      
      toast.success("CSV exported successfully!", {
        id: "export-csv"
      });
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Failed to export CSV", {
        id: "export-csv"
      });
    } finally {
      setIsExporting((prev) => ({
        ...prev,
        csv: false
      }));
    }
  };
  
  const copyToClipboard = () => {
    if (!slides || slides.length === 0 || !slides[0]) return;
    
    const slideText = slides.map(slide => `${slide.title}\n\n${slide.content}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(slideText);
    toast.success("All slides content copied to clipboard");
  };
  
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" asChild disabled={slides.length <= 1 || slides[0].id === "slide-placeholder"}>
        <Link to={`/projects/${projectId}/present`}>
          <Presentation className="h-4 w-4 mr-1" />
          Present
        </Link>
      </Button>
      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </DialogTrigger>
        <DialogContent>
          <div className="space-y-4 p-4">
            <h3 className="text-lg font-semibold">Export Options</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button onClick={generateSlides} variant="outline" className="justify-start" disabled={isGenerating}>
                {isGenerating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                {slides.length <= 1 ? "Generate Slides" : "Regenerate Slides"}
              </Button>
              
              <Button onClick={exportPDF} variant="outline" className="justify-start" disabled={isExporting.pdf}>
                {isExporting.pdf ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>}
                PDF
              </Button>
              <Button onClick={exportAnki} variant="outline" className="justify-start" disabled={isExporting.anki}>
                {isExporting.anki ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>}
                Anki
              </Button>
              <Button onClick={exportCSV} variant="outline" className="justify-start" disabled={isExporting.csv}>
                {isExporting.csv ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="8 17 12 21 16 17"></polyline>
                    <line x1="12" y1="12" x2="12" y2="21"></line>
                    <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path>
                  </svg>}
                CSV
              </Button>
              
              <Button onClick={copyToClipboard} variant="outline" className="justify-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy All Text
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
