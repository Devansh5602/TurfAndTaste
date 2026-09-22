import React, { useState, useEffect, useMemo, useRef } from 'react';
import { adminStore } from '../services/adminStore';
import { api } from '../services/api';
import SectionHeading from '../components/SectionHeading';
import CourtBackground from '../components/CourtBackground';
import ConfirmationModal from '../components/ConfirmationModal';
import FacilityManager from '../components/admin/FacilityManager';
import { 
  Shield, 
  Lock, 
  Unlock, 
  Calendar, 
  Clock, 
  DollarSign, 
  Users, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Save, 
  Trash2, 
  Phone, 
  Mail, 
  Eye, 
  EyeOff, 
  KeyRound, 
  Settings, 
  ChevronRight,
  TrendingUp,
  Activity,
  X,
  CheckSquare,
  Archive,
  Building2,
  FileText,
  Send,
  AlertTriangle,
  HardDrive,
  Check,
  ExternalLink
} from 'lucide-react';

export default function Admin() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Active Tab: 'overview' | 'bookings' | 'pricing' | 'timings'
  const [activeTab, setActiveTab] = useState('bookings');

  // Core Data
  const [bookings, setBookings] = useState([]);
  const [pricingList, setPricingList] = useState([]);
  const [timings, setTimings] = useState({
    arenaOpen: '06:00 AM',
    arenaClose: '06:00 AM',
    floodlightStart: '06:00 PM',
    slotIntervalMins: 60,
    notes: ''
  });

  // Filter & Search State for Bookings
  const [searchQuery, setSearchQuery] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBookings, setSelectedBookings] = useState([]);

  // Modals & Feedback
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInError, setWalkInError] = useState('');
  const [notification, setNotification] = useState(null);

  // In-app Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    details: null,
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'warning',
    onConfirm: () => {}
  });

  // Walk-in form state
  const [walkIn, setWalkIn] = useState({
    facilityId: 'box-cricket',
    facilityName: 'Box Cricket Arena',
    customerName: '',
    customerPhone: '',
    date: new Date().toISOString().split('T')[0],
    time: '06:00 PM – 07:00 PM',
    paymentType: 'full',
    amount: '₹800'
  });

  // Annual Archives & Data Vault States
  const [archiveYears, setArchiveYears] = useState([]);
  const [selectedArchiveYear, setSelectedArchiveYear] = useState(new Date().getFullYear());
  const [archivePreview, setArchivePreview] = useState(null);
  const [archiveVault, setArchiveVault] = useState([]);
  const [archiveEmailList, setArchiveEmailList] = useState('admin@turfandtaste.com, accounts@turfandtaste.com');
  const [newEmailTag, setNewEmailTag] = useState('');
  const [isArchiveLoading, setIsArchiveLoading] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isEmailingPdf, setIsEmailingPdf] = useState(false);
  const [isPurgingDb, setIsPurgingDb] = useState(false);

  // Purge Modal State
  const [purgeModal, setPurgeModal] = useState({
    isOpen: false,
    year: null,
    totalBookings: 0,
    confirmInput: '',
    error: ''
  });

  const searchInputRef = useRef(null);
  const headerCheckboxRef = useRef(null);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);

  // Destructive Action Undo Buffer State
  const [undoState, setUndoState] = useState(null); // { items: [], count: 0, remainingSeconds: 10 }
  const undoIntervalRef = useRef(null);
  const pendingDeleteIdsRef = useRef(null);

  // A browser flag is not an authenticated session. Validate the persisted token before exposing management data.
  useEffect(() => {
    let cancelled = false;
    api.verifyAdminToken()
      .then((result) => {
        if (!cancelled) setIsAuthenticated(Boolean(result?.success));
      })
      .finally(() => {
        if (!cancelled) setIsAuthChecking(false);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    loadData();
    loadArchiveData();

    return () => {
      if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
    };
  }, [isAuthenticated]);

  const loadData = async () => {
    const fetchedBookings = await adminStore.fetchBookingsAsync();
    const fetchedPricing = await adminStore.fetchPricingAsync();
    const fetchedTimings = await adminStore.fetchTimingsAsync();
    setBookings(fetchedBookings || []);
    setPricingList(fetchedPricing || []);
    setTimings(fetchedTimings || {});
  };

  // Archive & Ledger Handlers
  const loadArchiveData = async (targetYear) => {
    setIsArchiveLoading(true);
    try {
      const yearToLoad = targetYear || selectedArchiveYear;
      const [yearsRes, vaultRes, settingsRes, previewRes] = await Promise.all([
        api.getArchiveYears().catch(() => ({ years: [] })),
        api.getArchiveVault().catch(() => ({ archives: [] })),
        api.getArchiveSettings().catch(() => ({ settings: {} })),
        api.getArchivePreview(yearToLoad).catch(() => ({ preview: null }))
      ]);

      if (yearsRes?.years) {
        setArchiveYears(yearsRes.years);
      }
      if (vaultRes?.archives) {
        setArchiveVault(vaultRes.archives);
      }
      if (settingsRes?.settings?.archiveEmailList) {
        setArchiveEmailList(settingsRes.settings.archiveEmailList);
      }
      if (previewRes?.preview) {
        setArchivePreview(previewRes.preview);
      }
    } catch (err) {
      console.error('Failed to load archive data:', err);
    } finally {
      setIsArchiveLoading(false);
    }
  };

  const handleSelectArchiveYear = async (year) => {
    setSelectedArchiveYear(year);
    setIsArchiveLoading(true);
    try {
      const previewRes = await api.getArchivePreview(year);
      if (previewRes?.preview) {
        setArchivePreview(previewRes.preview);
      }
    } catch (err) {
      console.error('Failed to load year preview:', err);
    } finally {
      setIsArchiveLoading(false);
    }
  };

  const handleAddEmailRecipient = () => {
    const trimmed = newEmailTag.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      showToast('Please enter a valid email address.', 'info');
      return;
    }
    const currentList = archiveEmailList.split(',').map(s => s.trim()).filter(Boolean);
    if (currentList.includes(trimmed)) {
      showToast('Email is already on the distribution list.', 'info');
      return;
    }
    const updatedList = [...currentList, trimmed].join(', ');
    setArchiveEmailList(updatedList);
    setNewEmailTag('');
  };

  const handleRemoveEmailRecipient = (emailToRemove) => {
    const currentList = archiveEmailList.split(',').map(s => s.trim()).filter(Boolean);
    const updatedList = currentList.filter(e => e !== emailToRemove).join(', ');
    setArchiveEmailList(updatedList);
  };

  const handleSaveArchiveSettings = async () => {
    try {
      const res = await api.updateArchiveSettings({ archiveEmailList });
      if (res?.success) {
        showToast('Archive email distribution list saved successfully!');
      } else {
        showToast(res?.error || 'Failed to update email list.', 'error');
      }
    } catch (err) {
      showToast('Error saving settings: ' + err.message, 'error');
    }
  };

  const handleGeneratePdfLedger = async (sendEmail = false) => {
    if (sendEmail) {
      setIsEmailingPdf(true);
    } else {
      setIsGeneratingPdf(true);
    }

    try {
      const res = await api.generateAnnualArchive({
        year: selectedArchiveYear,
        sendEmail,
        recipients: archiveEmailList
      });

      if (res?.success) {
        showToast(
          sendEmail 
            ? `Generated & emailed ${selectedArchiveYear} Annual Ledger to distribution list!`
            : `Audit-ready PDF Ledger for ${selectedArchiveYear} generated & archived!`
        );
        await loadArchiveData(selectedArchiveYear);
      } else {
        showToast(res?.error || 'Failed to generate archive PDF.', 'error');
      }
    } catch (err) {
      showToast('Error generating archive: ' + err.message, 'error');
    } finally {
      setIsGeneratingPdf(false);
      setIsEmailingPdf(false);
    }
  };

  const handleResendVaultEmail = async (archive) => {
    try {
      const res = await api.emailAnnualArchive({
        archiveId: archive.id,
        recipients: archiveEmailList || archive.recipients
      });
      if (res?.success) {
        showToast(`Dispatched ${archive.year} Annual Ledger to ${archive.recipients}!`);
      } else {
        showToast(res?.error || 'Failed to resend archive email.', 'error');
      }
    } catch (err) {
      showToast('Error sending email: ' + err.message, 'error');
    }
  };

  const handleOpenPurgeModal = (year, totalBookings) => {
    const hasArchive = archiveVault.some(a => Number(a.year) === Number(year)) || archivePreview?.archiveRecord;
    if (!hasArchive) {
      showToast(`Please generate an Annual PDF Ledger for ${year} first before purging data!`, 'error');
      return;
    }
    setPurgeModal({
      isOpen: true,
      year,
      totalBookings: totalBookings || archivePreview?.totalBookings || 0,
      confirmInput: '',
      error: ''
    });
  };

  const handleConfirmPurge = async () => {
    const requiredPhrase = `CONFIRM PURGE ${purgeModal.year}`;
    if (purgeModal.confirmInput.trim() !== requiredPhrase) {
      setPurgeModal(prev => ({
        ...prev,
        error: `Please type exactly "${requiredPhrase}" to authorize deletion.`
      }));
      return;
    }

    setIsPurgingDb(true);
    try {
      const res = await api.purgeAnnualData({
        year: purgeModal.year,
        confirmationText: purgeModal.confirmInput.trim()
      });

      if (res?.success) {
        setPurgeModal({ isOpen: false, year: null, totalBookings: 0, confirmInput: '', error: '' });
        showToast(`Purged ${res.purgedBookingsCount} booking records for ${res.year}. Active DB space reclaimed!`);
        await loadData();
        await loadArchiveData(res.year);
      } else {
        setPurgeModal(prev => ({ ...prev, error: res?.error || 'Failed to purge data.' }));
      }
    } catch (err) {
      setPurgeModal(prev => ({ ...prev, error: err.message }));
    } finally {
      setIsPurgingDb(false);
    }
  };

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Auth Handlers
  const handleLogin = async (e) => {
    e.preventDefault();
    const result = await adminStore.loginAdmin('admin', passwordInput.trim());
    if (result.success) {
      setIsAuthenticated(true);
      setPasswordError('');
      setPasswordInput('');
      showToast('Welcome to Turf & Taste Management Portal!');
    } else {
      setPasswordError(result.error || 'Incorrect password. Please verify and try again.');
    }
  };

  const handleLogout = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Lock Management Portal',
      type: 'logout',
      message: 'Are you sure you want to end your administrator session? You will need your master password to sign back in.',
      confirmText: 'Lock Console',
      cancelText: 'Stay Logged In',
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsAuthenticated(false);
        sessionStorage.removeItem('tt_admin_jwt');
        showToast('Logged out of Admin Portal.', 'info');
      }
    });
  };

  // Status Change Handler with In-App Confirmation Modal
  const handleStatusChange = (booking, newStatus) => {
    if (booking.status === newStatus) return;
    setConfirmModal({
      isOpen: true,
      title: 'Update Booking Status',
      type: newStatus === 'Cancelled' ? 'danger' : 'info',
      message: `Are you sure you want to update the reservation status for ${booking.customerName} (${booking.id})?`,
      details: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div><strong style={{ color: 'var(--brand-cream)' }}>Booking Reference:</strong> <span style={{ fontFamily: 'monospace', color: 'var(--brand-olive-bright)' }}>{booking.id}</span></div>
          <div><strong style={{ color: 'var(--brand-cream)' }}>Customer:</strong> {booking.customerName} ({booking.customerPhone})</div>
          <div><strong style={{ color: 'var(--brand-cream)' }}>Arena Facility:</strong> {booking.facilityName || booking.facilityId}</div>
          <div><strong style={{ color: 'var(--brand-cream)' }}>Status Transition:</strong> {booking.status} ➔ <span style={{ fontWeight: 700, color: newStatus === 'Cancelled' ? '#ef4444' : 'var(--brand-olive-bright)' }}>{newStatus}</span></div>
        </div>
      ),
      confirmText: `Confirm "${newStatus}"`,
      cancelText: 'Keep Current Status',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const updated = await adminStore.updateBookingStatus(booking.id, newStatus);
          setBookings(updated);
          showToast(`Booking ${booking.id} status updated to "${newStatus}".`);
        } catch (error) {
          showToast(error.message || 'Booking status could not be updated.', 'error');
        }
      }
    });
  };

  // Finalize pending deletion to database permanently
  const finalizePendingDelete = async () => {
    if (undoIntervalRef.current) {
      clearInterval(undoIntervalRef.current);
      undoIntervalRef.current = null;
    }
    const idsToDelete = pendingDeleteIdsRef.current;
    pendingDeleteIdsRef.current = null;
    setUndoState(null);

    if (idsToDelete && idsToDelete.length > 0) {
      for (const id of idsToDelete) {
        try {
          await adminStore.deleteBooking(id);
        } catch (error) {
          showToast(error.message || `Booking ${id} could not be deleted.`, 'error');
          await loadData();
          break;
        }
      }
    }
  };

  // Restore deleted items from buffer
  const handleUndoDelete = () => {
    if (undoIntervalRef.current) {
      clearInterval(undoIntervalRef.current);
      undoIntervalRef.current = null;
    }
    if (undoState?.items && undoState.items.length > 0) {
      const count = undoState.count;
      setBookings(prev => [...undoState.items, ...prev]);
      showToast(`Restored ${count} reservation${count === 1 ? '' : 's'}.`, 'info');
    }
    pendingDeleteIdsRef.current = null;
    setUndoState(null);
  };

  // For destructive actions: skip confirm modal, echo count, run immediately, offer 10s undo with draining ring
  const executeDeleteWithUndo = async (itemsToDelete) => {
    if (!itemsToDelete || itemsToDelete.length === 0) return;

    if (pendingDeleteIdsRef.current && pendingDeleteIdsRef.current.length > 0) {
      await finalizePendingDelete();
    }

    const idsToDelete = itemsToDelete.map(b => b.id);
    const count = idsToDelete.length;

    pendingDeleteIdsRef.current = idsToDelete;
    setBookings(prev => prev.filter(b => !idsToDelete.includes(b.id)));
    setSelectedBookings(prev => prev.filter(id => !idsToDelete.includes(id)));

    const durationMs = 10000;
    const startMs = Date.now();

    setUndoState({
      items: itemsToDelete,
      count,
      remainingSeconds: 10
    });

    undoIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startMs;
      const remaining = Math.max(0, (durationMs - elapsed) / 1000);
      if (remaining <= 0) {
        finalizePendingDelete();
      } else {
        setUndoState(prev => prev ? { ...prev, remainingSeconds: remaining } : null);
      }
    }, 100);
  };

  // Delete Single Booking (Immediate execution with 10s undo window, skipping modal)
  const handleDeleteBooking = (booking) => {
    executeDeleteWithUndo([booking]);
  };

  // Walk-in submit with in-modal error feedback
  const handleCreateWalkIn = async (e) => {
    e.preventDefault();
    if (!walkIn.customerName.trim() || !walkIn.customerPhone.trim()) {
      setWalkInError('Please provide both player full name and 10-digit mobile number.');
      return;
    }
    setWalkInError('');

    const newBooking = {
      id: `TT-W${Math.floor(10000 + Math.random() * 90000)}`,
      facilityId: walkIn.facilityId,
      facilityName: walkIn.facilityName,
      date: walkIn.date,
      time: walkIn.time,
      customerName: walkIn.customerName.trim(),
      customerPhone: walkIn.customerPhone.trim(),
      customerEmail: 'walkin@turfandtaste.in',
      teamName: 'Counter Walk-in',
      duration: 1,
      paymentType: walkIn.paymentType,
      amount: walkIn.amount,
      status: 'Checked-in',
      createdAt: new Date().toISOString()
    };

    try {
      await adminStore.saveBooking(newBooking);
      await loadData();
      setShowWalkInModal(false);
      setWalkIn({
        facilityId: 'box-cricket',
        facilityName: 'Box Cricket Arena',
        customerName: '',
        customerPhone: '',
        date: new Date().toISOString().split('T')[0],
        time: '06:00 PM – 07:00 PM',
        paymentType: 'full',
        amount: '₹800'
      });
      showToast(`Walk-in reservation ${newBooking.id} created successfully!`);
    } catch (error) {
      setWalkInError(error.message || 'Walk-in reservation could not be created. Please retry.');
    }
  };

  // Pricing Change Handlers
  const handlePriceFieldChange = (facilityId, field, value) => {
    setPricingList(prev => prev.map(item => {
      if (item.facilityId === facilityId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Save All Pricing with In-App Confirmation Modal
  const handleSaveAllPricing = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Save All Pricing Changes',
      type: 'info',
      message: `Publish all updated facility rates, floodlight schedules, and token deposits to the live customer portal and cloud database?`,
      details: (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '0.5rem', fontSize: '0.82rem' }}>
          {pricingList.map(p => (
            <div key={p.facilityId} style={{ background: 'var(--bg-surface)', padding: '0.45rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 600, color: 'var(--brand-cream)' }}>{p.facilityName}</div>
              <div style={{ color: 'var(--text-muted)' }}>Day: {p.dayRate} | Night: {p.nightRate}</div>
              <div style={{ color: 'var(--brand-orange)', fontSize: '0.75rem' }}>Deposit: {p.bookingDeposit}</div>
            </div>
          ))}
        </div>
      ),
      confirmText: 'Publish & Save Rates',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const updated = await adminStore.savePricing(pricingList);
          setPricingList(updated);
          showToast('All facility rates & deposits saved to cloud database and live customer site!');
        } catch (error) {
          showToast(error.message || 'Pricing could not be saved. Please retry.', 'error');
        }
      }
    });
  };

  // Timings Change Handlers with In-App Confirmation Modal
  const handleSaveTimings = (e) => {
    e.preventDefault();
    setConfirmModal({
      isOpen: true,
      title: 'Update Arena Operating Schedule',
      type: 'info',
      message: `Update Patan arena schedule to open at ${timings.arenaOpen}, close at ${timings.arenaClose}, and initiate floodlight evening rates at ${timings.floodlightStart}?`,
      details: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div><strong style={{ color: 'var(--brand-cream)' }}>Arena Gates Open:</strong> {timings.arenaOpen}</div>
          <div><strong style={{ color: 'var(--brand-cream)' }}>Arena Gates Close:</strong> {timings.arenaClose}</div>
          <div><strong style={{ color: 'var(--brand-cream)' }}>Floodlight Transition Hour:</strong> {timings.floodlightStart}</div>
          <div><strong style={{ color: 'var(--brand-cream)' }}>Standard Slot Duration:</strong> {timings.slotIntervalMins} Minutes</div>
        </div>
      ),
      confirmText: 'Save Operating Schedule',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await adminStore.saveTimings(timings);
          showToast('Operating schedule & floodlight hours updated!');
        } catch (error) {
          showToast(error.message || 'Operating schedule could not be saved. Please retry.', 'error');
        }
      }
    });
  };

  // Reset all data with In-App Confirmation Modal
  const handleResetDefaults = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset to Factory Defaults',
      type: 'danger',
      message: `This will reset all facility pricing tiers, floodlight schedules, token deposit rules, and operating hours back to initial factory settings. This action cannot be undone.`,
      confirmText: 'Yes, Reset Everything',
      cancelText: 'Keep Current Settings',
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        adminStore.resetAll();
        loadData();
        showToast('Reset completed to default configurations.', 'info');
      }
    });
  };

  // Export Bookings to CSV
  const handleExportCSV = () => {
    if (bookings.length === 0) {
      showToast('No booking records currently available to export.', 'info');
      return;
    }

    const headers = ['Booking ID', 'Facility', 'Date', 'Time Slot', 'Customer Name', 'Phone', 'Payment Mode', 'Status', 'Created At'];
    const rows = bookings.map(b => [
      `"${b.id}"`,
      `"${b.facilityName || b.facilityId}"`,
      `"${b.date}"`,
      `"${b.time}"`,
      `"${b.customerName}"`,
      `"${b.customerPhone}"`,
      `"${b.paymentType === 'full' ? 'Full Paid' : 'Token Deposit'}"`,
      `"${b.status}"`,
      `"${new Date(b.createdAt).toLocaleString()}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TurfAndTaste_Bookings_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV report downloaded successfully!');
  };

  // Filtered Bookings calculation
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchSearch = 
        (b.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.customerPhone || '').includes(searchQuery) ||
        (b.id || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchFacility = facilityFilter === 'all' || b.facilityId === facilityFilter;
      const matchStatus = statusFilter === 'all' || b.status.toLowerCase() === statusFilter.toLowerCase();

      return matchSearch && matchFacility && matchStatus;
    });
  }, [bookings, searchQuery, facilityFilter, statusFilter]);

  // Selection State: Three states (empty, partial, checked)
  const isAllSelected = filteredBookings.length > 0 && selectedBookings.length === filteredBookings.length;
  const isPartialSelected = selectedBookings.length > 0 && selectedBookings.length < filteredBookings.length;

  // The indeterminate dash is not optional
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isPartialSelected;
    }
  }, [isPartialSelected]);

  // Partial dash always resolves to select-all, never to clear
  const handleHeaderCheckboxClick = () => {
    if (isAllSelected) {
      setSelectedBookings([]);
    } else {
      setSelectedBookings(filteredBookings.map(b => b.id));
    }
  };

  // Selection is state, not DOM. Shift-click picks a contiguous range
  const handleToggleSelectBooking = (id, index, event) => {
    if (event?.shiftKey && lastSelectedIndex !== null && lastSelectedIndex !== index) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = filteredBookings.slice(start, end + 1).map(b => b.id);
      setSelectedBookings(prev => {
        const nextSet = new Set(prev);
        rangeIds.forEach(rId => nextSet.add(rId));
        return Array.from(nextSet);
      });
    } else {
      setSelectedBookings(prev =>
        prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
      );
      setLastSelectedIndex(index);
    }
  };

  const handleBulkStatusChange = (newStatus) => {
    if (selectedBookings.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: `Update ${selectedBookings.length} Booking(s)?`,
      message: `Are you sure you want to mark ${selectedBookings.length} selected reservation(s) as "${newStatus}"?`,
      details: (
        <div>
          <strong>Selected IDs:</strong> {selectedBookings.slice(0, 5).join(', ')}
          {selectedBookings.length > 5 && ` and ${selectedBookings.length - 5} more`}
        </div>
      ),
      confirmText: `Mark as ${newStatus}`,
      cancelText: 'Cancel',
      type: 'info',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          for (const id of selectedBookings) {
            await adminStore.updateBookingStatus(id, newStatus);
          }
          setBookings(prev => prev.map(b => selectedBookings.includes(b.id) ? { ...b, status: newStatus } : b));
          setSelectedBookings([]);
          showToast(`Updated ${selectedBookings.length} booking(s) to "${newStatus}".`);
        } catch (error) {
          await loadData();
          showToast(error.message || 'One or more bookings could not be updated.', 'error');
        }
      }
    });
  };

  // For destructive bulk actions: skip confirm modal, echo count, run immediately, offer 10s undo with draining countdown ring
  const handleBulkDelete = () => {
    if (selectedBookings.length === 0) return;
    const itemsToDelete = bookings.filter(b => selectedBookings.includes(b.id));
    executeDeleteWithUndo(itemsToDelete);
  };

  // Keyboard Shortcuts:
  // - ⌘K / Ctrl+K: focus search filter
  // - C: create new walk-in
  // - X: export filtered CSV
  // - Z: undo deletion (when undo window is active)
  useEffect(() => {
    if (!isAuthenticated) return;
    const handleKeyDown = (e) => {
      if (undoState && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndoDelete();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      const activeEl = document.activeElement;
      const isInputFocused = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);
      if (isInputFocused) return;

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setShowWalkInModal(true);
      } else if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        handleExportCSV();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated, filteredBookings, undoState]);

  // Toggle Popular / Featured for Pricing Tier
  const handleTogglePopular = (facilityId, isPopular) => {
    setPricingList(prev => prev.map(tier => 
      tier.facilityId === facilityId ? { ...tier, popular: isPopular } : tier
    ));
  };

  // Statistics for Overview
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayBookings = bookings.filter(b => b.date === todayStr);
    const confirmedCount = bookings.filter(b => b.status === 'Confirmed' || b.status === 'Checked-in').length;
    return {
      total: bookings.length,
      today: todayBookings.length,
      confirmed: confirmedCount,
      facilitiesActive: 6
    };
  }, [bookings]);

  // If Not Authenticated, show Password entry modal
  if (isAuthChecking) {
    return (
      <div className="page-admin" role="status" aria-live="polite" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: '2rem', textAlign: 'center' }}>
        <div><RefreshCw size={28} className="text-olive spin" /><p style={{ marginTop: '0.8rem', color: 'var(--text-secondary)' }}>Checking secure management access…</p></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="page-admin-auth section" style={{ 
        minHeight: 'calc(100vh - 120px)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <CourtBackground />
        
        {/* Subtle radial glow behind card */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '580px',
          height: '580px',
          background: 'radial-gradient(circle, rgba(107, 143, 73, 0.12) 0%, rgba(232, 103, 38, 0.04) 40%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 1
        }} />

        <div className="container" style={{ position: 'relative', zIndex: 2, maxWidth: '440px', width: '100%', margin: '0 auto' }}>
          <div style={{
            background: 'linear-gradient(165deg, rgba(22, 28, 22, 0.95) 0%, rgba(10, 14, 10, 0.98) 100%)',
            border: '1px solid rgba(107, 143, 73, 0.35)',
            borderRadius: '24px',
            padding: '2.5rem 2rem',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(107, 143, 73, 0.18)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            textAlign: 'center'
          }}>
            {/* Top Shield Icon */}
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(107, 143, 73, 0.28), rgba(232, 103, 38, 0.15))',
              border: '1.5px solid var(--brand-olive)',
              color: 'var(--brand-olive-bright)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              boxShadow: 'var(--glow-olive)'
            }}>
              <Shield size={36} className="text-olive" />
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
              <span className="badge badge-olive" style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Management Portal
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>• Patan HQ</span>
            </div>

            <h1 style={{ fontSize: '2rem', marginBottom: '0.45rem', color: 'var(--brand-cream)', letterSpacing: '0.02em' }}>
              Arena <span className="text-olive">Control Panel</span>
            </h1>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1.75rem' }}>
              Enter management password to access bookings, slot schedules, and pricing rates.
            </p>

            <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--brand-cream)' }}>
                    <KeyRound size={16} className="text-olive" />
                    Management Password
                  </span>
                </label>

                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                    minLength={4}
                    placeholder="Enter management password"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (passwordError) setPasswordError('');
                    }}
                    className="form-input"
                    style={{ 
                      paddingRight: '3.2rem', 
                      height: '50px',
                      fontSize: '1rem',
                      color: 'var(--text-primary)',
                      letterSpacing: showPassword ? 'normal' : '0.15em'
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      width: '34px',
                      height: '34px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: showPassword ? 'var(--brand-orange)' : 'var(--brand-olive-bright)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {passwordError && (
                  <div className="form-error" style={{ marginTop: '0.5rem', background: 'rgba(255, 82, 82, 0.1)', padding: '0.45rem 0.75rem', borderRadius: 'var(--radius-md)' }}>
                    <AlertCircle size={15} />
                    <span>{passwordError}</span>
                  </div>
                )}
              </div>

              <button 
                type="submit" 
                className="btn btn-primary btn-block btn-lg btn-submit" 
                style={{ 
                  height: '50px', 
                  fontSize: '1rem', 
                  fontWeight: 700,
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.6rem',
                  boxShadow: 'var(--glow-orange)',
                  marginBottom: '1.5rem'
                }}
              >
                <Unlock size={18} /> Unlock Control Panel
              </button>
            </form>

            <div style={{
              marginTop: '1.5rem',
              paddingTop: '1.15rem',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.3rem'
            }}>
              <span style={{ fontSize: '0.73rem', opacity: 0.75 }}>Use the password configured by your organization. Access is verified by the management service.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-admin">
      {/* Admin Notification Toast */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '90px',
          right: '24px',
          background: notification.type === 'info' ? 'var(--bg-surface-elevated)' : 'var(--brand-olive)',
          color: '#fff',
          padding: '0.9rem 1.4rem',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontWeight: 600,
          fontSize: '0.92rem'
        }}>
          <CheckCircle size={18} />
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Admin Header Bar */}
      <div style={{
        background: 'var(--bg-surface-elevated)',
        borderBottom: '1px solid var(--border-strong)',
        padding: '1.25rem 0'
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="badge badge-olive">Patan Arena HQ</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Live Control Portal</span>
            </div>
            <h1 style={{ fontSize: '1.7rem', margin: '0.25rem 0 0' }}>
              Turf &amp; Taste <span className="text-olive">Arena Management</span>
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              onClick={handleResetDefaults} 
              className="btn btn-outline" 
              style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem' }}
              title="Reset to default mock settings"
            >
              <RefreshCw size={14} /> Reset Defaults
            </button>
            <button 
              onClick={handleLogout} 
              className="btn btn-outline" 
              style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem', color: 'var(--brand-orange)', borderColor: 'var(--brand-orange)' }}
            >
              <Lock size={14} /> Lock Portal
            </button>
          </div>
        </div>
      </div>

      {/* Admin Tabs */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.75rem 0' }}>
            <button
              className={`tab-btn ${activeTab === 'bookings' ? 'active' : ''}`}
              onClick={() => setActiveTab('bookings')}
            >
              <Calendar size={16} /> Bookings Roster ({bookings.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'pricing' ? 'active' : ''}`}
              onClick={() => setActiveTab('pricing')}
            >
              <DollarSign size={16} /> Rates &amp; Pricing
            </button>
            <button
              className={`tab-btn ${activeTab === 'timings' ? 'active' : ''}`}
              onClick={() => setActiveTab('timings')}
            >
              <Clock size={16} /> Operating Timings
            </button>
            <button
              className={`tab-btn ${activeTab === 'facilities' ? 'active' : ''}`}
              onClick={() => setActiveTab('facilities')}
            >
              <Building2 size={16} /> Facilities
            </button>
            <button
              className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <Activity size={16} /> Performance Overview
            </button>
            <button
              className={`tab-btn ${activeTab === 'archives' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('archives');
                loadArchiveData(selectedArchiveYear);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                borderBottom: activeTab === 'archives' ? '2px solid var(--brand-orange)' : 'none'
              }}
            >
              <Archive size={16} style={{ color: activeTab === 'archives' ? 'var(--brand-orange)' : 'inherit' }} /> 
              Annual Archives &amp; DB Cleanup
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <section className="section" style={{ paddingTop: '2rem', minHeight: '70vh' }}>
        <div className="container">

          {/* TAB 1: BOOKINGS ROSTER */}
          {activeTab === 'bookings' && (
            <div>
              {/* Controls bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '1rem',
                background: 'var(--bg-surface-elevated)',
                padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-hairline)'
              }}>
                {/* Search & Filters */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
                  <div style={{ position: 'relative', width: '248px', maxWidth: '100%' }}>
                    <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      id="admin-search"
                      ref={searchInputRef}
                      aria-label="Search bookings"
                      placeholder="Search player, phone, TT-#…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="form-input"
                      style={{ paddingLeft: '2rem', paddingRight: '2.2rem', height: '32px', fontSize: 'var(--font-size-data)', background: 'var(--bg-surface)', letterSpacing: '-0.01em' }}
                    />
                    <span className="kbd" style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', lineHeight: 1 }}>⌘K</span>
                  </div>

                  <select
                    value={facilityFilter}
                    onChange={(e) => setFacilityFilter(e.target.value)}
                    className="form-select form-select-sm"
                    style={{ width: '156px', height: '32px', background: 'var(--bg-surface)' }}
                  >
                    <option value="all">All Facilities</option>
                    <option value="box-cricket">Box Cricket</option>
                    <option value="pickleball">Pickleball</option>
                    <option value="skating">Skating Rink</option>
                    <option value="cricket-nets">Cricket Nets</option>
                    <option value="ball-machine">Ball Machine</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="form-select form-select-sm"
                    style={{ width: '136px', height: '32px', background: 'var(--bg-surface)' }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="checked-in">Checked-in</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Actions with keyboard shortcut hints */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button onClick={handleExportCSV} className="btn btn-secondary btn-sm" style={{ height: '32px', fontSize: 'var(--font-size-data)', padding: '0 0.75rem', gap: '0.35rem' }}>
                    <Download size={13} />
                    <span className="action-with-shortcut">Export <kbd className="kbd">X</kbd></span>
                  </button>
                  <button onClick={() => setShowWalkInModal(true)} className="btn btn-olive btn-sm" style={{ height: '32px', fontSize: 'var(--font-size-data)', padding: '0 0.85rem', gap: '0.35rem' }}>
                    <Plus size={13} />
                    <span className="action-with-shortcut">New Walk-In <kbd className="kbd">C</kbd></span>
                  </button>
                </div>
              </div>

              {/* Bulk Operations Toolbar */}
              {selectedBookings.length > 0 && (
                <div className="bulk-actions-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--brand-cream)', fontWeight: 600 }}>
                      Selected {selectedBookings.length} of {filteredBookings.length} matching
                    </span>
                    {selectedBookings.length < filteredBookings.length && (
                      <button
                        type="button"
                        onClick={() => setSelectedBookings(filteredBookings.map(b => b.id))}
                        className="btn btn-outline btn-sm"
                        style={{ height: '26px', fontSize: '0.75rem', padding: '0 0.6rem', color: 'var(--brand-olive-bright)', borderColor: 'var(--brand-olive-bright)' }}
                      >
                        Select all {filteredBookings.length} matching
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button 
                      type="button"
                      onClick={() => handleBulkStatusChange('Checked-in')} 
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '0.8rem', height: '32px', borderColor: '#58A6FF', color: '#58A6FF' }}
                    >
                      Mark Checked-In
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleBulkStatusChange('Completed')} 
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '0.8rem', height: '32px', borderColor: 'var(--brand-olive-bright)', color: 'var(--brand-olive-bright)' }}
                    >
                      Mark Completed
                    </button>
                    <button 
                      type="button"
                      onClick={handleBulkDelete} 
                      className="btn btn-sm"
                      style={{ fontSize: '0.8rem', height: '32px', background: 'rgba(239,68,68,0.18)', color: '#ff6b6b', border: '1px solid rgba(239,68,68,0.4)' }}
                    >
                      <Trash2 size={13} /> Delete {selectedBookings.length} matching
                    </button>
                    <button 
                      type="button"
                      onClick={() => setSelectedBookings([])} 
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '0.8rem', height: '32px' }}
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              )}

              {/* Bookings Table */}
              <div className="table-responsive" style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                overflowX: 'auto'
              }}>
                <table className="admin-table" style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-hairline)', color: 'var(--brand-cream-muted)' }}>
                      <th className="col-icon" style={{ width: '46px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          ref={headerCheckboxRef}
                          checked={isAllSelected}
                          onChange={handleHeaderCheckboxClick}
                          title={
                            isAllSelected
                              ? `Deselect all ${filteredBookings.length} matching`
                              : `Select all ${filteredBookings.length} matching`
                          }
                          aria-label={
                            isAllSelected
                              ? `Deselect all ${filteredBookings.length} matching bookings`
                              : `Select all ${filteredBookings.length} matching bookings`
                          }
                        />
                      </th>
                      <th className="col-id">Booking ID</th>
                      <th className="col-label">Sport / Court</th>
                      <th className="col-date">Date &amp; Slot</th>
                      <th className="col-label">Customer</th>
                      <th className="col-label">Payment</th>
                      <th className="col-label">Status</th>
                      <th className="col-icon" style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ height: '80px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-data)' }}>
                          No bookings match your search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredBookings.map((b, index) => (
                        <tr 
                          key={b.id} 
                          style={{ 
                            borderBottom: '1px solid var(--border-hairline)', 
                            /* One accent colour: olive-bright on selected row only */
                            background: selectedBookings.includes(b.id) ? 'rgba(130, 171, 88, 0.10)' : 'transparent',
                            transition: 'background var(--transition-fast)' 
                          }}
                        >
                          <td className="col-icon">
                            <input
                              type="checkbox"
                              checked={selectedBookings.includes(b.id)}
                              onClick={(e) => handleToggleSelectBooking(b.id, index, e)}
                              onChange={() => {}}
                              aria-label={`Select booking ${b.id}`}
                            />
                          </td>
                          <td className="col-id" style={{ paddingLeft: '0.5rem', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--brand-cream)', letterSpacing: '0.02em' }}>
                            {b.id}
                          </td>
                          <td className="col-label">
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.facilityName || b.facilityId}</div>
                            {b.teamName && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{b.teamName}</div>}
                          </td>
                          <td className="col-date">
                            <div style={{ color: 'var(--brand-cream)', textAlign: 'right' }}>{b.date}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--brand-olive-bright)', textAlign: 'right' }}>{b.time}</div>
                          </td>
                          <td className="col-label">
                            <div style={{ fontWeight: 600 }}>{b.customerName}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{b.customerPhone}</div>
                          </td>
                          <td className="col-label">
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: b.paymentType === 'full' ? 'var(--brand-olive-bright)' : 'var(--text-secondary)',
                              letterSpacing: '0.02em'
                            }}>
                              {b.paymentType === 'full' ? 'Full' : 'Deposit'}
                            </span>
                          </td>
                          <td className="col-label">
                            <select
                              value={b.status}
                              data-status={b.status}
                              onChange={(e) => handleStatusChange(b, e.target.value)}
                              className="form-select table-status-select"
                            >
                              <option value="Confirmed">Confirmed</option>
                              <option value="Checked-in">Checked-in</option>
                              <option value="Completed">Completed</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </td>
                          <td className="col-icon">
                            <button
                              onClick={() => handleDeleteBooking(b)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '0.25rem',
                                borderRadius: 'var(--radius-sm)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color var(--transition-fast)'
                              }}
                              onMouseOver={e => e.currentTarget.style.color = '#ff6b6b'}
                              onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                              title="Delete record"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: PRICING & RATES */}
          {activeTab === 'pricing' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Facility Pricing &amp; Token Deposits</h2>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Edit the public hourly rates and reservation booking amounts. Changes immediately update the live Pricing and Booking pages.
                  </p>
                </div>
                <div>
                  <button onClick={handleSaveAllPricing} className="btn btn-primary btn-lg">
                    <Save size={18} /> Save All Pricing Changes
                  </button>
                </div>
              </div>

              <div className="grid grid-2" style={{ gap: '1.5rem' }}>
                {pricingList.map((tier) => {
                  const cleanDayRate = String(tier.dayRate || '').replace(/^₹\s*/, '');
                  const cleanNightRate = String(tier.nightRate || '').replace(/^₹\s*/, '');
                  const cleanDeposit = String(tier.bookingDeposit || tier.depositPct || '').replace(/^₹\s*/, '');

                  return (
                    <div key={tier.facilityId} className="card-arena" style={{ padding: '1.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h3 style={{ fontSize: '1.3rem', margin: 0, color: 'var(--brand-cream)' }}>{tier.facilityName}</h3>
                          {tier.popular && <span className="badge badge-orange" style={{ fontSize: '0.7rem' }}>Featured</span>}
                        </div>
                        <span className="badge badge-olive" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>{tier.facilityId}</span>
                      </div>

                      {/* Rates Section */}
                      <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--brand-cream-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                          Hourly Rates
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                            <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                              Day Rate (per hour):
                            </label>
                            <div className="input-prefix-wrapper">
                              <span className="input-prefix-badge">₹</span>
                              <input
                                type="text"
                                value={cleanDayRate}
                                onChange={(e) => handlePriceFieldChange(tier.facilityId, 'dayRate', e.target.value)}
                                className="form-input"
                                placeholder="800"
                              />
                            </div>
                          </div>

                          <div>
                            <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                              Night / Floodlight Rate:
                            </label>
                            <div className="input-prefix-wrapper">
                              <span className="input-prefix-badge">₹</span>
                              <input
                                type="text"
                                value={cleanNightRate}
                                onChange={(e) => handlePriceFieldChange(tier.facilityId, 'nightRate', e.target.value)}
                                className="form-input"
                                placeholder="1200"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Deposit Section */}
                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                          Token Booking Amount (Deposit):
                        </label>
                        <div className="input-prefix-wrapper">
                          <span className="input-prefix-badge">₹</span>
                          <input
                            type="text"
                            value={cleanDeposit}
                            onChange={(e) => handlePriceFieldChange(tier.facilityId, 'bookingDeposit', e.target.value)}
                            className="form-input"
                            placeholder="400"
                          />
                        </div>
                      </div>

                      {/* Schedule Labels Section */}
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--brand-cream-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                          Schedule Window Labels
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                              Day Hours Label:
                            </label>
                            <input
                              type="text"
                              value={tier.dayHours || ''}
                              onChange={(e) => handlePriceFieldChange(tier.facilityId, 'dayHours', e.target.value)}
                              className="form-input"
                              style={{ fontSize: '0.85rem' }}
                              placeholder="e.g. 6:00 AM – 6:00 PM"
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                              Night Hours Label:
                            </label>
                            <input
                              type="text"
                              value={tier.nightHours || ''}
                              onChange={(e) => handlePriceFieldChange(tier.facilityId, 'nightHours', e.target.value)}
                              className="form-input"
                              style={{ fontSize: '0.85rem' }}
                        placeholder="e.g. 6:00 PM – 6:00 AM"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Featured Arena Toggle Checkbox */}
                      <div style={{ marginTop: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)' }}>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={!!tier.popular}
                            onChange={(e) => handleTogglePopular(tier.facilityId, e.target.checked)}
                          />
                          <span style={{ fontSize: '0.85rem', color: tier.popular ? 'var(--brand-cream)' : 'var(--text-secondary)' }}>
                            Featured arena on Pricing and Home pages
                          </span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
                <button onClick={handleSaveAllPricing} className="btn btn-primary btn-lg">
                  <Save size={18} /> Save All Pricing Changes
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: OPERATING TIMINGS */}
          {activeTab === 'timings' && (
            <div style={{ maxWidth: '820px', margin: '0 auto' }}>
              <div className="card-arena highlight" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(107, 143, 73, 0.15)', color: 'var(--brand-olive-bright)' }}>
                    <Clock size={28} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Arena Operating Schedule</h2>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                      Set Patan arena gates open/close timings, slot durations, and floodlight transitions.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveTimings}>
                  <div className="grid grid-2" style={{ gap: '1.25rem', marginBottom: '1.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: 'var(--brand-cream-muted)' }}>
                        Arena Gates Open Time:
                      </label>
                      <input
                        type="text"
                        value={timings.arenaOpen || ''}
                        onChange={(e) => setTimings({ ...timings, arenaOpen: e.target.value })}
                        className="form-input"
                        placeholder="e.g. 06:00 AM"
                      />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>First bookable slot of the morning</span>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: 'var(--brand-cream-muted)' }}>
                        Arena Gates Close Time:
                      </label>
                      <input
                        type="text"
                        value={timings.arenaClose || ''}
                        onChange={(e) => setTimings({ ...timings, arenaClose: e.target.value })}
                        className="form-input"
                        placeholder="e.g. 06:00 AM"
                      />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>Final slot conclude hour</span>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: 'var(--brand-cream-muted)' }}>
                        Floodlight Peak Start:
                      </label>
                      <input
                        type="text"
                        value={timings.floodlightStart || ''}
                        onChange={(e) => setTimings({ ...timings, floodlightStart: e.target.value })}
                        className="form-input"
                        placeholder="e.g. 06:00 PM"
                      />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>When evening floodlight rates take effect</span>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: 'var(--brand-cream-muted)' }}>
                        Slot Interval Duration (Minutes):
                      </label>
                      <select
                        value={timings.slotIntervalMins || 60}
                        onChange={(e) => setTimings({ ...timings, slotIntervalMins: Number(e.target.value) })}
                        className="form-select"
                      >
                        <option value={30}>30 Minutes</option>
                        <option value={60}>60 Minutes (Standard 1 Hour)</option>
                        <option value={90}>90 Minutes</option>
                        <option value={120}>120 Minutes (2 Hours)</option>
                      </select>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>Default bookable block duration</span>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: 'var(--brand-cream-muted)' }}>
                      Operational Notice / Schedule Notes:
                    </label>
                    <textarea
                      rows={3}
                      value={timings.notes || ''}
                      onChange={(e) => setTimings({ ...timings, notes: e.target.value })}
                      className="form-textarea"
                      placeholder="Special announcements (e.g., Sunday morning tournament maintenance)..."
                    />
                  </div>

                  <button type="submit" className="btn btn-primary btn-lg">
                    <Save size={18} /> Update Operating Schedule
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'facilities' && (
            <FacilityManager onToast={(message, type = 'success') => showToast(message, type)} />
          )}

          {/* TAB 4: OVERVIEW & STATS */}
          {activeTab === 'overview' && (
            <div>
              <div className="grid grid-4" style={{ gap: '1.25rem', marginBottom: '2rem' }}>
                <div className="card-arena" style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                    Total Bookings
                  </div>
                  <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', color: 'var(--brand-cream)' }}>
                    {stats.total}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--brand-olive-bright)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <TrendingUp size={14} /> Active reservations
                  </div>
                </div>

                <div className="card-arena" style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                    Today's Matches
                  </div>
                  <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', color: 'var(--brand-olive-bright)' }}>
                    {stats.today}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                    Scheduled for today
                  </div>
                </div>

                <div className="card-arena" style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                    Confirmed / Checked-In
                  </div>
                  <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', color: '#58A6FF' }}>
                    {stats.confirmed}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                    Guaranteed attendance
                  </div>
                </div>

                <div className="card-arena" style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                    Active Courts
                  </div>
                  <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', color: 'var(--brand-orange)' }}>
                    {stats.facilitiesActive}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                    Box, Nets, Rink, Pickle, Café
                  </div>
                </div>
              </div>

              {/* Quick Actions Panel */}
              <div className="card-arena" style={{ padding: '2rem' }}>
                <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Ground Reception Quick Actions</h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button onClick={() => setShowWalkInModal(true)} className="btn btn-primary">
                    <Plus size={16} /> Enter Walk-In Customer
                  </button>
                  <button onClick={handleExportCSV} className="btn btn-outline">
                    <Download size={16} /> Download Daily Roster
                  </button>
                  <button onClick={() => setActiveTab('pricing')} className="btn btn-outline">
                    <DollarSign size={16} /> Adjust Weekend Surcharges
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ANNUAL ARCHIVES & DB CLEANUP */}
          {activeTab === 'archives' && (
            <div>
              {/* Header Context Banner */}
              <div className="card-arena" style={{ padding: '1.75rem 2rem', marginBottom: '2rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute',
                  top: '-40px',
                  right: '-40px',
                  width: '200px',
                  height: '200px',
                  background: 'radial-gradient(circle, rgba(232, 103, 38, 0.12) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
                  <div style={{ maxWidth: '720px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <span className="badge badge-orange" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Archive size={13} /> Fiscal Year Archives
                      </span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>1-Year Ledger Lifecycle (Jan 1 – Dec 31)</span>
                    </div>
                    <h2 style={{ fontSize: '1.7rem', margin: '0.2rem 0 0.5rem', color: 'var(--brand-cream)' }}>
                      Annual Financial Ledgers &amp; <span className="text-orange">Database Space Optimization</span>
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                      Generate audit-ready, multi-page PDF financial records of all reservations and payments for any calendar year.
                      Share automatically with your management email distribution list, store securely in the Archive Vault, and safely purge old database records to keep cloud storage lightweight.
                    </p>
                  </div>

                  <button
                    onClick={() => loadArchiveData(selectedArchiveYear)}
                    className="btn btn-outline btn-sm"
                    disabled={isArchiveLoading}
                    style={{ height: '38px', fontSize: '0.85rem' }}
                  >
                    <RefreshCw size={14} className={isArchiveLoading ? 'animate-spin' : ''} /> Refresh Data
                  </button>
                </div>
              </div>

              {/* Year Selector Pills & Quick Status */}
              <div style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                padding: '1.25rem 1.5rem',
                marginBottom: '1.75rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                      Select Calendar Year (Jan 1 to Dec 31)
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {archiveYears.length === 0 ? (
                        <button
                          onClick={() => handleSelectArchiveYear(new Date().getFullYear())}
                          className="tab-btn active"
                          style={{ padding: '0.5rem 1.1rem', fontSize: '0.92rem', fontWeight: 700 }}
                        >
                          {new Date().getFullYear()} (Current Year)
                        </button>
                      ) : (
                        archiveYears.map(yr => {
                          const isSelected = Number(yr.year) === Number(selectedArchiveYear);
                          return (
                            <button
                              key={yr.year}
                              onClick={() => handleSelectArchiveYear(yr.year)}
                              className={`tab-btn ${isSelected ? 'active' : ''}`}
                              style={{
                                padding: '0.55rem 1.15rem',
                                fontSize: '0.95rem',
                                fontWeight: isSelected ? 700 : 500,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.55rem',
                                border: isSelected ? '1px solid var(--brand-orange)' : '1px solid var(--border-subtle)',
                                background: isSelected ? 'rgba(232, 103, 38, 0.15)' : 'var(--bg-surface-elevated)',
                                color: isSelected ? 'var(--brand-orange)' : 'var(--text-primary)'
                              }}
                            >
                              <span>{yr.year}</span>
                              {yr.purgedFromDb ? (
                                <span style={{
                                  fontSize: '0.7rem',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(107, 143, 73, 0.25)',
                                  color: 'var(--brand-olive-bright)',
                                  fontWeight: 600
                                }}>
                                  Purged &amp; Safe
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: '0.7rem',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(255, 255, 255, 0.08)',
                                  color: 'var(--brand-cream-muted)',
                                  fontWeight: 600
                                }}>
                                  {yr.totalBookings} in DB
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status:</span>
                    {archivePreview?.alreadyPurged ? (
                      <span className="badge badge-olive" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Check size={13} /> {selectedArchiveYear} Purged from Active DB
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(88, 166, 255, 0.15)', color: '#58A6FF', border: '1px solid rgba(88, 166, 255, 0.3)' }}>
                        <HardDrive size={13} /> {archivePreview?.totalBookings || 0} Records in Live DB
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Email Distribution Management Card */}
              <div className="card-arena" style={{ padding: '1.5rem', marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-cream)' }}>
                      <Mail size={16} className="text-orange" /> Automated Stakeholder Email Distribution List
                    </h3>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      Annual PDF audit ledgers will be attached and delivered to these addresses when dispatched.
                    </p>
                  </div>
                  <button
                    onClick={handleSaveArchiveSettings}
                    className="btn btn-outline btn-sm"
                    style={{ height: '34px', fontSize: '0.82rem' }}
                  >
                    <Save size={13} /> Save Email List
                  </button>
                </div>

                {/* Email Badges & Input */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.85rem' }}>
                  {archiveEmailList.split(',').map(s => s.trim()).filter(Boolean).map((email) => (
                    <span
                      key={email}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        background: 'rgba(107, 143, 73, 0.16)',
                        border: '1px solid rgba(107, 143, 73, 0.35)',
                        color: 'var(--brand-cream)',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.85rem'
                      }}
                    >
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEmailRecipient(email)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ff6b6b',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title={`Remove ${email}`}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '480px' }}>
                  <input
                    type="email"
                    placeholder="Enter stakeholder email (e.g. auditor@example.com)..."
                    value={newEmailTag}
                    onChange={(e) => setNewEmailTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEmailRecipient();
                      }
                    }}
                    className="form-input"
                    style={{ height: '38px', fontSize: '0.85rem', flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleAddEmailRecipient}
                    className="btn btn-secondary btn-sm"
                    style={{ height: '38px', fontSize: '0.82rem' }}
                  >
                    <Plus size={14} /> Add Recipient
                  </button>
                </div>
              </div>

              {/* 4 Annual Financial & Storage Metric Cards */}
              <div className="grid grid-4" style={{ gap: '1.25rem', marginBottom: '2rem' }}>
                <div className="card-arena" style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
                    {selectedArchiveYear} Gross Revenue
                  </div>
                  <div style={{ fontSize: '2.4rem', fontFamily: 'var(--font-display)', color: 'var(--brand-orange)' }}>
                    ₹{archivePreview ? (archivePreview.totalRevenue || 0).toLocaleString('en-IN') : '0'}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                    ₹{(archivePreview?.depositCollected || 0).toLocaleString('en-IN')} token deposits collected
                  </div>
                </div>

                <div className="card-arena" style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
                    Total Reservations
                  </div>
                  <div style={{ fontSize: '2.4rem', fontFamily: 'var(--font-display)', color: 'var(--brand-cream)' }}>
                    {archivePreview?.totalBookings || 0}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--brand-olive-bright)', marginTop: '0.35rem' }}>
                    {archivePreview?.fullPaidCount || 0} Full Paid • {archivePreview?.depositCount || 0} Token
                  </div>
                </div>

                <div className="card-arena" style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
                    Database Footprint
                  </div>
                  <div style={{ fontSize: '1.7rem', fontWeight: 700, color: archivePreview?.alreadyPurged ? 'var(--brand-olive-bright)' : '#58A6FF', marginTop: '0.3rem' }}>
                    {archivePreview?.alreadyPurged ? 'Space Reclaimed' : `~${((archivePreview?.totalBookings || 0) * 1.8).toFixed(1)} KB Active`}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    {archivePreview?.alreadyPurged ? 'Zero live DB footprint' : 'Ready for annual cleanup'}
                  </div>
                </div>

                <div className="card-arena" style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
                    Archive Vault Record
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: archivePreview?.archiveRecord ? 'var(--brand-cream)' : 'var(--text-muted)', marginTop: '0.45rem' }}>
                    {archivePreview?.archiveRecord ? 'PDF Vaulted' : 'Not Generated'}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.45rem' }}>
                    {archivePreview?.archiveRecord ? (
                      <a
                        href={`/api/archives/${archivePreview.archiveRecord.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--brand-orange)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
                      >
                        <Download size={13} /> Download ({Math.round(archivePreview.archiveRecord.pdfSizeBytes / 1024)} KB)
                      </a>
                    ) : (
                      'Click below to generate'
                    )}
                  </div>
                </div>
              </div>

              {/* Primary Action Control Strip */}
              <div className="card-arena" style={{ padding: '1.75rem 2rem', marginBottom: '2.5rem', background: 'linear-gradient(135deg, rgba(22, 28, 22, 0.95), rgba(16, 20, 16, 0.98))' }}>
                <h3 style={{ fontSize: '1.25rem', margin: '0 0 1rem', color: 'var(--brand-cream)' }}>
                  Annual Ledger &amp; DB Purge Actions ({selectedArchiveYear})
                </h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Action 1: Generate PDF */}
                  <button
                    onClick={() => handleGeneratePdfLedger(false)}
                    disabled={isGeneratingPdf || isEmailingPdf}
                    className="btn btn-primary"
                    style={{ minWidth: '220px' }}
                  >
                    {isGeneratingPdf ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" /> Generating PDF...
                      </>
                    ) : (
                      <>
                        <FileText size={16} /> Generate Annual PDF Ledger
                      </>
                    )}
                  </button>

                  {/* Action 2: Generate & Email */}
                  <button
                    onClick={() => handleGeneratePdfLedger(true)}
                    disabled={isGeneratingPdf || isEmailingPdf}
                    className="btn btn-olive"
                    style={{ minWidth: '250px' }}
                  >
                    {isEmailingPdf ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" /> Dispatching Email...
                      </>
                    ) : (
                      <>
                        <Send size={16} /> Generate &amp; Email to Distribution
                      </>
                    )}
                  </button>

                  {/* Action 3: Purge Data from DB */}
                  <button
                    onClick={() => handleOpenPurgeModal(selectedArchiveYear, archivePreview?.totalBookings)}
                    disabled={isPurgingDb || archivePreview?.alreadyPurged || (archivePreview?.totalBookings === 0 && !archivePreview?.archiveRecord)}
                    className="btn"
                    style={{
                      background: archivePreview?.alreadyPurged ? 'rgba(255,255,255,0.05)' : 'rgba(239, 68, 68, 0.15)',
                      border: archivePreview?.alreadyPurged ? '1px solid var(--border-subtle)' : '1px solid #ef4444',
                      color: archivePreview?.alreadyPurged ? 'var(--text-muted)' : '#ff6b6b',
                      cursor: (archivePreview?.alreadyPurged || (archivePreview?.totalBookings === 0 && !archivePreview?.archiveRecord)) ? 'not-allowed' : 'pointer',
                      minWidth: '240px'
                    }}
                  >
                    <Trash2 size={16} /> 
                    {archivePreview?.alreadyPurged ? 'Data Already Purged (Space Freed)' : `Purge ${selectedArchiveYear} & Free DB Space`}
                  </button>
                </div>

                <div style={{ marginTop: '0.85rem', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertCircle size={14} className="text-orange" />
                  <span>Purging deletes booking entries for {selectedArchiveYear} from the live DB. PDF records in the Archive Vault will remain safe permanently.</span>
                </div>
              </div>

              {/* Month-by-Month Annual Breakdown (Jan - Dec) */}
              <div style={{ marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.3rem', margin: 0, color: 'var(--brand-cream)' }}>
                    Calendar Year {selectedArchiveYear} Month-by-Month Distribution
                  </h3>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                    January 1 to December 31
                  </span>
                </div>

                <div className="table-responsive" style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-hairline)',
                  overflowX: 'auto'
                }}>
                  <table className="admin-table" style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-hairline)', color: 'var(--brand-cream-muted)' }}>
                        <th className="col-label">Month</th>
                        <th className="col-number">Reservations</th>
                        <th className="col-amount">Gross Revenue</th>
                        <th className="col-label">Payment Distribution</th>
                        <th className="col-label">Top Booked Sport</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!archivePreview?.monthlyBreakdown || archivePreview.monthlyBreakdown.length === 0) ? (
                        <tr>
                          <td colSpan={5} style={{ height: '64px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No monthly reservation records found for {selectedArchiveYear}.
                          </td>
                        </tr>
                      ) : (
                        archivePreview.monthlyBreakdown.map(m => (
                          <tr key={m.monthNum} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                            <td className="col-label" style={{ fontWeight: 600, color: 'var(--brand-cream)' }}>
                              {m.monthName}
                            </td>
                            <td className="col-number">
                              {m.count} {m.count === 1 ? 'match' : 'matches'}
                            </td>
                            <td className="col-amount" style={{ fontWeight: 600, color: m.revenue > 0 ? 'var(--brand-cream)' : 'var(--text-muted)' }}>
                              ₹{(m.revenue || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="col-label" style={{ color: 'var(--text-secondary)' }}>
                              {m.fullPaid} Full • {m.deposit} Deposit
                            </td>
                            <td className="col-label" style={{ color: 'var(--brand-cream-muted)' }}>
                              {m.topSport || '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Archive Vault Records Table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.3rem', margin: 0, color: 'var(--brand-cream)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Archive size={18} className="text-olive" /> Archive Vault (Permanent PDF Records)
                    </h3>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      Audited multi-page PDFs preserved in permanent storage. Always available even after live DB purge.
                    </p>
                  </div>
                  <span className="badge badge-olive" style={{ fontSize: '0.8rem' }}>
                    {archiveVault.length} Archives Stored
                  </span>
                </div>

                <div className="table-responsive" style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-hairline)',
                  overflowX: 'auto'
                }}>
                  <table className="admin-table" style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-hairline)', color: 'var(--brand-cream-muted)' }}>
                        <th className="col-label">Ledger Year</th>
                        <th className="col-amount">Total Volume</th>
                        <th className="col-label">File Details</th>
                        <th className="col-label">Recipients</th>
                        <th className="col-label">Live DB Status</th>
                        <th className="col-date">Archived At</th>
                        <th className="col-icon" style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archiveVault.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ height: '64px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No annual ledger archives created yet. Select a year above and click "Generate Annual PDF Ledger".
                          </td>
                        </tr>
                      ) : (
                        archiveVault.map(a => (
                          <tr key={a.id} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                            <td className="col-label">
                              <div style={{ fontWeight: 600, color: 'var(--brand-cream)' }}>{a.year} Annual Ledger</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Jan 1 – Dec 31</div>
                            </td>
                            <td className="col-amount">
                              <div style={{ fontWeight: 600, color: 'var(--brand-cream)' }}>₹{(a.totalRevenue || 0).toLocaleString('en-IN')}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.totalBookings} Bookings</div>
                            </td>
                            <td className="col-label">
                              <div style={{ fontSize: '0.78rem', color: 'var(--brand-cream)', fontFamily: 'monospace' }}>{a.fileName}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{Math.round(a.pdfSizeBytes / 1024)} KB</div>
                            </td>
                            <td className="col-label" style={{ maxWidth: '180px' }}>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={a.recipients}>
                                {a.recipients || 'Not emailed'}
                              </div>
                            </td>
                            <td className="col-label">
                              {a.purgedFromDb ? (
                                <span className="status-icon" style={{ fontSize: 'var(--font-size-data)' }}>
                                  <Check size={12} /> Purged
                                </span>
                              ) : (
                                <span className="status-icon" style={{ fontSize: 'var(--font-size-data)' }}>
                                  <Activity size={12} /> In DB
                                </span>
                              )}
                            </td>
                            <td className="col-date" style={{ color: 'var(--text-muted)' }}>
                              {a.archivedAt ? new Date(a.archivedAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="col-icon" style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                                <a
                                  href={`/api/archives/${a.id}/download`}
                                  download
                                  className="btn btn-outline btn-sm"
                                  style={{ padding: '0 0.5rem', height: '26px', fontSize: '0.75rem', textDecoration: 'none' }}
                                  title="Download PDF"
                                >
                                  <Download size={12} /> PDF
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleResendVaultEmail(a)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '0 0.5rem', height: '26px', fontSize: '0.75rem' }}
                                  title="Resend email"
                                >
                                  <Send size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>
      </section>

      {/* WALK-IN BOOKING MODAL */}
      {showWalkInModal && (
        <div className="modal-overlay" onClick={() => setShowWalkInModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setShowWalkInModal(false)}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div style={{ marginBottom: '1.5rem' }}>
              <span className="badge badge-orange" style={{ marginBottom: '0.4rem' }}>
                Counter Reception
              </span>
              <h3 style={{ fontSize: '1.5rem', margin: '0.2rem 0 0.35rem', color: 'var(--brand-cream)' }}>
                Register Walk-In Player
              </h3>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Quick check-in for on-site cash, UPI, or card players at the arena desk.
              </p>
            </div>

            <form onSubmit={handleCreateWalkIn}>
              {walkInError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#ff6b6b',
                  padding: '0.65rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.86rem'
                }}>
                  <AlertCircle size={16} /> {walkInError}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Sport / Court:</label>
                <select
                  value={walkIn.facilityId}
                  onChange={(e) => {
                    const sel = e.target.value;
                    const name = sel === 'box-cricket' ? 'Box Cricket Arena' : sel === 'pickleball' ? 'Pickleball Courts' : sel === 'skating' ? 'Skating Rink' : sel === 'cricket-nets' ? 'Practice Nets' : 'Ball Machine';
                    setWalkIn({ ...walkIn, facilityId: sel, facilityName: name });
                  }}
                  className="form-select"
                >
                  <option value="box-cricket">Box Cricket Arena</option>
                  <option value="pickleball">Pickleball Courts</option>
                  <option value="skating">Skating Rink</option>
                  <option value="cricket-nets">Cricket Practice Nets</option>
                  <option value="ball-machine">Ball-Shooting Machine Lane</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Customer Name: <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="customerName"
                  required
                  minLength={2}
                  placeholder="Player full name"
                  value={walkIn.customerName}
                  onChange={(e) => setWalkIn({ ...walkIn, customerName: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Phone Number: <span className="required">*</span>
                </label>
                <input
                  type="tel"
                  name="customerPhone"
                  required
                  pattern="[6-9][0-9]{9}"
                  title="Please enter a valid 10-digit mobile number starting with 6-9"
                  placeholder="10-digit mobile number"
                  value={walkIn.customerPhone}
                  onChange={(e) => setWalkIn({ ...walkIn, customerPhone: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="grid grid-2" style={{ gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Date:</label>
                  <input
                    type="date"
                    value={walkIn.date}
                    onChange={(e) => setWalkIn({ ...walkIn, date: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Slot Time:</label>
                  <select
                    value={walkIn.time}
                    onChange={(e) => setWalkIn({ ...walkIn, time: e.target.value })}
                    className="form-select"
                  >
                    <option value="06:00 AM – 07:00 AM">06:00 AM – 07:00 AM</option>
                    <option value="07:00 AM – 08:00 AM">07:00 AM – 08:00 AM</option>
                    <option value="08:00 AM – 09:00 AM">08:00 AM – 09:00 AM</option>
                    <option value="04:00 PM – 05:00 PM">04:00 PM – 05:00 PM</option>
                    <option value="05:00 PM – 06:00 PM">05:00 PM – 06:00 PM</option>
                    <option value="06:00 PM – 07:00 PM">06:00 PM – 07:00 PM (Prime)</option>
                    <option value="07:00 PM – 08:00 PM">07:00 PM – 08:00 PM (Prime)</option>
                    <option value="08:00 PM – 09:00 PM">08:00 PM – 09:00 PM (Prime)</option>
                    <option value="09:00 PM – 10:00 PM">09:00 PM – 10:00 PM</option>
                    <option value="10:00 PM – 11:00 PM">10:00 PM – 11:00 PM</option>
                    <option value="11:00 PM – 12:00 AM">11:00 PM – 12:00 AM</option>
                    <option value="12:00 AM – 01:00 AM">12:00 AM – 01:00 AM</option>
                    <option value="01:00 AM – 02:00 AM">01:00 AM – 02:00 AM</option>
                    <option value="02:00 AM – 03:00 AM">02:00 AM – 03:00 AM</option>
                    <option value="03:00 AM – 04:00 AM">03:00 AM – 04:00 AM</option>
                    <option value="04:00 AM – 05:00 AM">04:00 AM – 05:00 AM</option>
                    <option value="05:00 AM – 06:00 AM">05:00 AM – 06:00 AM</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-2" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Payment Status:</label>
                  <select
                    value={walkIn.paymentType}
                    onChange={(e) => setWalkIn({ ...walkIn, paymentType: e.target.value })}
                    className="form-select"
                  >
                    <option value="full">100% Full Paid</option>
                    <option value="deposit">Token Deposit Paid</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Amount Collected:</label>
                  <div className="input-prefix-wrapper">
                    <span className="input-prefix-badge">₹</span>
                    <input
                      type="text"
                      value={String(walkIn.amount || '').replace(/^₹\s*/, '')}
                      onChange={(e) => setWalkIn({ ...walkIn, amount: e.target.value })}
                      className="form-input"
                      placeholder="1200"
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowWalkInModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-submit">
                  Confirm &amp; Check In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PURGE CONFIRMATION MODAL (HIGH SECURITY) */}
      {purgeModal.isOpen && (
        <div className="modal-overlay" onClick={() => !isPurgingDb && setPurgeModal({ ...purgeModal, isOpen: false })}>
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()} 
            style={{ maxWidth: '580px', border: '1px solid #ef4444', boxShadow: '0 20px 50px rgba(239, 68, 68, 0.25)' }}
          >
            <button
              type="button"
              className="modal-close-btn"
              disabled={isPurgingDb}
              onClick={() => setPurgeModal({ ...purgeModal, isOpen: false })}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#ff6b6b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Trash2 size={24} />
              </div>
              <div>
                <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ff6b6b', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                  High-Security Operation
                </span>
                <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.35rem', color: 'var(--brand-cream)' }}>
                  Purge Calendar Year {purgeModal.year} Data
                </h3>
              </div>
            </div>

            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              marginBottom: '1.25rem',
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}>
              <p style={{ margin: '0 0 0.5rem', color: '#ff8a8a', fontWeight: 600 }}>
                ⚠️ You are about to permanently erase {purgeModal.totalBookings} booking &amp; payment records for calendar year {purgeModal.year} from the database.
              </p>
              <ul style={{ margin: '0 0 0.5rem 1.25rem', padding: 0 }}>
                <li>This action immediately frees up active database storage.</li>
                <li>Your generated PDF ledger in the <strong>Archive Vault</strong> remains preserved permanently.</li>
                <li>This operation cannot be reversed.</li>
              </ul>
            </div>

            {purgeModal.error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                color: '#ff6b6b',
                padding: '0.65rem 1rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.86rem'
              }}>
                <AlertCircle size={16} /> {purgeModal.error}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ color: 'var(--brand-cream)' }}>
                To confirm permanent database erasure, type <strong style={{ color: '#ff6b6b', letterSpacing: '0.05em' }}>CONFIRM PURGE {purgeModal.year}</strong> below:
              </label>
              <input
                type="text"
                value={purgeModal.confirmInput}
                onChange={(e) => setPurgeModal({ ...purgeModal, confirmInput: e.target.value, error: '' })}
                placeholder={`CONFIRM PURGE ${purgeModal.year}`}
                className="form-input"
                style={{ borderColor: purgeModal.confirmInput === `CONFIRM PURGE ${purgeModal.year}` ? '#ef4444' : 'var(--border-strong)', fontFamily: 'monospace', letterSpacing: '0.05em' }}
                disabled={isPurgingDb}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setPurgeModal({ ...purgeModal, isOpen: false })}
                className="btn btn-outline"
                disabled={isPurgingDb}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPurge}
                disabled={isPurgingDb || purgeModal.confirmInput.trim() !== `CONFIRM PURGE ${purgeModal.year}`}
                className="btn"
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: '1px solid #dc2626',
                  opacity: (isPurgingDb || purgeModal.confirmInput.trim() !== `CONFIRM PURGE ${purgeModal.year}`) ? 0.5 : 1,
                  cursor: (isPurgingDb || purgeModal.confirmInput.trim() !== `CONFIRM PURGE ${purgeModal.year}`) ? 'not-allowed' : 'pointer'
                }}
              >
                {isPurgingDb ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Purging Database...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} /> Permanently Erase &amp; Free DB Space
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP GLOBAL ACTION CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        details={confirmModal.details}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        type={confirmModal.type}
      />

      {/* 10-Second Undo Window with Draining Countdown Ring */}
      {undoState && (
        <aside
          role="status"
          aria-live="polite"
          aria-label="Undo deletion window"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-md)',
            padding: '0.65rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7)',
            animation: 'fadeIn 0.15s ease-out',
            color: 'var(--text-primary)'
          }}
        >
          {/* SVG Draining Countdown Ring */}
          <div style={{ position: 'relative', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 32 32" style={{ transform: 'rotate(-90deg)' }}>
              <circle
                cx="16"
                cy="16"
                r="13"
                fill="none"
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="2.5"
              />
              <circle
                cx="16"
                cy="16"
                r="13"
                fill="none"
                stroke="var(--brand-orange)"
                strokeWidth="2.5"
                strokeDasharray={2 * Math.PI * 13}
                strokeDashoffset={2 * Math.PI * 13 * (1 - undoState.remainingSeconds / 10)}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.1s linear' }}
              />
            </svg>
            <span style={{ position: 'absolute', fontSize: '0.68rem', fontWeight: 700, color: 'var(--brand-cream)', fontVariantNumeric: 'tabular-nums' }}>
              {Math.ceil(undoState.remainingSeconds)}
            </span>
          </div>

          {/* Echoed deletion count */}
          <span style={{ fontSize: '0.8125rem', color: 'var(--brand-cream)', fontWeight: 500, letterSpacing: '-0.01em' }}>
            Deleted {undoState.count} {undoState.count === 1 ? 'reservation' : 'reservations'}
          </span>

          {/* Undo Action with keyboard shortcut */}
          <button
            type="button"
            onClick={handleUndoDelete}
            className="btn btn-secondary btn-sm"
            style={{
              height: '28px',
              fontSize: '0.75rem',
              padding: '0 0.65rem',
              gap: '0.35rem',
              borderColor: 'var(--brand-olive-bright)',
              color: 'var(--brand-olive-bright)',
              background: 'transparent'
            }}
          >
            <span>Undo</span>
            <kbd className="kbd" style={{ fontSize: '0.65rem', padding: '1px 4px' }}>Z</kbd>
          </button>

          {/* Finalize / Dismiss button */}
          <button
            type="button"
            onClick={finalizePendingDelete}
            aria-label="Dismiss undo notification"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Dismiss and delete permanently now"
          >
            <X size={14} />
          </button>
        </aside>
      )}
    </div>
  );
}
