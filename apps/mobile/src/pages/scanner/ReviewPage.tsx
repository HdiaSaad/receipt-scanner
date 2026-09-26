import React, { useEffect, useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonItem, IonLabel, IonInput, IonSpinner, IonText, IonList, IonListHeader,
} from '@ionic/react';
import { useForm } from 'react-hook-form';
import { useHistory, useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import { useReceiptsStore } from '../../store/receipts.store';
import LineItemsList from '../../components/LineItemsList';
import type { ScanResponse, CreateReceiptRequest, Receipt } from '@receipt-scanner/shared';

interface LocationState { imageBase64: string }

interface FormValues {
  store: string;
  date: string;
  total: string;
  currency: string;
  tax: string;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
}

const ReviewPage: React.FC = () => {
  const location = useLocation<LocationState>();
  const history = useHistory();
  const { addReceipt } = useReceiptsStore();
  const [scanning, setScanning] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [scanResponse, setScanResponse] = useState<ScanResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, control } = useForm<FormValues>({
    defaultValues: { currency: 'EUR', lineItems: [] },
  });

  useEffect(() => {
    const { imageBase64 } = location.state ?? {};
    if (!imageBase64) { history.replace('/scanner'); return; }

    (async () => {
      try {
        const { data } = await api.post<ScanResponse>('/receipts/scan', { imageBase64 });
        setImageUrl(data.imageUrl);
        setScanResponse(data);
        const r = data.ocrResult;
        reset({
          store: r.store ?? '',
          date: r.date ?? '',
          total: r.total?.toString() ?? '',
          currency: r.currency ?? 'EUR',
          tax: r.tax?.toString() ?? '',
          lineItems: r.lineItems.map(i => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.total,
          })),
        });
        if (r.confidence < 0.4) {
          setScanError('Image peu lisible. Vérifiez et corrigez les informations.');
        }
      } catch {
        setScanError('OCR échoué. Remplissez les informations manuellement.');
      } finally {
        setScanning(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onSave = async (values: FormValues) => {
    setSaving(true);
    try {
      const payload: CreateReceiptRequest = {
        store: values.store || null,
        date: values.date || null,
        total: values.total ? parseFloat(values.total) : null,
        currency: values.currency || 'EUR',
        tax: values.tax ? parseFloat(values.tax) : null,
        imageUrl,
        rawOcr: scanResponse ? JSON.stringify(scanResponse.ocrResult) : '{}',
        lineItems: values.lineItems,
      };
      const { data } = await api.post<Receipt>('/receipts', payload);
      addReceipt(data);
      history.replace('/history');
    } catch {
      setSaveError('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  if (scanning) {
    return (
      <IonPage>
        <IonContent className="ion-text-center ion-padding">
          <IonSpinner />
          <p>Analyse du ticket en cours...</p>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Vérifier les informations</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={() => history.goBack()}>Annuler</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {scanError && (
          <IonText color="warning" className="ion-padding">
            <p>{scanError}</p>
          </IonText>
        )}
        {saveError && (
          <IonText color="danger" className="ion-padding">
            <p>{saveError}</p>
          </IonText>
        )}
        <form onSubmit={handleSubmit(onSave)}>
          <IonList>
            <IonListHeader><IonLabel>Informations générales</IonLabel></IonListHeader>
            <IonItem>
              <IonLabel position="floating">Magasin</IonLabel>
              <IonInput {...register('store')} />
            </IonItem>
            <IonItem>
              <IonLabel position="floating">Date (YYYY-MM-DD)</IonLabel>
              <IonInput type="date" {...register('date')} />
            </IonItem>
            <IonItem>
              <IonLabel position="floating">Total</IonLabel>
              <IonInput type="number" step="0.01" {...register('total')} />
            </IonItem>
            <IonItem>
              <IonLabel position="floating">Devise</IonLabel>
              <IonInput {...register('currency')} />
            </IonItem>
            <IonItem>
              <IonLabel position="floating">TVA</IonLabel>
              <IonInput type="number" step="0.01" {...register('tax')} />
            </IonItem>

            <IonListHeader><IonLabel>Articles</IonLabel></IonListHeader>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <LineItemsList control={control as unknown as any} />
          </IonList>

          <div className="ion-padding">
            <IonButton expand="block" type="submit" disabled={saving}>
              {saving ? <IonSpinner /> : 'Sauvegarder'}
            </IonButton>
          </div>
        </form>
      </IonContent>
    </IonPage>
  );
};

export default ReviewPage;
