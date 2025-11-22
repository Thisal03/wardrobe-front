const SUPABASE_FUNCTION_URL = process.env.NEXT_PUBLIC_SUPABASE_URL 
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-matching-set`
  : '';

export interface GenerateMatchingSetResponse {
  status: string;
  message: string;
  data: {
    prediction_id: string;
    status: string;
    model_image_url: string;
    clothing_images: {
      top_image?: string;
      bottom_image?: string;
      outer_image?: string;
      dress_image?: string;
    };
    num_outputs: number;
    webhook_url: string;
    note: string;
  };
}

export interface StatusResponse {
  status: string;
  message: string;
  data: {
    prediction_id: string;
    status: string;
    output: string | string[] | null;
    error: string | null;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
  };
}

export interface ClothingImages {
  top_image?: File;
  bottom_image?: File;
  outer_image?: File;
  dress_image?: File;
}

/**
 * Generate matching set by uploading images using vella-1.5 model
 */
export async function generateMatchingSet(
  modelImage: File,
  clothingImages: ClothingImages,
  numOutputs: number = 1
): Promise<GenerateMatchingSetResponse> {
  if (!SUPABASE_FUNCTION_URL) {
    throw new Error('Supabase function URL is not configured');
  }

  const formData = new FormData();
  
  // Use model_image (backend also accepts base_image as fallback)
  formData.append('model_image', modelImage);
  
  // Add clothing type images
  if (clothingImages.top_image) {
    formData.append('top_image', clothingImages.top_image);
  }
  if (clothingImages.bottom_image) {
    formData.append('bottom_image', clothingImages.bottom_image);
  }
  if (clothingImages.outer_image) {
    formData.append('outer_image', clothingImages.outer_image);
  }
  if (clothingImages.dress_image) {
    formData.append('dress_image', clothingImages.dress_image);
  }
  
  // Add num_outputs (1-4)
  if (numOutputs >= 1 && numOutputs <= 4) {
    formData.append('num_outputs', numOutputs.toString());
  }

  const response = await fetch(`${SUPABASE_FUNCTION_URL}/remix-images`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Check the status of a matching set generation job
 */
export async function checkJobStatus(predictionId: string): Promise<StatusResponse> {
  if (!SUPABASE_FUNCTION_URL) {
    throw new Error('Supabase function URL is not configured');
  }

  const response = await fetch(`${SUPABASE_FUNCTION_URL}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prediction_id: predictionId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

