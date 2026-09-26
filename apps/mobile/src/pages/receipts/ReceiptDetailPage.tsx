import React, { useEffect, useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonIcon, IonItem, IonLabel, IonInput, IonSpinner, IonAlert, IonImg,
  IonBackButton, IonList, IonListHeader,
} from '@ionic/react';
import { trashOutline, createOutline, saveOutline } from 'ionicons/icons';
import { useParams, useHistory } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '../../services/api';
import { useReceiptsStore } from '../../store/receipts.store';
import type { Receipt, UpdateReceiptRequest } from '@receipt-scanner/shared';

interface FormValues { store: string; date: string; total: string; currency: string; tax: string; }

const ReceiptDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const { updateReceipt, removeReceipt } = useReceiptsStore();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [editing, setEditing] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset } = useForm<FormValues>();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<Receipt>(`/receipts/${id}`);
        setReceipt(data);
        reset({
          store: data.store ?? '',
          date: data.date ?? '',
          total: data.total?.toString() ?? '',
          currency: data.currency,
          tax: data.tax?.toString() ?? '',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const onSave = async (values: FormValues) => {
    setSaving(true);
    try {
      const payload: UpdateReceiptRequest = {
        store: values.store || null,
        date: values.date || null,
        total: values.total ? parseFloat(values.total) : null,
        currency: values.currency || 'EUR',
        tax: values.tax ? parseFloat(values.tax) : null,
      };
      const { data } = await api.put<Receipt>(`/receipts/${id}`, payload);
      setReceipt(data);
      updateReceipt(data);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    await api.delete(`/receipts/${id}`);
    removeReceipt(id);
    history.replace('/history');
  };

  if (loading) return <IonPage><IonContent className="ion-text-center ion-padding"><IonSpinner /></IonContent></IonPage>;
  if (!receipt) return <IonPage><IonContent><p>Ticket introuvable</p></IonContent></IonPage>;

  const dateLabel = receipt.date
    ? format(new Date(receipt.date), 'd MMMM yyyy', { locale: fr })
    : 'Date inconnue';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/history" /></IonButtons>
          <IonTitle>{receipt.store ?? 'Ticket'}</IonTitle>
          <IonButtons slot="end">
            {editing ? (
              <IonButton onClick={handleSubmit(onSave)} disabled={saving}>
                <IonIcon icon={saveOutline} />
              </IonButton>
            ) : (
              <>
                <IonButton onClick={() => setEditing(true)}>
                  <IonIcon icon={createOutline} />
                </IonButton>
                <IonButton color="danger" onClick={() => setShowDeleteAlert(true)}>
                  <IonIcon icon={trashOutline} />
                </IonButton>
              </>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {receipt.imageUrl && (
          <IonImg src={receipt.imageUrl} style={{ maxHeight: 200, objectFit: 'contain' }} />
        )}
        <IonList>
          <IonListHeader><IonLabel>Informations</IonLabel></IonListHeader>
          <IonItem>
            <IonLabel position="floating">Magasin</IonLabel>
            {editing
              ? <IonInput {...register('store')} />
              : <IonLabel slot="end">{receipt.store ?? '—'}</IonLabel>}
          </IonItem>
          <IonItem>
            <IonLabel position="floating">Date</IonLabel>
            {editing
              ? <IonInput type="date" {...register('date')} />
              : <IonLabel slot="end">{dateLabel}</IonLabel>}
          </IonItem>
          <IonItem>
            <IonLabel position="floating">Total</IonLabel>
            {editing
              ? <IonInput type="number" step="0.01" {...register('total')} />
              : <IonLabel slot="end">{receipt.total?.toFixed(2)} {receipt.currency}</IonLabel>}
          </IonItem>
          <IonItem>
            <IonLabel position="floating">TVA</IonLabel>
            {editing
              ? <IonInput type="number" step="0.01" {...register('tax')} />
              : <IonLabel slot="end">{receipt.tax?.toFixed(2) ?? '—'}</IonLabel>}
          </IonItem>

          {receipt.lineItems.length > 0 && (
            <>
              <IonListHeader><IonLabel>Articles</IonLabel></IonListHeader>
              {receipt.lineItems.map(item => (
                <IonItem key={item.id}>
                  <IonLabel>{item.description}</IonLabel>
                  <IonLabel slot="end">{item.total.toFixed(2)} {receipt.currency}</IonLabel>
                </IonItem>
              ))}
            </>
          )}
        </IonList>

        <IonAlert
          isOpen={showDeleteAlert}
          header="Supprimer ce ticket ?"
          message="Cette action est irréversible."
          buttons={[
            { text: 'Annuler', role: 'cancel', handler: () => setShowDeleteAlert(false) },
            { text: 'Supprimer', role: 'destructive', handler: onDelete },
          ]}
          onDidDismiss={() => setShowDeleteAlert(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default ReceiptDetailPage;
