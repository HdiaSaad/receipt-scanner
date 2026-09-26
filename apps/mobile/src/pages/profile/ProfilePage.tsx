import React, { useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle,
  IonList, IonItem, IonLabel, IonButton, IonAlert, IonAvatar, IonIcon,
} from '@ionic/react';
import { personCircleOutline, logOutOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';

const ProfilePage: React.FC = () => {
  const { user, logout } = useAuthStore();
  const history = useHistory();
  const [showLogoutAlert, setShowLogoutAlert] = useState(false);

  const onLogout = async () => {
    await logout();
    history.replace('/auth/login');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar><IonTitle>Profil</IonTitle></IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="ion-text-center ion-padding">
          <IonIcon icon={personCircleOutline} style={{ fontSize: '80px', color: 'var(--ion-color-medium)' }} />
          <p style={{ margin: '8px 0 0' }}>{user?.email ?? 'Utilisateur Apple'}</p>
        </div>

        <IonList>
          <IonItem>
            <IonLabel>
              <h2>Email</h2>
              <p>{user?.email ?? '—'}</p>
            </IonLabel>
          </IonItem>
        </IonList>

        <div className="ion-padding">
          <IonButton
            expand="block"
            fill="outline"
            color="danger"
            onClick={() => setShowLogoutAlert(true)}
          >
            <IonIcon icon={logOutOutline} slot="start" />
            Se déconnecter
          </IonButton>
        </div>

        <IonAlert
          isOpen={showLogoutAlert}
          header="Se déconnecter ?"
          buttons={[
            { text: 'Annuler', role: 'cancel', handler: () => setShowLogoutAlert(false) },
            { text: 'Se déconnecter', role: 'destructive', handler: onLogout },
          ]}
          onDidDismiss={() => setShowLogoutAlert(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default ProfilePage;
