import { useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

import {
  getMyPaymentCards,
  getMyVehicles,
  type PricingInfo,
  type SavedPaymentCard,
  type UserVehicle,
} from '../src/api';
import { getPreferredPaymentCardId, setPreferredPaymentCardId } from '../src/preferredPaymentCard';
import { getPreferredVehicleId, setPreferredVehicleId } from '../src/preferredVehicle';

type Options = {
  token: string | null;
  setStartParkingPlate: (plate: string | null) => void;
};

export function useSpotFlowCheckoutExtras({ token, setStartParkingPlate }: Options) {
  const [vehicles, setVehicles] = useState<UserVehicle[]>([]);
  const [paymentCards, setPaymentCards] = useState<SavedPaymentCard[]>([]);
  const [extrasLoading, setExtrasLoading] = useState(false);
  const [extrasError, setExtrasError] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [pricingInfo, setPricingInfo] = useState<PricingInfo | null>(null);
  const [pricingModalLoading, setPricingModalLoading] = useState(false);
  const [pricingModalError, setPricingModalError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!token) {
        setVehicles([]);
        setPaymentCards([]);
        setExtrasError(null);
        setExtrasLoading(false);
        setSelectedVehicleId(null);
        setSelectedCardId(null);
        setStartParkingPlate(null);
        return;
      }
      let cancelled = false;
      setExtrasLoading(true);
      setExtrasError(null);
      (async () => {
        try {
          const [v, c] = await Promise.all([getMyVehicles(token), getMyPaymentCards(token)]);
          if (cancelled) return;
          setVehicles(v);
          setPaymentCards(c);
        } catch (e) {
          if (!cancelled) {
            setExtrasError((e as Error).message);
            setVehicles([]);
            setPaymentCards([]);
          }
        } finally {
          if (!cancelled) setExtrasLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [token, setStartParkingPlate]),
  );

  useEffect(() => {
    if (!vehicles.length) {
      setSelectedVehicleId(null);
      setStartParkingPlate(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const pref = await getPreferredVehicleId();
      if (cancelled) return;
      if (pref != null && vehicles.some((v) => v.id === pref)) {
        setSelectedVehicleId(pref);
        return;
      }
      if (pref != null) await setPreferredVehicleId(null);
      setSelectedVehicleId((prev) =>
        prev != null && vehicles.some((v) => v.id === prev) ? prev : vehicles[0].id,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [vehicles, setStartParkingPlate]);

  useEffect(() => {
    const v = vehicles.find((x) => x.id === selectedVehicleId);
    setStartParkingPlate(v?.plate ?? null);
  }, [vehicles, selectedVehicleId, setStartParkingPlate]);

  useEffect(() => {
    if (!paymentCards.length) {
      setSelectedCardId(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const pref = await getPreferredPaymentCardId();
      if (cancelled) return;
      if (pref != null && paymentCards.some((c) => c.id === pref)) {
        setSelectedCardId(pref);
        return;
      }
      if (pref != null) await setPreferredPaymentCardId(null);
      setSelectedCardId((prev) =>
        prev != null && paymentCards.some((c) => c.id === prev) ? prev : paymentCards[0].id,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [paymentCards]);

  return {
    vehicles,
    paymentCards,
    extrasLoading,
    extrasError,
    selectedVehicleId,
    setSelectedVehicleId,
    selectedCardId,
    setSelectedCardId,
    priceModalOpen,
    setPriceModalOpen,
    pricingInfo,
    pricingModalLoading,
    pricingModalError,
    setPricingInfo,
    setPricingModalLoading,
    setPricingModalError,
  };
}
