import React, { useEffect, useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonSpinner,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonItem, IonLabel,
  IonRefresher, IonRefresherContent,
} from '@ionic/react';
import { api } from '../../services/api';
import StatsChart from '../../components/StatsChart';
import type { StatsResponse } from '@receipt-scanner/shared';

const StatsPage: React.FC = () => {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<StatsResponse>('/receipts/stats');
      setStats(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const onRefresh = async (e: CustomEvent) => {
    await fetchStats();
    (e.target as HTMLIonRefresherElement).complete();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar><IonTitle>Statistiques</IonTitle></IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={onRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && <div className="ion-text-center ion-padding"><IonSpinner /></div>}

        {stats && (
          <>
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Ce mois-ci</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
                  {stats.totalThisMonth.toFixed(2)} {stats.currency}
                </p>
                <p>Moyenne par ticket : {stats.averagePerReceipt.toFixed(2)} {stats.currency}</p>
              </IonCardContent>
            </IonCard>

            <IonCard>
              <IonCardHeader><IonCardTitle>Par semaine</IonCardTitle></IonCardHeader>
              <IonCardContent>
                <StatsChart data={stats.weeklyTotals} currency={stats.currency} />
              </IonCardContent>
            </IonCard>

            <IonCard>
              <IonCardHeader><IonCardTitle>Top magasins</IonCardTitle></IonCardHeader>
              {stats.topStores.map(s => (
                <IonItem key={s.store}>
                  <IonLabel>{s.store}</IonLabel>
                  <IonLabel slot="end">{s.count} tickets · {s.total.toFixed(2)} {stats.currency}</IonLabel>
                </IonItem>
              ))}
            </IonCard>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default StatsPage;
