import React, { useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle,
  IonItem, IonLabel, IonInput, IonButton, IonText, IonSpinner,
} from '@ionic/react';
import { useForm } from 'react-hook-form';
import { useHistory } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import type { RegisterRequest, AuthResponse } from '@receipt-scanner/shared';

interface FormValues { email: string; password: string; confirm: string; }

const RegisterPage: React.FC = () => {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const history = useHistory();

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    setError(null);
    try {
      const payload: RegisterRequest = { email: values.email, password: values.password };
      const { data } = await api.post<AuthResponse>('/auth/register', payload);
      await login(data);
      history.replace('/scanner');
    } catch (e: unknown) {
      const msg = (e as { response?: { status?: number } })?.response?.status === 409
        ? 'Cet email est déjà utilisé.'
        : 'Erreur lors de la création du compte.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar><IonTitle>Créer un compte</IonTitle></IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <form onSubmit={handleSubmit(onSubmit)}>
          <IonItem>
            <IonLabel position="floating">Email</IonLabel>
            <IonInput type="email" {...register('email', { required: true })} />
          </IonItem>

          <IonItem>
            <IonLabel position="floating">Mot de passe</IonLabel>
            <IonInput type="password" {...register('password', { required: true, minLength: 8 })} />
          </IonItem>
          {errors.password && <IonText color="danger"><p>Minimum 8 caractères</p></IonText>}

          <IonItem>
            <IonLabel position="floating">Confirmer le mot de passe</IonLabel>
            <IonInput type="password" {...register('confirm', {
              validate: (v) => v === watch('password') || 'Les mots de passe ne correspondent pas',
            })} />
          </IonItem>
          {errors.confirm && <IonText color="danger"><p>{errors.confirm.message}</p></IonText>}

          {error && <IonText color="danger"><p>{error}</p></IonText>}

          <IonButton expand="block" type="submit" disabled={loading} className="ion-margin-top">
            {loading ? <IonSpinner /> : 'Créer mon compte'}
          </IonButton>
        </form>
        <IonButton expand="block" fill="clear" routerLink="/auth/login">
          Déjà un compte ? Se connecter
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default RegisterPage;
