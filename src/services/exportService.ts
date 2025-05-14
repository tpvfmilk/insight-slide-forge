
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { Slide } from "@/components/slides/editor/SlideEditorTypes";

// Helper function to convert base64 image to data URL if needed
const prepareImage = (imageUrl: string) => {
  return imageUrl;
};

export const exportToPDF = async (slides: Slide[], projectTitle: string): Promise<Blob> => {
  const doc = new jsPDF();
  const title = projectTitle || "Presentation";
  
  doc.setFontSize(20);
  doc.text(title, 20, 20);
  
  let yPos = 40;
  
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    
    // Add a new page for each slide after the first one
    if (i > 0) {
      doc.addPage();
      yPos = 20;
    }
    
    // Add slide number
    doc.setFontSize(10);
    doc.text(`Slide ${i + 1}/${slides.length}`, 20, yPos);
    yPos += 10;
    
    // Add slide title
    doc.setFontSize(16);
    doc.text(slide.title, 20, yPos);
    yPos += 15;
    
    // Add image if available
    if (slide.imageUrl) {
      try {
        const imgData = prepareImage(slide.imageUrl);
        const imgWidth = 170;
        const imgHeight = 80;
        doc.addImage(imgData, "JPEG", 20, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 10;
      } catch (error) {
        console.error("Error adding image to PDF:", error);
        // Continue without the image
      }
    }
    
    // Add slide content with text wrapping
    doc.setFontSize(12);
    const splitText = doc.splitTextToSize(slide.content, 170);
    doc.text(splitText, 20, yPos);
  }
  
  return doc.output("blob");
};

export const exportToCSV = (slides: Slide[], projectTitle: string): Blob => {
  let csvContent = "Slide Number,Title,Content\n";
  
  slides.forEach((slide, index) => {
    // Properly escape and format CSV data
    const title = `"${slide.title.replace(/"/g, '""')}"`;
    const content = `"${slide.content.replace(/"/g, '""')}"`;
    
    csvContent += `${index + 1},${title},${content}\n`;
  });
  
  return new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
};

export const exportToAnki = (slides: Slide[], projectTitle: string): Blob => {
  // For simplicity, we'll export as a CSV that can be imported into Anki
  // Anki expects a specific format: front,back
  
  let ankiContent = "Front,Back\n";
  
  slides.forEach((slide) => {
    // Use title as front and content as back of the card
    const front = `"${slide.title.replace(/"/g, '""')}"`;
    const back = `"${slide.content.replace(/"/g, '""')}"`;
    
    ankiContent += `${front},${back}\n`;
  });
  
  return new Blob([ankiContent], { type: "text/csv;charset=utf-8;" });
};

// Helper function to initiate a download for a generated blob
export const downloadFile = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
