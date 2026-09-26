import React, { useEffect } from 'react';
import { IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import { cameraOutline, listOutline, barChartOutline, personOutline } from 'ionicons/icons';
import { useAuthStore } from './store/auth.store';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ScannerPage from './pages/scanner/ScannerPage';
import CropPage from './pages/scanner/CropPage';
import ReviewPage from './pages/scanner/ReviewPage';
import HistoryPage from './pages/history/HistoryPage';
import ReceiptDetailPage from './pages/receipts/ReceiptDetailPage';
import StatsPage from './pages/stats/StatsPage';
import ProfilePage from './pages/profile/ProfilePage';

setupIonicReact();

const App: React.FC = () => {
  const { isAuthenticated, restoreSession } = useAuthStore();

  useEffect(() => { restoreSession(); }, []);

  if (!isAuthenticated) {
    return (
      <IonApp>
        <IonReactRouter>
          <IonRouterOutlet>
            <Route exact path="/auth/login" component={LoginPage} />
            <Route exact path="/auth/register" component={RegisterPage} />
            <Redirect to="/auth/login" />
          </IonRouterOutlet>
        </IonReactRouter>
      </IonApp>
    );
  }

  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet>
          <Route exact path="/scan/crop" component={CropPage} />
          <Route exact path="/scan/review" component={ReviewPage} />
          <Route exact path="/receipts/:id" component={ReceiptDetailPage} />
        </IonRouterOutlet>
        <IonTabs>
          <IonRouterOutlet>
            <Route exact path="/scanner" component={ScannerPage} />
            <Route exact path="/history" component={HistoryPage} />
            <Route exact path="/stats" component={StatsPage} />
            <Route exact path="/profile" component={ProfilePage} />
            <Redirect exact from="/" to="/scanner" />
          </IonRouterOutlet>
          <IonTabBar slot="bottom">
            <IonTabButton tab="scanner" href="/scanner">
              <IonIcon icon={cameraOutline} />
              <IonLabel>Scanner</IonLabel>
            </IonTabButton>
            <IonTabButton tab="history" href="/history">
              <IonIcon icon={listOutline} />
              <IonLabel>Historique</IonLabel>
            </IonTabButton>
            <IonTabButton tab="stats" href="/stats">
              <IonIcon icon={barChartOutline} />
              <IonLabel>Statistiques</IonLabel>
            </IonTabButton>
            <IonTabButton tab="profile" href="/profile">
              <IonIcon icon={personOutline} />
              <IonLabel>Profil</IonLabel>
            </IonTabButton>
          </IonTabBar>
        </IonTabs>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
