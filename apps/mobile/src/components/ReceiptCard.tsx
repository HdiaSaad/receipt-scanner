import React from 'react';
import {
  IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonCardSubtitle, IonBadge,
} from '@ionic/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useHistory } from 'react-router-dom';
import type { Receipt } from '@receipt-scanner/shared';

interface Props { receipt: Receipt }

const ReceiptCard: React.FC<Props> = ({ receipt }) => {
  const history = useHistory();
  const dateLabel = receipt.date
    ? format(new Date(receipt.date), 'd MMM yyyy', { locale: fr })
    : 'Date inconnue';

  return (
    <IonCard onClick={() => history.push(`/receipts/${receipt.id}`)} button>
      <IonCardHeader>
        <IonCardTitle>{receipt.store ?? 'Magasin inconnu'}</IonCardTitle>
        <IonCardSubtitle>{dateLabel}</IonCardSubtitle>
      </IonCardHeader>
      <IonCardContent>
        {receipt.total != null && (
          <IonBadge color="primary">
            {receipt.total.toFixed(2)} {receipt.currency}
          </IonBadge>
        )}
      </IonCardContent>
    </IonCard>
  );
};

export default ReceiptCard;
