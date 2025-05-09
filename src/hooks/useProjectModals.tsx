
import { useState } from "react";
import { ExtractedFrame } from "@/services/clientFrameExtractionService";

export const useProjectModals = () => {
  const [isTranscriptDialogOpen, setIsTranscriptDialogOpen] = useState<boolean>(false);
  const [isDensityDialogOpen, setIsDensityDialogOpen] = useState<boolean>(false);
  const [isContextDialogOpen, setIsContextDialogOpen] = useState<boolean>(false);
  const [isEditTitleDialogOpen, setIsEditTitleDialogOpen] = useState<boolean>(false);
  const [isFrameExtractionModalOpen, setIsFrameExtractionModalOpen] = useState<boolean>(false);
  const [isFramePickerModalOpen, setIsFramePickerModalOpen] = useState<boolean>(false);
  
  const openFrameExtractionModal = () => setIsFrameExtractionModalOpen(true);
  const closeFrameExtractionModal = () => setIsFrameExtractionModalOpen(false);
  
  const openFramePickerModal = () => setIsFramePickerModalOpen(true);
  const closeFramePickerModal = () => setIsFramePickerModalOpen(false);
  
  const openTranscriptDialog = () => setIsTranscriptDialogOpen(true);
  const closeTranscriptDialog = () => setIsTranscriptDialogOpen(false);
  
  const openDensityDialog = () => setIsDensityDialogOpen(true);
  const closeDensityDialog = () => setIsDensityDialogOpen(false);
  
  const openContextDialog = () => setIsContextDialogOpen(true);
  const closeContextDialog = () => setIsContextDialogOpen(false);
  
  const openEditTitleDialog = () => setIsEditTitleDialogOpen(true);
  const closeEditTitleDialog = () => setIsEditTitleDialogOpen(false);
  
  return {
    isTranscriptDialogOpen,
    setIsTranscriptDialogOpen,
    openTranscriptDialog,
    closeTranscriptDialog,
    
    isDensityDialogOpen,
    setIsDensityDialogOpen,
    openDensityDialog,
    closeDensityDialog,
    
    isContextDialogOpen,
    setIsContextDialogOpen,
    openContextDialog,
    closeContextDialog,
    
    isEditTitleDialogOpen,
    setIsEditTitleDialogOpen,
    openEditTitleDialog,
    closeEditTitleDialog,
    
    isFrameExtractionModalOpen,
    setIsFrameExtractionModalOpen,
    openFrameExtractionModal,
    closeFrameExtractionModal,
    
    isFramePickerModalOpen,
    setIsFramePickerModalOpen,
    openFramePickerModal,
    closeFramePickerModal
  };
};
