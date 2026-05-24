import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'parkingPreferredVehicleId';

export async function getPreferredVehicleId(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function setPreferredVehicleId(id: number | null): Promise<void> {
  try {
    if (id == null) await AsyncStorage.removeItem(KEY);
    else await AsyncStorage.setItem(KEY, String(id));
  } catch {
    /* ignore */
  }
}
