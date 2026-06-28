// Servicio de notificaciones locales para productos próximos a vencer (HU-10)
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { DespensaItemData } from './despensa';


// Configuracion cuando la app está en primer plano para las nmotifiaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const EXPIRY_NOTIFICATION_PREFIX = 'rechipe-expiry-';
const DAYS_BEFORE_EXPIRY = 2;






//Permisos
export async function requestNotificationPermissions(): Promise<boolean> {
  const existingPermissions = await Notifications.getPermissionsAsync() as any;

  if (existingPermissions.granted || existingPermissions.status === 'granted') return true;

  const newPermissions = await Notifications.requestPermissionsAsync() as any;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('expiry-alerts', {
      name: 'Alertas de vencimiento',
      description: 'Notificaciones cuando un producto está próximo a vencer',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return newPermissions.granted || newPermissions.status === 'granted';
}













// Utilidades

//Calcula los días restantes hasta la fecha de vencimiento
export function daysUntilExpiry(fechaVencimiento: string | undefined | null): number | null {
  if (!fechaVencimiento) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(fechaVencimiento);
  expiry.setHours(0, 0, 0, 0);

  if (isNaN(expiry.getTime())) return null;

  const diffMs = expiry.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

//determina el estado de vencimiento de un producto
export function getExpiryStatus(fechaVencimiento: string | undefined | null): 'expired' | 'expiring' | 'ok' | null {
  const days = daysUntilExpiry(fechaVencimiento);
  if (days === null) return null;
  if (days < 0) return 'expired';
  if (days <= DAYS_BEFORE_EXPIRY) return 'expiring';
  return 'ok';
}

//Genera el texto descriptivo del estado de vencimiento
export function getExpiryLabel(fechaVencimiento: string | undefined | null): string | null {
  const days = daysUntilExpiry(fechaVencimiento);
  if (days === null) return null;
  if (days < 0) return 'Vencido';
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  if (days <= DAYS_BEFORE_EXPIRY) return `Vence en ${days} días`;
  return null;
}

//PROGRAMACION DE NOTIFICACIONES
//Cancela todas las notificaciones de vencimiento previamente programadas
async function cancelAllExpiryNotifications(): Promise<void> {
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

  for (const notification of scheduledNotifications) {
    if (notification.identifier.startsWith(EXPIRY_NOTIFICATION_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
}

//Programa notificaciones locales para los productos que vencen pronto
export async function scheduleExpiryNotifications(items: DespensaItemData[]): Promise<void> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  //Cancelar notificaciones previas para evitar duplicados
  await cancelAllExpiryNotifications();

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (const item of items) {
    if (!item.fecha_vencimiento) continue;

    const expiryDate = new Date(item.fecha_vencimiento);
    expiryDate.setHours(0, 0, 0, 0);

    if (isNaN(expiryDate.getTime())) continue;

    const days = daysUntilExpiry(item.fecha_vencimiento);
    if (days === null) continue;

    //Si ya venció o vence hoy, notificar inmediatamente
    if (days <= 0) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${EXPIRY_NOTIFICATION_PREFIX}${item.id}`,
        content: {
          title: days < 0 ? 'Producto vencido' : 'Vence hoy!',
          body: days < 0
            ? `${item.nombre_producto} ya venció. Revisa tu despensa.`
            : `${item.nombre_producto} vence hoy.`,
          data: { itemId: item.id, type: 'expiry' },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 5,
        },
      });
      continue;
    }

    //Si vence en los próximos 2 dias se envia noti al dia siguiente a las 9AM
    if (days <= DAYS_BEFORE_EXPIRY) {
      //Notificar 2 dias antes a las 9:00 AM
      const notifyDate = new Date(expiryDate);
      notifyDate.setDate(notifyDate.getDate() - DAYS_BEFORE_EXPIRY);
      notifyDate.setHours(9, 0, 0, 0);

      //Si la fecha de notificación ya paso, notificar inmediatamente
      if (notifyDate.getTime() <= Date.now()) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${EXPIRY_NOTIFICATION_PREFIX}${item.id}`,
          content: {
            title: 'Producto próximo a vencer',
            body: `${item.nombre_producto} vence en ${days} día${days > 1 ? 's' : ''}.`,
            data: { itemId: item.id, type: 'expiry' },
            sound: 'default',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 5,
          },
        });
      } else {
        //Programar para la fecha calculada
        const secondsUntilNotify = Math.floor((notifyDate.getTime() - Date.now()) / 1000);
        if (secondsUntilNotify > 0) {
          await Notifications.scheduleNotificationAsync({
            identifier: `${EXPIRY_NOTIFICATION_PREFIX}${item.id}`,
            content: {
              title: 'Producto próximo a vencer',
              body: `${item.nombre_producto} vence en ${days} día${days > 1 ? 's' : ''}.`,
              data: { itemId: item.id, type: 'expiry' },
              sound: 'default',
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: secondsUntilNotify,
            },
          });
        }
      }
    }
  }
}
