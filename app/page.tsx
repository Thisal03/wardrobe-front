'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ImageUpload from '@/components/ImageUpload';
import StatusDisplay from '@/components/StatusDisplay';
import ResultGallery from '@/components/ResultGallery';
import { generateMatchingSet, checkJobStatus, type StatusResponse, type ClothingImages } from '@/lib/api/matchingSet';
import { compressImage } from '@/lib/utils/imageCompression';

type ClothingType = 'top' | 'bottom' | 'outer' | 'dress';

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
  const [currentStep, setCurrentStep] = useState<'initial' | 'adding'>('initial');
  const [selectedGeneratedImage, setSelectedGeneratedImage] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Utility function to convert image URL to File
  const urlToFile = async (url: string, filename: string = 'generated-image.png'): Promise<File> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type || 'image/png' });
  };

  // Check if any clothing is uploaded
  const hasClothingUploaded = (): boolean => {
    return topImage.length > 0 || bottomImage.length > 0 || outerImage.length > 0 || dressImage.length > 0;
  };

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

    // For initial step, require model image
    if (currentStep === 'initial' && modelImage.length === 0) {
      setError('Please select a model image');
      return;
    }

    // Check which clothing image is selected
    let selectedClothingType: ClothingType | null = null;
    let selectedClothingFile: File | null = null;

    if (topImage.length > 0) {
      selectedClothingType = 'top';
      selectedClothingFile = topImage[0];
    } else if (bottomImage.length > 0) {
      selectedClothingType = 'bottom';
      selectedClothingFile = bottomImage[0];
    } else if (outerImage.length > 0) {
      selectedClothingType = 'outer';
      selectedClothingFile = outerImage[0];
    } else if (dressImage.length > 0) {
      selectedClothingType = 'dress';
      selectedClothingFile = dressImage[0];
    }

    if (!selectedClothingFile || !selectedClothingType) {
      setError('Please select a clothing item to add');
      return;
    }

    setIsGenerating(true);
    setIsCompressing(true);

    try {
      // Get the model image (either initial or from generated result)
      let modelFile: File;
      if (currentStep === 'initial') {
        modelFile = await compressImage(modelImage[0], 1920, 1920, 0.8, 1);
      } else {
        // Use the selected generated image as the new model
        if (!selectedGeneratedImage) {
          // If no image selected, use the first one
          const imageArray = Array.isArray(generatedImages) ? generatedImages : [generatedImages];
          if (imageArray.length === 0 || !imageArray[0]) {
            throw new Error('No generated image available to continue');
          }
          const file = await urlToFile(imageArray[0], 'model-image.png');
          modelFile = await compressImage(file, 1920, 1920, 0.8, 1);
        } else {
          const file = await urlToFile(selectedGeneratedImage, 'model-image.png');
          modelFile = await compressImage(file, 1920, 1920, 0.8, 1);
        }
      }

      // Compress the clothing image
      const compressedClothing = await compressImage(selectedClothingFile, 1920, 1920, 0.8, 1);
      
      setIsCompressing(false);

      // Build clothing images object with only the selected clothing
      const clothingImages: ClothingImages = {};
      if (selectedClothingType === 'top') {
        clothingImages.top_image = compressedClothing;
      } else if (selectedClothingType === 'bottom') {
        clothingImages.bottom_image = compressedClothing;
      } else if (selectedClothingType === 'outer') {
        clothingImages.outer_image = compressedClothing;
      } else if (selectedClothingType === 'dress') {
        clothingImages.dress_image = compressedClothing;
      }

      const response = await generateMatchingSet(
        modelFile,
        clothingImages,
        numOutputs
      );

      if (response.status === 'success' && response.data.prediction_id) {
        setPredictionId(response.data.prediction_id);
        setStatus(response.data.status);
        // Clear the selected clothing after submission
        setTopImage([]);
        setBottomImage([]);
        setOuterImage([]);
        setDressImage([]);
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

  // Handle continuing to add more clothing
  const handleContinueAdding = () => {
    setCurrentStep('adding');
    // Don't clear selectedGeneratedImage - let user keep their selection or choose a different one
    // Clear all clothing uploaders
    setTopImage([]);
    setBottomImage([]);
    setOuterImage([]);
    setDressImage([]);
    // Clear status and error to show the form
    setStatus('');
    setStatusMessage('');
    setError(null);
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
    setCurrentStep('initial');
    setSelectedGeneratedImage(null);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // Handle clothing upload - clear other uploaders when one is uploaded
  const handleClothingUpload = (type: ClothingType, files: File[]) => {
    // Clear all other clothing uploaders when one is uploaded
    if (type !== 'top') setTopImage([]);
    if (type !== 'bottom') setBottomImage([]);
    if (type !== 'outer') setOuterImage([]);
    if (type !== 'dress') setDressImage([]);
    
    // Set the selected one
    switch (type) {
      case 'top':
        setTopImage(files);
        break;
      case 'bottom':
        setBottomImage(files);
        break;
      case 'outer':
        setOuterImage(files);
        break;
      case 'dress':
        setDressImage(files);
        break;
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

          {(!generatedImages || currentStep === 'adding') && !isGenerating && (
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
                      <p className="text-xs text-gray-500 dark:text-gray-400 ml-7 mt-1">
                        {currentStep === 'initial' ? 'Upload a photo of the person' : 'Using generated image as model'}
                      </p>
                    </div>
                    {currentStep === 'initial' ? (
                      <ImageUpload
                        label="Model Image (Person Photo)"
                        acceptMultiple={false}
                        onFilesChange={setModelImage}
                        selectedFiles={modelImage}
                        required
                        showCompressionNote={true}
                      />
                    ) : (
                      <div className="border-2 border-gray-300 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                          Using the generated image from the previous step as the model
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side - Clothing Images - Show all, hide others when one is uploaded */}
                <div className="space-y-4">
                  <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      Clothing Items
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 ml-7 mt-1">
                      Upload one clothing item at a time
                    </p>
                  </div>
                  
                  {!hasClothingUploaded() && (
                    <>
                      <ImageUpload
                        label="Top Image (Shirt/Top)"
                        acceptMultiple={false}
                        onFilesChange={(files) => handleClothingUpload('top', files)}
                        selectedFiles={topImage}
                        showCompressionNote={true}
                      />

                      <ImageUpload
                        label="Bottom Image (Pants/Skirt)"
                        acceptMultiple={false}
                        onFilesChange={(files) => handleClothingUpload('bottom', files)}
                        selectedFiles={bottomImage}
                        showCompressionNote={true}
                      />

                      <ImageUpload
                        label="Outer Image (Jacket/Coat)"
                        acceptMultiple={false}
                        onFilesChange={(files) => handleClothingUpload('outer', files)}
                        selectedFiles={outerImage}
                        showCompressionNote={true}
                      />

                      <ImageUpload
                        label="Dress Image (One-piece)"
                        acceptMultiple={false}
                        onFilesChange={(files) => handleClothingUpload('dress', files)}
                        selectedFiles={dressImage}
                        showCompressionNote={true}
                      />
                    </>
                  )}

                  {hasClothingUploaded() && (
                    <>
                      {topImage.length > 0 && (
                        <ImageUpload
                          label="Top Image (Shirt/Top)"
                          acceptMultiple={false}
                          onFilesChange={(files) => handleClothingUpload('top', files)}
                          selectedFiles={topImage}
                          showCompressionNote={true}
                        />
                      )}

                      {bottomImage.length > 0 && (
                        <ImageUpload
                          label="Bottom Image (Pants/Skirt)"
                          acceptMultiple={false}
                          onFilesChange={(files) => handleClothingUpload('bottom', files)}
                          selectedFiles={bottomImage}
                          showCompressionNote={true}
                        />
                      )}

                      {outerImage.length > 0 && (
                        <ImageUpload
                          label="Outer Image (Jacket/Coat)"
                          acceptMultiple={false}
                          onFilesChange={(files) => handleClothingUpload('outer', files)}
                          selectedFiles={outerImage}
                          showCompressionNote={true}
                        />
                      )}

                      {dressImage.length > 0 && (
                        <ImageUpload
                          label="Dress Image (One-piece)"
                          acceptMultiple={false}
                          onFilesChange={(files) => handleClothingUpload('dress', files)}
                          selectedFiles={dressImage}
                          showCompressionNote={true}
                        />
                      )}
                    </>
                  )}
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
                    disabled={isGenerating || (currentStep === 'initial' && modelImage.length === 0) || !hasClothingUploaded()}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg disabled:shadow-none cursor-pointer active:scale-[0.98]"
                  >
                    {isCompressing ? 'Compressing images...' : isGenerating ? 'Generating...' : currentStep === 'initial' ? 'Generate Virtual Try-On' : 'Add Clothing & Generate'}
                  </button>
                  {(modelImage.length > 0 || hasClothingUploaded() || generatedImages) && (
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
            <div className="space-y-6 mb-6">
              <ResultGallery 
                images={generatedImages} 
                onImageSelect={setSelectedGeneratedImage}
                selectedImage={selectedGeneratedImage}
              />
              {currentStep !== 'adding' && (
                <div className="flex justify-center gap-4">
                  <button
                    onClick={handleContinueAdding}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg active:scale-[0.98]"
                  >
                    Continue Adding Clothing
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 cursor-pointer active:scale-[0.98]"
                  >
                    Start Over
                  </button>
                </div>
              )}
              {currentStep === 'adding' && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-blue-800 dark:text-blue-200 font-semibold">Add More Clothing</p>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Select an image above to use as the model for the next generation, or we'll use the first image by default.
                  </p>
                </div>
              )}
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
