import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonSearchbar,
  IonRefresher, IonRefresherContent, IonInfiniteScroll, IonInfiniteScrollContent,
  IonSpinner, IonText,
} from '@ionic/react';
import { api } from '../../services/api';
import { useReceiptsStore } from '../../store/receipts.store';
import ReceiptCard from '../../components/ReceiptCard';
import type { ReceiptsListResponse } from '@receipt-scanner/shared';

const LIMIT = 20;

const HistoryPage: React.FC = () => {
  const { receipts, total, setReceipts } = useReceiptsStore();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const infiniteRef = useRef<HTMLIonInfiniteScrollElement>(null);

  const fetchReceipts = useCallback(async (pageNum: number, query: string, replace: boolean) => {
    setLoading(true);
    try {
      const { data } = await api.get<ReceiptsListResponse>('/receipts', {
        params: { page: pageNum, limit: LIMIT, search: query || undefined },
      });
      if (replace) {
        setReceipts(data.receipts, data.total);
      } else {
        setReceipts([...receipts, ...data.receipts], data.total);
      }
      setHasMore(data.receipts.length === LIMIT);
    } finally {
      setLoading(false);
    }
  }, [receipts, setReceipts]);

  useEffect(() => {
    setPage(1);
    fetchReceipts(1, search, true);
  }, [search]);

  const onRefresh = async (e: CustomEvent) => {
    setPage(1);
    await fetchReceipts(1, search, true);
    (e.target as HTMLIonRefresherElement).complete();
  };

  const onInfinite = async (e: CustomEvent) => {
    const next = page + 1;
    setPage(next);
    await fetchReceipts(next, search, false);
    infiniteRef.current?.complete();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar><IonTitle>Historique</IonTitle></IonToolbar>
        <IonToolbar>
          <IonSearchbar
            value={search}
            onIonInput={(e) => setSearch(e.detail.value ?? '')}
            placeholder="Rechercher un magasin..."
            debounce={400}
          />
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={onRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && receipts.length === 0 && (
          <div className="ion-text-center ion-padding"><IonSpinner /></div>
        )}

        {!loading && receipts.length === 0 && (
          <IonText color="medium" className="ion-text-center ion-padding">
            <p>Aucun ticket trouvé.</p>
          </IonText>
        )}

        {receipts.map(r => <ReceiptCard key={r.id} receipt={r} />)}

        <IonInfiniteScroll ref={infiniteRef} disabled={!hasMore} onIonInfinite={onInfinite}>
          <IonInfiniteScrollContent loadingText="Chargement..." />
        </IonInfiniteScroll>
      </IonContent>
    </IonPage>
  );
};

export default HistoryPage;
