
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Download, Copy, Clock, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

interface Slide {
  id: string;
  title: string;
  content: string;
  timestamp?: string;
  imageUrl?: string;
}

const dummySlides: Slide[] = [
  {
    id: "slide-1",
    title: "Introduction to Quantum Computing",
    content: "• Quantum computing leverages quantum mechanics principles\n• Uses qubits instead of classical bits\n• Capable of solving complex problems exponentially faster\n• Currently in early stages of development",
    timestamp: "00:01:15",
    imageUrl: "/lovable-uploads/0ad5b08b-62f2-48a2-a50d-f34e2feaa43e.png"
  },
  {
    id: "slide-2",
    title: "Quantum Bits (Qubits)",
    content: "• Fundamental unit of quantum information\n• Can exist in superposition of states\n• Enables parallel computation\n• Types: superconducting, trapped ion, photonic",
    timestamp: "00:03:42"
  },
  {
    id: "slide-3",
    title: "Quantum Algorithms",
    content: "• Shor's Algorithm: Integer factorization\n• Grover's Algorithm: Unstructured search\n• Quantum Fourier Transform\n• Variational Quantum Eigensolvers (VQE)",
    timestamp: "00:08:15"
  }
];

export const SlideEditor = () => {
  const [slides, setSlides] = useState<Slide[]>(dummySlides);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [editedTitle, setEditedTitle] = useState<string>("");
  const [editedContent, setEditedContent] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const currentSlide = slides[currentSlideIndex];
  
  useEffect(() => {
    if (currentSlide) {
      setEditedTitle(currentSlide.title);
      setEditedContent(currentSlide.content);
    }
  }, [currentSlide, currentSlideIndex]);
  
  const goToNextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      saveChanges();
      setCurrentSlideIndex(prev => prev + 1);
    }
  };
  
  const goToPrevSlide = () => {
    if (currentSlideIndex > 0) {
      saveChanges();
      setCurrentSlideIndex(prev => prev - 1);
    }
  };
  
  const saveChanges = () => {
    if (isEditing) {
      const updatedSlides = [...slides];
      updatedSlides[currentSlideIndex] = {
        ...updatedSlides[currentSlideIndex],
        title: editedTitle,
        content: editedContent,
      };
      setSlides(updatedSlides);
      setIsEditing(false);
      toast.success("Slide updated");
    }
  };
  
  const startEditing = () => {
    setIsEditing(true);
  };
  
  const copyToClipboard = () => {
    const slideText = `${currentSlide.title}\n\n${currentSlide.content}`;
    navigator.clipboard.writeText(slideText);
    toast.success("Slide content copied to clipboard");
  };
  
  const exportPDF = () => {
    toast.success("Preparing PDF export...");
    // This would trigger the actual PDF generation
  };
  
  const exportAnki = () => {
    toast.success("Preparing Anki deck...");
    // This would trigger Anki export
  };
  
  const exportCSV = () => {
    toast.success("Preparing CSV export...");
    // This would trigger CSV export
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b">
        <div className="text-sm text-muted-foreground flex items-center">
          <Clock className="h-4 w-4 mr-1" />
          <span>Slide {currentSlideIndex + 1} of {slides.length}</span>
          {currentSlide.timestamp && (
            <span className="ml-2">• Timestamp: {currentSlide.timestamp}</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            <Copy className="h-4 w-4 mr-1" />
            Copy
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Button onClick={exportPDF} variant="outline" className="justify-start">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    PDF
                  </Button>
                  <Button onClick={exportAnki} variant="outline" className="justify-start">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                      <line x1="8" y1="21" x2="16" y2="21"></line>
                      <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                    Anki
                  </Button>
                  <Button onClick={exportCSV} variant="outline" className="justify-start">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="8 17 12 21 16 17"></polyline>
                      <line x1="12" y1="12" x2="12" y2="21"></line>
                      <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path>
                    </svg>
                    CSV
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Left pane - Image */}
        <div className="border-r min-h-[300px] flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-medium">Slide Visual</h3>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            {currentSlide.imageUrl ? (
              <div className="relative w-full h-full">
                <img 
                  src={currentSlide.imageUrl} 
                  alt="Slide visual" 
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground h-full">
                <ImageIcon className="h-10 w-10 mb-2" />
                <p>No image available</p>
                <Button variant="outline" size="sm" className="mt-4">
                  Upload Image
                </Button>
              </div>
            )}
          </div>
        </div>
        
        {/* Right pane - Content */}
        <div className="min-h-[300px] flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-medium">Slide Content</h3>
            {isEditing ? (
              <Button size="sm" onClick={saveChanges}>Save Changes</Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={startEditing}>Edit</Button>
            )}
          </div>
          <div className="flex-1 p-4">
            {isEditing ? (
              <div className="space-y-4 h-full">
                <div className="space-y-2">
                  <label htmlFor="slide-title" className="text-sm font-medium">Title</label>
                  <Textarea
                    id="slide-title"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="slide-content" className="text-sm font-medium">Content</label>
                  <Textarea
                    id="slide-content"
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="resize-none flex-1 min-h-[200px]"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">{currentSlide.title}</h2>
                <div className="whitespace-pre-line">{currentSlide.content}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <Separator />
      
      {/* Bottom navigation */}
      <div className="flex justify-between items-center p-4">
        <Button 
          variant="outline" 
          onClick={goToPrevSlide} 
          disabled={currentSlideIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        
        <div className="flex gap-1">
          {slides.map((_, index) => (
            <Button 
              key={index}
              variant={index === currentSlideIndex ? "default" : "ghost"}
              size="icon"
              className="w-8 h-8 rounded-full"
              onClick={() => {
                saveChanges();
                setCurrentSlideIndex(index);
              }}
            >
              {index + 1}
            </Button>
          ))}
        </div>
        
        <Button 
          variant="outline" 
          onClick={goToNextSlide} 
          disabled={currentSlideIndex === slides.length - 1}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};
