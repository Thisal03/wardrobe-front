'use client';

import { useState } from 'react';

interface ResultGalleryProps {
  images: string | string[];
  onImageSelect?: (imageUrl: string | null) => void;
  selectedImage?: string | null;
}

export default function ResultGallery({ images, onImageSelect, selectedImage: externalSelectedImage }: ResultGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const imageArray = Array.isArray(images) ? images : [images];
  
  // Use external selected image if provided, otherwise use internal state
  const displaySelectedImage = externalSelectedImage !== undefined ? externalSelectedImage : selectedImage;
  
  const handleImageClick = (imageUrl: string) => {
    if (onImageSelect) {
      onImageSelect(imageUrl);
    }
    setSelectedImage(imageUrl);
  };

  const handleCloseModal = () => {
    if (onImageSelect) {
      onImageSelect(null); // Clear the external selection
    }
    setSelectedImage(null); // Clear the internal selection
  };

  const downloadImage = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `matching-set-${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  if (imageArray.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4">Generated Images</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {imageArray.map((imageUrl, index) => (
          <div 
            key={index} 
            className={`relative group rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-md hover:shadow-xl transition-all duration-200 ${
              displaySelectedImage === imageUrl ? 'ring-4 ring-blue-500 dark:ring-blue-400' : ''
            }`}
          >
            <img
              src={imageUrl}
              alt={`Generated image ${index + 1}`}
              className="w-full h-auto object-cover cursor-pointer transition-transform duration-200 group-hover:scale-105"
              onClick={() => handleImageClick(imageUrl)}
            />
            {displaySelectedImage === imageUrl && (
              <div className="absolute top-2 left-2 bg-blue-500 text-white rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Selected
              </div>
            )}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadImage(imageUrl, index);
                }}
                className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-all duration-200 cursor-pointer shadow-lg hover:scale-105 active:scale-95"
              >
                Download
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleImageClick(imageUrl);
                }}
                className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-all duration-200 cursor-pointer shadow-lg hover:scale-105 active:scale-95"
              >
                View Full
              </button>
            </div>
          </div>
        ))}
      </div>

      {displaySelectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={handleCloseModal}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCloseModal();
              }}
              className="absolute top-4 right-4 bg-white text-black rounded-full p-2 hover:bg-gray-100 transition-all duration-200 z-10 cursor-pointer hover:scale-110 active:scale-95 shadow-lg"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={displaySelectedImage}
              alt="Full size preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

