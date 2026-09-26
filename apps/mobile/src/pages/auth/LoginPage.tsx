import React, { useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle,
  IonItem, IonLabel, IonInput, IonButton, IonText, IonSpinner,
} from '@ionic/react';
import { useForm } from 'react-hook-form';
import { useHistory } from 'react-router-dom';
import { SignInWithApple, SignInWithAppleOptions } from '@capacitor-community/apple-sign-in';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import type { LoginRequest, AuthResponse, AppleSignInRequest } from '@receipt-scanner/shared';

interface FormValues { email: string; password: string; }

const LoginPage: React.FC = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const history = useHistory();

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<AuthResponse>('/auth/login', values as LoginRequest);
      await login(data);
      history.replace('/scanner');
    } catch {
      setError('Email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  const onAppleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const options: SignInWithAppleOptions = {
        clientId: import.meta.env.VITE_APPLE_CLIENT_ID ?? 'com.yourapp.receiptscanner',
        redirectURI: import.meta.env.VITE_APPLE_REDIRECT_URI ?? '',
        scopes: 'email name',
      };
      const result = await SignInWithApple.authorize(options);
      const payload: AppleSignInRequest = {
        identityToken: result.response.identityToken,
        email: result.response.email,
        givenName: result.response.givenName,
        familyName: result.response.familyName,
      };
      const { data } = await api.post<AuthResponse>('/auth/apple', payload);
      await login(data);
      history.replace('/scanner');
    } catch {
      setError('Connexion Apple échouée.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Connexion</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <form onSubmit={handleSubmit(onSubmit)}>
          <IonItem>
            <IonLabel position="floating">Email</IonLabel>
            <IonInput type="email" {...register('email', { required: true })} />
          </IonItem>
          {errors.email && <IonText color="danger"><p>Email requis</p></IonText>}

          <IonItem>
            <IonLabel position="floating">Mot de passe</IonLabel>
            <IonInput type="password" {...register('password', { required: true })} />
          </IonItem>
          {errors.password && <IonText color="danger"><p>Mot de passe requis</p></IonText>}

          {error && <IonText color="danger"><p>{error}</p></IonText>}

          <IonButton expand="block" type="submit" disabled={loading} className="ion-margin-top">
            {loading ? <IonSpinner /> : 'Se connecter'}
          </IonButton>
        </form>

        <IonButton expand="block" fill="outline" onClick={onAppleSignIn} disabled={loading}>
          Se connecter avec Apple
        </IonButton>

        <IonButton expand="block" fill="clear" routerLink="/auth/register">
          Créer un compte
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
