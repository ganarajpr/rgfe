import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'thinking' | 'verses' | 'search-results' | 'search-status' | 'orchestrator' | 'searcher' | 'analyzer' | 'translator' | 'generator';
  content: string;
  timestamp: Date;
  metadata?: {
    searchResults?: Array<{
      id: string;
      title: string;
      content?: string;
      relevance: number;
      source?: string;
      bookContext?: string;
    }>;
    searchTerm?: string;
    searchIteration?: number;
    maxSearchIterations?: number;
    avgRelevanceScore?: number;
  };
}

export interface PDFExportOptions {
  title?: string;
  watermark?: string;
  includeMetadata?: boolean;
}

/**
 * Export conversation to PDF with watermark
 */
export async function exportConversationToPDF(
  messages: ConversationMessage[],
  options: PDFExportOptions = {}
): Promise<void> {
  const {
    title = 'RigVeda Assistant Conversation',
    watermark = 'indhic.com'
  } = options;

  try {
    // Create PDF document
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    let currentY = margin;
    const lineHeight = 6;
    const sectionSpacing = 10;

    // Helper function to add watermark
    const addWatermark = () => {
      pdf.setGState(pdf.GState({ opacity: 0.1 }));
      pdf.setFontSize(60);
      pdf.setTextColor(200, 200, 200);
      pdf.text(watermark, pageWidth / 2, pageHeight / 2, { 
        angle: 45, 
        align: 'center' 
      });
      pdf.setGState(pdf.GState({ opacity: 1 }));
    };

    // Add watermark to first page
    addWatermark();

    // Add title
    pdf.setFontSize(20);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, margin, currentY);
    currentY += lineHeight * 2;

    // Add timestamp
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Generated on: ${new Date().toLocaleString()}`, margin, currentY);
    currentY += lineHeight * 2;

    // Process messages
    for (const message of messages) {
      // Check if we need a new page
      if (currentY > pageHeight - margin - 50) {
        pdf.addPage();
        addWatermark();
        currentY = margin;
      }

      // Skip message header for system/status messages (they're already styled differently)
      if (message.role !== 'system' && message.role !== 'thinking' && 
          message.role !== 'orchestrator' && message.role !== 'searcher' && 
          message.role !== 'analyzer' && message.role !== 'translator' && 
          message.role !== 'generator' && message.role !== 'search-status') {
        // Message header
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(107, 114, 128); // Gray (text-gray-500)
        
        const roleLabel = getRoleLabel(message.role);
        const timestamp = message.timestamp.toLocaleTimeString();
        pdf.text(roleLabel, margin, currentY);
        
        pdf.setFontSize(8);
        pdf.setTextColor(156, 163, 175); // Light gray
        const roleLabelWidth = pdf.getTextWidth(roleLabel);
        pdf.text(timestamp, margin + roleLabelWidth + 5, currentY);
        currentY += lineHeight;
        pdf.setFontSize(10);
      }

      // Message content
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);

      // Handle different message types
      if ((message.role === 'verses' || message.role === 'search-results') && message.metadata?.searchResults) {
        // Special handling for verses/search-results - styled like the UI
        const isSearchResults = message.role === 'search-results';
        const bgColor = isSearchResults ? [240, 253, 244] : [239, 246, 255]; // Green for search-results, blue for verses
        const textColor = isSearchResults ? [22, 101, 52] : [30, 64, 175]; // Green for search-results, blue for verses
        
        pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        const boxY = currentY - 5;
        const boxHeight = 15;
        pdf.rect(margin - 5, boxY, contentWidth + 10, boxHeight, 'F');
        
        pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
        pdf.setFont('helvetica', 'bold');
        
        if (isSearchResults && message.metadata?.searchIteration !== undefined) {
          const iteration = message.metadata.searchIteration + 1;
          const maxIterations = (message.metadata.maxSearchIterations || 3) + 1;
          const searchTerm = message.metadata.searchTerm || '';
          pdf.text(`🔍 Search Iteration ${iteration}/${maxIterations}${searchTerm ? `: ${searchTerm}` : ''}`, margin, currentY);
        } else {
          pdf.text(`📜 ${message.content}`, margin, currentY);
        }
        currentY += lineHeight * 2;
        
        message.metadata.searchResults.forEach((verse) => {
          if (currentY > pageHeight - margin - 50) {
            pdf.addPage();
            addWatermark();
            currentY = margin;
          }

          // Verse box with border
          const verseBoxY = currentY - 3;
          pdf.setDrawColor(191, 219, 254); // Blue border (border-blue-200)
          pdf.setLineWidth(0.5);
          pdf.rect(margin, verseBoxY, contentWidth, 5, 'S'); // Will adjust height after content

          // Verse reference and relevance
          pdf.setTextColor(37, 99, 235); // Blue (text-blue-600)
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          const verseRef = verse.bookContext || verse.title || 'Verse';
          pdf.text(verseRef, margin + 2, currentY);
          
          const relevanceText = `${(verse.relevance * 100).toFixed(1)}% match`;
          const textWidth = pdf.getTextWidth(relevanceText);
          pdf.setTextColor(107, 114, 128); // Gray (text-gray-500)
          pdf.text(relevanceText, margin + contentWidth - textWidth - 2, currentY);
          currentY += lineHeight;

          // Source
          if (verse.source) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            pdf.setTextColor(75, 85, 99); // Dark gray (text-gray-600)
            pdf.text(`Source: ${verse.source}`, margin + 2, currentY);
            currentY += lineHeight;
          }

          // Content with preserved newlines and Devanagari support
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          pdf.setTextColor(55, 65, 81); // Gray (text-gray-700)
          const content = verse.content || verse.title || 'No content available';
          
          // Check if content contains Devanagari characters
          if (containsDevanagari(content)) {
            // For Devanagari text, use a slightly larger font and bold
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(11);
            pdf.setTextColor(75, 85, 99); // Slightly darker for better readability
          }
          
          // Split by newlines first to preserve formatting
          const contentLines = content.split('\n');
          contentLines.forEach(line => {
            const wrappedLines = pdf.splitTextToSize(line || ' ', contentWidth - 4);
            pdf.text(wrappedLines, margin + 2, currentY);
            currentY += lineHeight * wrappedLines.length;
          });
          
          currentY += 8; // Space between verses
        });
        
        currentY += 5;
      } else if (message.role === 'system' || message.role === 'thinking' || 
                 message.role === 'orchestrator' || message.role === 'searcher' || 
                 message.role === 'analyzer' || message.role === 'translator' || 
                 message.role === 'generator' || message.role === 'search-status') {
        // Status messages - smaller and gray
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(156, 163, 175); // Light gray (text-gray-400)
        const lines = pdf.splitTextToSize(message.content, contentWidth);
        pdf.text(lines, margin, currentY);
        currentY += lineHeight * lines.length + 3;
      } else {
        // Regular message content with styled backgrounds
        const content = message.content;
        
        if (message.role === 'assistant') {
          // Process Sanskrit text for assistant messages
          const { sanskritParts, translationParts, regularParts } = processSanskritText(content);
          
          if (sanskritParts.length > 0 || translationParts.length > 0) {
            // Handle special Sanskrit formatting
            let totalHeight = 0;
            
            // Regular text parts
            for (const part of regularParts) {
              if (part.trim()) {
                const lines = pdf.splitTextToSize(part, contentWidth - 8);
                totalHeight += lineHeight * lines.length;
              }
            }
            
            // Sanskrit verses
            for (const sanskritText of sanskritParts) {
              const lines = pdf.splitTextToSize(sanskritText, contentWidth - 12);
              totalHeight += (lineHeight * lines.length) + 8; // Extra space for Sanskrit
            }
            
            // Translations
            for (const translationText of translationParts) {
              const lines = pdf.splitTextToSize(translationText, contentWidth - 12);
              totalHeight += (lineHeight * lines.length) + 4; // Extra space for translation
            }
            
            // Draw background
            pdf.setDrawColor(229, 231, 235); // border-gray-200
            pdf.setFillColor(249, 250, 251); // bg-gray-50
            pdf.setLineWidth(1);
            pdf.roundedRect(margin, currentY - 4, contentWidth, totalHeight + 8, 2, 2, 'FD');
            
            let currentContentY = currentY;
            
            // Render regular text parts
            for (const part of regularParts) {
              if (part.trim()) {
                const lines = pdf.splitTextToSize(part, contentWidth - 8);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(55, 65, 81); // text-gray-700
                pdf.text(lines, margin + 4, currentContentY);
                currentContentY += lineHeight * lines.length;
              }
            }
            
            // Render Sanskrit verses with special styling
            for (const sanskritText of sanskritParts) {
              currentContentY += 4; // Extra spacing
              
              // Sanskrit verse background
              pdf.setFillColor(255, 248, 220); // Light amber background
              pdf.setDrawColor(251, 191, 36); // Amber border
              pdf.setLineWidth(2);
              const sanskritLines = pdf.splitTextToSize(sanskritText, contentWidth - 12);
              const sanskritHeight = (lineHeight * sanskritLines.length) + 6;
              pdf.roundedRect(margin + 4, currentContentY - 3, contentWidth - 8, sanskritHeight, 2, 2, 'FD');
              
              // Sanskrit text
              pdf.setFont('helvetica', 'bold');
              pdf.setTextColor(146, 64, 14); // Dark amber text
              pdf.setFontSize(11); // Slightly larger for Sanskrit
              pdf.text(sanskritLines, margin + 6, currentContentY);
              currentContentY += sanskritHeight + 2;
            }
            
            // Render translations with special styling
            for (const translationText of translationParts) {
              const translationLines = pdf.splitTextToSize(translationText, contentWidth - 12);
              pdf.setFont('helvetica', 'italic');
              pdf.setTextColor(75, 85, 99); // Gray text for translation
              pdf.setFontSize(10);
              pdf.text(translationLines, margin + 6, currentContentY);
              currentContentY += lineHeight * translationLines.length + 2;
            }
            
            currentY += totalHeight + 8;
          } else {
            // Regular assistant message without Sanskrit
            const lines = pdf.splitTextToSize(content, contentWidth - 8);
            const contentHeight = lineHeight * lines.length + 6;
            
            pdf.setDrawColor(229, 231, 235); // border-gray-200
            pdf.setFillColor(249, 250, 251); // bg-gray-50
            pdf.setLineWidth(1);
            pdf.roundedRect(margin, currentY - 4, contentWidth, contentHeight, 2, 2, 'FD');
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(55, 65, 81); // text-gray-700
            pdf.text(lines, margin + 4, currentY);
            currentY += lineHeight * lines.length + 4;
          }
        } else if (message.role === 'user') {
          // User messages: Dark background with light text (matching screen)
          const lines = pdf.splitTextToSize(content, contentWidth - 8);
          const contentHeight = lineHeight * lines.length + 6;
          
          pdf.setFillColor(31, 41, 55); // bg-gray-800
          pdf.roundedRect(margin, currentY - 4, contentWidth, contentHeight, 2, 2, 'F');
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(243, 244, 246); // Light text (text-gray-100)
          pdf.text(lines, margin + 4, currentY);
          currentY += lineHeight * lines.length + 4;
        } else {
          // Other messages: Default styling
          const lines = pdf.splitTextToSize(content, contentWidth);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(55, 65, 81); // Dark gray (text-gray-700)
          pdf.text(lines, margin, currentY);
          currentY += lineHeight * lines.length;
        }
      }

      currentY += sectionSpacing;
    }

    // Add footer
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        `Page ${i} of ${totalPages} - Generated by ${watermark}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Save the PDF
    const fileName = `rigveda-conversation-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);

  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw new Error('Failed to export conversation to PDF');
  }
}

/**
 * Check if text contains Devanagari characters
 */
function containsDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Process text to handle Sanskrit verses and translations
 */
function processSanskritText(text: string): { sanskritParts: string[], translationParts: string[], regularParts: string[] } {
  const sanskritParts: string[] = [];
  const translationParts: string[] = [];
  const regularParts: string[] = [];
  
  // Split by Sanskrit and translation tags
  const parts = text.split(/(<sanskrit>.*?<\/sanskrit>|<translation>.*?<\/translation>)/gs);
  
  for (const part of parts) {
    if (part.startsWith('<sanskrit>') && part.endsWith('</sanskrit>')) {
      const sanskritText = part.replace(/<\/?sanskrit>/g, '').trim();
      sanskritParts.push(sanskritText);
    } else if (part.startsWith('<translation>') && part.endsWith('</translation>')) {
      const translationText = part.replace(/<\/?translation>/g, '').trim();
      translationParts.push(translationText);
    } else if (part.trim()) {
      regularParts.push(part);
    }
  }
  
  return { sanskritParts, translationParts, regularParts };
}

/**
 * Get display label for message role
 */
function getRoleLabel(role: string): string {
  switch (role) {
    case 'user':
      return 'You';
    case 'assistant':
      return 'RigVeda Assistant';
    case 'system':
      return 'Status';
    case 'thinking':
      return 'Processing';
    case 'verses':
      return 'Found Verses';
    case 'search-results':
      return 'Search Results';
    case 'search-status':
      return 'Search Status';
    case 'orchestrator':
      return 'Status';
    case 'searcher':
      return 'Status';
    case 'analyzer':
      return 'Status';
    case 'generator':
      return 'Status';
    case 'translator':
      return 'Status';
    default:
      return 'Info';
  }
}

/**
 * Export conversation from DOM element (alternative method)
 */
export async function exportConversationFromDOM(
  elementId: string,
  options: PDFExportOptions = {}
): Promise<void> {
  const {
    title = 'RigVeda Assistant Conversation',
    watermark = 'indhic.com'
  } = options;

  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error('Element not found');
    }

    // Convert element to canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });

    // Create PDF
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Calculate dimensions to fit image
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
    const finalWidth = imgWidth * ratio;
    const finalHeight = imgHeight * ratio;

    // Add watermark
    pdf.setGState(pdf.GState({ opacity: 0.1 }));
    pdf.setFontSize(60);
    pdf.setTextColor(200, 200, 200);
    pdf.text(watermark, pageWidth / 2, pageHeight / 2, { 
      angle: 45, 
      align: 'center' 
    });
    pdf.setGState(pdf.GState({ opacity: 1 }));

    // Add image
    pdf.addImage(imgData, 'PNG', 0, 0, finalWidth, finalHeight);

    // Add title
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(title, 20, 20);

    // Save PDF
    const fileName = `rigveda-conversation-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);

  } catch (error) {
    console.error('Error exporting DOM to PDF:', error);
    throw new Error('Failed to export conversation to PDF');
  }
}
