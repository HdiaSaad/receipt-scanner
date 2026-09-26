import React, { useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle,
  IonButton, IonIcon, IonSpinner, IonText,
} from '@ionic/react';
import { cameraOutline, imagesOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { useCamera } from '../../hooks/useCamera';
import { useImageCompressor } from '../../hooks/useImageCompressor';

const ScannerPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { takePhoto, pickFromGallery } = useCamera();
  const { compress } = useImageCompressor();
  const history = useHistory();

  const handleCapture = async (source: 'camera' | 'gallery') => {
    setLoading(true);
    setError(null);
    try {
      const raw = source === 'camera' ? await takePhoto() : await pickFromGallery();
      const compressed = await compress(raw);
      history.push('/scan/crop', { imageBase64: compressed });
    } catch {
      setError('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar><IonTitle>Scanner un ticket</IonTitle></IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding ion-text-center">
        {loading && (
          <div className="ion-padding">
            <IonSpinner />
            <p>Traitement en cours...</p>
          </div>
        )}
        {error && <IonText color="danger"><p>{error}</p></IonText>}

        <IonButton
          expand="block"
          size="large"
          onClick={() => handleCapture('camera')}
          disabled={loading}
          className="ion-margin-top"
        >
          <IonIcon icon={cameraOutline} slot="start" />
          Prendre une photo
        </IonButton>

        <IonButton
          expand="block"
          fill="outline"
          onClick={() => handleCapture('gallery')}
          disabled={loading}
          className="ion-margin-top"
        >
          <IonIcon icon={imagesOutline} slot="start" />
          Importer depuis la galerie
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default ScannerPage;
