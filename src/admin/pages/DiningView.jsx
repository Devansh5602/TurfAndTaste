import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { 
  Coffee, 
  Utensils, 
  Search, 
  RefreshCw, 
  Plus, 
  Edit3, 
  CheckCircle, 
  X, 
  Clock, 
  Layers, 
  DollarSign,
  Image as ImageIcon,
  Tag,
  AlertCircle
} from 'lucide-react';

export default function DiningView({ showToast }) {
  const { can } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('outlets'); // outlets, menu
  const [stalls, setStalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStallId, setSelectedStallId] = useState('all');

  // Outlet Modal State
  const [showStallModal, setShowStallModal] = useState(false);
  const [editingStall, setEditingStall] = useState(null);
  const [stallId, setStallId] = useState('');
  const [stallSlug, setStallSlug] = useState('');
  const [stallName, setStallName] = useState('');
  const [stallType, setStallType] = useState('food'); // food, parlour
  const [stallShortDesc, setStallShortDesc] = useState('');
  const [stallDesc, setStallDesc] = useState('');
  const [stallCoverUrl, setStallCoverUrl] = useState('');
  const [stallStatus, setStallStatus] = useState('active');

  // Item Modal State
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemId, setItemId] = useState('');
  const [itemStallId, setItemStallId] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPriceRupees, setItemPriceRupees] = useState('');
  const [itemDiet, setItemDiet] = useState('veg');
  const [itemAvailable, setItemAvailable] = useState(true);
  const [itemImageUrl, setItemImageUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchDiningData = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminFood();
      setStalls(res?.stalls || []);
    } catch (err) {
      if (showToast) showToast('Failed to load dining management data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiningData();
  }, []);

  // Collect all menu items across all stalls for the inventory feed
  const allMenuItems = stalls.flatMap(s => (s.menuItems || []).map(item => ({
    ...item,
    stallName: s.name,
    stallSlug: s.slug
  })));

  // Outlet modal handlers
  const openCreateStallModal = () => {
    setEditingStall(null);
    setStallId(`stall_${Date.now().toString(36)}`);
    setStallSlug('');
    setStallName('');
    setStallType('food');
    setStallShortDesc('');
    setStallDesc('');
    setStallCoverUrl('');
    setStallStatus('active');
    setModalError('');
    setShowStallModal(true);
  };

  const openEditStallModal = (st) => {
    setEditingStall(st);
    setStallId(st.id);
    setStallSlug(st.slug || '');
    setStallName(st.name || '');
    setStallType(st.stallType || 'food');
    setStallShortDesc(st.shortDescription || '');
    setStallDesc(st.description || '');
    setStallCoverUrl(st.coverImageUrl || '');
    setStallStatus(st.status || 'active');
    setModalError('');
    setShowStallModal(true);
  };

  const handleSaveStall = async (e) => {
    e.preventDefault();
    if (!stallName.trim()) {
      setModalError('Outlet name is required.');
      return;
    }
    const slug = stallSlug.trim() || stallName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const id = editingStall ? editingStall.id : (stallId.trim() || `stall-${slug}`);

    setSubmitting(true);
    setModalError('');
    try {
      const payload = {
        id,
        slug,
        name: stallName.trim(),
        stallType,
        shortDescription: stallShortDesc.trim() || null,
        description: stallDesc.trim() || null,
        coverImageUrl: stallCoverUrl.trim() || null,
        status: stallStatus
      };

      const res = await api.saveFoodStall(payload, !editingStall);
      if (res.success) {
        if (showToast) showToast(editingStall ? 'Outlet updated' : 'Outlet created');
        setShowStallModal(false);
        fetchDiningData();
      } else {
        setModalError(res.error || 'Failed to save food outlet');
      }
    } catch (err) {
      setModalError(err.message || 'Error occurred while saving outlet');
    } finally {
      setSubmitting(false);
    }
  };

  // Item modal handlers
  const openCreateItemModal = () => {
    setEditingItem(null);
    setItemId(`item_${Date.now().toString(36)}`);
    setItemStallId(stalls[0]?.id || '');
    setItemCategoryId('');
    setItemName('');
    setItemDesc('');
    setItemPriceRupees('');
    setItemDiet('veg');
    setItemAvailable(true);
    setItemImageUrl('');
    setModalError('');
    setShowItemModal(true);
  };

  const openEditItemModal = (item) => {
    setEditingItem(item);
    setItemId(item.id);
    setItemStallId(item.stallId || stalls[0]?.id || '');
    setItemCategoryId(item.categoryId || '');
    setItemName(item.name || '');
    setItemDesc(item.description || '');
    setItemPriceRupees(String(Math.round((item.pricePaise || 0) / 100)));
    setItemDiet(item.dietaryType || 'veg');
    setItemAvailable(Boolean(item.available));
    setItemImageUrl(item.imageUrl || '');
    setModalError('');
    setShowItemModal(true);
  };

  const handleToggleItemAvailability = async (item) => {
    try {
      const res = await api.saveFoodItem({
        id: item.id,
        stallId: item.stallId,
        name: item.name,
        pricePaise: item.pricePaise,
        available: !item.available
      }, false);
      if (res.success) {
        if (showToast) showToast(`${item.name} marked as ${!item.available ? 'available' : 'sold out'}`);
        fetchDiningData();
      }
    } catch (err) {
      if (showToast) showToast('Error updating item availability', 'error');
    }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemName.trim()) {
      setModalError('Item name is required.');
      return;
    }
    const priceNum = parseFloat(itemPriceRupees);
    if (isNaN(priceNum) || priceNum < 0) {
      setModalError('A valid price in Rupees is required.');
      return;
    }

    setSubmitting(true);
    setModalError('');
    try {
      const payload = {
        id: editingItem ? editingItem.id : (itemId.trim() || `item-${Date.now().toString(36)}`),
        stallId: itemStallId,
        categoryId: itemCategoryId || null,
        name: itemName.trim(),
        description: itemDesc.trim() || null,
        pricePaise: Math.round(priceNum * 100),
        dietaryType: itemDiet,
        available: itemAvailable,
        imageUrl: itemImageUrl.trim() || null
      };

      const res = await api.saveFoodItem(payload, !editingItem);
      if (res.success) {
        if (showToast) showToast(editingItem ? 'Menu item updated' : 'Menu item created');
        setShowItemModal(false);
        fetchDiningData();
      } else {
        setModalError(res.error || 'Failed to save menu item');
      }
    } catch (err) {
      setModalError(err.message || 'Error occurred while saving item');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter menu items
  const filteredMenuItems = allMenuItems.filter(item => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      String(item.name || '').toLowerCase().includes(term) ||
      String(item.stallName || '').toLowerCase().includes(term);

    const matchesStall = selectedStallId === 'all' || item.stallId === selectedStallId;

    return matchesSearch && matchesStall;
  });

  return (
    <div className="admin-page-container">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <span className="admin-eyebrow">HOSPITALITY CMS</span>
          <h2 className="admin-page-title">Dining Management</h2>
          <p className="admin-page-subtitle">Configure clubhouse cafe, parlour outlets, categories & menu tariffs</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="admin-btn secondary" 
            onClick={fetchDiningData} 
            disabled={loading}
            aria-label="Refresh Dining"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
          {activeTab === 'outlets' ? (
            <button 
              id="admin-btn-add-outlet"
              className="admin-btn primary" 
              onClick={openCreateStallModal}
            >
              <Plus size={14} />
              <span>Add Outlet</span>
            </button>
          ) : (
            <button 
              id="admin-btn-create-menu-item"
              className="admin-btn primary" 
              onClick={openCreateItemModal}
            >
              <Plus size={14} />
              <span>Create Item</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Module Tabs */}
      <div className="admin-tabs-row" style={{ marginBottom: '16px' }}>
        <button 
          className={`admin-tab-btn ${activeTab === 'outlets' ? 'active' : ''}`}
          onClick={() => setActiveTab('outlets')}
        >
          <Coffee size={15} />
          <span>Configured Outlets ({stalls.length})</span>
        </button>
        <button 
          className={`admin-tab-btn ${activeTab === 'menu' ? 'active' : ''}`}
          onClick={() => setActiveTab('menu')}
        >
          <Utensils size={15} />
          <span>Menu Inventory ({allMenuItems.length})</span>
        </button>
      </div>

      {/* Outlets View */}
      {activeTab === 'outlets' && (
        <div className="admin-feed-section">
          {loading ? (
            <div className="admin-empty-state">
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
              <p>Loading hospitality outlets...</p>
            </div>
          ) : stalls.length === 0 ? (
            <div className="admin-empty-state">
              <Coffee size={32} style={{ color: '#8D9490', margin: '0 auto 12px' }} />
              <p>No dining outlets configured yet. Click "Add Outlet" to configure one.</p>
            </div>
          ) : (
            <div className="admin-records-list">
              {stalls.map((st) => (
                <div key={st.id} className="admin-card admin-outlet-card">
                  <div className="admin-outlet-top">
                    <span className={`admin-status-badge ${st.status === 'active' ? 'confirmed' : 'pending'}`}>
                      {st.status === 'active' ? '• Active' : '• Draft'}
                    </span>
                    <span className="admin-outlet-type-tag">
                      {st.stallType === 'parlour' ? 'Creamery & Parlour' : 'Clubhouse Cafe'}
                    </span>
                  </div>

                  <h3 className="admin-outlet-title">{st.name}</h3>
                  {st.shortDescription && (
                    <p className="admin-outlet-desc">{st.shortDescription}</p>
                  )}

                  <div className="admin-outlet-meta-row">
                    <div className="admin-meta-pill">
                      <Layers size={12} style={{ marginRight: '4px' }} />
                      <span>{(st.categories || []).length} Categories</span>
                    </div>
                    <div className="admin-meta-pill">
                      <Utensils size={12} style={{ marginRight: '4px' }} />
                      <span>{(st.menuItems || []).length} Menu Items</span>
                    </div>
                  </div>

                  <div className="admin-outlet-footer">
                    <span className="admin-record-ref">Ref: {st.slug}</span>
                    <button 
                      className="admin-btn secondary compact"
                      onClick={() => openEditStallModal(st)}
                    >
                      <Edit3 size={13} />
                      <span>Edit Outlet</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Menu Items View */}
      {activeTab === 'menu' && (
        <div>
          {/* Search & Filter Bar */}
          <div className="admin-search-filter-bar">
            <div className="admin-search-wrap">
              <Search size={16} className="admin-search-icon" />
              <input
                id="admin-dining-item-search"
                type="text"
                className="admin-search-input"
                placeholder="Search menu items by dish name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button className="admin-search-clear" onClick={() => setSearchTerm('')}>
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="admin-filter-pills" role="tablist">
              <button 
                className={`admin-filter-pill ${selectedStallId === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedStallId('all')}
              >
                All Outlets
              </button>
              {stalls.map((s) => (
                <button 
                  key={s.id}
                  className={`admin-filter-pill ${selectedStallId === s.id ? 'active' : ''}`}
                  onClick={() => setSelectedStallId(s.id)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-feed-section">
            <div className="admin-feed-header">
              <span className="admin-feed-title">Menu Items ({filteredMenuItems.length})</span>
              <span className="admin-feed-badge">Informational Catalog</span>
            </div>

            {loading ? (
              <div className="admin-empty-state">
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
                <p>Loading menu items...</p>
              </div>
            ) : filteredMenuItems.length === 0 ? (
              <div className="admin-empty-state">
                <Utensils size={32} style={{ color: '#8D9490', margin: '0 auto 12px' }} />
                <p>No dishes found matching your search.</p>
              </div>
            ) : (
              <div className="admin-records-list">
                {filteredMenuItems.map((item) => {
                  const priceRupees = Math.round((item.pricePaise || 0) / 100);
                  const isAvailable = Boolean(item.available);

                  return (
                    <div key={item.id} className="admin-card admin-dish-card">
                      <div className="admin-dish-top">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`admin-diet-dot ${item.dietaryType || 'veg'}`} title={item.dietaryType} />
                          <h4 className="admin-dish-title">{item.name}</h4>
                        </div>
                        <span className="admin-dish-price">₹{priceRupees}</span>
                      </div>

                      {item.description && (
                        <p className="admin-dish-desc">{item.description}</p>
                      )}

                      <div className="admin-dish-footer">
                        <span className="admin-dish-outlet">{item.stallName}</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className={`admin-toggle-switch ${isAvailable ? 'on' : 'off'}`}
                            onClick={() => handleToggleItemAvailability(item)}
                            title="Toggle Live Availability"
                          >
                            <span className="toggle-slider" />
                            <span className="toggle-label">{isAvailable ? 'Available' : 'Sold Out'}</span>
                          </button>
                          <button 
                            className="admin-btn secondary compact"
                            onClick={() => openEditItemModal(item)}
                          >
                            <Edit3 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Outlet Modal */}
      {showStallModal && (
        <div className="admin-modal-overlay" onClick={() => setShowStallModal(false)}>
          <div className="admin-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <span className="admin-eyebrow">HOSPITALITY OUTLET</span>
                <h3 className="admin-modal-title">
                  {editingStall ? 'Edit Outlet' : 'Add New Outlet'}
                </h3>
              </div>
              <button className="admin-modal-close" onClick={() => setShowStallModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStall} className="admin-modal-body">
              {modalError && (
                <div className="admin-form-error-banner">{modalError}</div>
              )}

              <div className="admin-form-group">
                <label className="admin-form-label required" htmlFor="stall-form-name">
                  Outlet Name *
                </label>
                <input
                  id="stall-form-name"
                  type="text"
                  className="admin-form-input"
                  placeholder="e.g. The Pavilion Cafe & Lounge"
                  value={stallName}
                  onChange={(e) => setStallName(e.target.value)}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="stall-form-type">
                  Outlet Category / Type
                </label>
                <select
                  id="stall-form-type"
                  className="admin-form-select"
                  value={stallType}
                  onChange={(e) => setStallType(e.target.value)}
                >
                  <option value="food">Clubhouse Cafe / Dining</option>
                  <option value="parlour">Ice Cream / Shakes Parlour</option>
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="stall-form-short-desc">
                  Short Description
                </label>
                <input
                  id="stall-form-short-desc"
                  type="text"
                  className="admin-form-input"
                  placeholder="e.g. Fresh juices, artisan coffee, clubhouse bites"
                  value={stallShortDesc}
                  onChange={(e) => setStallShortDesc(e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="stall-form-status">
                  Publication Status
                </label>
                <select
                  id="stall-form-status"
                  className="admin-form-select"
                  value={stallStatus}
                  onChange={(e) => setStallStatus(e.target.value)}
                >
                  <option value="active">Active (Visible to Patrons)</option>
                  <option value="draft">Draft (Internal Roster)</option>
                </select>
              </div>

              <div className="admin-modal-footer" style={{ padding: '16px 0 0' }}>
                <button 
                  type="submit" 
                  className="admin-btn primary full"
                  disabled={submitting}
                >
                  <CheckCircle size={14} />
                  <span>{submitting ? 'Saving...' : editingStall ? 'Save Outlet Changes' : 'Create Outlet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Menu Item Modal */}
      {showItemModal && (
        <div className="admin-modal-overlay" onClick={() => setShowItemModal(false)}>
          <div className="admin-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <span className="admin-eyebrow">MENU DISH ITEM</span>
                <h3 className="admin-modal-title">
                  {editingItem ? 'Edit Menu Item' : 'Create Menu Item'}
                </h3>
              </div>
              <button className="admin-modal-close" onClick={() => setShowItemModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="admin-modal-body">
              {modalError && (
                <div className="admin-form-error-banner">{modalError}</div>
              )}

              <div className="admin-form-group">
                <label className="admin-form-label required" htmlFor="item-form-stall">
                  Assigned Outlet *
                </label>
                <select
                  id="item-form-stall"
                  className="admin-form-select"
                  value={itemStallId}
                  onChange={(e) => setItemStallId(e.target.value)}
                  required
                >
                  {stalls.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label required" htmlFor="item-form-name">
                  Dish / Beverage Name *
                </label>
                <input
                  id="item-form-name"
                  type="text"
                  className="admin-form-input"
                  placeholder="e.g. Masala Chai & Maska Bun"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  required
                />
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group" style={{ flex: 1 }}>
                  <label className="admin-form-label required" htmlFor="item-form-price">
                    Price in INR (₹) *
                  </label>
                  <input
                    id="item-form-price"
                    type="number"
                    className="admin-form-input"
                    placeholder="e.g. 120"
                    min="0"
                    value={itemPriceRupees}
                    onChange={(e) => setItemPriceRupees(e.target.value)}
                    required
                  />
                </div>

                <div className="admin-form-group" style={{ flex: 1 }}>
                  <label className="admin-form-label" htmlFor="item-form-diet">
                    Dietary Classification
                  </label>
                  <select
                    id="item-form-diet"
                    className="admin-form-select"
                    value={itemDiet}
                    onChange={(e) => setItemDiet(e.target.value)}
                  >
                    <option value="veg">Vegetarian</option>
                    <option value="non_veg">Non-Veg</option>
                    <option value="egg">Contains Egg</option>
                    <option value="vegan">Vegan</option>
                  </select>
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="item-form-desc">
                  Dish Description
                </label>
                <input
                  id="item-form-desc"
                  type="text"
                  className="admin-form-input"
                  placeholder="e.g. Freshly brewed ginger tea served with buttered pav..."
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={itemAvailable}
                    onChange={(e) => setItemAvailable(e.target.checked)}
                  />
                  <span>Mark Item as Available (In-Stock)</span>
                </label>
              </div>

              <div className="admin-modal-footer" style={{ padding: '16px 0 0' }}>
                <button 
                  type="submit" 
                  className="admin-btn primary full"
                  disabled={submitting}
                >
                  <CheckCircle size={14} />
                  <span>{submitting ? 'Saving...' : editingItem ? 'Save Item Changes' : 'Create Item'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
