import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export function useCamera() {
  async function takePhoto(): Promise<string> {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      correctOrientation: true,
    });
    return photo.base64String!;
  }

  async function pickFromGallery(): Promise<string> {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
      correctOrientation: true,
    });
    return photo.base64String!;
  }

  return { takePhoto, pickFromGallery };
}
