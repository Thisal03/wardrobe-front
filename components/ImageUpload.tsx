'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';

interface ImageUploadProps {
  label: string;
  acceptMultiple?: boolean;
  maxSizeMB?: number; // Optional - for display only, not validation
  onFilesChange: (files: File[]) => void;
  selectedFiles: File[];
  required?: boolean;
  showCompressionNote?: boolean;
}

export default function ImageUpload({
  label,
  acceptMultiple = false,
  maxSizeMB,
  onFilesChange,
  selectedFiles,
  required = false,
  showCompressionNote = false,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return `${file.name} is not an image file`;
    }
    // No size validation - images will be compressed before sending
    return null;
  };

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setError(null);
      const fileArray = Array.from(files);
      const errors: string[] = [];

      fileArray.forEach((file) => {
        const error = validateFile(file);
        if (error) errors.push(error);
      });

      if (errors.length > 0) {
        setError(errors.join(', '));
        return;
      }

      if (acceptMultiple) {
        onFilesChange([...selectedFiles, ...fileArray]);
      } else {
        onFilesChange(fileArray);
      }
    },
    [acceptMultiple, onFilesChange, selectedFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
    // Reset the input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset the input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    onFilesChange(newFiles);
    // Reset the input value so the same file can be selected again after removal
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const hasImage = selectedFiles.length > 0;
  const firstFile = hasImage ? selectedFiles[0] : null;
  
  // Create a stable key from file properties to track file changes
  const fileKey = firstFile ? `${firstFile.name}-${firstFile.size}-${firstFile.lastModified}` : null;
  
  // Use data URL for image preview (more reliable than object URLs)
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Update image URL when file changes using FileReader
  useEffect(() => {
    if (!firstFile) {
      setImageUrl(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    console.log('🔄 Starting to read file:', {
      name: firstFile.name,
      size: firstFile.size,
      type: firstFile.type,
      lastModified: firstFile.lastModified
    });
    
    // Use FileReader to create a data URL
    const reader = new FileReader();
    
    reader.onloadstart = () => {
      console.log('📖 FileReader started reading file:', firstFile.name);
    };
    
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        console.log(`📊 Reading progress: ${percent}%`);
      }
    };
    
    reader.onloadend = () => {
      console.log('✅ FileReader finished reading');
      if (reader.result && typeof reader.result === 'string') {
        const dataUrl = reader.result;
        console.log('✅ Image data URL created successfully. Length:', dataUrl.length, 'First 100 chars:', dataUrl.substring(0, 100));
        setImageUrl(dataUrl);
        setIsLoading(false);
      } else {
        console.error('❌ Failed to read file as data URL. Result type:', typeof reader.result, 'Result:', reader.result);
        setIsLoading(false);
        setImageUrl(null);
      }
    };
    
    reader.onerror = () => {
      console.error('❌ FileReader error:', reader.error);
      setIsLoading(false);
      setImageUrl(null);
    };
    
    reader.onabort = () => {
      console.error('❌ FileReader aborted');
      setIsLoading(false);
      setImageUrl(null);
    };
    
    reader.readAsDataURL(firstFile);
    
    // Cleanup is not needed for data URLs as they are part of the component state
  }, [fileKey]); // Use fileKey to track when file actually changes

  return (
    <div className="w-full">
      <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500 ml-1" title="Required field">*</span>}
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={acceptMultiple}
        onChange={handleFileInput}
        className="hidden"
      />

      {hasImage && firstFile ? (
        // Show uploaded image, replacing the uploader
        <div className="relative group">
          <div
            className="border-2 border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-950 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200 active:scale-[0.99] relative w-full"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center min-h-[200px] text-gray-400 dark:text-gray-500 text-sm">
                Loading preview...
              </div>
            ) : imageUrl ? (
              <div className="flex items-center justify-center w-full min-h-[200px] bg-transparent p-2">
                <img
                  key={fileKey || 'image-preview'}
                  src={imageUrl}
                  alt={firstFile.name}
                  className="max-w-full max-h-[400px] w-auto h-auto"
                  style={{ 
                    display: 'block',
                    objectFit: 'contain',
                    maxWidth: '100%',
                    maxHeight: '400px',
                    height: 'auto',
                    width: 'auto'
                  }}
                  onError={(e) => {
                    console.error('❌ Image failed to load:', {
                      fileName: firstFile?.name,
                      fileSize: firstFile?.size,
                      fileType: firstFile?.type,
                      hasImageUrl: !!imageUrl,
                      imageUrlLength: imageUrl?.length
                    });
                    const target = e.currentTarget;
                    target.style.display = 'none';
                  }}
                  onLoad={(e) => {
                    console.log('✅ Image loaded successfully:', {
                      fileName: firstFile?.name,
                      naturalWidth: e.currentTarget.naturalWidth,
                      naturalHeight: e.currentTarget.naturalHeight,
                      displayedWidth: e.currentTarget.offsetWidth,
                      displayedHeight: e.currentTarget.offsetHeight
                    });
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center min-h-[200px] text-gray-400 dark:text-gray-500 text-sm">
                No preview available
              </div>
            )}
            {/* Hover overlay - only visible on hover */}
            <div className="absolute inset-0 bg-blue-500 opacity-0 group-hover:opacity-5 transition-opacity duration-200 pointer-events-none z-0" />
          </div>
          <div className="absolute top-2 right-2 flex gap-2 z-20">
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="bg-blue-500 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-600 hover:scale-110 active:scale-95 shadow-lg cursor-pointer"
              aria-label="Replace image"
              title="Replace image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFile(0);
              }}
              className="bg-red-500 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-600 hover:scale-110 active:scale-95 shadow-lg cursor-pointer"
              aria-label="Remove image"
              title="Remove image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 truncate" title={firstFile.name}>
            {firstFile.name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500">
            {formatFileSize(firstFile.size)}
            {showCompressionNote && ' (will be compressed to <1MB before upload)'}
          </div>
        </div>
      ) : (
        // Show uploader interface when no image is uploaded
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer min-h-[200px] flex items-center justify-center ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 scale-[1.02] shadow-lg'
              : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-750 hover:shadow-md active:scale-[0.99]'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <div className="space-y-2">
            <svg
              className={`mx-auto h-12 w-12 transition-colors duration-200 ${
                isDragging
                  ? 'text-blue-500'
                  : 'text-gray-400 group-hover:text-blue-500'
              }`}
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className={`text-sm transition-colors duration-200 ${
              isDragging
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              {isDragging ? 'Drop images here' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {acceptMultiple ? 'Multiple images' : 'Single image'}
              {showCompressionNote && ' (will be compressed to <1MB before upload)'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Show additional files if multiple upload is enabled and more than one file is selected */}
      {acceptMultiple && selectedFiles.length > 1 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {selectedFiles.slice(1).map((file, index) => (
            <div key={index + 1} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index + 1);
                }}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-600 hover:scale-110 active:scale-95 cursor-pointer shadow-lg"
                aria-label="Remove image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 truncate" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                {formatFileSize(file.size)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

