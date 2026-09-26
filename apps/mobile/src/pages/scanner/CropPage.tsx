import React, { useRef } from 'react';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonButtons,
  IonFooter,
} from '@ionic/react';
import Cropper, { ReactCropperElement } from 'react-cropper';
import { useHistory, useLocation } from 'react-router-dom';
import 'cropperjs/dist/cropper.css';

interface LocationState {
  imageBase64: string;
}

const CropPage: React.FC = () => {
  const history = useHistory();
  const location = useLocation<LocationState>();
  const cropperRef = useRef<ReactCropperElement>(null);

  if (!location.state?.imageBase64) {
    history.replace('/scanner');
    return null;
  }

  const { imageBase64 } = location.state;

  const onConfirm = () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    const dataUrl = cropper
      .getCroppedCanvas({
        maxWidth: 1920,
        maxHeight: 1920,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      })
      .toDataURL('image/jpeg', 0.8);
    const croppedBase64 = dataUrl.split(',')[1];
    history.replace('/scan/review', { imageBase64: croppedBase64 });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => history.goBack()}>Annuler</IonButton>
          </IonButtons>
          <IonTitle>Recadrer</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <Cropper
          ref={cropperRef}
          src={`data:image/jpeg;base64,${imageBase64}`}
          style={{ height: '100%', width: '100%' }}
          guides={true}
          autoCropArea={0.9}
          viewMode={1}
        />
      </IonContent>
      <IonFooter>
        <IonToolbar>
          <IonButton expand="block" onClick={onConfirm}>
            Confirmer
          </IonButton>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
};

export default CropPage;
