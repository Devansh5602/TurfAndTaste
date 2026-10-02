import { useState, useCallback, useMemo } from 'react';

const INITIAL_BOOKING_STATE = {
  facility: null,
  date: null,
  slot: null,
  duration: null,
  customerDetails: { name: '', phone: '', email: '', note: '' },
  quote: null,
  quoteLoading: false,
  quoteError: null,
  booking: null,
  payment: { state: 'idle', orderId: null, error: null },
};

export function useBookingState() {
  const [state, setState] = useState(INITIAL_BOOKING_STATE);

  const setFacility = useCallback((facility) => {
    setState((prev) => ({
      ...prev,
      facility,
      date: null,
      slot: null,
      duration: null,
      quote: null,
      quoteLoading: false,
      quoteError: null,
      booking: null,
      payment: { state: 'idle', orderId: null, error: null },
    }));
  }, []);

  const setDate = useCallback((date) => {
    setState((prev) => ({
      ...prev,
      date,
      slot: null,
      quote: null,
      quoteLoading: false,
      quoteError: null,
    }));
  }, []);

  const setSlot = useCallback((slot) => {
    setState((prev) => ({
      ...prev,
      slot,
      quote: null,
      quoteLoading: false,
      quoteError: null,
    }));
  }, []);

  const setDuration = useCallback((duration) => {
    setState((prev) => ({
      ...prev,
      duration,
      quote: null,
      quoteLoading: false,
      quoteError: null,
    }));
  }, []);

  const setCustomerDetails = useCallback((details) => {
    setState((prev) => ({
      ...prev,
      customerDetails: { ...prev.customerDetails, ...details },
    }));
  }, []);

  const setQuote = useCallback((quote) => {
    setState((prev) => ({
      ...prev,
      quote,
      quoteLoading: false,
      quoteError: null,
    }));
  }, []);

  const setQuoteLoading = useCallback((loading) => {
    setState((prev) => ({
      ...prev,
      quoteLoading: loading,
    }));
  }, []);

  const setQuoteError = useCallback((error) => {
    setState((prev) => ({
      ...prev,
      quoteError: error,
      quoteLoading: false,
    }));
  }, []);

  const setBooking = useCallback((booking) => {
    setState((prev) => ({
      ...prev,
      booking,
    }));
  }, []);

  const setPaymentState = useCallback((paymentState) => {
    setState((prev) => ({
      ...prev,
      payment: { ...prev.payment, ...paymentState },
    }));
  }, []);

  const resetBooking = useCallback(() => {
    setState(INITIAL_BOOKING_STATE);
  }, []);

  const canProceedToSchedule = useMemo(() => Boolean(state.facility), [state.facility]);
  const canProceedToDetails = useMemo(() => Boolean(state.date && state.slot && state.duration), [state.date, state.slot, state.duration]);
  const canProceedToReview = useMemo(() => Boolean(state.quote && state.customerDetails.name.trim().length >= 2 && state.customerDetails.phone.replace(/\D/g, '').length >= 10), [state.quote, state.customerDetails]);
  const canSubmitPayment = useMemo(() => Boolean(state.quote && !state.quoteLoading && !state.quoteError), [state.quote, state.quoteLoading, state.quoteError]);

  return {
    state,
    setFacility,
    setDate,
    setSlot,
    setDuration,
    setCustomerDetails,
    setQuote,
    setQuoteLoading,
    setQuoteError,
    setBooking,
    setPaymentState,
    resetBooking,
    canProceedToSchedule,
    canProceedToDetails,
    canProceedToReview,
    canSubmitPayment,
  };
}

export default useBookingState;
