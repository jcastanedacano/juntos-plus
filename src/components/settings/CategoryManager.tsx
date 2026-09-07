import { useState, useCallback } from 'react';
import { X, Eye, EyeOff, Pencil, Trash2, Plus, Check } from 'lucide-react';
import { Category, TransactionType } from '../../types';
import { defaultCategories } from '../../data/categories';
import {
  getCustomCategories,
  getHiddenCategoryIds,
  addCustomCategory,
  updateCustomCategory,
  deleteCustomCategory,
  toggleHideDefault,
  isDefaultCategory,
  generateCategoryId,
} from '../../utils/categoryHelpers';

interface CategoryManagerProps {
  onClose: () => void;
  /** Called after any change so parent can re-render */
  onChange?: () => void;
}

const EMOJI_OPTIONS = [
  '🍔', '🚗', '🛍️', '🎮', '📄', '⚕️', '📚', '🏠', '📱', '💸',
  '💰', '💼', '📈', '🎁', '💵', '🐾', '✈️', '☕', '🎬', '🏋️',
  '👶', '💊', '🎨', '🔧', '🚌', '🍺', '📦', '🧹', '💇', '🛒',
];

const COLOR_OPTIONS = [
  '#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#95A5A6', '#FF8B94',
  '#C7CEEA', '#FFDAC1', '#B4A7D6', '#FAD4B8', '#02B08D', '#60A5FA',
];

type EditState = { id?: string; name: string; icon: string; color: string; type: TransactionType };

const emptyEdit = (type: TransactionType): EditState => ({
  name: '', icon: '📦', color: '#60A5FA', type,
});

export function CategoryManager({ onClose, onChange }: CategoryManagerProps) {
  const [tab, setTab] = useState<TransactionType>('expense');
  const [editState, setEditState] = useState<EditState | null>(null);
  const [, forceUpdate] = useState(0);

  const refresh = useCallback(() => {
    forceUpdate(n => n + 1);
    onChange?.();
  }, [onChange]);

  const hiddenIds = getHiddenCategoryIds();
  const customCats = getCustomCategories();
  const defaults = defaultCategories.filter(c => c.type === tab);
  const customs = customCats.filter(c => c.type === tab);

  const handleSave = () => {
    if (!editState || !editState.name.trim()) return;
    if (editState.id) {
      updateCustomCategory(editState.id, {
        name: editState.name.trim(),
        icon: editState.icon,
        color: editState.color,
        type: editState.type,
      });
    } else {
      addCustomCategory({
        name: editState.name.trim(),
        icon: editState.icon,
        color: editState.color,
        type: editState.type,
      });
    }
    setEditState(null);
    refresh();
  };

  const handleDelete = (id: string) => {
    deleteCustomCategory(id);
    refresh();
  };

  const handleToggleHide = (id: string) => {
    toggleHideDefault(id);
    refresh();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal catmgr" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Gestionar categorías</h2>
          <button className="close-btn" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="type-toggle" style={{ margin: '0 1.25rem' }}>
          <button
            type="button"
            className={`type-btn ${tab === 'expense' ? 'active expense' : ''}`}
            onClick={() => { setTab('expense'); setEditState(null); }}
          >
            💸 Gastos
          </button>
          <button
            type="button"
            className={`type-btn ${tab === 'income' ? 'active income' : ''}`}
            onClick={() => { setTab('income'); setEditState(null); }}
          >
            💰 Ingresos
          </button>
        </div>

        <div className="catmgr-body">
          {/* Default categories */}
          <div className="catmgr-section-label">Predeterminadas</div>
          {defaults.map(cat => {
            const hidden = hiddenIds.includes(cat.id);
            return (
              <div key={cat.id} className={`catmgr-row ${hidden ? 'catmgr-row--hidden' : ''}`}>
                <span className="catmgr-icon" style={{ backgroundColor: cat.color + '20', color: cat.color }}>
                  {cat.icon}
                </span>
                <span className="catmgr-name">{cat.name}</span>
                <button
                  className="catmgr-action"
                  onClick={() => handleToggleHide(cat.id)}
                  title={hidden ? 'Mostrar' : 'Ocultar'}
                >
                  {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            );
          })}

          {/* Custom categories */}
          {customs.length > 0 && (
            <>
              <div className="catmgr-section-label" style={{ marginTop: '1rem' }}>Personalizadas</div>
              {customs.map(cat => (
                <div key={cat.id} className="catmgr-row">
                  <span className="catmgr-icon" style={{ backgroundColor: cat.color + '20', color: cat.color }}>
                    {cat.icon}
                  </span>
                  <span className="catmgr-name">{cat.name}</span>
                  <button
                    className="catmgr-action"
                    onClick={() => setEditState({
                      id: cat.id, name: cat.name, icon: cat.icon, color: cat.color, type: cat.type,
                    })}
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="catmgr-action catmgr-action--danger"
                    onClick={() => handleDelete(cat.id)}
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </>
          )}

          {/* Add / Edit form */}
          {editState ? (
            <div className="catmgr-form">
              <div className="catmgr-form-title">
                {editState.id ? 'Editar categoría' : 'Nueva categoría'}
              </div>
              <input
                className="form-input"
                placeholder="Nombre de la categoría"
                maxLength={30}
                value={editState.name}
                onChange={e => setEditState({ ...editState, name: e.target.value })}
                autoFocus
              />

              {/* Emoji picker */}
              <div className="catmgr-picker-label">Icono</div>
              <div className="catmgr-emoji-grid">
                {EMOJI_OPTIONS.map(em => (
                  <button
                    key={em}
                    type="button"
                    className={`catmgr-emoji-btn ${editState.icon === em ? 'active' : ''}`}
                    onClick={() => setEditState({ ...editState, icon: em })}
                  >
                    {em}
                  </button>
                ))}
              </div>

              {/* Color picker */}
              <div className="catmgr-picker-label">Color</div>
              <div className="catmgr-color-grid">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`catmgr-color-btn ${editState.color === c ? 'active' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setEditState({ ...editState, color: c })}
                  >
                    {editState.color === c && <Check size={12} color="#fff" />}
                  </button>
                ))}
              </div>

              <div className="catmgr-form-actions">
                <button className="catmgr-btn catmgr-btn--cancel" onClick={() => setEditState(null)}>
                  Cancelar
                </button>
                <button
                  className="catmgr-btn catmgr-btn--save"
                  disabled={!editState.name.trim()}
                  onClick={handleSave}
                >
                  {editState.id ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="catmgr-add-btn"
              onClick={() => setEditState(emptyEdit(tab))}
            >
              <Plus size={16} />
              Nueva categoría
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
