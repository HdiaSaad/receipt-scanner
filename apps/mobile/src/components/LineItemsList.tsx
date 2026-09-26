import React from 'react';
import { IonItem, IonLabel, IonInput, IonButton, IonIcon, IonList } from '@ionic/react';
import { addOutline, trashOutline } from 'ionicons/icons';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { useFieldArray, Control, Controller } from 'react-hook-form';

interface LineItemField {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
}

const LineItemsList: React.FC<Props> = ({ control }) => {
  const { fields, append, remove } = useFieldArray<{ lineItems: LineItemField[] }, 'lineItems'>({
    control,
    name: 'lineItems',
  });

  return (
    <IonList>
      {fields.map((field, index) => (
        <IonItem key={field.id}>
          <IonLabel position="floating">Article {index + 1}</IonLabel>
          <Controller
            control={control}
            name={`lineItems.${index}.description`}
            render={({ field: f }) => (
              <IonInput
                value={f.value}
                onIonInput={(e) => f.onChange(e.detail.value)}
                placeholder="Description"
              />
            )}
          />
          <Controller
            control={control}
            name={`lineItems.${index}.total`}
            render={({ field: f }) => (
              <IonInput
                type="number"
                value={f.value}
                onIonInput={(e) => f.onChange(parseFloat(e.detail.value ?? '0'))}
                placeholder="Total"
                slot="end"
                style={{ maxWidth: 80 }}
              />
            )}
          />
          <IonButton fill="clear" slot="end" onClick={() => remove(index)}>
            <IonIcon icon={trashOutline} />
          </IonButton>
        </IonItem>
      ))}
      <IonItem button onClick={() => append({ description: '', quantity: 1, unitPrice: 0, total: 0 })}>
        <IonIcon icon={addOutline} slot="start" />
        <IonLabel>Ajouter un article</IonLabel>
      </IonItem>
    </IonList>
  );
};

export default LineItemsList;
