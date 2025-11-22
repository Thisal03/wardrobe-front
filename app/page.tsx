'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ImageUpload from '@/components/ImageUpload';
import StatusDisplay from '@/components/StatusDisplay';
import ResultGallery from '@/components/ResultGallery';
import { generateMatchingSet, checkJobStatus, type StatusResponse, type ClothingImages } from '@/lib/api/matchingSet';
import { compressImage } from '@/lib/utils/imageCompression';

export default function Home() {
  const [modelImage, setModelImage] = useState<File[]>([]);
  const [topImage, setTopImage] = useState<File[]>([]);
  const [bottomImage, setBottomImage] = useState<File[]>([]);
  const [outerImage, setOuterImage] = useState<File[]>([]);
  const [dressImage, setDressImage] = useState<File[]>([]);
  const [numOutputs, setNumOutputs] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [generatedImages, setGeneratedImages] = useState<string | string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const startPolling = useCallback((id: string) => {
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    const poll = async () => {
      try {
        const response: StatusResponse = await checkJobStatus(id);
        const currentStatus = response.data.status;
        setStatus(currentStatus);
        setStatusMessage(response.message || '');

        if (response.data.output) {
          setGeneratedImages(response.data.output);
        }

        if (response.data.error) {
          setError(response.data.error);
          setIsGenerating(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          return;
        }

        // Stop polling if job is complete
        if (['succeeded', 'failed', 'canceled'].includes(currentStatus)) {
          setIsGenerating(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      } catch (err) {
        console.error('Error polling status:', err);
        setError(err instanceof Error ? err.message : 'Failed to check job status');
        setIsGenerating(false);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    };

    // Poll immediately, then every 3 seconds
    poll();
    pollingIntervalRef.current = setInterval(poll, 3000);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setGeneratedImages(null);
    setStatus('');
    setStatusMessage('');

    if (modelImage.length === 0) {
      setError('Please select a model image');
      return;
    }

    // Check if at least one clothing image is selected
    const hasClothingImage = topImage.length > 0 || bottomImage.length > 0 || 
                              outerImage.length > 0 || dressImage.length > 0;
    
    if (!hasClothingImage) {
      setError('Please select at least one clothing image (top, bottom, outer, or dress)');
      return;
    }

    setIsGenerating(true);
    setIsCompressing(true);

    try {
      // Compress all images before sending
      const compressionPromises: Promise<File>[] = [
        compressImage(modelImage[0], 1920, 1920, 0.8, 1),
      ];

      const clothingTypes: Array<{ type: keyof ClothingImages; files: File[] }> = [
        { type: 'top_image', files: topImage },
        { type: 'bottom_image', files: bottomImage },
        { type: 'outer_image', files: outerImage },
        { type: 'dress_image', files: dressImage },
      ];

      for (const { files } of clothingTypes) {
        if (files.length > 0) {
          compressionPromises.push(compressImage(files[0], 1920, 1920, 0.8, 1));
        }
      }

      const compressedImages = await Promise.all(compressionPromises);
      
      setIsCompressing(false);

      // Build clothing images object
      const clothingImages: ClothingImages = {};
      let compressedIndex = 1; // Start after model image

      if (topImage.length > 0) {
        clothingImages.top_image = compressedImages[compressedIndex++];
      }
      if (bottomImage.length > 0) {
        clothingImages.bottom_image = compressedImages[compressedIndex++];
      }
      if (outerImage.length > 0) {
        clothingImages.outer_image = compressedImages[compressedIndex++];
      }
      if (dressImage.length > 0) {
        clothingImages.dress_image = compressedImages[compressedIndex++];
      }

      const response = await generateMatchingSet(
        compressedImages[0], // Model image
        clothingImages,
        numOutputs
      );

      if (response.status === 'success' && response.data.prediction_id) {
        setPredictionId(response.data.prediction_id);
        setStatus(response.data.status);
        startPolling(response.data.prediction_id);
      } else {
        throw new Error(response.message || 'Failed to start generation');
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start generation');
      setIsGenerating(false);
      setIsCompressing(false);
    }
  };

  const handleReset = () => {
    setModelImage([]);
    setTopImage([]);
    setBottomImage([]);
    setOuterImage([]);
    setDressImage([]);
    setNumOutputs(1);
    setPredictionId(null);
    setStatus('');
    setStatusMessage('');
    setGeneratedImages(null);
    setError(null);
    setIsGenerating(false);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Virtual Try-On Generator
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Upload a model image and clothing items to generate virtual try-on results
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {status && (
            <div className="mb-6 flex justify-center">
              <StatusDisplay status={status} message={statusMessage} />
            </div>
          )}

          {!generatedImages && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Two-column layout: Model on left, Clothes on right */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                {/* Left side - Model Image */}
                <div className="space-y-4">
                  <div className="sticky top-4">
                    <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Model Photo
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 ml-7 mt-1">Upload a photo of the person</p>
                    </div>
                    <ImageUpload
                      label="Model Image (Person Photo)"
                      acceptMultiple={false}
                      onFilesChange={setModelImage}
                      selectedFiles={modelImage}
                      required
                      showCompressionNote={true}
                    />
                  </div>
                </div>

                {/* Right side - Clothing Images stacked vertically */}
                <div className="space-y-4">
                  <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      Clothing Items
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 ml-7 mt-1">Upload at least one clothing item (optional)</p>
                  </div>
                  
                  <ImageUpload
                    label="Top Image (Shirt/Top)"
                    acceptMultiple={false}
                    onFilesChange={setTopImage}
                    selectedFiles={topImage}
                    showCompressionNote={true}
                  />

                  <ImageUpload
                    label="Bottom Image (Pants/Skirt)"
                    acceptMultiple={false}
                    onFilesChange={setBottomImage}
                    selectedFiles={bottomImage}
                    showCompressionNote={true}
                  />

                  <ImageUpload
                    label="Outer Image (Jacket/Coat)"
                    acceptMultiple={false}
                    onFilesChange={setOuterImage}
                    selectedFiles={outerImage}
                    showCompressionNote={true}
                  />

                  <ImageUpload
                    label="Dress Image (One-piece)"
                    acceptMultiple={false}
                    onFilesChange={setDressImage}
                    selectedFiles={dressImage}
                    showCompressionNote={true}
                  />
                </div>
              </div>

              {/* Number of Outputs and Action Buttons */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                {/* <div className="mb-6">
                  <label htmlFor="num_outputs" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Number of Outputs
                  </label>
                  <select
                    id="num_outputs"
                    value={numOutputs}
                    onChange={(e) => setNumOutputs(parseInt(e.target.value, 10))}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer transition-all hover:border-gray-400 dark:hover:border-gray-600"
                  >
                    <option value={1}>1 output</option>
                    <option value={2}>2 outputs</option>
                    <option value={3}>3 outputs</option>
                    <option value={4}>4 outputs</option>
                  </select>
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    Select how many variations to generate (1-4)
                  </p>
                </div> */}

                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={isGenerating || modelImage.length === 0 || (!topImage.length && !bottomImage.length && !outerImage.length && !dressImage.length)}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg disabled:shadow-none cursor-pointer active:scale-[0.98]"
                  >
                    {isCompressing ? 'Compressing images...' : isGenerating ? 'Generating...' : 'Generate Virtual Try-On'}
                  </button>
                  {(modelImage.length > 0 || topImage.length > 0 || bottomImage.length > 0 || outerImage.length > 0 || dressImage.length > 0) && (
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={isGenerating}
                      className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer active:scale-[0.98]"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}

          {generatedImages && (
            <div className="space-y-6">
              <ResultGallery images={generatedImages} />
              <div className="flex justify-center">
                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg active:scale-[0.98]"
                >
                  Generate Another
                </button>
              </div>
            </div>
          )}
        </div>

        {(isCompressing || isGenerating) && (
          <div className="mt-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              {isCompressing 
                ? 'Compressing images for upload...' 
                : 'Processing your images... This may take a few minutes.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
