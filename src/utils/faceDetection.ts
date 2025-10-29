import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;

export async function loadFaceDetectionModels() {
  if (modelsLoaded) return;
  
  const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
  
  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    console.log('Face detection models loaded successfully');
  } catch (error) {
    console.error('Error loading face detection models:', error);
    throw new Error('Failed to load face detection models');
  }
}

export async function detectFaceAndGetDescriptor(imageElement: HTMLImageElement): Promise<Float32Array | null> {
  if (!modelsLoaded) {
    await loadFaceDetectionModels();
  }

  const detection = await faceapi
    .detectSingleFace(imageElement)
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection?.descriptor || null;
}

export async function detectAllFacesAndGetDescriptors(imageElement: HTMLImageElement): Promise<Float32Array[]> {
  if (!modelsLoaded) {
    await loadFaceDetectionModels();
  }

  const detections = await faceapi
    .detectAllFaces(imageElement)
    .withFaceLandmarks()
    .withFaceDescriptors();

  return detections.map(d => d.descriptor);
}

export function calculateFaceSimilarity(descriptor1: Float32Array, descriptor2: Float32Array): number {
  return faceapi.euclideanDistance(descriptor1, descriptor2);
}

export function isFaceMatch(similarity: number, threshold: number = 0.6): boolean {
  // Lower euclidean distance means better match
  return similarity < threshold;
}

export async function imageUrlToElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function blobToImageElement(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  const img = await imageUrlToElement(url);
  URL.revokeObjectURL(url);
  return img;
}
